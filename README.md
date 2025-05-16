# Vault Security Monitoring System

## Overview

A comprehensive video surveillance system designed specifically for banking environments, featuring vault monitoring, ATM surveillance, and lobby security with AI-powered person detection and violation recording.

![Screenshot](Screenshot%202025-05-14%20124522.jpg)
![Alt text](image.png)


## Features

### 🏦 Banking-Specific Monitoring
- **Vault Security**: Two-person rule enforcement
- **ATM Monitoring**: Loitering and skimming detection
- **Cash Counter**: Transaction compliance monitoring

### 🛡️ Security Features
- Real-time person detection with YOLO AI
- Violation recording with automatic clip generation
- 180-day footage retention (RBI compliance)
- Multi-user access with role-based permissions
- Audit trail for all activities

### 📊 Dashboard Features
- Live video streaming
- Real-time metrics and alerts
- Violation history and playback
- System health monitoring
- Export capabilities for compliance

## Prerequisites

### System Requirements
- Python 3.8 or higher
- MySQL 8.0 or higher
- GPU with CUDA support (recommended)
- Minimum 8GB RAM
- 50GB free disk space for recordings

### Hardware Requirements
- IP cameras with RTSP support
- Stable network connection
- Dedicated server/workstation

## Installation

### 1. Clone Repository
```bash
git clone <link to the repo>
cd vault security system
```

### 2. Create Virtual Environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Install CUDA (for GPU support)
```bash
# Follow NVIDIA CUDA installation guide for your OS
# Verify installation
nvidia-smi
```

## Configuration

### 1. Environment Variables
Create a `.env` file in the root directory:

```env
# Database Configuration
MYSQL_HOST=localhost
MYSQL_USER=bank_security
MYSQL_PASSWORD=your_secure_password
MYSQL_DATABASE=<db name>bank_security
MYSQL_PORT=3306

# AI Models
DETECTION_MODEL_PATH=models/yolov8n.pt
POSE_ESTIMATION_MODEL_PATH=models/yolov8n-pose.pt

# Storage Configuration
GCP_BUCKET_NAME=your-gcs-bucket  # Optional for cloud storage
FRAMES_OUTPUT_DIR=recordings

# Security
SECRET_KEY=your-jwt-secret-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_DAYS=30

# Camera Configuration
RTSP_URLS=<rtsp url>

# Performance
BATCH_SIZE=4
READER_FPS_LIMIT=5
MAX_QUEUE_SIZE=200
```

### 2. Database Setup
```bash
# Create database
mysql -u root -p
CREATE DATABASE _bank_security;
CREATE USER 'bank_security'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON south_india_bank_security.* TO 'bank_security'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Import schema
mysql -u bank_security -p bank_security < schema.sql
```

### 3. Camera Configuration
Edit `camera_config.sql` or use the web interface to configure:
- Camera locations (vault, ATM, lobby)
- Detection zones
- Security rules and thresholds

### 4. Download AI Models
```bash
# Create models directory
mkdir models

# Download YOLO models (will auto-download on first run)
python -c "from ultralytics import YOLO; model = YOLO('yolov8n.pt')"
```

## Running the System

### 1. Start the Monitoring System
```bash
# Run the main application
python main.py

# or with specific configuration
python main.py --config-file custom_config.yaml
```

### 2. Start the Web Dashboard (Optional)
```bash
# In a separate terminal
python api.py
```

### 3. Access Dashboard
Open your browser and navigate to:
- **Dashboard**: http://localhost:5000
- **API Documentation**: http://localhost:8000/docs

## Usage

### Starting Monitoring
1. Open the dashboard
2. Verify camera connections
3. Click "START MONITORING"
4. Monitor live feeds and violations

### Configuring Rules
1. Navigate to "Settings" in dashboard
2. Select camera
3. Define zones by drawing on video feed
4. Set violation rules (person count, time limits, etc.)

### Viewing Violations
1. Check "Recent Violations" panel
2. Click "Play Clip" to view recorded violation
3. Export violations for compliance

## Camera Configuration Examples

### Vault Camera Configuration
```yaml
camera:
  camera_id: "VAULT_01"
  name: "Main Vault Entry"
  stream_url: "rtsp url"
  type: "vault_monitoring"

zones:
  restricted:
    - name: "Vault Interior"
      coordinates: [[100, 100], [500, 100], [500, 400], [100, 400]]
      type: "restricted_access"

rules:
  - name: "Two Person Rule"
    event_type: "vault_access_violation"
    parameters:
      required_people: 2
      violation_threshold: 10  # seconds
```

### ATM Camera Configuration
```yaml
camera:
  camera_id: "ATM_01"
  name: "ATM External"
  stream_url: "rtsp url"
  type: "atm_monitoring"

zones:
  monitoring:
    - name: "ATM Area"
      coordinates: [[50, 50], [600, 50], [600, 450], [50, 450]]
      type: "atm_zone"

rules:
  - name: "Loitering Detection"
    event_type: "atm_loitering"
    parameters:
      max_time: 300  # 5 minutes
      detection_threshold: 0.7
```

## Troubleshooting

### Common Issues

#### 1. Camera Connection Issues
```bash
# Test RTSP connection
python test_rtsp.py --url rtsp://your-camera-url

# Check camera settings
ping 192.168.1.100  # Replace with camera IP
```

#### 2. Database Connection Issues
```bash
# Test database connection
python test_db.py

# Check MySQL service
sudo systemctl status mysql
```

#### 3. GPU/CUDA Issues
```bash
# Verify CUDA installation
nvidia-smi
python -c "import torch; print(torch.cuda.is_available())"
```

#### 4. Model Loading Issues
```bash
# Clear model cache and re-download
rm -rf ~/.cache/ultralytics
python main.py  # Will re-download models
```

### Performance Optimization

#### For CPU-only systems:
```env
# In .env file
CUDA_VISIBLE_DEVICES=""
BATCH_SIZE=1
READER_FPS_LIMIT=2
```

#### For high-performance systems:
```env
# In .env file
BATCH_SIZE=8
READER_FPS_LIMIT=15
ENABLE_HALF_PRECISION=true
```

## Maintenance

### Daily Tasks
- Check system status via dashboard
- Review violation logs
- Monitor disk space in recordings directory

### Weekly Tasks
- Export violation reports
- Check camera connectivity
- Review system performance metrics

### Monthly Tasks
- Update AI models if available
- Clean old recordings (per retention policy)
- Review and update camera configurations

## Compliance

### RBI Compliance Features
- 180-day footage retention
- Audit trails for all access
- Encrypted data storage
- Role-based access control
- Automated reporting

### Export Compliance Data
```bash
# Export violations for specific date range
python export_compliance.py --start-date 2024-01-01 --end-date 2024-01-31

# Generate audit report
python generate_audit_report.py --month 2024-01
```

## API Documentation

### Start Monitoring
```bash
curl -X POST http://localhost:8000/api/start_monitoring
```

### Get System Status
```bash
curl http://localhost:8000/api/status
```

### Get Violations
```bash
curl http://localhost:8000/api/violations?limit=10
```

## Backup and Recovery

### Database Backup
```bash
# Create backup
mysqldump -u bank_security -p south_india_bank_security > backup_$(date +%Y%m%d).sql

# Restore backup
mysql -u bank_security -p south_india_bank_security < backup_20240101.sql
```

### Recordings Backup
```bash
# Sync recordings to backup location
rsync -av recordings/ /backup/path/recordings/
```

## Development

### Running Tests
```bash
# Run all tests
python -m pytest tests/

# Run specific test
python -m pytest tests/test_camera_models.py
```

### Code Formatting
```bash
# Format code
black .
isort .
```

### Adding New Camera Models
1. Create new model in `camera_models/`
2. Extend `CameraModelBase`
3. Add to `CAMERA_MODEL_MAPPING` in `video_processor.py`
4. Update database schema if needed

## Support

### Logs Location
- System logs: `logs/`
- Camera logs: `logs/camera_*.log`
- Database logs: `logs/database.log`

### Getting Help
1. Check logs for errors
2. Review this documentation
3. Contact system administrator
4. Create issue in repository

## License

© 2024 All rights reserved.

## Version History

- **v1.0.0** - Initial release with vault monitoring
- **v1.1.0** - Added ATM monitoring
- **v1.2.0** - Added lobby surveillance
- **v1.3.0** - Added compliance reporting
- **v2.0.0** - Complete system rewrite with enhanced AI




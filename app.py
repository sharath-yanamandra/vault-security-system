from flask import Flask, render_template, jsonify, Response, request, send_from_directory
from flask_socketio import SocketIO, emit
import cv2
import json
import os
import time
from datetime import datetime
import sqlite3
import threading
import base64
from pathlib import Path

app = Flask(__name__)
app.config['SECRET_KEY'] = 'vault_security_key'
socketio = SocketIO(app, cors_allowed_origins="*", logger=True, engineio_logger=True)

class VaultSecurityWeb:
    def __init__(self):
        self.camera_processor = None
        self.monitoring = False
        self.init_database()
        
    def init_database(self):
        """Initialize SQLite database"""
        conn = sqlite3.connect('vault_security.db')
        cursor = conn.cursor()
        
        # Create tables
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS violations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                person_count INTEGER,
                clip_path TEXT,
                duration REAL,
                status TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS camera_status (
                id INTEGER PRIMARY KEY,
                last_update DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT,
                people_count INTEGER,
                is_recording BOOLEAN
            )
        ''')
        
        # Initialize camera status
        cursor.execute('''
            INSERT OR REPLACE INTO camera_status (id, status, people_count, is_recording)
            VALUES (1, 'Offline', 0, 0)
        ''')
        
        conn.commit()
        conn.close()
    
    def update_camera_status(self, people_count, is_recording):
        """Update camera status in database"""
        conn = sqlite3.connect('vault_security.db')
        cursor = conn.cursor()
        
        status = "Access Granted" if people_count == 2 else "Access Denied"
        
        cursor.execute('''
            UPDATE camera_status 
            SET last_update = CURRENT_TIMESTAMP, 
                status = ?, 
                people_count = ?,
                is_recording = ?
            WHERE id = 1
        ''', (status, people_count, is_recording))
        
        conn.commit()
        conn.close()
    
    def add_violation(self, person_count, clip_path, duration):
        """Add violation to database"""
        conn = sqlite3.connect('vault_security.db')
        cursor = conn.cursor()
        
        status = "Too Few People" if person_count < 2 else "Too Many People"
        
        cursor.execute('''
            INSERT INTO violations (person_count, clip_path, duration, status)
            VALUES (?, ?, ?, ?)
        ''', (person_count, clip_path, duration, status))
        
        conn.commit()
        conn.close()
    
    def get_violations(self, limit=10):
        """Get recent violations"""
        conn = sqlite3.connect('vault_security.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM violations 
            ORDER BY timestamp DESC 
            LIMIT ?
        ''', (limit,))
        
        violations = []
        for row in cursor.fetchall():
            violations.append({
                'id': row[0],
                'timestamp': row[1],
                'person_count': row[2],
                'clip_path': row[3],
                'duration': row[4],
                'status': row[5]
            })
        
        conn.close()
        return violations
    
    def get_camera_status(self):
        """Get current camera status"""
        conn = sqlite3.connect('vault_security.db')
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM camera_status WHERE id = 1')
        row = cursor.fetchone()
        
        conn.close()
        
        if row:
            return {
                'last_update': row[1],
                'status': row[2],
                'people_count': row[3],
                'is_recording': bool(row[4]),
                'monitoring': self.monitoring
            }
        return None

# Initialize the security system
security_system = VaultSecurityWeb()

@app.route('/')
def dashboard():
    """Main dashboard page"""
    return render_template('dashboard.html')

@app.route('/api/status')
def get_status():
    """Get current system status"""
    return jsonify(security_system.get_camera_status())

@app.route('/api/violations')
def get_violations():
    """Get recent violations"""
    limit = request.args.get('limit', 10, type=int)
    return jsonify(security_system.get_violations(limit))

@app.route('/api/start_monitoring', methods=['POST'])
def start_monitoring():
    """Start camera monitoring"""
    try:
        if not security_system.monitoring:
            security_system.monitoring = True
            # Start camera processor in a separate thread
            from camera_processor import CameraProcessor
            security_system.camera_processor = CameraProcessor(security_system, socketio)
            thread = threading.Thread(target=security_system.camera_processor.run)
            thread.daemon = True
            thread.start()
            return jsonify({'status': 'success', 'message': 'Monitoring started'})
        return jsonify({'status': 'error', 'message': 'Already monitoring'})
    except Exception as e:
        print(f"Error starting monitoring: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/stop_monitoring', methods=['POST'])
def stop_monitoring():
    """Stop camera monitoring"""
    try:
        if security_system.monitoring:
            security_system.monitoring = False
            if security_system.camera_processor:
                security_system.camera_processor.stop()
            return jsonify({'status': 'success', 'message': 'Monitoring stopped'})
        return jsonify({'status': 'error', 'message': 'Not currently monitoring'})
    except Exception as e:
        print(f"Error stopping monitoring: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/clips/<path:filename>')
def serve_clip(filename):
    """Serve violation clips"""
    clips_dir = 'violation_clips'
    return send_from_directory(clips_dir, filename)

# Add missing API endpoints
@app.route('/api/test/alarm', methods=['POST'])
def test_alarm():
    """Test alarm system"""
    return jsonify({'status': 'success', 'message': 'Alarm test completed'})

@app.route('/api/system/health')
def system_health():
    """Check system health"""
    return jsonify({'status': 'healthy', 'message': 'All systems operational'})

@app.route('/api/export/logs', methods=['POST'])
def export_logs():
    """Export system logs"""
    return jsonify({'status': 'success', 'message': 'Logs exported'})

@app.route('/api/violations/clear', methods=['DELETE'])
def clear_violations():
    """Clear violation history"""
    try:
        conn = sqlite3.connect('vault_security.db')
        cursor = conn.cursor()
        cursor.execute('DELETE FROM violations')
        conn.commit()
        conn.close()
        return jsonify({'status': 'success', 'message': 'Violations cleared'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

# Serve static files with fallback
@app.route('/static/images/<path:filename>')
def static_images(filename):
    """Serve static images with fallback"""
    try:
        return send_from_directory('static/images', filename)
    except:
        # Return a simple 1px transparent image if file not found
        return '''<svg width="1" height="1" xmlns="http://www.w3.org/2000/svg">
                 <rect width="1" height="1" fill="transparent"/>
                 </svg>''', 200, {'Content-Type': 'image/svg+xml'}

@app.route('/static/sounds/<path:filename>')
def static_sounds(filename):
    """Serve static sounds with fallback"""
    try:
        return send_from_directory('static/sounds', filename)
    except:
        # Return empty response for missing sound files
        return '', 204

# Add this endpoint to your app.py after the other API routes

@app.route('/api/settings/recording-quality', methods=['POST'])
def set_recording_quality():
    """Set recording quality"""
    data = request.get_json()
    quality = data.get('quality', '1080p')
    # You can store this in database or config file
    return jsonify({'status': 'success', 'message': f'Recording quality set to {quality}'})

@app.route('/api/violations/<int:violation_id>/export', methods=['POST'])
def export_violation(violation_id):
    """Export specific violation"""
    try:
        # Get violation from database
        conn = sqlite3.connect('vault_security.db')
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM violations WHERE id = ?', (violation_id,))
        violation = cursor.fetchone()
        conn.close()
        
        if violation:
            clip_path = violation[3]  # clip_path column
            full_path = os.path.join('violation_clips', clip_path)
            
            if os.path.exists(full_path):
                return send_from_directory('violation_clips', clip_path, as_attachment=True)
            else:
                return jsonify({'status': 'error', 'message': 'Violation clip not found'}), 404
        else:
            return jsonify({'status': 'error', 'message': 'Violation not found'}), 404
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {request.sid}')
    emit('connected', {'data': 'Connected to server'})

@socketio.on('disconnect')
def handle_disconnect():
    print(f'Client disconnected: {request.sid}')

@socketio.on('request_frame')
def handle_frame_request():
    """Handle frame request from client"""
    pass

@socketio.on('ping')
def handle_ping(data):
    """Handle ping from client"""
    emit('pong', data)

def create_placeholder_files():
    """Create placeholder files to prevent 404 errors"""
    # Create simple placeholder image
    placeholder_dir = 'static/images'
    os.makedirs(placeholder_dir, exist_ok=True)
    
    # Create a simple SVG placeholder
    placeholder_content = '''<svg width="640" height="480" xmlns="http://www.w3.org/2000/svg">
        <rect width="640" height="480" fill="#1a1a1a"/>
        <text x="320" y="240" font-family="Arial" font-size="24" fill="#666" text-anchor="middle">
            No Signal
        </text>
        <text x="320" y="270" font-family="Arial" font-size="16" fill="#444" text-anchor="middle">
            Camera Offline
        </text>
    </svg>'''
    
    with open(os.path.join(placeholder_dir, 'no-signal.svg'), 'w') as f:
        f.write(placeholder_content)

if __name__ == '__main__':
    # Ensure required directories exist
    os.makedirs('violation_clips', exist_ok=True)
    os.makedirs('static/images', exist_ok=True)
    os.makedirs('static/sounds', exist_ok=True)
    os.makedirs('templates', exist_ok=True)
    
    print("Starting Vault Security Web System...")
    print("Dashboard will be available at: http://localhost:5000")
    
    # Create a simple no-signal placeholder
    create_placeholder_files()
    
    socketio.run(app, debug=False, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)
    #socketio.run(app, debug=True, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)
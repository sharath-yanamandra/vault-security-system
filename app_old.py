
'''
from flask import Flask, render_template, jsonify, Response, request
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
socketio = SocketIO(app, cors_allowed_origins="*")

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

@app.route('/api/stop_monitoring', methods=['POST'])
def stop_monitoring():
    """Stop camera monitoring"""
    if security_system.monitoring:
        security_system.monitoring = False
        if security_system.camera_processor:
            security_system.camera_processor.stop()
        return jsonify({'status': 'success', 'message': 'Monitoring stopped'})
    return jsonify({'status': 'error', 'message': 'Not currently monitoring'})

@app.route('/clips/<path:filename>')
def serve_clip(filename):
    """Serve violation clips"""
    clips_dir = 'violation_clips'
    return app.send_static_file(f'../{clips_dir}/{filename}')

@socketio.on('request_frame')
def handle_frame_request():
    """Handle frame request from client"""
    pass

if __name__ == '__main__':
    # Ensure required directories exist
    os.makedirs('violation_clips', exist_ok=True)
    os.makedirs('static', exist_ok=True)
    os.makedirs('templates', exist_ok=True)
    
    print("Starting Vault Security Web System...")
    print("Dashboard will be available at: http://localhost:5000")
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
    '''
# config.py - Configuration Management

import os
from dataclasses import dataclass
from typing import Dict, Any

@dataclass
class CameraConfig:
    rtsp_url: str
    reconnect_attempts: int = 3
    reconnect_delay: int = 2
    confidence_threshold: float = 0.6

@dataclass
class SecurityConfig:
    required_people: int = 2
    alert_cooldown: int = 3
    violation_clip_duration: int = 10

@dataclass
class DatabaseConfig:
    url: str = 'sqlite:///vault_security.db'
    echo: bool = False

@dataclass
class ServerConfig:
    host: str = '0.0.0.0'
    port: int = 5000
    debug: bool = True

class Config:
    # Camera settings
    CAMERA = CameraConfig(
        rtsp_url=os.getenv('RTSP_URL', 'rtsp://admin:administrator@192.168.0.100:554/ch0_0.264')
    )
    
    # Security settings
    SECURITY = SecurityConfig()
    
    # Database settings
    DATABASE = DatabaseConfig()
    
    # Server settings
    SERVER = ServerConfig(
        host=os.getenv('HOST', '0.0.0.0'),
        port=int(os.getenv('PORT', 5000)),
        debug=os.getenv('DEBUG', 'True').lower() == 'true'
    )
    
    # File paths
    LOG_DIRECTORY = 'vault_logs'
    VIOLATION_CLIPS_DIR = 'violation_clips'
    STATIC_DIR = 'static'
    TEMPLATES_DIR = 'templates'
    
    # Model path
    YOLO_MODEL_PATH = os.getenv('YOLO_MODEL_PATH', 'yolov8n.pt')
    
    # Secret key for Flask
    SECRET_KEY = os.getenv('SECRET_KEY', 'vault_security_key_change_in_production')
# run.py - Startup Script


# run.py - Startup Script

import os
import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Import and run the application
from app import app, socketio

if __name__ == '__main__':
    # Ensure required directories exist
    os.makedirs('violation_clips', exist_ok=True)
    os.makedirs('vault_logs', exist_ok=True)
    os.makedirs('static/css', exist_ok=True)
    os.makedirs('static/js', exist_ok=True)
    os.makedirs('static/images', exist_ok=True)
    os.makedirs('templates', exist_ok=True)
    
    print("=" * 50)
    print("🏛️  VAULT SECURITY SYSTEM")
    print("=" * 50)
    print(f"📡 Server starting on http://localhost:5000")
    print(f"📹 Camera monitoring ready")
    print(f"🔒 Security protocols active")
    print("=" * 50)
    
    # Run the application WITHOUT debug mode to prevent restarts
    socketio.run(app, 
                debug=False,  # ✅ CHANGED: Disabled debug mode
                host='0.0.0.0', 
                port=5000,
                allow_unsafe_werkzeug=True)

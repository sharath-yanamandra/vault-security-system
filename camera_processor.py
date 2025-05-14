import cv2
import numpy as np
from ultralytics import YOLO
import threading
import time
from datetime import datetime
import logging
import base64

class CameraProcessor:
    def __init__(self, security_system, socketio):
        self.security_system = security_system
        self.socketio = socketio
        self.running = False
        
        # Configuration
        self.CONFIG = {
            'required_people': 2,
            'confidence_threshold': 0.5,  # Lowered for better detection
            'alert_cooldown': 3,
            'recording': {
                'enabled': True,
                'violation_clip_duration': 10,
                'output_directory': 'violation_clips'
            },
            'camera': {
                'rtsp_url': 'rtsp://admin:administrator@192.168.0.100:554/ch0_0.264',
                'reconnect_attempts': 3,
                'reconnect_delay': 2
            }
        }
        
        # Initialize logging with more detail
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger('CameraProcessor')
        
        # Load YOLO model - FIXED THE MODEL NAME
        try:
            self.logger.info("🔄 Loading YOLO model...")
            # Use the correct model name that auto-downloads
            self.model = YOLO('yolov8n.pt')  # ✅ FIXED: Correct model name
            self.logger.info("✅ YOLO model loaded successfully")
        except Exception as e:
            self.logger.error(f"❌ Error loading YOLO model: {e}")
            # Try alternative model
            try:
                self.logger.info("🔄 Trying alternative model...")
                self.model = YOLO('yolov8s.pt')
                self.logger.info("✅ Alternative YOLO model loaded")
            except:
                raise Exception("Could not load any YOLO model")
        
        # State management
        self.last_alert_time = 0
        self.recording = False
        self.violation_writer = None
        self.current_violation_start = None
        self.frame_count = 0
        
        # Initialize camera
        self._initialize_camera()
    
    def _initialize_camera(self):
        #Initialize camera with RTSP stream - OPTIMIZED
        self.logger.info("🔄 Initializing RTSP camera connection...")
        self.logger.info(f"📡 RTSP URL: {self.CONFIG['camera']['rtsp_url']}")
        
        for attempt in range(self.CONFIG['camera']['reconnect_attempts']):
            self.logger.info(f"🔄 Connection attempt {attempt + 1}/{self.CONFIG['camera']['reconnect_attempts']}")
            
            self.cap = cv2.VideoCapture(self.CONFIG['camera']['rtsp_url'])
            
            if self.cap.isOpened():
                self.logger.info("✅ RTSP connection opened successfully")
                
                # Optimize settings for better performance
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)      # Minimal buffer
                self.cap.set(cv2.CAP_PROP_FPS, 15)            # Lower FPS for better performance
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)  # Reduce resolution
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)  # Reduce resolution
                
                # Test if we can actually read frames
                ret, frame = self.cap.read()
                if ret and frame is not None:
                    self.logger.info(f"✅ Successfully connected to RTSP stream")
                    self.logger.info(f"📏 Frame size: {frame.shape}")
                    return
                else:
                    self.logger.warning(f"⚠️ Can't read frames from RTSP (attempt {attempt + 1})")
                    self.cap.release()
            
            self.logger.warning(f"❌ Failed to connect to RTSP stream (attempt {attempt + 1})")
            time.sleep(self.CONFIG['camera']['reconnect_delay'])
        
        # If RTSP fails, try webcam as fallback
        self.logger.warning("⚠️ RTSP failed, trying webcam for demo...")
        for cam_index in [0, 1, 2]:
            self.logger.info(f"🔄 Trying webcam {cam_index}...")
            self.cap = cv2.VideoCapture(cam_index)
            if self.cap.isOpened():
                ret, frame = self.cap.read()
                if ret:
                    self.logger.info(f"✅ Successfully connected to webcam {cam_index}")
                    self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                    return
            self.cap.release()
        
        raise ConnectionError("❌ Could not connect to RTSP stream or any camera")
        
    '''
    def _initialize_camera(self):
        """Initialize camera with RTSP stream"""
        self.logger.info("🔄 Initializing RTSP camera connection...")
        self.logger.info(f"📡 RTSP URL: {self.CONFIG['camera']['rtsp_url']}")
        
        for attempt in range(self.CONFIG['camera']['reconnect_attempts']):
            self.logger.info(f"🔄 Connection attempt {attempt + 1}/{self.CONFIG['camera']['reconnect_attempts']}")
            
            self.cap = cv2.VideoCapture(self.CONFIG['camera']['rtsp_url'])
            
            if self.cap.isOpened():
                self.logger.info("✅ RTSP connection opened successfully")
                
                # Set properties for better performance
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                
                # Test if we can actually read frames
                ret, frame = self.cap.read()
                if ret and frame is not None:
                    self.logger.info(f"✅ Successfully connected to RTSP stream")
                    self.logger.info(f"📏 Frame size: {frame.shape}")
                    return
                else:
                    self.logger.warning(f"⚠️ Can't read frames from RTSP (attempt {attempt + 1})")
                    self.cap.release()
            
            self.logger.warning(f"❌ Failed to connect to RTSP stream (attempt {attempt + 1})")
            time.sleep(self.CONFIG['camera']['reconnect_delay'])
        
        # If RTSP fails, try webcam as fallback
        self.logger.warning("⚠️ RTSP failed, trying webcam for demo...")
        for cam_index in [0, 1, 2]:
            self.logger.info(f"🔄 Trying webcam {cam_index}...")
            self.cap = cv2.VideoCapture(cam_index)
            if self.cap.isOpened():
                ret, frame = self.cap.read()
                if ret:
                    self.logger.info(f"✅ Successfully connected to webcam {cam_index}")
                    self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                    return
            self.cap.release()
        
        raise ConnectionError("❌ Could not connect to RTSP stream or any camera")
        '''
    
    def detect_people(self, frame):
        """Detect people in frame"""
        try:
            # Use verbose=False to reduce YOLO output
            results = self.model(frame, conf=self.CONFIG['confidence_threshold'], classes=[0], verbose=False)
            
            people_boxes = []
            if results and len(results) > 0:
                boxes = results[0].boxes
                if boxes is not None:
                    for box in boxes:
                        if box.cls == 0:  # Person class
                            people_boxes.append(box)
            
            return len(people_boxes), people_boxes
        except Exception as e:
            self.logger.error(f"❌ Error in people detection: {e}")
            return 0, []
    
    def draw_bounding_boxes(self, frame, people_boxes, people_count):
        """Draw bounding boxes around detected persons"""
        if people_count == self.CONFIG['required_people']:
            box_color = (0, 255, 0)  # Green
        else:
            box_color = (0, 0, 255)  # Red
        
        for box in people_boxes:
            try:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
                
                cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2)
                
                conf = float(box.conf[0])
                conf_text = f'{conf:.2f}'
                cv2.putText(frame, conf_text, (x1, y1 - 10),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, box_color, 2)
            except Exception as e:
                self.logger.error(f"❌ Error drawing box: {e}")
    
    def draw_overlay(self, frame, people_count):
        """Draw professional overlay"""
        try:
            # Add semi-transparent overlay
            overlay = frame.copy()
            cv2.rectangle(overlay, (0, 0), (frame.shape[1], 100), (0, 0, 0), -1)
            cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)
            
            # Status text
            if people_count == self.CONFIG['required_people']:
                status = "ACCESS GRANTED"
                color = (0, 255, 0)
            else:
                status = "ACCESS DENIED"
                color = (0, 0, 255)
            
            cv2.putText(frame, f"VAULT SECURITY: {status}", (20, 40),
                       cv2.FONT_HERSHEY_DUPLEX, 0.8, color, 2)
            
            # Person count
            cv2.putText(frame, f"PERSONS: {people_count}/{self.CONFIG['required_people']}", 
                       (20, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            
            # Time
            current_time = datetime.now().strftime("%H:%M:%S")
            cv2.putText(frame, current_time, (frame.shape[1] - 120, 30),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            
            # Recording indicator
            if self.recording:
                cv2.circle(frame, (frame.shape[1] - 30, 70), 10, (0, 0, 255), -1)
                cv2.putText(frame, "REC", (frame.shape[1] - 80, 75),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
            
            return status != "ACCESS GRANTED"
        except Exception as e:
            self.logger.error(f"❌ Error drawing overlay: {e}")
            return False
    
    def start_violation_recording(self, frame):
        """Start recording violation"""
        if not self.recording:
            try:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                output_path = f"violation_clips/violation_{timestamp}.mp4"
                fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                self.violation_writer = cv2.VideoWriter(
                    output_path, fourcc, 20.0, 
                    (frame.shape[1], frame.shape[0])
                )
                self.recording = True
                self.current_violation_start = time.time()
                self.logger.info(f"📹 Started recording: {output_path}")
                return output_path
            except Exception as e:
                self.logger.error(f"❌ Error starting recording: {e}")
        return None
    

    def stop_violation_recording(self, people_count):
        """Stop recording violation"""
        if self.recording:
            try:
                self.violation_writer.release()
                duration = time.time() - self.current_violation_start
                
                # Save to database with correct clip path
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                clip_path = f"violation_{timestamp}.mp4"  # Just filename, not full path
                self.security_system.add_violation(people_count, clip_path, duration)
                
                self.recording = False
                self.current_violation_start = None
                self.logger.info(f"⏹️ Stopped recording violation - saved as {clip_path}")
            except Exception as e:
                self.logger.error(f"❌ Error stopping recording: {e}")
    '''
    def stop_violation_recording(self, people_count):
        """Stop recording violation"""
        if self.recording:
            try:
                self.violation_writer.release()
                duration = time.time() - self.current_violation_start
                
                # Save to database
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                clip_path = f"violation_{timestamp}.mp4"
                self.security_system.add_violation(people_count, clip_path, duration)
                
                self.recording = False
                self.current_violation_start = None
                self.logger.info(f"⏹️ Stopped recording violation")
            except Exception as e:
                self.logger.error(f"❌ Error stopping recording: {e}")
    '''
    def frame_to_base64(self, frame):
    #Convert frame to base64 for web transmission - OPTIMIZED
        try:
            # Resize frame for better web performance
            height, width = frame.shape[:2]
            
            # Scale down for web transmission
            if width > 1280:
                scale = 1280 / width
                new_width = int(width * scale)
                new_height = int(height * scale)
                frame = cv2.resize(frame, (new_width, new_height))
            
            # Use lower quality for better performance
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])  # Reduced quality
            frame_base64 = base64.b64encode(buffer).decode('utf-8')
            return f"data:image/jpeg;base64,{frame_base64}"
        except Exception as e:
            self.logger.error(f"❌ Error encoding frame: {e}")
            return None


    '''            
    def frame_to_base64(self, frame):
        """Convert frame to base64 for web transmission"""
        try:
            # Resize frame for better web performance
            height, width = frame.shape[:2]
            if width > 1280:
                scale = 1280 / width
                new_width = int(width * scale)
                new_height = int(height * scale)
                frame = cv2.resize(frame, (new_width, new_height))
            
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            frame_base64 = base64.b64encode(buffer).decode('utf-8')
            return f"data:image/jpeg;base64,{frame_base64}"
        except Exception as e:
            self.logger.error(f"❌ Error encoding frame: {e}")
            return None
    '''
    def run(self):
        """Main camera processing loop"""
        self.running = True
        self.logger.info("🚀 Camera processor started - entering main loop")
        
        consecutive_failures = 0
        max_failures = 5
        last_log_time = time.time()
        
        while self.running and self.security_system.monitoring:
            try:
                ret, frame = self.cap.read()
                
                if not ret or frame is None:
                    consecutive_failures += 1
                    self.logger.warning(f"⚠️ Failed to read frame (failure {consecutive_failures}/{max_failures})")
                    
                    if consecutive_failures >= max_failures:
                        self.logger.error("❌ Too many consecutive failures, attempting reconnection...")
                        self._initialize_camera()
                        consecutive_failures = 0
                        continue
                    
                    time.sleep(0.1)
                    continue
                
                # Reset failure counter on successful read
                consecutive_failures = 0
                self.frame_count += 1
                
                # Log progress every 10 seconds
                current_time = time.time()
                if current_time - last_log_time > 10:
                    self.logger.info(f"📊 Processed {self.frame_count} frames - System running normally")
                    last_log_time = current_time
                
                # Detect people
                people_count, people_boxes = self.detect_people(frame)
                
                # Draw bounding boxes and overlay
                self.draw_bounding_boxes(frame, people_boxes, people_count)
                violation_detected = self.draw_overlay(frame, people_count)
                
                # Handle violations
                if violation_detected:
                    if not self.recording:
                        self.start_violation_recording(frame)
                    if self.recording:
                        self.violation_writer.write(frame)
                else:
                    if self.recording:
                        self.stop_violation_recording(people_count)
                
                # Update database status
                self.security_system.update_camera_status(people_count, self.recording)
                
                # Send frame to web dashboard
                frame_data = self.frame_to_base64(frame)
                if frame_data:
                    # Log first few frame transmissions
                    if self.frame_count <= 3:
                        self.logger.info(f"📤 Sending frame {self.frame_count} to dashboard")
                    
                    self.socketio.emit('video_frame', {
                        'frame': frame_data,
                        'people_count': people_count,
                        'status': 'Access Granted' if people_count == 2 else 'Access Denied',
                        'is_recording': self.recording
                    })
                else:
                    self.logger.warning("⚠️ Failed to encode frame for web transmission")
                
                #time.sleep(0.033)  # ~30 FPS
                time.sleep(0.2)  # ~5 FPS instead of 30 for better performance 
                
            except Exception as e:
                self.logger.error(f"❌ Error in main loop: {e}")
                consecutive_failures += 1
                if consecutive_failures >= max_failures:
                    self.logger.error("❌ Too many errors, stopping camera processor")
                    break
                time.sleep(1)
        
        self.logger.info("🛑 Exiting camera processor main loop")
        self.cleanup()
    
    def stop(self):
        """Stop camera processing"""
        self.logger.info("🛑 Stop signal received")
        self.running = False
    
    def cleanup(self):
        """Clean up resources"""
        try:
            if self.recording:
                self.stop_violation_recording(0)
            if self.cap:
                self.cap.release()
            self.logger.info("✅ Camera processor cleanup completed")
        except Exception as e:
            self.logger.error(f"❌ Error during cleanup: {e}")


import subprocess
import numpy as np
import cv2
from threading import Thread
import queue

class FFmpegRTSPReader:
    def __init__(self, rtsp_url):
        self.rtsp_url = rtsp_url
        self.frame_queue = queue.Queue(maxsize=2)
        self.process = None
        self.running = False
        
    def start(self):
        """Start FFmpeg process to read RTSP stream"""
        cmd = [
            'ffmpeg',
            '-y',  # Overwrite output file
            '-loglevel', 'error',  # Reduce logging
            '-rtsp_transport', 'tcp',  # Use TCP for RTSP
            '-i', self.rtsp_url,
            '-f', 'rawvideo',  # Output raw video
            '-pix_fmt', 'bgr24',  # Pixel format for OpenCV
            '-vf', 'scale=1280:720',  # Scale to reasonable size
            '-'  # Output to stdout
        ]
        
        try:
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=10**8
            )
            self.running = True
            
            # Start frame reading thread
            self.thread = Thread(target=self._read_frames)
            self.thread.daemon = True
            self.thread.start()
            
            return True
        except Exception as e:
            print(f"Error starting FFmpeg: {e}")
            return False
    
    def _read_frames(self):
        """Read frames from FFmpeg stdout"""
        frame_size = 1280 * 720 * 3  # width * height * channels
        
        while self.running:
            try:
                # Read frame data
                raw_frame = self.process.stdout.read(frame_size)
                
                if len(raw_frame) != frame_size:
                    break
                
                # Convert to numpy array
                frame = np.frombuffer(raw_frame, dtype=np.uint8)
                frame = frame.reshape((720, 1280, 3))
                
                # Put frame in queue (non-blocking)
                try:
                    self.frame_queue.put_nowait(frame)
                except queue.Full:
                    # Remove old frame if queue is full
                    try:
                        self.frame_queue.get_nowait()
                        self.frame_queue.put_nowait(frame)
                    except queue.Empty:
                        pass
                        
            except Exception as e:
                print(f"Error reading frame: {e}")
                break
    
    def read(self):
        """Read next frame (compatible with cv2.VideoCapture)"""
        try:
            frame = self.frame_queue.get(timeout=1.0)
            return True, frame
        except queue.Empty:
            return False, None
    
    def isOpened(self):
        """Check if stream is opened"""
        return self.running and self.process and self.process.poll() is None
    
    def release(self):
        """Release resources"""
        self.running = False
        if self.process:
            self.process.terminate()
            self.process.wait()

# Usage example:
# reader = FFmpegRTSPReader('rtsp://admin:administrator@192.168.0.100:554/ch0_0.264')
# if reader.start():
#     while True:
#         ret, frame = reader.read()
#         if ret:
#             cv2.imshow('RTSP Stream', frame)
#             if cv2.waitKey(1) & 0xFF == ord('q'):
#                 break
# reader.release()
# cv2.destroyAllWindows()
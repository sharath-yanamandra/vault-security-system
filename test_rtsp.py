import cv2
import time

# Test script for RTSP connection
print("Testing RTSP connection...")

# Your RTSP URL (update with your actual credentials and IP)
rtsp_url = 'rtsp://admin:administrator@192.168.0.100:554/ch0_0.264'

print(f"Connecting to: {rtsp_url}")

# Test with different backend options
backends = [
    ('Default', cv2.CAP_ANY),
    ('FFmpeg', cv2.CAP_FFMPEG),
    ('GStreamer', cv2.CAP_GSTREAMER),
]

for name, backend in backends:
    print(f"\nTrying {name} backend...")
    cap = cv2.VideoCapture(rtsp_url, backend)
    
    # Set buffer size to reduce latency
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    cap.set(cv2.CAP_PROP_FPS, 30)
    
    if cap.isOpened():
        print(f"✅ {name}: Connection opened successfully")
        
        # Try to read frames
        start_time = time.time()
        frame_count = 0
        
        for i in range(10):  # Try to read 10 frames
            ret, frame = cap.read()
            if ret:
                frame_count += 1
                print(f"Frame {i+1}: Success - Shape: {frame.shape}")
            else:
                print(f"Frame {i+1}: Failed to read")
            time.sleep(0.1)
        
        elapsed = time.time() - start_time
        fps = frame_count / elapsed if elapsed > 0 else 0
        print(f"Read {frame_count}/10 frames in {elapsed:.2f}s (FPS: {fps:.2f})")
        
        if frame_count > 0:
            print(f"✅ {name} backend working!")
            cap.release()
            break
    else:
        print(f"❌ {name}: Failed to open connection")
    
    cap.release()

print("\nTest complete!")

# Additional test with different URL formats
print("\nTesting different URL formats...")
url_variations = [
    'rtsp://admin:administrator@192.168.0.100:554/ch0_0.264',
    'rtsp://admin:administrator@192.168.0.100:554/streaming/channels/101',
    'rtsp://admin:administrator@192.168.0.100:554/Streaming/Channels/101/httppreview',
    'rtsp://admin:administrator@192.168.0.100:554/cam/realmonitor?channel=1&subtype=1'
]

for url in url_variations:
    print(f"\nTesting: {url}")
    cap = cv2.VideoCapture(url)
    if cap.isOpened():
        ret, frame = cap.read()
        if ret:
            print(f"✅ Success with URL: {url}")
            cap.release()
            break
        else:
            print("❌ Opened but cannot read frames")
    else:
        print("❌ Failed to open")
    cap.release()
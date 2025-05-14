import cv2
import time

print("Testing camera access...")

# Test different camera indices
camera_found = False
for i in range(3):
    print(f"Trying camera index {i}...")
    cap = cv2.VideoCapture(i)
    
    if cap.isOpened():
        print(f"✅ Camera {i} opened successfully")
        
        # Try to read a frame
        ret, frame = cap.read()
        if ret:
            print(f"✅ Successfully read frame from camera {i}")
            print(f"Frame shape: {frame.shape}")
            camera_found = True
        else:
            print(f"❌ Could not read frame from camera {i}")
        
        cap.release()
        break
    else:
        print(f"❌ Cannot open camera {i}")
        cap.release()

if not camera_found:
    print("\n❌ No working camera found!")
    print("Possible solutions:")
    print("1. Make sure your webcam is connected and not being used by another application")
    print("2. Check if camera permissions are enabled")
    print("3. Try restarting your computer")
    print("4. Update camera drivers")
else:
    print(f"\n✅ Camera test successful! Camera {i} is working.")

# Test YOLO model download
print("\nTesting YOLO model...")
try:
    from ultralytics import YOLO
    model = YOLO('yolov11l.pt')  # This will download if not present
    print("✅ YOLO model loaded successfully")
except Exception as e:
    print(f"❌ Error loading YOLO model: {e}")
    print("Installing required packages...")
    import subprocess
    subprocess.run(['pip', 'install', 'ultralytics', 'torch', 'torchvision'])

print("\nTest complete!")
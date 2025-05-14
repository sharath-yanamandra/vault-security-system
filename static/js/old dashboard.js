

// ============ GLOBAL VARIABLES ============
let monitoring = false;
let startTime = null;
let uptimeInterval = null;
let socket = null;
let currentVolume = 50;
let systemStats = {
    totalViolations: 0,
    lastUpdate: null,
    peopleDetected: 0,
    accessGranted: false,
    recording: false
};

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', function() {
    initializeSocket();
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    initializeVolumeControl();
    initializeVideoControls();
    loadInitialData();
    initializeSettings();
});

// ============ SOCKET INITIALIZATION ============
function initializeSocket() {
    socket = io();
    
    socket.on('connect', function() {
        console.log('Connected to server');
        showNotification('Connected to security system', 'success');
    });
    
    socket.on('disconnect', function() {
        console.log('Disconnected from server');
        showNotification('Disconnected from security system', 'error');
        updateSystemStatus('offline');
    });
    
    socket.on('video_frame', function(data) {
        updateVideoFeed(data);
        updateSystemMetrics(data);
        updateAccessStatus(data);
    });
    
    socket.on('violation_detected', function(data) {
        showNotification(`Violation detected: ${data.status}`, 'warning');
        loadViolations();
    });
    
    socket.on('system_error', function(data) {
        showNotification(`System Error: ${data.message}`, 'error');
    });
}

// ============ VIDEO FEED MANAGEMENT ============
function updateVideoFeed(data) {
    const videoFeed = document.getElementById('videoFeed');
    const recordingBadge = document.getElementById('recordingBadge');
    const accessStatusOverlay = document.getElementById('accessStatusOverlay');
    
    if (data.frame) {
        videoFeed.src = data.frame;
    }
    
    // Update recording indicator
    if (data.is_recording) {
        recordingBadge.classList.add('active');
    } else {
        recordingBadge.classList.remove('active');
    }
    
    // Update access status overlay
    const statusText = accessStatusOverlay.querySelector('.status-text');
    if (data.status === 'Access Granted') {
        statusText.textContent = '✅ ACCESS GRANTED';
        statusText.style.color = '#00ff41';
        accessStatusOverlay.style.borderLeftColor = '#00ff41';
    } else {
        statusText.textContent = '❌ ACCESS DENIED';
        statusText.style.color = '#ff0041';
        accessStatusOverlay.style.borderLeftColor = '#ff0041';
    }
}

// ============ SYSTEM METRICS ============
function updateSystemMetrics(data) {
    systemStats.peopleDetected = data.people_count || 0;
    systemStats.accessGranted = data.status === 'Access Granted';
    systemStats.recording = data.is_recording || false;
    systemStats.lastUpdate = new Date();
    
    // Update metric cards
    document.getElementById('peopleMetric').textContent = `${systemStats.peopleDetected}/2`;
    document.getElementById('accessMetric').textContent = systemStats.accessGranted ? 'GRANTED' : 'DENIED';
    document.getElementById('recordingMetric').textContent = systemStats.recording ? 'YES' : 'NO';
    
    // Update metric card colors
    const accessCard = document.querySelector('.access-icon').parentNode;
    if (systemStats.accessGranted) {
        accessCard.style.borderLeft = '3px solid #00ff41';
    } else {
        accessCard.style.borderLeft = '3px solid #ff0041';
    }
    
    const recordingCard = document.querySelector('.recording-icon').parentNode;
    if (systemStats.recording) {
        recordingCard.style.borderLeft = '3px solid #ff0041';
        recordingCard.classList.add('glow-effect');
    } else {
        recordingCard.style.borderLeft = '';
        recordingCard.classList.remove('glow-effect');
    }
}

// ============ SYSTEM STATUS MANAGEMENT ============
function updateSystemStatus(status) {
    const statusIndicator = document.getElementById('systemStatusIndicator');
    const headerStatus = document.getElementById('headerStatus');
    const cameraStatus = document.getElementById('cameraStatus');
    
    const statusDot = statusIndicator.querySelector('.status-dot');
    const statusText = statusIndicator.querySelector('span:last-child');
    
    switch(status) {
        case 'online':
            statusDot.className = 'status-dot online';
            statusText.textContent = 'ONLINE';
            headerStatus.textContent = 'ACTIVE';
            headerStatus.style.color = '#00ff41';
            cameraStatus.querySelector('.status-dot').className = 'status-dot online';
            break;
        case 'offline':
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'OFFLINE';
            headerStatus.textContent = 'OFFLINE';
            headerStatus.style.color = '#666';
            cameraStatus.querySelector('.status-dot').className = 'status-dot offline';
            break;
        case 'warning':
            statusDot.className = 'status-dot warning';
            statusText.textContent = 'WARNING';
            headerStatus.textContent = 'WARNING';
            headerStatus.style.color = '#ffc107';
            cameraStatus.querySelector('.status-dot').className = 'status-dot warning';
            break;
        case 'error':
            statusDot.className = 'status-dot danger';
            statusText.textContent = 'ERROR';
            headerStatus.textContent = 'ERROR';
            headerStatus.style.color = '#ff0041';
            cameraStatus.querySelector('.status-dot').className = 'status-dot danger';
            break;
    }
}

// ============ ACCESS STATUS ============
function updateAccessStatus(data) {
    // This is handled in updateVideoFeed and updateSystemMetrics
    // Additional animations or effects can be added here
    if (data.status === 'Access Granted') {
        document.body.style.setProperty('--accent-color', '#00ff41');
    } else {
        document.body.style.setProperty('--accent-color', '#ff0041');
    }
}

// ============ TIME MANAGEMENT ============
function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('currentTime').textContent = timeString;
}

function updateUptime() {
    if (startTime) {
        const now = Date.now();
        const uptime = now - startTime;
        const hours = Math.floor(uptime / (1000 * 60 * 60));
        const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((uptime % (1000 * 60)) / 1000);
        
        const uptimeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('uptimeMetric').textContent = uptimeString;
    }
}

// ============ MONITORING CONTROLS ============
function startMonitoring() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    startBtn.disabled = true;
    startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>STARTING...</span>';
    
    fetch('/api/start_monitoring', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                monitoring = true;
                startTime = Date.now();
                
                startBtn.disabled = true;
                stopBtn.disabled = false;
                startBtn.innerHTML = '<i class="fas fa-play"></i><span>START MONITORING</span>';
                
                updateSystemStatus('online');
                showNotification('Monitoring started successfully', 'success');
                
                // Start uptime counter
                uptimeInterval = setInterval(updateUptime, 1000);
                
                // Load violations after starting
                setTimeout(loadViolations, 1000);
            } else {
                throw new Error(data.message || 'Failed to start monitoring');
            }
        })
        .catch(error => {
            console.error('Error starting monitoring:', error);
            showNotification(`Error: ${error.message}`, 'error');
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fas fa-play"></i><span>START MONITORING</span>';
            updateSystemStatus('error');
        });
}

function stopMonitoring() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    stopBtn.disabled = true;
    stopBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>STOPPING...</span>';
    
    fetch('/api/stop_monitoring', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                monitoring = false;
                startTime = null;
                
                startBtn.disabled = false;
                stopBtn.disabled = true;
                stopBtn.innerHTML = '<i class="fas fa-stop"></i><span>STOP MONITORING</span>';
                
                updateSystemStatus('offline');
                showNotification('Monitoring stopped', 'info');
                
                // Clear uptime counter
                if (uptimeInterval) {
                    clearInterval(uptimeInterval);
                    uptimeInterval = null;
                }
                document.getElementById('uptimeMetric').textContent = '00:00:00';
                
                // Clear video feed
                document.getElementById('videoFeed').src = '/static/images/no-signal.jpg';
                document.getElementById('recordingBadge').classList.remove('active');
                
                // Reset metrics
                resetMetrics();
            } else {
                throw new Error(data.message || 'Failed to stop monitoring');
            }
        })
        .catch(error => {
            console.error('Error stopping monitoring:', error);
            showNotification(`Error: ${error.message}`, 'error');
            stopBtn.disabled = false;
            stopBtn.innerHTML = '<i class="fas fa-stop"></i><span>STOP MONITORING</span>';
        });
}

// ============ VIOLATIONS MANAGEMENT ============
function loadViolations() {
    fetch('/api/violations?limit=10')
        .then(response => response.json())
        .then(violations => {
            updateViolationsList(violations);
            updateViolationCount(violations.length);
        })
        .catch(error => {
            console.error('Error loading violations:', error);
            showNotification('Error loading violations', 'error');
        });
}

function updateViolationsList(violations) {
    const violationsList = document.getElementById('violationsList');
    
    if (violations.length === 0) {
        violationsList.innerHTML = `
            <div class="no-violations">
                <i class="fas fa-shield-check"></i>
                <p>No violations detected</p>
            </div>
        `;
        return;
    }
    
    const violationsHTML = violations.map(violation => {
        const timestamp = new Date(violation.timestamp).toLocaleString();
        return `
            <div class="violation-item">
                <div class="violation-header">
                    <span class="violation-time">${timestamp}</span>
                    <span class="violation-status">${violation.status}</span>
                </div>
                <div class="violation-details">
                    People detected: ${violation.person_count} | Duration: ${violation.duration ? violation.duration.toFixed(2) + 's' : 'N/A'}
                </div>
                <div class="violation-actions">
                    ${violation.clip_path ? `<button class="violation-btn" onclick="playViolationClip('${violation.clip_path}')">
                        <i class="fas fa-play"></i> Play Clip
                    </button>` : ''}
                    <button class="violation-btn" onclick="exportViolation(${violation.id})">
                        <i class="fas fa-download"></i> Export
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    violationsList.innerHTML = violationsHTML;
}

function updateViolationCount(count) {
    document.getElementById('violationCount').textContent = count;
    systemStats.totalViolations = count;
}

function playViolationClip(clipPath) {
    const modal = document.getElementById('videoModal');
    const modalVideo = document.getElementById('modalVideo');
    
    modalVideo.src = `/clips/${clipPath}`;
    modal.style.display = 'block';
    
    // Add escape key listener
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeVideoModal();
        }
    });
}

function closeVideoModal() {
    const modal = document.getElementById('videoModal');
    const modalVideo = document.getElementById('modalVideo');
    
    modal.style.display = 'none';
    modalVideo.pause();
    modalVideo.src = '';
}

// ============ SETTINGS & CONTROLS ============
function initializeVolumeControl() {
    const volumeSlider = document.getElementById('alertVolume');
    const volumeValue = document.getElementById('volumeValue');
    
    volumeSlider.addEventListener('input', function() {
        currentVolume = this.value;
        volumeValue.textContent = `${this.value}%`;
        // Update audio volume for alerts
        updateAudioVolume(this.value / 100);
    });
}

function initializeVideoControls() {
    document.getElementById('screenshotBtn').addEventListener('click', takeScreenshot);
    document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
}

function initializeSettings() {
    const qualitySelect = document.getElementById('recordingQuality');
    
    qualitySelect.addEventListener('change', function() {
        const quality = this.value;
        // Send quality setting to backend
        fetch('/api/settings/recording-quality', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ quality })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                showNotification(`Recording quality set to ${quality}`, 'success');
            }
        })
        .catch(error => {
            console.error('Error updating settings:', error);
            showNotification('Error updating recording quality', 'error');
        });
    });
}

// ============ QUICK ACTIONS ============
function takeScreenshot() {
    const videoFeed = document.getElementById('videoFeed');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = videoFeed.naturalWidth || videoFeed.width;
    canvas.height = videoFeed.naturalHeight || videoFeed.height;
    
    ctx.drawImage(videoFeed, 0, 0);
    
    // Create download link
    canvas.toBlob(function(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vault-screenshot-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        showNotification('Screenshot saved', 'success');
    });
}

function toggleFullscreen() {
    const videoContainer = document.querySelector('.video-container');
    
    if (!document.fullscreenElement) {
        videoContainer.requestFullscreen().catch(err => {
            console.error('Error entering fullscreen:', err);
            showNotification('Fullscreen not supported', 'error');
        });
    } else {
        document.exitFullscreen();
    }
}

function exportLogs() {
    showNotification('Exporting logs...', 'info');
    
    fetch('/api/export/logs', { method: 'POST' })
        .then(response => response.blob())
        .then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vault-logs-${Date.now()}.zip`;
            a.click();
            URL.revokeObjectURL(url);
            showNotification('Logs exported successfully', 'success');
        })
        .catch(error => {
            console.error('Error exporting logs:', error);
            showNotification('Error exporting logs', 'error');
        });
}

function testAlarm() {
    showNotification('Testing alarm system...', 'info');
    
    fetch('/api/test/alarm', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                showNotification('Alarm test completed', 'success');
            } else {
                throw new Error(data.message || 'Alarm test failed');
            }
        })
        .catch(error => {
            console.error('Error testing alarm:', error);
            showNotification(`Alarm test failed: ${error.message}`, 'error');
        });
}

function clearViolations() {
    if (confirm('Are you sure you want to clear all violation history?')) {
        fetch('/api/violations/clear', { method: 'DELETE' })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    loadViolations();
                    showNotification('Violation history cleared', 'success');
                } else {
                    throw new Error(data.message || 'Failed to clear violations');
                }
            })
            .catch(error => {
                console.error('Error clearing violations:', error);
                showNotification(`Error: ${error.message}`, 'error');
            });
    }
}

function systemHealth() {
    showNotification('Checking system health...', 'info');
    
    fetch('/api/system/health')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'healthy') {
                showNotification('System is healthy', 'success');
            } else {
                showNotification(`System issues detected: ${data.issues.join(', ')}`, 'warning');
            }
        })
        .catch(error => {
            console.error('Error checking system health:', error);
            showNotification('Error checking system health', 'error');
        });
}

function exportViolation(violationId) {
    showNotification('Exporting violation...', 'info');
    
    fetch(`/api/violations/${violationId}/export`, { method: 'POST' })
        .then(response => response.blob())
        .then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `violation-${violationId}-${Date.now()}.zip`;
            a.click();
            URL.revokeObjectURL(url);
            showNotification('Violation exported successfully', 'success');
        })
        .catch(error => {
            console.error('Error exporting violation:', error);
            showNotification('Error exporting violation', 'error');
        });
}

// ============ UTILITY FUNCTIONS ============
function loadInitialData() {
    // Load current system status
    fetch('/api/status')
        .then(response => response.json())
        .then(data => {
            if (data) {
                if (data.monitoring) {
                    document.getElementById('startBtn').disabled = true;
                    document.getElementById('stopBtn').disabled = false;
                    updateSystemStatus('online');
                    monitoring = true;
                    
                    if (monitoring && !startTime) {
                        startTime = Date.now();
                        uptimeInterval = setInterval(updateUptime, 1000);
                    }
                } else {
                    updateSystemStatus('offline');
                }
            }
        })
        .catch(error => {
            console.error('Error loading initial data:', error);
            updateSystemStatus('error');
        });
    
    // Load initial violations
    loadViolations();
}

function resetMetrics() {
    document.getElementById('peopleMetric').textContent = '0/2';
    document.getElementById('accessMetric').textContent = 'DENIED';
    document.getElementById('recordingMetric').textContent = 'NO';
    
    systemStats.peopleDetected = 0;
    systemStats.accessGranted = false;
    systemStats.recording = false;
    
    // Reset visual indicators
    document.querySelector('.access-icon').parentNode.style.borderLeft = '';
    document.querySelector('.recording-icon').parentNode.style.borderLeft = '';
    document.querySelector('.recording-icon').parentNode.classList.remove('glow-effect');
}

function updateAudioVolume(volume) {
    // This would integrate with actual audio system
    // For now, just store the volume preference
    localStorage.setItem('alertVolume', volume);
    console.log(`Audio volume updated to ${Math.round(volume * 100)}%`);
}

// ============ EVENT LISTENERS ============
// Modal close on click outside
window.onclick = function(event) {
    const modal = document.getElementById('videoModal');
    if (event.target === modal) {
        closeVideoModal();
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Spacebar to start/stop monitoring
    if (event.code === 'Space' && event.target.tagName !== 'INPUT') {
        event.preventDefault();
        if (monitoring) {
            stopMonitoring();
        } else {
            startMonitoring();
        }
    }
    
    // F11 for fullscreen
    if (event.key === 'F11') {
        event.preventDefault();
        toggleFullscreen();
    }
    
    // S for screenshot
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        takeScreenshot();
    }
});

// Handle window visibility change
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Page is hidden, might want to reduce update frequency
        console.log('Page hidden - reducing updates');
    } else {
        // Page is visible, resume normal updates
        console.log('Page visible - resuming updates');
        if (monitoring) {
            loadViolations(); // Refresh violations when page becomes visible
        }
    }
});
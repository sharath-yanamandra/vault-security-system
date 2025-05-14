// ============ SOCKET HANDLER MODULE ============

class SocketHandler {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 5000; // 5 seconds
        this.reconnectTimer = null;
        this.listeners = new Map();
        this.messageQueue = [];
        this.pingInterval = null;
        this.pingTimeout = null;
        this.lastPingTime = null;
        
        this.init();
    }

    init() {
        this.connect();
        this.setupHeartbeat();
    }

    connect() {
        try {
            console.log('Attempting to connect to server...');
            
            this.socket = io({
                transports: ['websocket', 'polling'],
                upgrade: true,
                rememberUpgrade: true,
                timeout: 5000,
                forceNew: false
            });

            this.setupEventListeners();
        } catch (error) {
            console.error('Socket connection error:', error);
            this.handleConnectionError();
        }
    }

    setupEventListeners() {
        // Connection events
        this.socket.on('connect', () => {
            console.log('Connected to server successfully');
            this.connected = true;
            this.reconnectAttempts = 0;
            
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            
            // Send queued messages
            this.processMessageQueue();
            
            // Notify components of connection
            this.emit('connection_status', { connected: true });
            
            // Update UI
            if (typeof updateSystemStatus === 'function') {
                updateSystemStatus('online');
            }
            
            if (typeof showNotification === 'function') {
                showNotification('Connected to security system', 'success');
            }
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            this.connected = false;
            
            // Emit disconnection event
            this.emit('connection_status', { connected: false, reason });
            
            // Update UI
            if (typeof updateSystemStatus === 'function') {
                updateSystemStatus('offline');
            }
            
            if (typeof showNotification === 'function') {
                showNotification(`Disconnected: ${reason}`, 'warning');
            }
            
            // Attempt reconnection for client-side disconnects
            if (reason === 'transport close' || reason === 'ping timeout') {
                this.attemptReconnect();
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.handleConnectionError();
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`Reconnected after ${attemptNumber} attempts`);
            this.reconnectAttempts = 0;
            
            if (typeof showNotification === 'function') {
                showNotification('Reconnected to server', 'success');
            }
        });

        this.socket.on('reconnect_error', (error) => {
            console.error('Reconnection error:', error);
        });

        this.socket.on('reconnect_failed', () => {
            console.error('Failed to reconnect after maximum attempts');
            
            if (typeof showNotification === 'function') {
                showNotification('Failed to reconnect to server', 'error');
            }
        });

        // Application-specific events
        this.setupApplicationEvents();

        // Heartbeat/ping events
        this.socket.on('pong', (data) => {
            this.handlePong(data);
        });
    }

    setupApplicationEvents() {
        // Video stream events
        this.socket.on('video_frame', (data) => {
            this.emit('video_frame', data);
            this.updateConnectionHealth('video_received');
        });

        // System status events
        this.socket.on('system_status', (data) => {
            this.emit('system_status', data);
        });

        // Violation events
        this.socket.on('violation_detected', (data) => {
            this.emit('violation_detected', data);
            
            // Auto-show notification for violations
            if (typeof notificationManager !== 'undefined') {
                notificationManager.violationDetected(data);
            }
        });

        // Camera events
        this.socket.on('camera_connected', (data) => {
            this.emit('camera_connected', data);
            
            if (typeof notificationManager !== 'undefined') {
                notificationManager.cameraStatus(`Camera ${data.id} connected`, true);
            }
        });

        this.socket.on('camera_disconnected', (data) => {
            this.emit('camera_disconnected', data);
            
            if (typeof notificationManager !== 'undefined') {
                notificationManager.cameraStatus(`Camera ${data.id} disconnected`, false);
            }
        });

        // System alerts
        this.socket.on('system_alert', (data) => {
            this.emit('system_alert', data);
            
            if (typeof notificationManager !== 'undefined') {
                notificationManager.securityAlert(data.message, data.severity);
            }
        });

        // Recording events
        this.socket.on('recording_started', (data) => {
            this.emit('recording_started', data);
        });

        this.socket.on('recording_stopped', (data) => {
            this.emit('recording_stopped', data);
        });

        // Error events
        this.socket.on('system_error', (data) => {
            this.emit('system_error', data);
            console.error('System error from server:', data);
            
            if (typeof showNotification === 'function') {
                showNotification(`System Error: ${data.message}`, 'error');
            }
        });
    }

    handleConnectionError() {
        this.connected = false;
        
        if (typeof updateSystemStatus === 'function') {
            updateSystemStatus('error');
        }
        
        this.attemptReconnect();
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Maximum reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        if (typeof showNotification === 'function') {
            showNotification(
                `Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
                'info',
                2000
            );
        }

        this.reconnectTimer = setTimeout(() => {
            if (!this.connected) {
                this.socket.disconnect();
                this.connect();
            }
        }, this.reconnectInterval);
    }

    // Heartbeat system to monitor connection health
    setupHeartbeat() {
        this.pingInterval = setInterval(() => {
            if (this.connected && this.socket) {
                this.lastPingTime = Date.now();
                this.socket.emit('ping', { timestamp: this.lastPingTime });
                
                // Set timeout for pong response
                this.pingTimeout = setTimeout(() => {
                    console.warn('Ping timeout - connection may be unstable');
                    this.handleConnectionError();
                }, 5000);
            }
        }, 30000); // Ping every 30 seconds
    }

    handlePong(data) {
        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
            this.pingTimeout = null;
        }
        
        if (this.lastPingTime && data.timestamp) {
            const latency = Date.now() - data.timestamp;
            this.emit('connection_latency', { latency });
            console.log(`Connection latency: ${latency}ms`);
        }
    }

    updateConnectionHealth(eventType) {
        // Track different types of events to monitor connection health
        const now = Date.now();
        
        if (!this.connectionHealth) {
            this.connectionHealth = {};
        }
        
        this.connectionHealth[eventType] = now;
        this.connectionHealth.lastActivity = now;
    }

    // Event system for internal communication
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event callback for ${event}:`, error);
                }
            });
        }
    }

    // Message sending with queue
    send(event, data) {
        const message = { event, data, timestamp: Date.now() };
        
        if (this.connected && this.socket) {
            this.socket.emit(event, data);
        } else {
            // Queue message for when connection is restored
            this.messageQueue.push(message);
            console.log(`Message queued: ${event}`);
        }
    }

    processMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            console.log(`Sending queued message: ${message.event}`);
            this.socket.emit(message.event, message.data);
        }
    }

    // Utility methods
    isConnected() {
        return this.connected && this.socket && this.socket.connected;
    }

    getConnectionState() {
        return {
            connected: this.connected,
            reconnectAttempts: this.reconnectAttempts,
            queuedMessages: this.messageQueue.length,
            socketId: this.socket ? this.socket.id : null,
            health: this.connectionHealth
        };
    }

    forceReconnect() {
        console.log('Forcing reconnection...');
        this.reconnectAttempts = 0;
        
        if (this.socket) {
            this.socket.disconnect();
        }
        
        setTimeout(() => {
            this.connect();
        }, 1000);
    }

    // Cleanup
    destroy() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
            this.pingTimeout = null;
        }
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.listeners.clear();
        this.messageQueue = [];
        this.connected = false;
    }
}

// ============ SOCKET EVENT HANDLERS ============

// Global socket handler instance
let socketHandler;

// Initialize socket handler when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    socketHandler = new SocketHandler();
    window.socketHandler = socketHandler; // Make globally accessible
    
    // Set up global event listeners
    setupSocketEventHandlers();
});

function setupSocketEventHandlers() {
    if (!socketHandler) return;
    
    // Video frame handler
    socketHandler.on('video_frame', function(data) {
        if (typeof updateVideoFeed === 'function') {
            updateVideoFeed(data);
        }
        
        if (typeof updateSystemMetrics === 'function') {
            updateSystemMetrics(data);
        }
        
        if (typeof updateAccessStatus === 'function') {
            updateAccessStatus(data);
        }
    });
    
    // System status handler
    socketHandler.on('system_status', function(data) {
        if (typeof updateSystemStatus === 'function') {
            updateSystemStatus(data.status);
        }
    });
    
    // Violation handler
    socketHandler.on('violation_detected', function(data) {
        // Reload violations list
        if (typeof loadViolations === 'function') {
            setTimeout(loadViolations, 1000); // Slight delay to ensure database is updated
        }
    });
    
    // Camera connection handlers
    socketHandler.on('camera_connected', function(data) {
        console.log('Camera connected:', data);
    });
    
    socketHandler.on('camera_disconnected', function(data) {
        console.log('Camera disconnected:', data);
        
        // Update UI to show disconnection
        if (typeof updateSystemStatus === 'function') {
            updateSystemStatus('warning');
        }
    });
    
    // Recording handlers
    socketHandler.on('recording_started', function(data) {
        console.log('Recording started:', data);
        
        // Update recording indicator
        const recordingBadge = document.getElementById('recordingBadge');
        if (recordingBadge) {
            recordingBadge.classList.add('active');
        }
    });
    
    socketHandler.on('recording_stopped', function(data) {
        console.log('Recording stopped:', data);
        
        // Update recording indicator
        const recordingBadge = document.getElementById('recordingBadge');
        if (recordingBadge) {
            recordingBadge.classList.remove('active');
        }
    });
    
    // Connection status handler
    socketHandler.on('connection_status', function(data) {
        console.log('Connection status changed:', data);
        
        if (data.connected) {
            // Refresh all data when reconnected
            if (typeof loadInitialData === 'function') {
                setTimeout(loadInitialData, 500);
            }
        } else {
            // Clear video feed on disconnection
            const videoFeed = document.getElementById('videoFeed');
            if (videoFeed) {
                videoFeed.src = '/static/images/no-signal.jpg';
            }
        }
    });
    
    // Latency monitoring
    socketHandler.on('connection_latency', function(data) {
        // Update latency display if exists
        const latencyElement = document.getElementById('connectionLatency');
        if (latencyElement) {
            latencyElement.textContent = `${data.latency}ms`;
        }
        
        // Color code based on latency
        if (data.latency > 200) {
            console.warn('High latency detected:', data.latency + 'ms');
        }
    });
}

// ============ SOCKET UTILITY FUNCTIONS ============

// Send data through socket with error handling
function sendSocketData(event, data) {
    if (socketHandler && socketHandler.isConnected()) {
        socketHandler.send(event, data);
    } else {
        console.warn(`Cannot send ${event}: Socket not connected`);
        showNotification('Connection lost. Message will be sent when reconnected.', 'warning');
    }
}

// Request specific data from server
function requestServerData(dataType, callback) {
    if (!socketHandler || !socketHandler.isConnected()) {
        console.error('Cannot request data: Socket not connected');
        return;
    }
    
    const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Set up one-time listener for response
    const responseHandler = function(data) {
        if (data.requestId === requestId) {
            callback(data);
            socketHandler.off(dataType + '_response', responseHandler);
        }
    };
    
    socketHandler.on(dataType + '_response', responseHandler);
    
    // Send request
    socketHandler.send(dataType + '_request', { requestId, timestamp: Date.now() });
    
    // Timeout after 10 seconds
    setTimeout(() => {
        socketHandler.off(dataType + '_response', responseHandler);
    }, 10000);
}

// Monitor socket connection health
function monitorSocketHealth() {
    if (!socketHandler) return null;
    
    const state = socketHandler.getConnectionState();
    
    // Log connection health periodically
    console.log('Socket Health:', {
        connected: state.connected,
        reconnectAttempts: state.reconnectAttempts,
        queuedMessages: state.queuedMessages,
        socketId: state.socketId,
        lastActivity: state.health ? state.health.lastActivity : null
    });
    
    return state;
}

// Set up periodic health monitoring
setInterval(monitorSocketHealth, 60000); // Every minute

// ============ SOCKET EVENT EMITTERS ============

// Request video frame
function requestVideoFrame() {
    sendSocketData('request_frame', { timestamp: Date.now() });
}

// Request system status
function requestSystemStatus() {
    sendSocketData('request_status', { timestamp: Date.now() });
}

// Send control commands
function sendStartMonitoring() {
    sendSocketData('start_monitoring', { 
        timestamp: Date.now(),
        source: 'dashboard'
    });
}

function sendStopMonitoring() {
    sendSocketData('stop_monitoring', { 
        timestamp: Date.now(),
        source: 'dashboard'
    });
}

// Send camera commands
function sendCameraCommand(command, parameters = {}) {
    sendSocketData('camera_command', {
        command,
        parameters,
        timestamp: Date.now()
    });
}

// Send alert acknowledgment
function acknowledgeAlert(alertId) {
    sendSocketData('acknowledge_alert', {
        alertId,
        timestamp: Date.now(),
        userId: getCurrentUserId() // Implement this based on your auth system
    });
}

// ============ ADVANCED SOCKET FEATURES ============

// Batch message sending for efficiency
class MessageBatcher {
    constructor(socketHandler, batchSize = 10, flushInterval = 100) {
        this.socketHandler = socketHandler;
        this.batchSize = batchSize;
        this.flushInterval = flushInterval;
        this.batch = [];
        this.timer = null;
    }
    
    add(event, data) {
        this.batch.push({ event, data, timestamp: Date.now() });
        
        if (this.batch.length >= this.batchSize) {
            this.flush();
        } else if (!this.timer) {
            this.timer = setTimeout(() => this.flush(), this.flushInterval);
        }
    }
    
    flush() {
        if (this.batch.length > 0) {
            this.socketHandler.send('batch_messages', this.batch);
            this.batch = [];
        }
        
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
 }
 
 // Socket connection recovery
 class SocketRecovery {
    constructor(socketHandler) {
        this.socketHandler = socketHandler;
        this.enableRecovery();
    }
    
    enableRecovery() {
        // Save critical state before disconnection
        this.socketHandler.on('disconnect', () => {
            this.saveState();
        });
        
        // Restore state after reconnection
        this.socketHandler.on('connect', () => {
            setTimeout(() => this.restoreState(), 1000);
        });
    }
    
    saveState() {
        const state = {
            monitoring: window.monitoring || false,
            lastUpdate: Date.now(),
            activeSettings: this.getActiveSettings()
        };
        
        localStorage.setItem('socketState', JSON.stringify(state));
        console.log('Socket state saved');
    }
    
    restoreState() {
        const savedState = localStorage.getItem('socketState');
        if (!savedState) return;
        
        try {
            const state = JSON.parse(savedState);
            
            // Restore monitoring state
            if (state.monitoring && !window.monitoring) {
                console.log('Restoring monitoring state...');
                startMonitoring();
            }
            
            // Restore settings
            if (state.activeSettings) {
                this.restoreSettings(state.activeSettings);
            }
            
            console.log('Socket state restored');
        } catch (error) {
            console.error('Error restoring socket state:', error);
        }
    }
    
    getActiveSettings() {
        return {
            recordingQuality: document.getElementById('recordingQuality')?.value,
            alertVolume: document.getElementById('alertVolume')?.value
        };
    }
    
    restoreSettings(settings) {
        if (settings.recordingQuality) {
            const qualitySelect = document.getElementById('recordingQuality');
            if (qualitySelect) qualitySelect.value = settings.recordingQuality;
        }
        
        if (settings.alertVolume) {
            const volumeSlider = document.getElementById('alertVolume');
            if (volumeSlider) {
                volumeSlider.value = settings.alertVolume;
                // Trigger change event
                volumeSlider.dispatchEvent(new Event('input'));
            }
        }
    }
 }
 
 // ============ SOCKET DEBUG UTILITIES ============
 
 // Socket debug panel (for development)
 class SocketDebugger {
    constructor(socketHandler) {
        this.socketHandler = socketHandler;
        this.eventLog = [];
        this.maxLogSize = 100;
        this.debugPanel = null;
        this.enabled = false;
    }
    
    enable() {
        this.enabled = true;
        this.createDebugPanel();
        this.attachEventListeners();
    }
    
    disable() {
        this.enabled = false;
        if (this.debugPanel) {
            this.debugPanel.remove();
            this.debugPanel = null;
        }
    }
    
    createDebugPanel() {
        this.debugPanel = document.createElement('div');
        this.debugPanel.id = 'socket-debug-panel';
        this.debugPanel.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 300px;
            height: 400px;
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 8px;
            color: white;
            font-family: monospace;
            font-size: 12px;
            z-index: 9999;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        `;
        
        this.debugPanel.innerHTML = `
            <div style="padding: 10px; border-bottom: 1px solid #333; background: #2a2a2a;">
                <strong>Socket Debug</strong>
                <button onclick="this.parentElement.parentElement.remove()" style="float: right; background: none; border: none; color: white;">×</button>
            </div>
            <div id="socket-debug-content" style="flex: 1; overflow-y: auto; padding: 10px;">
                <div id="socket-debug-status"></div>
                <div id="socket-debug-log"></div>
            </div>
        `;
        
        document.body.appendChild(this.debugPanel);
        this.updateStatus();
    }
    
    attachEventListeners() {
        // Monitor all socket events
        const originalEmit = this.socketHandler.socket.emit;
        this.socketHandler.socket.emit = (...args) => {
            this.logEvent('OUT', args[0], args[1]);
            return originalEmit.apply(this.socketHandler.socket, args);
        };
        
        // Monitor incoming events
        this.socketHandler.socket.onAny((event, data) => {
            this.logEvent('IN', event, data);
        });
    }
    
    logEvent(direction, event, data) {
        if (!this.enabled) return;
        
        const logEntry = {
            timestamp: new Date().toLocaleTimeString(),
            direction,
            event,
            data: data ? (typeof data === 'object' ? JSON.stringify(data).substring(0, 100) : data) : null
        };
        
        this.eventLog.unshift(logEntry);
        if (this.eventLog.length > this.maxLogSize) {
            this.eventLog.pop();
        }
        
        this.updateLog();
    }
    
    updateStatus() {
        if (!this.debugPanel) return;
        
        const statusDiv = this.debugPanel.querySelector('#socket-debug-status');
        const state = this.socketHandler.getConnectionState();
        
        statusDiv.innerHTML = `
            <div>Status: ${state.connected ? '🟢 Connected' : '🔴 Disconnected'}</div>
            <div>Socket ID: ${state.socketId || 'N/A'}</div>
            <div>Reconnect Attempts: ${state.reconnectAttempts}</div>
            <div>Queued Messages: ${state.queuedMessages}</div>
        `;
    }
    
    updateLog() {
        if (!this.debugPanel) return;
        
        const logDiv = this.debugPanel.querySelector('#socket-debug-log');
        logDiv.innerHTML = this.eventLog.map(entry => `
            <div style="color: ${entry.direction === 'IN' ? '#00ff41' : '#007bff'}; margin-bottom: 5px;">
                ${entry.timestamp} [${entry.direction}] ${entry.event}
                ${entry.data ? `<br><span style="color: #888; margin-left: 20px;">${entry.data}</span>` : ''}
            </div>
        `).join('');
        
        this.updateStatus();
    }
 }
 
 // ============ INITIALIZATION WITH EXTRAS ============
 
 // Initialize additional socket features
 document.addEventListener('DOMContentLoaded', function() {
    // Wait for socket handler to be initialized
    setTimeout(() => {
        if (socketHandler) {
            // Initialize message batcher
            window.messageBatcher = new MessageBatcher(socketHandler);
            
            // Initialize recovery system
            window.socketRecovery = new SocketRecovery(socketHandler);
            
            // Initialize debugger (only in development)
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                window.socketDebugger = new SocketDebugger(socketHandler);
                
                // Enable debug mode with Ctrl+Alt+D
                document.addEventListener('keydown', (e) => {
                    if (e.ctrlKey && e.altKey && e.key === 'd') {
                        if (window.socketDebugger.enabled) {
                            window.socketDebugger.disable();
                        } else {
                            window.socketDebugger.enable();
                        }
                    }
                });
            }
        }
    }, 1000);
 });
 
 // Helper function to get current user ID (implement based on your auth system)
 function getCurrentUserId() {
    // This is a placeholder - implement based on your authentication system
    return localStorage.getItem('userId') || 'anonymous';
 }
 
 // Export for module use if needed
 if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SocketHandler,
        MessageBatcher,
        SocketRecovery,
        SocketDebugger
    };
 }
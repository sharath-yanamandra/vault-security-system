// ============ NOTIFICATION SYSTEM ============

class NotificationManager {
    constructor() {
        this.container = document.getElementById('notificationContainer');
        this.notifications = [];
        this.maxNotifications = 5;
        this.defaultDuration = 5000; // 5 seconds
        this.init();
    }

    init() {
        this.injectStyles();
    }

    show(message, type = 'info', duration = null) {
        const notification = this.create(message, type, duration);
        this.add(notification);
        return notification;
    }

    create(message, type, duration) {
        const notification = {
            id: this.generateId(),
            message,
            type,
            duration: duration || this.defaultDuration,
            element: null,
            timeout: null
        };

        notification.element = this.createElement(notification);
        return notification;
    }

    createElement(notification) {
        const element = document.createElement('div');
        element.className = `notification ${notification.type}`;
        element.setAttribute('data-id', notification.id);

        // Create notification content
        const content = `
            <div class="notification-content">
                <i class="notification-icon ${this.getIcon(notification.type)}"></i>
                <div class="notification-text">
                    <span class="notification-message">${notification.message}</span>
                    <span class="notification-time">${this.getCurrentTime()}</span>
                </div>
                <button class="notification-close" onclick="notificationManager.close('${notification.id}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="notification-progress">
                <div class="notification-progress-bar"></div>
            </div>
        `;

        element.innerHTML = content;

        // Add click handler (except for close button)
        element.addEventListener('click', (e) => {
            if (!e.target.closest('.notification-close')) {
                this.close(notification.id);
            }
        });

        return element;
    }

    getIcon(type) {
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    getCurrentTime() {
        return new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    add(notification) {
        // Remove oldest notification if we exceed max
        if (this.notifications.length >= this.maxNotifications) {
            const oldestNotification = this.notifications[0];
            this.close(oldestNotification.id);
        }

        // Add new notification
        this.notifications.push(notification);
        this.container.appendChild(notification.element);

        // Trigger entrance animation
        requestAnimationFrame(() => {
            notification.element.classList.add('show');
        });

        // Start progress bar animation (only if has duration)
        if (notification.duration) {
            this.startProgressBar(notification);
            
            // Set auto-close timeout
            notification.timeout = setTimeout(() => {
                this.close(notification.id);
            }, notification.duration);
        }
    }

    startProgressBar(notification) {
        const progressBar = notification.element.querySelector('.notification-progress-bar');
        if (progressBar && notification.duration) {
            // Reset and animate progress bar
            progressBar.style.transition = 'none';
            progressBar.style.width = '100%';
            
            requestAnimationFrame(() => {
                progressBar.style.transition = `width ${notification.duration}ms linear`;
                progressBar.style.width = '0%';
            });
        }
    }

    close(id) {
        const notificationIndex = this.notifications.findIndex(n => n.id === id);
        if (notificationIndex === -1) return;

        const notification = this.notifications[notificationIndex];
        
        // Clear timeout
        if (notification.timeout) {
            clearTimeout(notification.timeout);
        }

        // Add closing animation
        notification.element.classList.add('removing');
        
        // Remove after animation
        setTimeout(() => {
            if (notification.element && notification.element.parentNode) {
                notification.element.parentNode.removeChild(notification.element);
            }
            this.notifications.splice(notificationIndex, 1);
        }, 300);
    }

    closeAll() {
        const notificationsCopy = [...this.notifications];
        notificationsCopy.forEach(notification => {
            this.close(notification.id);
        });
    }

    generateId() {
        return 'notification_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Public methods for different notification types
    success(message, duration = null) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 8000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 6000) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = null) {
        return this.show(message, 'info', duration);
    }

    // Persistent notifications (don't auto-close)
    persistent(message, type = 'info') {
        return this.show(message, type, null);
    }

    injectStyles() {
        if (document.getElementById('notification-styles')) return;

        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification {
                background: #1a1a1a;
                border: 1px solid #333;
                border-radius: 8px;
                color: white;
                max-width: 350px;
                margin-bottom: 0.5rem;
                overflow: hidden;
                transform: translateX(100%);
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                cursor: pointer;
                position: relative;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                backdrop-filter: blur(10px);
            }

            .notification.show {
                transform: translateX(0);
                opacity: 1;
            }

            .notification.removing {
                transform: translateX(100%);
                opacity: 0;
            }

            .notification:hover {
                transform: translateX(-5px);
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
            }

            .notification.success { border-left: 4px solid #00ff41; }
            .notification.error { border-left: 4px solid #ff0041; }
            .notification.warning { border-left: 4px solid #ffc107; }
            .notification.info { border-left: 4px solid #007bff; }

            .notification-content {
                display: flex;
                align-items: flex-start;
                padding: 1rem;
                gap: 0.75rem;
            }

            .notification-icon {
                font-size: 1.25rem;
                min-width: 20px;
                margin-top: 0.1rem;
            }

            .notification.success .notification-icon { color: #00ff41; }
            .notification.error .notification-icon { color: #ff0041; }
            .notification.warning .notification-icon { color: #ffc107; }
            .notification.info .notification-icon { color: #007bff; }

            .notification-text {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 0.25rem;
            }

            .notification-message {
                font-size: 0.9rem;
                line-height: 1.4;
                word-wrap: break-word;
            }

            .notification-time {
                font-size: 0.75rem;
                color: #888;
                opacity: 0.8;
            }

            .notification-close {
                background: none;
                border: none;
                color: #888;
                cursor: pointer;
                padding: 0.5rem;
                border-radius: 4px;
                transition: all 0.2s ease;
                margin: -0.25rem;
            }

            .notification-close:hover {
                color: #ffffff;
                background: rgba(255, 255, 255, 0.1);
                transform: scale(1.1);
            }

            .notification-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 3px;
                background: rgba(255, 255, 255, 0.1);
                overflow: hidden;
            }

            .notification-progress-bar {
                height: 100%;
                width: 100%;
                transform-origin: left;
                transition: width linear;
            }

            .notification.success .notification-progress-bar { background: #00ff41; }
            .notification.error .notification-progress-bar { background: #ff0041; }
            .notification.warning .notification-progress-bar { background: #ffc107; }
            .notification.info .notification-progress-bar { background: #007bff; }

            /* Sound effect classes */
            .notification.sound-enabled::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: radial-gradient(circle at center, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
                animation: sound-ripple 0.6s ease-out;
                pointer-events: none;
            }

            @keyframes sound-ripple {
                0% {
                    transform: scale(0);
                    opacity: 1;
                }
                100% {
                    transform: scale(1);
                    opacity: 0;
                }
            }

            /* Stack effect for multiple notifications */
            .notification:nth-last-child(2) {
                transform: translateX(10px) scale(0.95);
                opacity: 0.8;
            }

            .notification:nth-last-child(3) {
                transform: translateX(20px) scale(0.9);
                opacity: 0.6;
            }

            .notification:nth-last-child(n+4) {
                display: none;
            }
        `;
        document.head.appendChild(style);
    }
}

// ============ AUDIO NOTIFICATIONS ============
class AudioNotificationManager {
    constructor() {
        this.sounds = {
            success: '/static/sounds/success.mp3',
            error: '/static/sounds/error.mp3',
            warning: '/static/sounds/warning.mp3',
            info: '/static/sounds/info.mp3'
        };
        this.enabled = true;
        this.volume = 0.3;
    }

    play(type) {
        if (!this.enabled) return;

        try {
            const audio = new Audio(this.sounds[type] || this.sounds.info);
            audio.volume = this.volume;
            audio.play().catch(error => {
                console.log('Audio playback failed:', error);
            });
        } catch (error) {
            console.log('Audio creation failed:', error);
        }
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

// ============ ENHANCED NOTIFICATION MANAGER ============
class EnhancedNotificationManager extends NotificationManager {
    constructor() {
        super();
        this.audioManager = new AudioNotificationManager();
        this.soundEnabled = true;
        this.history = [];
        this.maxHistory = 100;
    }

    show(message, type = 'info', duration = null, options = {}) {
        const notification = super.show(message, type, duration);
        
        // Add to history
        this.addToHistory(message, type);
        
        // Play sound if enabled
        if (this.soundEnabled && options.sound !== false) {
            this.audioManager.play(type);
            notification.element.classList.add('sound-enabled');
        }
        
        // Custom actions
        if (options.action) {
            this.addActionButton(notification, options.action);
        }
        
        return notification;
    }

    addToHistory(message, type) {
        this.history.unshift({
            message,
            type,
            timestamp: new Date()
        });
        
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(0, this.maxHistory);
        }
    }

    addActionButton(notification, action) {
        const content = notification.element.querySelector('.notification-content');
        const actionBtn = document.createElement('button');
        actionBtn.className = 'notification-action';
        actionBtn.textContent = action.label;
        actionBtn.onclick = (e) => {
            e.stopPropagation();
            action.callback();
            this.close(notification.id);
        };
        content.appendChild(actionBtn);
    }

    // Enhanced notification methods with options
    success(message, duration = null, options = {}) {
        return this.show(message, 'success', duration, options);
    }

    error(message, duration = 8000, options = {}) {
        return this.show(message, 'error', duration, options);
    }

    warning(message, duration = 6000, options = {}) {
        return this.show(message, 'warning', duration, options);
    }

    info(message, duration = null, options = {}) {
        return this.show(message, 'info', duration, options);
    }

    // System-specific notifications
    securityAlert(message, severity = 'warning') {
        const type = severity === 'high' ? 'error' : 'warning';
        return this.show(`🔒 ${message}`, type, 10000, {
            sound: true,
            action: {
                label: 'View Details',
                callback: () => console.log('Security alert details')
            }
        });
    }

    cameraStatus(message, online = true) {
        const type = online ? 'success' : 'error';
        const icon = online ? '📹' : '📵';
        return this.show(`${icon} ${message}`, type, 5000);
    }

    violationDetected(details) {
        return this.show(
            `⚠️ Violation: ${details.count} people detected`,
            'warning',
            8000,
            {
                sound: true,
                action: {
                    label: 'View Footage',
                    callback: () => {
                        if (details.clipPath) {
                            playViolationClip(details.clipPath);
                        }
                    }
                }
            }
        );
    }

    // Utility methods
    setSoundEnabled(enabled) {
        this.soundEnabled = enabled;
        return this;
    }

    setSoundVolume(volume) {
        this.audioManager.setVolume(volume);
        return this;
    }

    getHistory() {
        return this.history;
    }

    clearHistory() {
        this.history = [];
        return this;
    }

    exportHistory() {
        const data = JSON.stringify(this.history, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notification-history-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// ============ GLOBAL NOTIFICATION INSTANCE ============
let notificationManager;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    notificationManager = new EnhancedNotificationManager();
    window.notificationManager = notificationManager; // Make globally accessible
});

// ============ CONVENIENCE FUNCTIONS ============
function showNotification(message, type = 'info', duration = null, options = {}) {
    if (notificationManager) {
        return notificationManager.show(message, type, duration, options);
    } else {
        console.log(`Notification: [${type.toUpperCase()}] ${message}`);
    }
}

// Export for module use if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        NotificationManager,
        AudioNotificationManager,
        EnhancedNotificationManager
    };
}
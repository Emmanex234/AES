// Notification Manager - Handles all notification operations
const NotificationManager = {
    // Initialize notification system
    init: async function() {
        await this.checkAuth();
        await this.fetchNotifications();
        this.setupRealtimeUpdates();
        this.setupEventListeners();
    },



    // Fetch notifications from Supabase
    fetchNotifications: async function() {
        try {
            const { data: notifications, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;

            this.notifications = notifications || [];
            this.unreadCount = this.notifications.filter(n => !n.read).length;
            this.updateUI();
            
            return this.notifications;
        } catch (error) {
            console.error('Error fetching notifications:', error);
            this.showToast('Error loading notifications', 'error');
            return [];
        }
    },

    // Create a new notification
    createNotification: async function({ title, message, type = 'info', link = null }) {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .insert([{
                    user_id: this.currentUser.id,
                    title,
                    message,
                    type,
                    link,
                    read: false
                }]);

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error creating notification:', error);
            this.showToast('Failed to create notification', 'error');
            return null;
        }
    },

    // Mark notification as read
    markAsRead: async function(notificationId) {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', notificationId);

            if (error) throw error;
            
            // Update local state
            const notification = this.notifications.find(n => n.id === notificationId);
            if (notification && !notification.read) {
                notification.read = true;
                this.unreadCount--;
                this.updateUI();
            }
            
            return true;
        } catch (error) {
            console.error('Error marking notification as read:', error);
            return false;
        }
    },

    // Mark all notifications as read
    markAllAsRead: async function() {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('user_id', this.currentUser.id)
                .eq('read', false);

            if (error) throw error;
            
            // Update local state
            this.notifications.forEach(n => n.read = true);
            this.unreadCount = 0;
            this.updateUI();
            
            return true;
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            return false;
        }
    },

    // Delete a notification
    deleteNotification: async function(notificationId) {
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', notificationId);

            if (error) throw error;
            
            // Update local state
            this.notifications = this.notifications.filter(n => n.id !== notificationId);
            this.updateUI();
            
            return true;
        } catch (error) {
            console.error('Error deleting notification:', error);
            return false;
        }
    },

    // Setup real-time updates for notifications
    setupRealtimeUpdates: function() {
        if (this.notificationChannel) return;

        this.notificationChannel = supabase
            .channel('notifications-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${this.currentUser.id}`
            }, payload => {
                this.handleNotificationUpdate(payload);
            })
            .subscribe();
    },

    // Handle real-time notification updates
    handleNotificationUpdate: function(payload) {
        switch (payload.eventType) {
            case 'INSERT':
                // New notification added
                this.notifications.unshift(payload.new);
                this.unreadCount++;
                this.updateUI();
                this.showToast(payload.new.title || 'New notification', 'info');
                break;
                
            case 'UPDATE':
                // Notification updated (e.g., marked as read)
                const index = this.notifications.findIndex(n => n.id === payload.new.id);
                if (index !== -1) {
                    this.notifications[index] = payload.new;
                    this.updateUnreadCount();
                    this.updateUI();
                }
                break;
                
            case 'DELETE':
                // Notification deleted
                this.notifications = this.notifications.filter(n => n.id !== payload.old.id);
                this.updateUnreadCount();
                this.updateUI();
                break;
        }
    },

    // Update unread count
    updateUnreadCount: function() {
        this.unreadCount = this.notifications.filter(n => !n.read).length;
    },

    // Update UI elements
    updateUI: function() {
        // Update notification badge
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        // Update notifications list if exists
        const notificationsList = document.getElementById('notificationsList');
        if (notificationsList) {
            if (this.notifications.length === 0) {
                notificationsList.innerHTML = '<div class="p-4 text-center text-gray-500">No notifications</div>';
            } else {
                notificationsList.innerHTML = this.notifications.map(notification => `
                    <div class="flex items-start p-4 hover:bg-gray-50 transition cursor-pointer ${notification.read ? '' : 'bg-blue-50'}" 
                         onclick="NotificationManager.handleNotificationClick('${notification.id}', '${notification.link}')">
                        <div class="flex-shrink-0 pt-1">
                            <div class="p-2 rounded-full ${this.getNotificationColor(notification.type)}">
                                <i class="fas ${this.getNotificationIcon(notification.type)}"></i>
                            </div>
                        </div>
                        <div class="ml-3 flex-1">
                            <p class="text-sm font-medium text-gray-900">${notification.title || 'Notification'}</p>
                            <p class="text-sm text-gray-500">${notification.message || notification.content}</p>
                            <p class="text-xs text-gray-400 mt-1">${this.formatDate(notification.created_at)}</p>
                        </div>
                        ${!notification.read ? '<div class="w-2 h-2 bg-blue-500 rounded-full"></div>' : ''}
                    </div>
                `).join('');
            }
        }
    },

    // Handle notification click
    handleNotificationClick: async function(notificationId, link) {
        // Mark as read
        await this.markAsRead(notificationId);
        
        // If notification has a link, navigate to it
        if (link) {
            window.location.href = link;
        }
    },

    // Show notification toast
    showToast: function(message, type = 'info') {
        const toast = document.createElement('div');
        const bgColor = {
            success: 'bg-green-100 text-green-800 border-green-200',
            error: 'bg-red-100 text-red-800 border-red-200',
            warning: 'bg-amber-100 text-amber-800 border-amber-200',
            info: 'bg-blue-100 text-blue-800 border-blue-200'
        };
        
        const icon = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        toast.className = `fixed top-4 right-4 z-50 p-4 rounded-lg border shadow-lg ${bgColor[type]} animate__animated animate__fadeInRight max-w-sm`;
        toast.innerHTML = `
            <div class="flex items-start">
                <div class="flex-shrink-0">
                    <i class="fas ${icon[type]}"></i>
                </div>
                <div class="ml-3 flex-1">
                    <p class="text-sm font-medium">${message}</p>
                </div>
                <button class="ml-4 text-current opacity-50 hover:opacity-75" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times text-xs"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.classList.remove('animate__fadeInRight');
            toast.classList.add('animate__fadeOutRight');
            setTimeout(() => toast.remove(), 500);
        }, 5000);
    },

    // Setup event listeners
    setupEventListeners: function() {
        // Mark all as read button
        const markAllAsReadBtn = document.getElementById('markAllAsReadBtn');
        if (markAllAsReadBtn) {
            markAllAsReadBtn.addEventListener('click', () => this.markAllAsRead());
        }

        // Notification dropdown toggle
        const notificationBtn = document.getElementById('notificationBtn');
        if (notificationBtn) {
            notificationBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.getElementById('notificationDropdown').classList.toggle('hidden');
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('notificationDropdown');
            if (dropdown && !dropdown.contains(e.target) && !notificationBtn.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    },

    // Helper function to get notification color
    getNotificationColor: function(type) {
        switch (type) {
            case 'alert':
            case 'warning':
                return 'bg-red-100 text-red-600';
            case 'success':
                return 'bg-green-100 text-green-600';
            case 'info':
            default:
                return 'bg-blue-100 text-blue-600';
        }
    },

    // Helper function to get notification icon
    getNotificationIcon: function(type) {
        switch (type) {
            case 'alert':
            case 'warning':
                return 'fa-exclamation-triangle';
            case 'success':
                return 'fa-check-circle';
            case 'info':
            default:
                return 'fa-info-circle';
        }
    },

    // Helper function to format date
    formatDate: function(dateString) {
        const options = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }
};

// Initialize the notification system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => NotificationManager.init());
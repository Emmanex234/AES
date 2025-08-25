        // Initialize Supabase
        const supabaseUrl = 'https://heenvsshjcizlykpbcag.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlZW52c3NoamNpemx5a3BiY2FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwNDA0OTgsImV4cCI6MjA2ODYxNjQ5OH0.SZFhUuGhnqyRD91NdY265N5ojeS1wcMSwl9a2IOpNPQ';
        const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

        // Global variables
        let currentUser = null;
        let notificationCount = 0;
        let isSidebarCollapsed = false;
        let userSettings = {
            darkMode: false,
            compactSidebar: false,
            emailNotifications: true,
            pushNotifications: true
        };

        // DOM Elements
        const totalProductsEl = document.getElementById('totalProducts');
        const expiringSoonEl = document.getElementById('expiringSoon');
        const expiredCountEl = document.getElementById('expiredCount');
        const categoryCountEl = document.getElementById('categoryCount');
        const expiringProductsList = document.getElementById('expiringProductsList');
        const notificationsList = document.getElementById('notificationsList');
        const welcomeMessage = document.getElementById('welcomeMessage');
        const notificationBadge = document.getElementById('notificationBadge');

        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', async function() {
            await checkAuth();
            await fetchDashboardData();
            setupEventListeners();
            loadSettings();
        });

        // Check authentication
        async function checkAuth() {
            try {
                const { data: { user } } = await supabaseClient.auth.getUser();
                if (!user) {
                    window.location.href = 'index.html';
                    return;
                }
                currentUser = user;
                updateUserInterface(user);
            } catch (error) {
                console.error('Auth error:', error);
                window.location.href = 'index.html';
            }
        }

        // Update user interface with user data
        function updateUserInterface(user) {
            const displayName = user.user_metadata?.full_name || user.email.split('@')[0];
            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4f46e5&color=fff`;
            
            // Update welcome message
            welcomeMessage.textContent = `Welcome back, ${displayName}!`;
            
            // Update avatars
            document.getElementById('sidebarUserAvatar').src = avatarUrl;
            document.getElementById('headerUserAvatar').src = avatarUrl;
            document.getElementById('profileAvatar').src = avatarUrl;
            
            // Update user names
            document.getElementById('sidebarUserName').textContent = displayName;
            document.getElementById('profileName').textContent = displayName;
            document.getElementById('profileEmail').textContent = user.email;
            document.getElementById('fullName').value = user.user_metadata?.full_name || displayName;
            
            // Update profile details
            const createdDate = new Date(user.created_at).toLocaleDateString();
            const lastSignIn = new Date(user.last_sign_in_at || user.created_at).toLocaleDateString();
            document.getElementById('memberSince').textContent = createdDate;
            document.getElementById('lastLogin').textContent = lastSignIn;
        }

        // Fetch dashboard data
        async function fetchDashboardData() {
            if (!currentUser) return;
            
            try {
                await Promise.all([
                    fetchProductCounts(currentUser.id),
                    fetchExpiringProducts(currentUser.id),
                    fetchNotifications(currentUser.id)
                ]);
                
                setupRealtimeUpdates(currentUser.id);
            } catch (error) {
                console.error('Dashboard error:', error);
                showToast('Error loading dashboard data', 'error');
            }
        }

        // Fetch product counts
        async function fetchProductCounts(userId) {
            try {
                // Total products
                const { count: totalCount } = await supabaseClient
                    .from('products')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId);

                totalProductsEl.textContent = totalCount || 0;

                // Expiring soon (within 30 days)
                const thirtyDaysFromNow = new Date();
                thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
                
                const { count: expiringCount } = await supabaseClient
                    .from('products')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId)
                    .gte('expiry_date', new Date().toISOString().split('T')[0])
                    .lte('expiry_date', thirtyDaysFromNow.toISOString().split('T')[0]);

                expiringSoonEl.textContent = expiringCount || 0;

                // Expired products
                const { count: expiredCount } = await supabaseClient
                    .from('products')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId)
                    .lt('expiry_date', new Date().toISOString().split('T')[0]);

                expiredCountEl.textContent = expiredCount || 0;

                // Categories count (if table exists)
                try {
                    const { count: categoryCount } = await supabaseClient
                        .from('categories')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_id', userId);
                    categoryCountEl.textContent = categoryCount || 0;
                } catch (error) {
                    // If categories table doesn't exist, show unique categories from products
                    const { data: products } = await supabaseClient
                        .from('products')
                        .select('category')
                        .eq('user_id', userId);
                    
                    const uniqueCategories = [...new Set(products?.map(p => p.category) || [])];
                    categoryCountEl.textContent = uniqueCategories.length;
                }
            } catch (error) {
                console.error('Error fetching product counts:', error);
            }
        }

        // Fetch expiring products
async function fetchExpiringProducts(userId) {
    try {
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        
        // Get current date at midnight (00:00:00)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Get 30 days from now at end of day (23:59:59)
        thirtyDaysFromNow.setHours(23, 59, 59, 999);
        
        const { data: products, error } = await supabaseClient
            .from('products')
            .select(`
                id, 
                name, 
                expiry_date, 
                quantity, 
                category_id,
                categories (name)
            `)
            .eq('user_id', userId)
            .gte('expiry_date', today.toISOString())
            .lte('expiry_date', thirtyDaysFromNow.toISOString())
            .order('expiry_date', { ascending: true })
            .limit(5);

        if (error) {
            console.error('Supabase error:', error);
            expiringProductsList.innerHTML = '<div class="p-4 text-center text-red-500">Error loading products</div>';
            return;
        }

        if (!products || products.length === 0) {
            expiringProductsList.innerHTML = '<div class="p-4 text-center text-gray-500">No products expiring soon</div>';
            return;
        }

        expiringProductsList.innerHTML = products.map(product => `
            <div class="flex items-center justify-between p-4 hover:bg-gray-50 transition">
                <div class="flex items-center">
                    <div class="p-2 rounded-full bg-amber-100 text-amber-600 mr-4">
                        <i class="fas fa-exclamation-circle"></i>
                    </div>
                    <div>
                        <h4 class="font-medium text-gray-900">${product.name}</h4>
                        <p class="text-sm text-gray-500">${product.categories?.name || 'Uncategorized'}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-medium ${getExpiryColor(product.expiry_date)}">
                        ${getDaysUntilExpiry(product.expiry_date)} days left
                    </p>
                    <p class="text-sm text-gray-500">Qty: ${product.quantity || 1}</p>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error fetching expiring products:', error);
        expiringProductsList.innerHTML = '<div class="p-4 text-center text-red-500">Error loading products</div>';
    }
}

        // Fetch notifications
        async function fetchNotifications(userId) {
            try {
                const { data: notifications, error } = await supabaseClient
                    .from('notifications')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (error) {
                    console.error('Error fetching notifications:', error);
                    notificationsList.innerHTML = '<div class="p-4 text-center text-red-500">Error loading notifications</div>';
                    return;
                }

                if (!notifications || notifications.length === 0) {
                    notificationsList.innerHTML = '<div class="p-4 text-center text-gray-500">No recent notifications</div>';
                    notificationCount = 0;
                } else {
                    notificationCount = notifications.filter(n => !n.read).length;
                    notificationsList.innerHTML = notifications.map(notification => `
                        <div class="flex items-start p-4 hover:bg-gray-50 transition ${notification.read ? '' : 'bg-blue-50'}">
                            <div class="flex-shrink-0 pt-1">
                                <div class="p-2 rounded-full ${getNotificationColor(notification.type)}">
                                    <i class="fas ${getNotificationIcon(notification.type)}"></i>
                                </div>
                            </div>
                            <div class="ml-3 flex-1">
                                <p class="text-sm font-medium text-gray-900">${notification.title || 'Notification'}</p>
                                <p class="text-sm text-gray-500">${notification.message || notification.content}</p>
                                <p class="text-xs text-gray-400 mt-1">${formatDate(notification.created_at)}</p>
                            </div>
                            ${!notification.read ? '<div class="w-2 h-2 bg-blue-500 rounded-full"></div>' : ''}
                        </div>
                    `).join('');
                }

                updateNotificationBadge();
            } catch (error) {
                console.error('Error fetching notifications:', error);
                notificationsList.innerHTML = '<div class="p-4 text-center text-red-500">Error loading notifications</div>';
            }
        }

        // Update notification badge
        function updateNotificationBadge() {
            if (notificationCount > 0) {
                notificationBadge.textContent = notificationCount > 99 ? '99+' : notificationCount;
                notificationBadge.classList.remove('hidden');
            } else {
                notificationBadge.classList.add('hidden');
            }
        }

        // Setup real-time updates
        function setupRealtimeUpdates(userId) {
            // Products subscription
            supabaseClient
                .channel('products-changes')
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'products',
                    filter: `user_id=eq.${userId}`
                }, payload => {
                    fetchProductCounts(userId);
                    fetchExpiringProducts(userId);
                })
                .subscribe();

            // Notifications subscription
            supabaseClient
                .channel('notifications-changes')
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                }, payload => {
                    fetchNotifications(userId);
                    if (payload.eventType === 'INSERT') {
                        showToast(payload.new.title || 'New notification', 'info');
                    }
                })
                .subscribe();
        }

        // Setup event listeners
        function setupEventListeners() {
            // Mobile menu
            document.getElementById('mobileMenuBtn').addEventListener('click', openMobileMenu);
            document.getElementById('closeMobileMenu').addEventListener('click', closeMobileMenu);
            document.getElementById('mobileOverlay').addEventListener('click', closeMobileMenu);

            // Toggle sidebar
            document.getElementById('toggleSidebar').addEventListener('click', toggleSidebar);

            // User menu
            document.getElementById('userMenuBtn').addEventListener('click', toggleUserMenu);
            document.addEventListener('click', function(e) {
                if (!e.target.closest('#userMenuBtn') && !e.target.closest('#userDropdown')) {
                    document.getElementById('userDropdown').classList.add('hidden');
                }
            });

            // Logout button
            document.getElementById('logoutBtn').addEventListener('click', logout);
            
            // Notification button
            document.getElementById('notificationBtn').addEventListener('click', showAllNotifications);
        }

        // Mobile menu functions
        function openMobileMenu() {
            document.getElementById('sidebar').classList.add('open');
            document.getElementById('mobileOverlay').classList.remove('hidden');
        }

        function closeMobileMenu() {
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('mobileOverlay').classList.add('hidden');
        }

        // Toggle sidebar
        function toggleSidebar() {
            isSidebarCollapsed = !isSidebarCollapsed;
            const sidebar = document.getElementById('sidebar');
            
            if (isSidebarCollapsed) {
                sidebar.classList.add('sidebar-collapsed');
                localStorage.setItem('sidebarCollapsed', 'true');
            } else {
                sidebar.classList.remove('sidebar-collapsed');
                localStorage.setItem('sidebarCollapsed', 'false');
            }
        }

        // Load settings from localStorage
        function loadSettings() {
            const savedSettings = localStorage.getItem('userSettings');
            if (savedSettings) {
                userSettings = JSON.parse(savedSettings);
            }
            
            const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
            if (sidebarCollapsed) {
                document.getElementById('sidebar').classList.add('sidebar-collapsed');
                isSidebarCollapsed = true;
            }
            
            // Update toggle switches
            document.getElementById('darkModeToggle').checked = userSettings.darkMode;
            document.getElementById('compactSidebarToggle').checked = userSettings.compactSidebar;
            document.getElementById('emailNotificationsToggle').checked = userSettings.emailNotifications;
            document.getElementById('pushNotificationsToggle').checked = userSettings.pushNotifications;
            
            // Apply dark mode if enabled
            if (userSettings.darkMode) {
                document.documentElement.classList.add('dark');
            }
        }

        // Save settings to localStorage
        function saveSettings() {
            userSettings = {
                darkMode: document.getElementById('darkModeToggle').checked,
                compactSidebar: document.getElementById('compactSidebarToggle').checked,
                emailNotifications: document.getElementById('emailNotificationsToggle').checked,
                pushNotifications: document.getElementById('pushNotificationsToggle').checked
            };
            
            localStorage.setItem('userSettings', JSON.stringify(userSettings));
            
            // Apply dark mode if changed
            if (userSettings.darkMode) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            
            // Apply compact sidebar if changed
            if (userSettings.compactSidebar && !isSidebarCollapsed) {
                toggleSidebar();
            } else if (!userSettings.compactSidebar && isSidebarCollapsed) {
                toggleSidebar();
            }
            
            showToast('Settings saved successfully', 'success');
            closeSettingsModal();
        }

        // User menu functions
        function toggleUserMenu() {
            const dropdown = document.getElementById('userDropdown');
            dropdown.classList.toggle('hidden');
        }

        // Modal functions
        function showAddProductModal() {
            document.getElementById('addProductModal').classList.remove('hidden');
        }

        function closeAddProductModal() {
            document.getElementById('addProductModal').classList.add('hidden');
        }

        function showProfile(editMode = false) {
            document.getElementById('profileModal').classList.remove('hidden');
            document.getElementById('userDropdown').classList.add('hidden');
            
            if (editMode) {
                document.getElementById('fullName').focus();
            }
        }

        function closeProfileModal() {
            document.getElementById('profileModal').classList.add('hidden');
        }

        function showSettings() {
            document.getElementById('settingsModal').classList.remove('hidden');
            document.getElementById('userDropdown').classList.add('hidden');
        }

        function closeSettingsModal() {
            document.getElementById('settingsModal').classList.add('hidden');
        }

        // Handle avatar upload
        async function handleAvatarUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            try {
                // In a real app, you would upload to Supabase Storage
                // For demo, we'll just create a local URL
                const avatarUrl = URL.createObjectURL(file);
                
                // Update all avatar images
                document.getElementById('sidebarUserAvatar').src = avatarUrl;
                document.getElementById('headerUserAvatar').src = avatarUrl;
                document.getElementById('profileAvatar').src = avatarUrl;
                
                showToast('Avatar updated successfully', 'success');
            } catch (error) {
                console.error('Error uploading avatar:', error);
                showToast('Error updating avatar', 'error');
            }
        }

        // Update user profile
        async function updateProfile() {
            const fullName = document.getElementById('fullName').value.trim();
            if (!fullName) {
                showToast('Please enter a valid name', 'error');
                return;
            }
            
            try {
                const { data, error } = await supabaseClient.auth.updateUser({
                    data: { full_name: fullName }
                });
                
                if (error) throw error;
                
                currentUser = data.user;
                updateUserInterface(currentUser);
                showToast('Profile updated successfully', 'success');
                closeProfileModal();
            } catch (error) {
                console.error('Error updating profile:', error);
                showToast('Error updating profile', 'error');
            }
        }

        // Navigation functions
        function navigateToProducts() {
            // For demo purposes, show alert. Replace with actual navigation
            showToast('Redirecting to Products page...', 'info');
            setTimeout(() => {
                window.location.href = 'products.html';
            }, 800);
        }

        function navigateToReports() {
            showToast('Redirecting to Reports page...', 'info');
            // window.location.href = 'reports.html';
             setTimeout(() => {
                window.location.href = 'reports.html';
            }, 800);
        }

        function navigateToChat() {
            showToast('Redirecting to Management Chat...', 'info');
            // window.location.href = 'chat.html';
             setTimeout(() => {
                window.location.href = 'chat.html';
            }, 800);
        }

        function showAllNotifications() {
            showToast('All notifications view coming soon...', 'info');

            
        }

        // Logout function
        async function logout() {
            try {
                const { error } = await supabaseClient.auth.signOut();
                if (error) throw error;
                
                showToast('Logged out successfully', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
            } catch (error) {
                console.error('Logout error:', error);
                showToast('Error logging out', 'error');
            }
        }

        // Helper functions
        function getDaysUntilExpiry(expiryDate) {
            const expiry = new Date(expiryDate);
            const today = new Date();
            const diffTime = expiry - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return Math.max(0, diffDays);
        }

        function getExpiryColor(expiryDate) {
            const days = getDaysUntilExpiry(expiryDate);
            if (days <= 3) return 'text-red-600';
            if (days <= 7) return 'text-orange-600';
            if (days <= 14) return 'text-amber-600';
            return 'text-indigo-600';
        }

        function getNotificationColor(type) {
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
        }

        function getNotificationIcon(type) {
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
        }

        function formatDate(dateString) {
            const options = { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
            };
            return new Date(dateString).toLocaleDateString(undefined, options);
        }

        // Toast notification function
        function showToast(message, type = 'info') {
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
        }

        // Error handling
        window.addEventListener('error', function(e) {
            console.error('Global error:', e.error);
            showToast('An unexpected error occurred', 'error');
        });

        // Handle offline/online status
        window.addEventListener('online', () => {
            showToast('Connection restored', 'success');
            if (currentUser) {
                fetchDashboardData();
            }
        });

        window.addEventListener('offline', () => {
            showToast('You are offline', 'warning');
        });
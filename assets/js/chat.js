// Initialize Supabase
const supabaseUrl = 'https://heenvsshjcizlykpbcag.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlZW52c3NoamNpemx5a3BiY2FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwNDA0OTgsImV4cCI6MjA2ODYxNjQ5OH0.SZFhUuGhnqyRD91NdY265N5ojeS1wcMSwl9a2IOpNPQ';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// DOM Elements
const conversationsList = document.getElementById('conversationsList');
const messageHeader = document.getElementById('messageHeader');
const messagesContainer = document.getElementById('messagesContainer');
const messageInputContainer = document.getElementById('messageInputContainer');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const newMessageBtn = document.getElementById('newMessageBtn');
const newMessageModal = document.getElementById('newMessageModal');
const recipientSelect = document.getElementById('recipientSelect');
const newMessageContent = document.getElementById('newMessageContent');
const sendNewMessageBtn = document.getElementById('sendNewMessageBtn');
const cancelNewMessageBtn = document.getElementById('cancelNewMessageBtn');

// State
let currentUserId = null;
let currentRecipientId = null;
let currentConversationId = null;

// Initialize chat page
document.addEventListener('DOMContentLoaded', async () => {
    // Check auth
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    currentUserId = user.id;

    // Load managers/recipients
    await loadRecipients();
    
    // Load conversations
    await loadConversations();
    
    // Set up event listeners
    setupEventListeners();
    
    // Set up real-time updates
    setupRealtimeUpdates();
});

// Load recipients (managers)
async function loadRecipients() {
    // In a real app, you'd fetch managers/recipients from your database
    // For demo, we'll use a hardcoded list or fetch from a 'managers' table
    
    // Example: Fetch from a 'profiles' table where role is 'manager'
    const { data: managers, error } = await supabaseClient
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'manager')
        .neq('id', currentUserId);

    if (error) {
        console.error('Error loading recipients:', error);
        return;
    }

    // Populate recipient select
    recipientSelect.innerHTML = '<option value="">Select a recipient</option>';
    managers.forEach(manager => {
        recipientSelect.innerHTML += `<option value="${manager.id}">${manager.full_name}</option>`;
    });
}

// Load conversations
async function loadConversations() {
    // Get conversations where current user is either sender or recipient
    const { data: conversations, error } = await supabaseClient
        .from('messages')
        .select('recipient_id, recipients:recipient_id(full_name, avatar_url), senders:sender_id(full_name, avatar_url)')
        .or(`sender_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`)
        .order('created_at', { ascending: false });

    if (error) {
        conversationsList.innerHTML = '<div class="p-4 text-center text-red-500">Error loading conversations</div>';
        console.error('Error loading conversations:', error);
        return;
    }

    if (conversations.length === 0) {
        conversationsList.innerHTML = '<div class="p-4 text-center text-gray-500">No conversations yet</div>';
        return;
    }

    // Process conversations to show unique recipients
    const uniqueRecipients = {};
    conversations.forEach(conv => {
        const otherUserId = conv.sender_id === currentUserId ? conv.recipient_id : conv.sender_id;
        const otherUser = conv.sender_id === currentUserId ? conv.recipients : conv.senders;
        
        if (!uniqueRecipients[otherUserId]) {
            uniqueRecipients[otherUserId] = {
                id: otherUserId,
                name: otherUser.full_name,
                avatar: otherUser.avatar_url,
                lastMessage: conv.created_at
            };
        }
    });

    // Sort by last message date
    const sortedConversations = Object.values(uniqueRecipients).sort((a, b) => 
        new Date(b.lastMessage) - new Date(a.lastMessage));

    // Display conversations
    conversationsList.innerHTML = sortedConversations.map(conv => `
        <div class="p-4 hover:bg-gray-100 cursor-pointer transition flex items-center conversation-item" data-id="${conv.id}">
            <img class="h-10 w-10 rounded-full" src="${conv.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(conv.name)}" alt="${conv.name}">
            <div class="ml-3 flex-1">
                <h4 class="text-sm font-medium text-gray-900">${conv.name}</h4>
                <p class="text-sm text-gray-500">Last conversation</p>
            </div>
        </div>
    `).join('');

    // Add click event to conversation items
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.addEventListener('click', () => openConversation(item.dataset.id));
    });
}

// Open conversation
async function openConversation(recipientId) {
    currentRecipientId = recipientId;
    
    // Get recipient details
    const { data: recipient, error } = await supabaseClient
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', recipientId)
        .single();

    if (error) {
        console.error('Error loading recipient:', error);
        return;
    }

    // Update header
    messageHeader.innerHTML = `
        <img class="h-10 w-10 rounded-full" src="${recipient.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(recipient.full_name)}" alt="${recipient.full_name}">
        <div class="ml-3 flex-1">
            <h3 class="text-lg font-medium text-gray-900">${recipient.full_name}</h3>
            <p class="text-sm text-gray-500">Active now</p>
        </div>
    `;

    // Load messages
    await loadMessages(recipientId);
    
    // Show message input
    messageInputContainer.classList.remove('hidden');
}

// Load messages
async function loadMessages(recipientId) {
    const { data: messages, error } = await supabaseClient
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUserId},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${currentUserId})`)
        .order('created_at', { ascending: true });

    if (error) {
        messagesContainer.innerHTML = '<div class="text-center text-red-500 py-10">Error loading messages</div>';
        console.error('Error loading messages:', error);
        return;
    }

    if (messages.length === 0) {
        messagesContainer.innerHTML = '<div class="text-center text-gray-500 py-10">No messages yet</div>';
        return;
    }

    // Display messages
    messagesContainer.innerHTML = messages.map(msg => `
        <div class="mb-4 flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}">
            <div class="max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-lg ${msg.sender_id === currentUserId ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200'}">
                <p>${msg.content}</p>
                <p class="text-xs mt-1 ${msg.sender_id === currentUserId ? 'text-indigo-200' : 'text-gray-500'}">
                    ${formatTime(msg.created_at)}
                </p>
            </div>
        </div>
    `).join('');

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send message
async function sendMessage() {
    const content = messageInput.value.trim();
    if (!content || !currentRecipientId) return;

    const { error } = await supabaseClient
        .from('messages')
        .insert({
            sender_id: currentUserId,
            recipient_id: currentRecipientId,
            content: content
        });

    if (error) {
        alert('Error sending message: ' + error.message);
        return;
    }

    // Clear input and reload messages
    messageInput.value = '';
    await loadMessages(currentRecipientId);
}

// Send new message (from modal)
async function sendNewMessage() {
    const recipientId = recipientSelect.value;
    const content = newMessageContent.value.trim();
    
    if (!recipientId || !content) {
        alert('Please select a recipient and enter a message');
        return;
    }

    const { error } = await supabaseClient
        .from('messages')
        .insert({
            sender_id: currentUserId,
            recipient_id: recipientId,
            content: content
        });

    if (error) {
        alert('Error sending message: ' + error.message);
        return;
    }

    // Close modal, clear fields, and reload conversations
    newMessageModal.classList.add('hidden');
    recipientSelect.value = '';
    newMessageContent.value = '';
    await loadConversations();
    
    // Open the new conversation
    await openConversation(recipientId);
}

// Set up event listeners
function setupEventListeners() {
    // Message form submission
    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await sendMessage();
    });

    // New message button
    newMessageBtn.addEventListener('click', () => {
        newMessageModal.classList.remove('hidden');
    });

    // Send new message button
    sendNewMessageBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await sendNewMessage();
    });

    // Cancel new message button
    cancelNewMessageBtn.addEventListener('click', () => {
        newMessageModal.classList.add('hidden');
    });

    // Close modal when clicking outside
    newMessageModal.addEventListener('click', (e) => {
        if (e.target === newMessageModal) {
            newMessageModal.classList.add('hidden');
        }
    });
}

// Set up real-time updates
function setupRealtimeUpdates() {
    supabaseClient
        .channel('messages')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `recipient_id=eq.${currentUserId}`
        }, payload => {
            // If this message is part of the current conversation, add it
            if (currentRecipientId && payload.new.sender_id === currentRecipientId) {
                const message = payload.new;
                const messageElement = document.createElement('div');
                messageElement.className = 'mb-4 flex justify-start';
                messageElement.innerHTML = `
                    <div class="max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-lg bg-white border border-gray-200">
                        <p>${message.content}</p>
                        <p class="text-xs mt-1 text-gray-500">
                            ${formatTime(message.created_at)}
                        </p>
                    </div>
                `;
                messagesContainer.appendChild(messageElement);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
            
            // Refresh conversations list to show new message
            loadConversations();
        })
        .subscribe();
}

// Helper functions
function formatTime(dateString) {
    const options = { hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleTimeString(undefined, options);
}
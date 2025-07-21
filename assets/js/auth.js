// Initialize Supabase
const supabaseUrl = 'https://heenvsshjcizlykpbcag.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlZW52c3NoamNpemx5a3BiY2FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwNDA0OTgsImV4cCI6MjA2ODYxNjQ5OH0.SZFhUuGhnqyRD91NdY265N5ojeS1wcMSwl9a2IOpNPQ' // Replace with your actual key
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey)

// DOM Elements
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginText = document.getElementById('loginText');
const loginSpinner = document.getElementById('loginSpinner');
const logoutBtn = document.getElementById('logoutBtn');

// Check if user is already logged in
async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        window.location.href = 'dashboard.html';
    }
}

// Login function
async function login(email, password) {
    loginText.textContent = 'Signing in...';
    loginSpinner.classList.remove('hidden');
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;
        
        // Redirect to dashboard after successful login
        window.location.href = 'dashboard.html';
    } catch (error) {
        alert(error.message);
        loginText.textContent = 'Sign In';
        loginSpinner.classList.add('hidden');
    }
}

// Logout function
async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Logout error:', error);
    } else {
        window.location.href = 'index.html';
    }
}

// Event Listeners
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value;
        const password = passwordInput.value;
        await login(email, password);
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
}

// Check auth status on page load
document.addEventListener('DOMContentLoaded', checkAuth);
// Initialize Supabase
const supabaseUrl = 'https://heenvsshjcizlykpbcag.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlZW52c3NoamNpemx5a3BiY2FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwNDA0OTgsImV4cCI6MjA2ODYxNjQ5OH0.SZFhUuGhnqyRD91NdY265N5ojeS1wcMSwl9a2IOpNPQ';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// DOM Elements
const productsTableBody = document.getElementById('productsTableBody');
const categoryFilter = document.getElementById('categoryFilter');
const expiryFilter = document.getElementById('expiryFilter');
const sortFilter = document.getElementById('sortFilter');
const applyFiltersBtn = document.getElementById('applyFiltersBtn');
const addProductBtn = document.getElementById('addProductBtn');
const exportProductsBtn = document.getElementById('exportProductsBtn');
const scanProductBtn = document.getElementById('scanProductBtn');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const showingFrom = document.getElementById('showingFrom');
const showingTo = document.getElementById('showingTo');
const totalItems = document.getElementById('totalItems');

// Modal elements
const productModal = document.getElementById('productModal');
const modalTitle = document.getElementById('modalTitle');
const productForm = document.getElementById('productForm');
const productId = document.getElementById('productId');
const productName = document.getElementById('productName');
const productDescription = document.getElementById('productDescription');
const productCategory = document.getElementById('productCategory');
const productQuantity = document.getElementById('productQuantity');
const productExpiry = document.getElementById('productExpiry');
const productBarcode = document.getElementById('productBarcode');
const saveProductBtn = document.getElementById('saveProductBtn');
const cancelProductBtn = document.getElementById('cancelProductBtn');

// Pagination
let currentPage = 1;
const itemsPerPage = 10;
let totalProducts = 0;

// Initialize products page
document.addEventListener('DOMContentLoaded', async () => {
    // Check auth
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Load categories for filters and modal
    await loadCategories(user.id);
    
    // Load initial products
    await loadProducts(user.id);
    
    // Set up event listeners
    setupEventListeners(user.id);
});

// Load categories
async function loadCategories(userId) {
    const { data: categories, error } = await supabaseClient
        .from('categories')
        .select('id, name')
        .eq('user_id', userId)
        .order('name', { ascending: true });

    if (error) {
        console.error('Error loading categories:', error);
        return;
    }

    // Clear and populate category filters
    categoryFilter.innerHTML = '<option value="">All Categories</option>';
    productCategory.innerHTML = '<option value="">Select a category</option>';
    
    categories.forEach(category => {
        categoryFilter.innerHTML += `<option value="${category.id}">${category.name}</option>`;
        productCategory.innerHTML += `<option value="${category.id}">${category.name}</option>`;
    });
}

// Load categories
async function loadCategories(userId) {
    // First check if user already has categories
    const { data: existingCategories, error: checkError } = await supabaseClient
        .from('categories')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

    if (checkError) {
        console.error('Error checking categories:', checkError);
        return;
    }

    // If no categories exist for this user, create default ones
    if (existingCategories.length === 0) {
        const defaultCategories = [
            { name: 'Medication', description: 'Pharmaceutical products' },
            { name: 'Perishable Food', description: 'Food with limited shelf life' },
            { name: 'Cosmetics', description: 'Beauty and personal care items' },
            { name: 'Cleaning Supplies', description: 'Household cleaning products' },
            { name: 'Baby Products', description: 'Items for infant care' }
        ];

        // Insert default categories
        const { error: insertError } = await supabaseClient
            .from('categories')
            .insert(defaultCategories.map(cat => ({
                user_id: userId,
                ...cat
            })));

        if (insertError) {
            console.error('Error creating default categories:', insertError);
            return;
        }
    }

    // Now load all categories (including newly created defaults)
    const { data: categories, error } = await supabaseClient
        .from('categories')
        .select('id, name')
        .eq('user_id', userId)
        .order('name', { ascending: true });

    if (error) {
        console.error('Error loading categories:', error);
        return;
    }

    // Clear and populate category filters
    categoryFilter.innerHTML = '<option value="">All Categories</option>';
    productCategory.innerHTML = '<option value="">Select a category</option>';
    
    categories.forEach(category => {
        categoryFilter.innerHTML += `<option value="${category.id}">${category.name}</option>`;
        productCategory.innerHTML += `<option value="${category.id}">${category.name}</option>`;
    });
}

// Load products with filters
async function loadProducts(userId, page = 1) {
    currentPage = page;
    
    // Build query based on filters
    let query = supabaseClient
        .from('products')
        .select(`
            id,
            name,
            description,
            quantity,
            expiry_date,
            barcode,
            categories (name)
        `, { count: 'exact' })
        .eq('user_id', userId);

    // Apply category filter
    const selectedCategory = categoryFilter.value;
    if (selectedCategory) {
        query = query.eq('category_id', selectedCategory);
    }

    // Apply expiry filter
    const selectedExpiry = expiryFilter.value;
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    if (selectedExpiry === 'expired') {
        query = query.lt('expiry_date', today);
    } else if (selectedExpiry === 'expiring_soon') {
        query = query.gte('expiry_date', today).lte('expiry_date', thirtyDaysLater);
    } else if (selectedExpiry === 'safe') {
        query = query.gt('expiry_date', thirtyDaysLater);
    }

    // Apply sorting
    const selectedSort = sortFilter.value;
    if (selectedSort === 'expiry_date_asc') {
        query = query.order('expiry_date', { ascending: true });
    } else if (selectedSort === 'expiry_date_desc') {
        query = query.order('expiry_date', { ascending: false });
    } else if (selectedSort === 'name_asc') {
        query = query.order('name', { ascending: true });
    } else if (selectedSort === 'name_desc') {
        query = query.order('name', { ascending: false });
    }

    // Apply pagination
    const from = (page - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;
    query = query.range(from, to);

    const { data: products, count, error } = await query;

    if (error) {
        productsTableBody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Error loading products</td></tr>';
        return;
    }

    totalProducts = count || 0;
    updatePaginationUI();

    if (products.length === 0) {
        productsTableBody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No products found</td></tr>';
        return;
    }

    // Populate products table
    productsTableBody.innerHTML = products.map(product => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <i class="fas fa-box text-indigo-600"></i>
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">${product.name}</div>
                        <div class="text-sm text-gray-500">${product.description || 'No description'}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">${product.categories.name}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">${product.quantity}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">${formatDate(product.expiry_date)}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getExpiryBadgeClass(product.expiry_date)}">
                    ${getExpiryStatus(product.expiry_date)}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button data-id="${product.id}" class="edit-product text-indigo-600 hover:text-indigo-900 mr-3">Edit</button>
                <button data-id="${product.id}" class="delete-product text-red-600 hover:text-red-900">Delete</button>
            </td>
        </tr>
    `).join('');

    // Add event listeners to edit/delete buttons
    document.querySelectorAll('.edit-product').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn.dataset.id));
    });

    document.querySelectorAll('.delete-product').forEach(btn => {
        btn.addEventListener('click', () => confirmDeleteProduct(btn.dataset.id));
    });
}

// Update pagination UI
function updatePaginationUI() {
    const from = (currentPage - 1) * itemsPerPage + 1;
    const to = Math.min(currentPage * itemsPerPage, totalProducts);
    
    showingFrom.textContent = from;
    showingTo.textContent = to;
    totalItems.textContent = totalProducts;
    
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage * itemsPerPage >= totalProducts;
}

// Set up event listeners
function setupEventListeners(userId) {
    // Filter buttons
    applyFiltersBtn.addEventListener('click', () => loadProducts(userId));
    
    // Pagination buttons
    prevPageBtn.addEventListener('click', () => loadProducts(userId, currentPage - 1));
    nextPageBtn.addEventListener('click', () => loadProducts(userId, currentPage + 1));
    
    // Add product button
    addProductBtn.addEventListener('click', openAddModal);
    
    // Export button
    exportProductsBtn.addEventListener('click', () => exportProducts(userId));
    
    // Scan button
    scanProductBtn.addEventListener('click', openScanModal);
    
    // Modal buttons
    saveProductBtn.addEventListener('click', () => saveProduct(userId));
    cancelProductBtn.addEventListener('click', closeModal);
    
    // Close modal when clicking outside
    productModal.addEventListener('click', (e) => {
        if (e.target === productModal) {
            closeModal();
        }
    });
}

// Open add product modal
function openAddModal() {
    modalTitle.textContent = 'Add New Product';
    productForm.reset();
    productId.value = '';
    productModal.classList.remove('hidden');
}

// Open edit product modal
async function openEditModal(productId) {
    const { data: product, error } = await supabaseClient
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

    if (error) {
        alert('Error loading product: ' + error.message);
        return;
    }

    modalTitle.textContent = 'Edit Product';
    productId.value = product.id;
    productName.value = product.name;
    productDescription.value = product.description || '';
    productCategory.value = product.category_id;
    productQuantity.value = product.quantity;
    productExpiry.value = product.expiry_date.split('T')[0];
    productBarcode.value = product.barcode || '';
    
    productModal.classList.remove('hidden');
}

// Close modal
function closeModal() {
    productModal.classList.add('hidden');
}

// Save product
async function saveProduct(userId) {
    if (!productForm.checkValidity()) {
        productForm.reportValidity();
        return;
    }

    const productData = {
        user_id: userId,
        name: productName.value,
        description: productDescription.value,
        category_id: productCategory.value,
        quantity: parseInt(productQuantity.value),
        expiry_date: productExpiry.value,
        barcode: productBarcode.value || null
    };

    try {
        if (productId.value) {
            // Update existing product
            const { error } = await supabaseClient
                .from('products')
                .update(productData)
                .eq('id', productId.value);

            if (error) throw error;
        } else {
            // Add new product
            const { error } = await supabaseClient
                .from('products')
                .insert(productData);

            if (error) throw error;
        }

        // Refresh products list
        await loadProducts(userId, currentPage);
        closeModal();
    } catch (error) {
        alert('Error saving product: ' + error.message);
    }
}

// Confirm product deletion
function confirmDeleteProduct(productId) {
    if (confirm('Are you sure you want to delete this product?')) {
        deleteProduct(productId);
    }
}

// Delete product
async function deleteProduct(productId) {
    try {
        const { error } = await supabaseClient
            .from('products')
            .delete()
            .eq('id', productId);

        if (error) throw error;

        // Refresh products list
        const { data: { user } } = await supabaseClient.auth.getUser();
        await loadProducts(user.id, currentPage);
    } catch (error) {
        alert('Error deleting product: ' + error.message);
    }
}

// Export products
async function exportProducts(userId) {
    try {
        // Get all products (without pagination)
        const { data: products, error } = await supabaseClient
            .from('products')
            .select(`
                name,
                description,
                quantity,
                expiry_date,
                barcode,
                categories (name)
            `)
            .eq('user_id', userId)
            .order('expiry_date', { ascending: true });

        if (error) throw error;

        // Convert to CSV
        const headers = ['Name', 'Description', 'Category', 'Quantity', 'Expiry Date', 'Barcode', 'Status'];
        const csvRows = [
            headers.join(','),
            ...products.map(p => [
                `"${p.name.replace(/"/g, '""')}"`,
                `"${(p.description || '').replace(/"/g, '""')}"`,
                `"${p.categories.name.replace(/"/g, '""')}"`,
                p.quantity,
                formatDate(p.expiry_date),
                p.barcode || '',
                getExpiryStatus(p.expiry_date)
            ].join(','))
        ];

        const csvContent = csvRows.join('\n');
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `products_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        alert('Error exporting products: ' + error.message);
    }
}

// Open scan modal
function openScanModal() {
    // Implement barcode scanning functionality
    alert('Barcode scanning functionality would be implemented here');
}

// Helper functions
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

function getExpiryStatus(expiryDate) {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Expired';
    if (diffDays <= 7) return 'Critical';
    if (diffDays <= 30) return 'Warning';
    return 'Safe';
}

function getExpiryBadgeClass(expiryDate) {
    const status = getExpiryStatus(expiryDate);
    switch (status) {
        case 'Expired': return 'bg-red-100 text-red-800';
        case 'Critical': return 'bg-red-100 text-red-800';
        case 'Warning': return 'bg-amber-100 text-amber-800';
        default: return 'bg-green-100 text-green-800';
    }
}

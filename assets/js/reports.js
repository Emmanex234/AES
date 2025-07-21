// Initialize Supabase
const supabaseUrl = 'https://heenvsshjcizlykpbcag.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlZW52c3NoamNpemx5a3BiY2FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwNDA0OTgsImV4cCI6MjA2ODYxNjQ5OH0.SZFhUuGhnqyRD91NdY265N5ojeS1wcMSwl9a2IOpNPQ';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey)
// DOM Elements
const reportType = document.getElementById('reportType');
const dateRange = document.getElementById('dateRange');
const customDateRangeContainer = document.getElementById('customDateRangeContainer');
const startDate = document.getElementById('startDate');
const endDate = document.getElementById('endDate');
const generateReportBtn = document.getElementById('generateReportBtn');
const reportPreview = document.getElementById('reportPreview');

// Initialize reports page
document.addEventListener('DOMContentLoaded', async () => {
    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Set default dates
    const today = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(today.getDate() + 30);
    
    startDate.value = today.toISOString().split('T')[0];
    endDate.value = thirtyDaysLater.toISOString().split('T')[0];

    // Set up event listeners
    setupEventListeners(user.id);
});

// Set up event listeners
function setupEventListeners(userId) {
    // Date range toggle
    dateRange.addEventListener('change', function() {
        customDateRangeContainer.classList.toggle('hidden', this.value !== 'custom');
    });

    // Generate report button
    generateReportBtn.addEventListener('click', () => generatePdfReport(userId));

    // When filters change, update preview
    reportType.addEventListener('change', () => updateReportPreview(userId));
    dateRange.addEventListener('change', () => updateReportPreview(userId));
    startDate.addEventListener('change', () => updateReportPreview(userId));
    endDate.addEventListener('change', () => updateReportPreview(userId));

    // Initial preview update
    updateReportPreview(userId);
}

// Update report preview
async function updateReportPreview(userId) {
    try {
        const products = await fetchReportData(userId);
        
        if (products.length === 0) {
            reportPreview.innerHTML = '<p class="text-gray-500 text-center">No products match the selected filters</p>';
            return;
        }

        // Create a simple HTML preview
        let html = `
            <div class="mb-4">
                <h4 class="font-medium text-lg text-gray-900 mb-2">${getReportTitle()}</h4>
                <p class="text-sm text-gray-500">${products.length} products found</p>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
        `;

        products.forEach(product => {
            html += `
                <tr>
                    <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">${product.name}</td>
                    <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-500">${product.categories.name}</td>
                    <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">${product.quantity}</td>
                    <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">${formatDate(product.expiry_date)}</td>
                    <td class="px-4 py-2 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getExpiryBadgeClass(product.expiry_date)}">
                            ${getExpiryStatus(product.expiry_date)}
                        </span>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        reportPreview.innerHTML = html;
    } catch (error) {
        reportPreview.innerHTML = '<p class="text-red-500 text-center">Error loading report data</p>';
        console.error('Report preview error:', error);
    }
}

// Fetch report data
async function fetchReportData(userId) {
    let query = supabase
        .from('products')
        .select(`
            name,
            quantity,
            expiry_date,
            categories (name)
        `)
        .eq('user_id', userId);

    // Apply report type filter
    const type = reportType.value;
    const today = new Date().toISOString().split('T')[0];
    
    if (type === 'expiring_soon') {
        const endDateValue = getEndDate();
        query = query.gte('expiry_date', today).lte('expiry_date', endDateValue);
    } else if (type === 'expired') {
        query = query.lt('expiry_date', today);
    }
    // 'inventory' and 'category' types don't need additional filters

    // Apply sorting
    query = query.order('expiry_date', { ascending: true });

    const { data: products, error } = await query;

    if (error) throw error;
    return products || [];
}

// Generate PDF report
async function generatePdfReport(userId) {
    try {
        const products = await fetchReportData(userId);
        
        if (products.length === 0) {
            alert('No products found for the selected filters');
            return;
        }

        // Create PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Add title
        doc.setFontSize(18);
        doc.text(getReportTitle(), 14, 20);
        
        // Add date range if applicable
        if (reportType.value !== 'inventory') {
            doc.setFontSize(12);
            const dateText = dateRange.value === 'custom' 
                ? `From ${formatDate(startDate.value)} to ${formatDate(endDate.value)}`
                : `Next ${dateRange.value} days`;
            doc.text(dateText, 14, 30);
        }
        
        // Add generated date
        doc.setFontSize(10);
        doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 40);
        
        // Prepare data for the table
        const tableData = products.map(p => [
            p.name,
            p.categories.name,
            p.quantity,
            formatDate(p.expiry_date),
            getExpiryStatus(p.expiry_date)
        ]);
        
        // Add table
        doc.autoTable({
            head: [['Product', 'Category', 'Qty', 'Expiry Date', 'Status']],
            body: tableData,
            startY: 45,
            styles: {
                fontSize: 9,
                cellPadding: 3,
                valign: 'middle'
            },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 15 },
                3: { cellWidth: 30 },
                4: { cellWidth: 25 }
            },
            didDrawCell: (data) => {
                if (data.column.index === 4 && data.cell.section === 'body') {
                    const status = data.cell.raw;
                    const colors = {
                        'Expired': [255, 0, 0],
                        'Critical': [255, 0, 0],
                        'Warning': [255, 159, 64],
                        'Safe': [0, 128, 0]
                    };
                    
                    if (colors[status]) {
                        doc.setFillColor(...colors[status]);
                        doc.rect(data.cell.x + 1, data.cell.y + 1, 6, 6, 'F');
                    }
                }
            }
        });
        
        // Save the PDF
        doc.save(`ExpiryAlert_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
        alert('Error generating report: ' + error.message);
        console.error('PDF generation error:', error);
    }
}

// Helper functions
function getReportTitle() {
    const types = {
        'expiring_soon': 'Products Expiring Soon',
        'expired': 'Expired Products',
        'inventory': 'Full Inventory Report',
        'category': 'Products by Category'
    };
    return types[reportType.value] || 'Product Report';
}

function getEndDate() {
    if (dateRange.value === 'custom') {
        return endDate.value;
    }
    
    const days = parseInt(dateRange.value);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    return endDate.toISOString().split('T')[0];
}

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
// Main JavaScript utilities for the EDA application

// API Utility Functions
class APIClient {
    constructor() {
        this.baseURL = '';
        this.requestInterceptors = [];
        this.responseInterceptors = [];
    }

    // Add request interceptor
    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }

    // Add response interceptor
    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);
    }

    // Make API request
    async request(url, options = {}) {
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        // Apply request interceptors
        for (const interceptor of this.requestInterceptors) {
            config = await interceptor(config);
        }

        try {
            showLoading();
            const response = await fetch(this.baseURL + url, config);
            let data = await response.json();

            // Apply response interceptors
            for (const interceptor of this.responseInterceptors) {
                data = await interceptor(data, response);
            }

            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API request failed:', error);
            showToast(error.message, 'error');
            throw error;
        } finally {
            hideLoading();
        }
    }

    // GET request
    async get(url, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = queryString ? `${url}?${queryString}` : url;
        return this.request(fullUrl, { method: 'GET' });
    }

    // POST request
    async post(url, data = {}) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // PUT request
    async put(url, data = {}) {
        return this.request(url, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // DELETE request
    async delete(url) {
        return this.request(url, { method: 'DELETE' });
    }

    // Upload file
    async uploadFile(url, formData) {
        return this.request(url, {
            method: 'POST',
            body: formData,
            headers: {} // Remove Content-Type to let browser set it for FormData
        });
    }
}

// Create global API client instance
const api = new APIClient();

// Toast Notification System
class ToastManager {
    constructor() {
        this.container = this.createContainer();
        this.toasts = [];
    }

    createContainer() {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }

    show(message, type = 'info', duration = 5000) {
        const toast = this.createToast(message, type);
        this.container.appendChild(toast);
        this.toasts.push(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 100);

        // Auto remove
        if (duration > 0) {
            setTimeout(() => this.remove(toast), duration);
        }

        return toast;
    }

    createToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ⓘ'
        };

        toast.innerHTML = `
            <div class="toast-header">
                <span>${icons[type] || icons.info}</span>
                <span>${type.charAt(0).toUpperCase() + type.slice(1)}</span>
                <button type="button" class="toast-close" onclick="toastManager.remove(this.closest('.toast'))">×</button>
            </div>
            <div class="toast-body">${message}</div>
        `;

        return toast;
    }

    remove(toast) {
        if (toast && toast.parentNode) {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                    this.toasts = this.toasts.filter(t => t !== toast);
                }
            }, 300);
        }
    }

    clear() {
        this.toasts.forEach(toast => this.remove(toast));
    }
}

// Create global toast manager
const toastManager = new ToastManager();

// Toast utility functions
function showToast(message, type = 'info', duration = 5000) {
    return toastManager.show(message, type, duration);
}

function hideToast(toast) {
    toastManager.remove(toast);
}

function clearToasts() {
    toastManager.clear();
}

// Modal System
class ModalManager {
    constructor() {
        this.modals = new Map();
        this.currentModal = null;
    }

    create(id, title, content, options = {}) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = `modal-${id}`;
        
        modal.innerHTML = `
            <div class="modal" style="width: ${options.width || 'auto'}">
                <div class="modal-header">
                    <h5 class="modal-title">${title}</h5>
                    <button type="button" class="modal-close" onclick="modalManager.hide('${id}')">×</button>
                </div>
                <div class="modal-body">${content}</div>
                ${options.footer ? `<div class="modal-footer">${options.footer}</div>` : ''}
            </div>
        `;

        document.body.appendChild(modal);
        this.modals.set(id, modal);

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hide(id);
            }
        });

        return modal;
    }

    show(id) {
        const modal = this.modals.get(id);
        if (modal) {
            this.currentModal = modal;
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    hide(id) {
        const modal = this.modals.get(id);
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
            this.currentModal = null;
        }
    }

    remove(id) {
        const modal = this.modals.get(id);
        if (modal) {
            modal.parentNode.removeChild(modal);
            this.modals.delete(id);
        }
    }

    confirm(title, message, onConfirm) {
        const id = 'confirm-' + Date.now();
        const content = `<p>${message}</p>`;
        const footer = `
            <button type="button" class="btn btn-secondary" onclick="modalManager.hide('${id}')">Cancel</button>
            <button type="button" class="btn btn-danger" onclick="modalManager.handleConfirm('${id}', arguments[0])" data-confirm="true">Confirm</button>
        `;

        const modal = this.create(id, title, content, { footer });
        modal._onConfirm = onConfirm;
        this.show(id);
    }

    handleConfirm(id, callback) {
        const modal = this.modals.get(id);
        if (modal && modal._onConfirm) {
            modal._onConfirm();
        }
        this.hide(id);
        this.remove(id);
    }
}

// Create global modal manager
const modalManager = new ModalManager();

// Loading System
let loadingCount = 0;
let loadingOverlay = null;

function createLoadingOverlay() {
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            backdrop-filter: blur(2px);
        `;
        loadingOverlay.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(loadingOverlay);
    }
    return loadingOverlay;
}

function showLoading() {
    loadingCount++;
    const overlay = createLoadingOverlay();
    overlay.style.display = 'flex';
}

function hideLoading() {
    loadingCount = Math.max(0, loadingCount - 1);
    if (loadingCount === 0 && loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

// Form Utilities
function serializeForm(form) {
    const formData = new FormData(form);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
        if (data[key]) {
            // Handle multiple values (checkboxes, multiple selects)
            if (Array.isArray(data[key])) {
                data[key].push(value);
            } else {
                data[key] = [data[key], value];
            }
        } else {
            data[key] = value;
        }
    }
    
    return data;
}

function populateForm(form, data) {
    for (const [key, value] of Object.entries(data)) {
        const element = form.querySelector(`[name="${key}"]`);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = Boolean(value);
            } else if (element.type === 'radio') {
                if (element.value === value) {
                    element.checked = true;
                }
            } else {
                element.value = value;
            }
        }
    }
}

function validateForm(form, rules = {}) {
    const errors = {};
    const data = serializeForm(form);
    
    for (const [field, fieldRules] of Object.entries(rules)) {
        const value = data[field];
        
        if (fieldRules.required && (!value || value.trim() === '')) {
            errors[field] = 'This field is required';
            continue;
        }
        
        if (value && fieldRules.minLength && value.length < fieldRules.minLength) {
            errors[field] = `Minimum length is ${fieldRules.minLength}`;
            continue;
        }
        
        if (value && fieldRules.maxLength && value.length > fieldRules.maxLength) {
            errors[field] = `Maximum length is ${fieldRules.maxLength}`;
            continue;
        }
        
        if (value && fieldRules.pattern && !fieldRules.pattern.test(value)) {
            errors[field] = fieldRules.message || 'Invalid format';
            continue;
        }
        
        if (value && fieldRules.custom && !fieldRules.custom(value)) {
            errors[field] = fieldRules.message || 'Invalid value';
        }
    }
    
    // Display errors
    form.querySelectorAll('.error-message').forEach(el => el.remove());
    form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    
    for (const [field, message] of Object.entries(errors)) {
        const element = form.querySelector(`[name="${field}"]`);
        if (element) {
            element.classList.add('is-invalid');
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message text-danger mt-1';
            errorDiv.textContent = message;
            element.parentNode.appendChild(errorDiv);
        }
    }
    
    return Object.keys(errors).length === 0;
}

// File Upload Utilities
function setupFileUpload(element, options = {}) {
    const input = element.querySelector('input[type="file"]') || element;
    const dropZone = element.classList.contains('file-drop-zone') ? element : element.querySelector('.file-drop-zone');
    
    if (dropZone) {
        // Drag and drop functionality
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
        });
        
        dropZone.addEventListener('drop', handleDrop, false);
        dropZone.addEventListener('click', () => input.click());
    }
    
    input.addEventListener('change', handleFiles);
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function handleDrop(e) {
        const files = e.dataTransfer.files;
        handleFiles({ target: { files } });
    }
    
    function handleFiles(e) {
        const files = [...e.target.files];
        
        if (options.multiple === false && files.length > 1) {
            showToast('Please select only one file', 'warning');
            return;
        }
        
        if (options.accept) {
            const validFiles = files.filter(file => {
                const fileType = file.type || '';
                const fileName = file.name || '';
                const acceptTypes = options.accept.split(',').map(type => type.trim());
                
                return acceptTypes.some(type => {
                    if (type.startsWith('.')) {
                        return fileName.toLowerCase().endsWith(type.toLowerCase());
                    } else if (type.includes('*')) {
                        const baseType = type.split('/')[0];
                        return fileType.startsWith(baseType);
                    } else {
                        return fileType === type;
                    }
                });
            });
            
            if (validFiles.length !== files.length) {
                showToast('Some files have invalid format', 'warning');
            }
            
            files.length = 0;
            files.push(...validFiles);
        }
        
        if (options.maxSize) {
            const validFiles = files.filter(file => file.size <= options.maxSize);
            if (validFiles.length !== files.length) {
                showToast('Some files are too large', 'warning');
            }
            files.length = 0;
            files.push(...validFiles);
        }
        
        if (options.onFiles) {
            options.onFiles(files);
        }
    }
}

// Data Table Utilities
function createDataTable(container, data, options = {}) {
    if (!data || data.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">No data available</p>';
        return;
    }
    
    const columns = options.columns || Object.keys(data[0]);
    const maxRows = options.maxRows || 100;
    const displayData = data.slice(0, maxRows);
    
    let html = `
        <div class="data-table-container">
            <table class="data-table table">
                <thead>
                    <tr>
                        ${columns.map(col => `<th>${col}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${displayData.map(row => `
                        <tr>
                            ${columns.map(col => `<td title="${row[col] || ''}">${row[col] || ''}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    if (data.length > maxRows) {
        html += `<p class="text-center text-muted mt-2">Showing ${maxRows} of ${data.length} rows</p>`;
    }
    
    container.innerHTML = html;
}

// Chart Utilities (for use with Plotly.js)
function createChart(containerId, data, layout = {}, config = {}) {
    const defaultLayout = {
        plot_bgcolor: 'transparent',
        paper_bgcolor: 'transparent',
        font: { color: '#ffffff' },
        colorway: ['#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#20c997'],
        ...layout
    };
    
    const defaultConfig = {
        displayModeBar: false,
        responsive: true,
        ...config
    };
    
    if (typeof Plotly !== 'undefined') {
        Plotly.newPlot(containerId, data, defaultLayout, defaultConfig);
    } else {
        console.warn('Plotly.js not loaded');
    }
}

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatNumber(num, decimals = 2) {
    if (num === null || num === undefined) return '';
    if (typeof num !== 'number') return num;
    
    if (Math.abs(num) >= 1e6) {
        return (num / 1e6).toFixed(decimals) + 'M';
    } else if (Math.abs(num) >= 1e3) {
        return (num / 1e3).toFixed(decimals) + 'K';
    } else {
        return num.toFixed(decimals);
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied to clipboard', 'success', 2000);
        });
    } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('Copied to clipboard', 'success', 2000);
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips
    const tooltips = document.querySelectorAll('[data-tooltip]');
    tooltips.forEach(element => {
        element.addEventListener('mouseenter', showTooltip);
        element.addEventListener('mouseleave', hideTooltip);
    });
    
    // Initialize file uploads
    const fileUploads = document.querySelectorAll('.file-upload, .file-drop-zone');
    fileUploads.forEach(element => {
        const options = {
            accept: element.dataset.accept,
            multiple: element.dataset.multiple !== 'false',
            maxSize: element.dataset.maxSize ? parseInt(element.dataset.maxSize) : null
        };
        setupFileUpload(element, options);
    });
    
    // Close modals on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modalManager.currentModal) {
            modalManager.currentModal.classList.remove('show');
            document.body.style.overflow = '';
        }
    });
    
    console.log('EDA Application initialized');
});

function showTooltip(e) {
    const text = e.target.dataset.tooltip;
    if (!text) return;
    
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip-popup';
    tooltip.textContent = text;
    tooltip.style.cssText = `
        position: absolute;
        background: var(--secondary-bg);
        color: var(--text-primary);
        padding: 0.5rem;
        border-radius: var(--border-radius-sm);
        font-size: 0.8rem;
        z-index: 1000;
        pointer-events: none;
        box-shadow: var(--shadow-md);
    `;
    
    document.body.appendChild(tooltip);
    
    const rect = e.target.getBoundingClientRect();
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = rect.top - tooltip.offsetHeight - 5 + 'px';
    
    e.target._tooltip = tooltip;
}

function hideTooltip(e) {
    if (e.target._tooltip) {
        e.target._tooltip.remove();
        e.target._tooltip = null;
    }
}
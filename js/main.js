// Research Intelligence Hub - Main JavaScript
// Configuration settings
const CONFIG_SETTINGS = {
    outputTypesUrl: '../config/output-types.json', // Path to external JSON file
    retryAttempts: 2,
    retryDelay: 500 // milliseconds
};

// Embedded configuration for demo (minimal fallback)
const EMBEDDED_CONFIG = {
    "claims": {
        "title": "Scientific Claims with Proof",
        "icon": "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
        "description": "Verified research findings with industrial validation, evidence trails, and implementation proof",
        "tag": "Validated industrial claims",
        "checked": true
    },
    "metadata": {
        "version": "1.0.0",
        "lastUpdated": "2025-06-03",
        "description": "Research Intelligence Hub output types configuration - minimal fallback"
    }
};

// Function to load configuration from external JSON file
async function loadOutputTypesConfig() {
    // Always try to load from external file first
    let attempts = 0;
    
    while (attempts < CONFIG_SETTINGS.retryAttempts) {
        try {
            console.log(`Loading output types configuration from: ${CONFIG_SETTINGS.outputTypesUrl}`);
            
            const response = await fetch(CONFIG_SETTINGS.outputTypesUrl, {
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const config = await response.json();
            console.log('✅ External configuration loaded successfully');
            return config;
            
        } catch (error) {
            attempts++;
            console.error(`❌ Attempt ${attempts} failed to load external config:`, error.message);
            
            if (attempts < CONFIG_SETTINGS.retryAttempts) {
                console.log(`⏳ Retrying in ${CONFIG_SETTINGS.retryDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, CONFIG_SETTINGS.retryDelay));
            }
        }
    }
    
    // If external file loading failed, use embedded config as fallback
    console.log('⚠️ External file not found, using embedded configuration');
    console.log('💡 To use external config, ensure ../config/output-types.json exists and is accessible');
    return EMBEDDED_CONFIG;
}

// Function to handle checkbox change
function handleCheckboxChange(checkbox) {
    console.log('handleCheckboxChange called for:', checkbox.id, 'checked:', checkbox.checked);
    const option = checkbox.closest('.output-option');
    
    if (checkbox.checked) {
        option.classList.add('selected');
        console.log('Added selected class to:', checkbox.id);
    } else {
        option.classList.remove('selected');
        console.log('Removed selected class from:', checkbox.id);
    }
    
    updateSelectionSummary();
}

// Function to update selection summary
function updateSelectionSummary() {
    const selectedCheckboxes = document.querySelectorAll('.output-option input[type="checkbox"]:checked');
    const selectionSummary = document.getElementById('selection-summary');
    const selectionCount = document.getElementById('selection-count');
    const selectedItems = document.getElementById('selected-items');
    
    console.log('updateSelectionSummary: found', selectedCheckboxes.length, 'selected checkboxes');
    
    const count = selectedCheckboxes.length;
    selectionCount.textContent = count;
    
    if (count > 0) {
        selectionSummary.classList.add('has-selections');
        selectedItems.innerHTML = '';
        
        selectedCheckboxes.forEach(checkbox => {
            const outputType = checkbox.closest('.output-option');
            const titleElement = outputType.querySelector('.output-title');
            // Get only the text, excluding the SVG
            const titleText = Array.from(titleElement.childNodes)
                .filter(node => node.nodeType === Node.TEXT_NODE)
                .map(node => node.textContent.trim())
                .join('');
            
            const selectedItem = document.createElement('div');
            selectedItem.className = 'selected-item';
            selectedItem.innerHTML = `
                ${titleText}
                <button class="remove-btn" data-checkbox-id="${checkbox.id}" title="Remove ${titleText}">×</button>
            `;
            selectedItems.appendChild(selectedItem);
        });
    } else {
        selectionSummary.classList.remove('has-selections');
        selectedItems.innerHTML = '<span class="no-selections">No output types selected. Please choose at least one option below.</span>';
    }
}

// Function to validate configuration structure
function validateConfig(config) {
    if (!config || typeof config !== 'object') {
        console.error('❌ Configuration is not a valid object');
        return false;
    }

    const requiredFields = ['title', 'icon', 'description', 'tag'];
    
    for (const [key, outputType] of Object.entries(config)) {
        // Skip metadata object
        if (key === 'metadata') continue;
        
        if (!outputType || typeof outputType !== 'object') {
            console.error(`❌ Output type '${key}' is not a valid object`);
            return false;
        }
        
        for (const field of requiredFields) {
            if (!outputType[field]) {
                console.error(`❌ Missing required field '${field}' in output type '${key}'`);
                return false;
            }
        }
    }
    
    console.log('✅ Configuration validation passed');
    return true;
}

// Function to show error state
function showConfigError(error) {
    const outputGrid = document.querySelector('.output-grid');
    outputGrid.innerHTML = `
        <div class="config-error">
            <div class="error-title">⚠️ Configuration Error</div>
            <div class="error-message">${error.message}</div>
            <div class="error-instruction">
                Please ensure <code>../config/output-types.json</code> exists and is properly formatted.
            </div>
            <button class="retry-button" onclick="location.reload()">Retry</button>
        </div>
    `;
}

// Function to render output types from configuration
function renderOutputTypes(config) {
    const outputGrid = document.querySelector('.output-grid');
    
    // Show loading state initially
    outputGrid.innerHTML = '<div class="loading-message">Loading output types...</div>';

    // Validate configuration
    if (!validateConfig(config)) {
        showConfigError(new Error('Invalid configuration format. Please check the JSON file structure.'));
        return;
    }

    // Clear loading state
    outputGrid.innerHTML = '';

    // Filter out metadata and render output types
    const outputTypes = Object.entries(config).filter(([key]) => key !== 'metadata');

    outputTypes.forEach(([key, outputType]) => {
        const label = document.createElement('label');
        label.className = 'output-option';
        label.setAttribute('for', key);

        label.innerHTML = `
            <input type="checkbox" id="${key}" value="${key}" ${outputType.checked ? 'checked' : ''}>
            <div class="output-title">
                <svg class="icon" viewBox="0 0 24 24">
                    <path d="${outputType.icon}"/>
                </svg>
                ${outputType.title}
            </div>
            <div class="output-description">
                ${outputType.description}
            </div>
            <span class="example-tag">${outputType.tag}</span>
        `;

        // Get the checkbox element
        const checkbox = label.querySelector('input[type="checkbox"]');

        // Add click event to the label (but not checkbox to avoid double-firing)
        label.addEventListener('click', function(e) {
            // Don't handle if clicking on checkbox directly or remove button
            if (e.target.type === 'checkbox' || e.target.classList.contains('remove-btn')) {
                return;
            }
            
            // Prevent the event from bubbling to the checkbox
            e.preventDefault();
            e.stopPropagation();
            
            // Toggle the checkbox
            console.log('Toggling checkbox:', checkbox.id, 'from', checkbox.checked, 'to', !checkbox.checked);
            checkbox.checked = !checkbox.checked;
            handleCheckboxChange(checkbox);
        });

        // Add change event to checkbox for direct clicks ONLY
        checkbox.addEventListener('change', function(e) {
            // Only handle this if the click was directly on the checkbox
            if (e.target === this) {
                console.log('Direct checkbox change event:', this.id, this.checked);
                handleCheckboxChange(this);
            }
        });

        // Initialize selected state
        if (outputType.checked) {
            label.classList.add('selected');
        }

        outputGrid.appendChild(label);
    });

    console.log(`✅ Rendered ${outputTypes.length} output types`);
    
    // Update selection summary after rendering
    updateSelectionSummary();
}

// Handle remove button clicks using event delegation
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('remove-btn')) {
        const checkboxId = e.target.getAttribute('data-checkbox-id');
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
            checkbox.checked = false;
            handleCheckboxChange(checkbox);
        }
    }
});

// Handle search execution
async function executeSearch() {
    const query = document.getElementById('research-query').value.trim();
    const button = document.querySelector('.search-button');
    const resultsSection = document.getElementById('results');
    const resultsContainer = document.getElementById('results-container');

    if (!query) {
        alert('Please enter a research question.');
        return;
    }

    // Get selected output types
    const selectedTypes = Array.from(document.querySelectorAll('.output-option input:checked'))
        .map(checkbox => checkbox.value);

    if (selectedTypes.length === 0) {
        alert('Please select at least one output type from the options above.');
        return;
    }

    // Show loading state
    button.classList.add('loading');
    button.querySelector('.button-text').textContent = 'Processing Query...';

    try {
        // Call app.js with the query and selected types
        await callAppJs(query, selectedTypes);
        
        // Show results
        resultsSection.classList.add('show');
        resultsSection.scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('Search error:', error);
        showErrorMessage(error.message || 'An error occurred while processing your query. Please try again.');
    } finally {
        // Reset button state
        button.classList.remove('loading');
        button.querySelector('.button-text').textContent = 'Discover Research Intelligence';
    }
}

// Function to call app.js 
async function callAppJs(query, selectedTypes) {
    console.log('🚀 Calling app.js...');
    
    try {
        const response = await fetch('/.netlify/functions/app', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: query,
                outputTypes: selectedTypes,
                timestamp: new Date().toISOString()
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('✅ Response from app.js:', result);
        
        displayResults(result);
        return result;
        
    } catch (error) {
        console.error('❌ Error calling app.js:', error);
        throw error;
    }
}

// Function to display results from app.js
function displayResults(result) {
    const resultsContainer = document.getElementById('results-container');
    resultsContainer.innerHTML = '';

    // Handle different result formats from your app.js
    if (result.results && Array.isArray(result.results)) {
        result.results.forEach(item => {
            const resultElement = createResultElement(item);
            resultsContainer.appendChild(resultElement);
        });
    } else if (result.summary) {
        // If app.js returns a summary
        const summaryElement = document.createElement('div');
        summaryElement.className = 'result-item';
        summaryElement.innerHTML = `
            <div class="result-type">Summary</div>
            <div class="result-title">Research Summary</div>
            <div class="result-content">${result.summary}</div>
        `;
        resultsContainer.appendChild(summaryElement);
    } else {
        // Generic display for any result format
        const genericElement = document.createElement('div');
        genericElement.className = 'result-item';
        genericElement.innerHTML = `
            <div class="result-type">Results</div>
            <div class="result-title">Research Results</div>
            <div class="result-content"><pre>${JSON.stringify(result, null, 2)}</pre></div>
        `;
        resultsContainer.appendChild(genericElement);
    }
}

// Function to show error messages
function showErrorMessage(message) {
    const resultsContainer = document.getElementById('results-container');
    const resultsSection = document.getElementById('results');
    
    resultsContainer.innerHTML = `
        <div class="search-error">
            <div class="error-title">❌ Search Error</div>
            <div class="error-message">${message}</div>
            <button class="retry-button" onclick="location.reload()">Try Again</button>
        </div>
    `;
    
    resultsSection.classList.add('show');
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Function to create result elements
function createResultElement(result) {
    const div = document.createElement('div');
    div.className = 'result-item';
    div.innerHTML = `
        <div class="result-type">${result.type}</div>
        <div class="result-title">${result.title}</div>
        <div class="result-content">${result.content}</div>
    `;
    return div;
}

// Initialize everything when DOM loads
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Initializing Research Intelligence Hub...');
    
    // Load configuration 
    try {
        const config = await loadOutputTypesConfig();
        renderOutputTypes(config);
    } catch (error) {
        console.error('💥 Failed to initialize application:', error);
        showConfigError(error);
    }
});

// Handle Enter key in textarea - needs to be added after DOM loads
document.addEventListener('DOMContentLoaded', function() {
    const queryInput = document.getElementById('research-query');
    if (queryInput) {
        queryInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                executeSearch();
            }
        });
    }
});

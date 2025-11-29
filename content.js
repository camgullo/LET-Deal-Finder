// content.js

// Configuration: The text/classes we are looking for to identify a provider
const PROVIDER_KEYWORDS = ["Patron Provider", "Host Rep", "Provider Tag", "Administrator", "Moderator"];
const PROVIDER_CLASSES = ["Role_PatronProvider", "Role_HostRep", "Role_Administrator", "Role_Moderator"];

// State
let isFilterActive = false; // "Show Providers Only"
let isInfiniteScrollEnabled = false;
let isHighlightActive = false; // "Highlight Mode"
let isHideQuotesActive = false; // "Hide Quotes"
let keywordFilter = ""; // Keyword text
let isCollapsed = false;

// Scroll State
let isLoading = false;
let scrollThrottleTimer = null; // For performance throttling

// --- UI Creation ---

function createControls() {
    // prevent duplicates
    if (document.getElementById('let-controls-container')) return;

    const container = document.createElement('div');
    container.id = 'let-controls-container';

    // Main Container Styling
    container.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 99999;
        background-color: rgba(255, 255, 255, 0.98);
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        border: 1px solid #dcdcdc;
        width: 260px;
        font-family: "Open Sans", sans-serif;
        transition: height 0.3s ease;
        overflow: hidden;
    `;

    // 1. Header (Drag/Collapse area)
    const header = document.createElement('div');
    header.style.cssText = `
        background-color: #2c3e50;
        color: white;
        padding: 10px 15px;
        font-weight: bold;
        font-size: 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        border-bottom: 1px solid #34495e;
    `;
    // Title
    header.innerHTML = `<span>⚡ LET Deal Finder</span> <span id="let-collapse-btn">[-]</span>`;
    header.onclick = toggleCollapse;
    container.appendChild(header);

    // 2. Body (Controls)
    const body = document.createElement('div');
    body.id = 'let-controls-body';
    body.style.cssText = `
        padding: 15px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    `;

    // -- Keyword Input --
    const keywordInput = document.createElement('input');
    keywordInput.type = 'text';
    keywordInput.placeholder = 'Filter keywords (e.g. NVMe)...';
    keywordInput.style.cssText = `
        padding: 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        width: 100%;
        box-sizing: border-box;
    `;
    keywordInput.oninput = (e) => {
        keywordFilter = e.target.value.toLowerCase();
        applyFilter();
    };
    body.appendChild(keywordInput);

    // -- Checkbox: Infinite Scroll --
    const scrollLabel = createCheckbox('Infinite Scroll', 'let-infinite-scroll-check', toggleInfiniteScroll);
    body.appendChild(scrollLabel);

    // -- Checkbox: Highlight Mode --
    const highlightLabel = createCheckbox('Highlight Providers', 'let-highlight-check', toggleHighlight);
    body.appendChild(highlightLabel);

    // -- Checkbox: Hide Quotes --
    const quotesLabel = createCheckbox('Hide Quoted Text', 'let-hide-quotes-check', toggleHideQuotes);
    body.appendChild(quotesLabel);

    // -- Button: Load Next 10 Pages --
    const loadBatchBtn = document.createElement('button');
    loadBatchBtn.innerText = 'Load Next 10 Pages';
    loadBatchBtn.style.cssText = `
        padding: 8px;
        background-color: #f39c12;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
        width: 100%;
    `;
    loadBatchBtn.onclick = loadBatchPages;
    body.appendChild(loadBatchBtn);

    // -- Toggle Button: Show Providers Only --
    const filterBtn = document.createElement('button');
    filterBtn.id = 'let-provider-filter-btn';
    filterBtn.innerText = 'Show Providers Only';
    filterBtn.style.cssText = `
        padding: 10px;
        background-color: #34495e;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        font-weight: bold;
        width: 100%;
        margin-top: 5px;
        transition: background-color 0.2s;
    `;
    filterBtn.onclick = toggleFilter;
    body.appendChild(filterBtn);

    container.appendChild(body);
    document.body.appendChild(container);

    // Inject styles for hiding quotes
    const style = document.createElement('style');
    style.id = 'let-dynamic-styles';
    style.innerHTML = `
        body.let-hide-quotes blockquote { display: none !important; }
        body.let-hide-quotes .Quote { display: none !important; }
    `;
    document.head.appendChild(style);

    // Restore saved settings
    restoreSettings();
}

function createCheckbox(labelText, id, changeHandler) {
    const label = document.createElement('label');
    label.style.cssText = `
        display: flex;
        align-items: center;
        color: #333;
        font-size: 13px;
        cursor: pointer;
        user-select: none;
    `;

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.style.marginRight = '8px';
    input.onchange = changeHandler;

    label.appendChild(input);
    label.appendChild(document.createTextNode(labelText));
    return label;
}

// --- Logic: Collapse ---

function toggleCollapse() {
    isCollapsed = !isCollapsed;
    const body = document.getElementById('let-controls-body');
    const btn = document.getElementById('let-collapse-btn');
    const container = document.getElementById('let-controls-container');

    if (isCollapsed) {
        body.style.display = 'none';
        btn.innerText = '[+]';
        container.style.width = 'auto'; // Shrink to fit header
    } else {
        body.style.display = 'flex';
        btn.innerText = '[-]';
        container.style.width = '260px';
    }
    localStorage.setItem('let_is_collapsed', isCollapsed);
}

// --- Logic: Filtering & Highlighting ---

function applyFilter() {
    const discussionRows = document.querySelectorAll('.ItemDiscussion, li.Item');

    discussionRows.forEach(row => {
        let isProvider = false;
        const rowText = row.innerText.toLowerCase();

        // 1. Determine if Provider
        PROVIDER_CLASSES.forEach(cls => {
            if (row.classList.contains(cls)) isProvider = true;
        });

        if (!isProvider) {
            const authorInfo = row.querySelector('.DiscussionMeta, .Meta-Discussion, .Author, .MItem.Role');
            if (authorInfo) {
                const authorText = authorInfo.innerText;
                PROVIDER_KEYWORDS.forEach(keyword => {
                    if (authorText.includes(keyword)) isProvider = true;
                });
            }
        }
        if (!isProvider) {
            const userLink = row.querySelector('.UserLink, .Author a');
            if (userLink && userLink.title) {
                 PROVIDER_KEYWORDS.forEach(keyword => {
                    if (userLink.title.includes(keyword)) isProvider = true;
                });
            }
        }

        // 2. Determine Visibility
        let shouldShow = true;

        // Rule A: "Show Providers Only" Filter
        if (isFilterActive && !isProvider) {
            shouldShow = false;
        }

        // Rule B: Keyword Filter
        if (keywordFilter && !rowText.includes(keywordFilter)) {
            shouldShow = false;
        }

        // Apply Visibility
        row.style.display = shouldShow ? '' : 'none';

        // 3. Apply Highlighting
        // Reset first
        row.style.backgroundColor = '';
        row.style.borderLeft = '';

        if (shouldShow && isHighlightActive && isProvider) {
            // Use RGBA for transparency so it works on both Dark Mode and Light Mode
            // 0.15 opacity adds a subtle green tint without overpowering text
            row.style.backgroundColor = 'rgba(46, 204, 113, 0.15)';
            row.style.borderLeft = '4px solid #2ecc71'; // Accent border
        }
    });
}

function toggleFilter() {
    isFilterActive = !isFilterActive;
    const btn = document.getElementById('let-provider-filter-btn');

    if (isFilterActive) {
        btn.innerText = 'Filter Active (Providers Only)';
        btn.style.backgroundColor = '#27ae60'; // Green
    } else {
        btn.innerText = 'Show Providers Only';
        btn.style.backgroundColor = '#34495e'; // Dark Blue
    }
    localStorage.setItem('let_filter_active', isFilterActive);
    applyFilter();

    // Check if we need to load more data to fill the screen
    if (isFilterActive && isInfiniteScrollEnabled) {
        handleScroll();
    }
}

function toggleHighlight(e) {
    isHighlightActive = e.target.checked;
    localStorage.setItem('let_highlight_active', isHighlightActive);
    applyFilter();
}

function toggleHideQuotes(e) {
    isHideQuotesActive = e.target.checked;
    localStorage.setItem('let_hide_quotes', isHideQuotesActive);

    if (isHideQuotesActive) {
        document.body.classList.add('let-hide-quotes');
    } else {
        document.body.classList.remove('let-hide-quotes');
    }
}

// --- Logic: Infinite Scroll ---

function toggleInfiniteScroll(e) {
    isInfiniteScrollEnabled = e.target.checked;
    localStorage.setItem('let_infinite_scroll', isInfiniteScrollEnabled);

    if (isInfiniteScrollEnabled) {
        window.addEventListener('scroll', handleScroll);
        handleScroll();
    } else {
        window.removeEventListener('scroll', handleScroll);
    }
}

function handleScroll() {
    if (!isInfiniteScrollEnabled || isLoading) return;

    // THROTTLE: Only run this check every 200ms
    if (scrollThrottleTimer) return;
    scrollThrottleTimer = setTimeout(() => {
        scrollThrottleTimer = null;

        // Actual Check
        const scrollPosition = window.innerHeight + window.scrollY;
        const threshold = document.body.offsetHeight - 800;

        if (scrollPosition >= threshold) {
            loadNextPage();
        }
    }, 200);
}

// Batch loading helper
async function loadBatchPages() {
    if (isLoading) return;
    const batchSize = 10;

    for (let i = 0; i < batchSize; i++) {
        showLoadingIndicator(true, `Loading page ${i + 1} of ${batchSize}...`);
        const success = await loadNextPage();

        if (!success) {
            showLoadingIndicator(true, "Reached end of list.");
            setTimeout(() => showLoadingIndicator(false), 2000);
            break;
        }
        // Small delay to be polite to the server
        await new Promise(r => setTimeout(r, 200));
    }

    showLoadingIndicator(false);
}

// Returns true if page loaded, false if no more pages
async function loadNextPage() {
    const nextLink = document.querySelector('.Pager .Next, #PagerBefore .Next');
    if (!nextLink || !nextLink.href) return false;

    isLoading = true;
    // Note: If calling from batch, the indicator text is managed by batch function
    if (!document.getElementById('let-loading-indicator')?.style.display === 'block') {
         showLoadingIndicator(true);
    }

    try {
        const response = await fetch(nextLink.href);
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');

        const newItems = doc.querySelectorAll('.ItemDiscussion, li.Item');
        const listContainer = document.querySelector('.DataList, ul.DataList');

        if (listContainer && newItems.length > 0) {
            newItems.forEach(item => listContainer.appendChild(item));
            applyFilter();
        }

        // Update Pager
        const oldPager = document.querySelector('.Pager');
        const newPager = doc.querySelector('.Pager');
        if (oldPager && newPager) {
            oldPager.innerHTML = newPager.innerHTML;
        } else if (oldPager) {
            oldPager.remove();
            return false;
        }
        return true;

    } catch (err) {
        console.error("Deal Finder: Error loading next page", err);
        return false;
    } finally {
        isLoading = false;
        // Only hide indicator if we aren't batch loading (batch loading manages its own hide)
        // Simple check: if we are scrolling naturally, hide it.
        if (scrollThrottleTimer !== null || !isInfiniteScrollEnabled) {
            showLoadingIndicator(false);
        }
    }
}

function showLoadingIndicator(show, text = "Loading more deals...") {
    let indicator = document.getElementById('let-loading-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'let-loading-indicator';
        indicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #f39c12;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-weight: bold;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 10000;
            display: none;
            font-size: 12px;
        `;
        document.body.appendChild(indicator);
    }
    indicator.innerText = text;
    indicator.style.display = show ? 'block' : 'none';
}

// --- Persistence ---

function restoreSettings() {
    // 1. Filter Active
    if (localStorage.getItem('let_filter_active') === 'true') {
        isFilterActive = false; // toggleFilter will flip it to true
        toggleFilter();
    }

    // 2. Infinite Scroll
    if (localStorage.getItem('let_infinite_scroll') === 'true') {
        const cb = document.getElementById('let-infinite-scroll-check');
        if (cb) {
            cb.checked = true;
            toggleInfiniteScroll({ target: cb });
        }
    }

    // 3. Highlight Mode
    if (localStorage.getItem('let_highlight_active') === 'true') {
        const cb = document.getElementById('let-highlight-check');
        if (cb) {
            cb.checked = true;
            isHighlightActive = true;
            applyFilter();
        }
    }

    // 4. Hide Quotes
    if (localStorage.getItem('let_hide_quotes') === 'true') {
        const cb = document.getElementById('let-hide-quotes-check');
        if (cb) {
            cb.checked = true;
            toggleHideQuotes({ target: cb });
        }
    }

    // 5. Collapsed State
    if (localStorage.getItem('let_is_collapsed') === 'true') {
        isCollapsed = false; // toggleCollapse will flip it to true
        toggleCollapse();
    }
}

// --- Initialization ---

const observer = new MutationObserver(() => {
    applyFilter();
});

window.addEventListener('load', () => {
    createControls();
    const list = document.querySelector('.DataList') || document.body;
    observer.observe(list, { childList: true, subtree: true });
});

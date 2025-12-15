// ---------------------------------------------------------
// EDITOR CONFIG & STATE
// ---------------------------------------------------------

const ROWS = [100, 200, 300, 400, 500];
const COLS = 5;
let quizData = {};

// Initialize with empty data
function initData() {
    for(let r=0; r<ROWS.length; r++) {
        for(let c=0; c<COLS; c++) {
            const id = `${r}-${c}`;
            quizData[id] = {
                points: ROWS[r],
                prompt: "",
                response: "",
                hint: "",
                audio: false,
                image: false,
                imageExt: "jpg"
            };
        }
    }
    renderGrid();
}

function renderGrid() {
    const container = document.getElementById('mainGrid');
    if(!container) return;
    
    container.innerHTML = '';

    ROWS.forEach((points, rIndex) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'grid-row';
        
        for(let c=0; c<COLS; c++) {
            const id = `${rIndex}-${c}`;
            const cellData = quizData[id];
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            
            // Mark as edited if response is filled
            if(cellData.response) cell.classList.add('edited');

            let icons = "";
            if(cellData.audio) icons += "♫ ";
            if(cellData.image) icons += "🖼 ";

            // Status Text logic
            let statusText = "Empty";
            if (cellData.response) statusText = "Ready";

            cell.innerHTML = `
                <div class="points-label">${points}</div>
                <div class="status-indicator">
                    ${statusText} 
                    ${icons ? ' | ' + icons : ''}
                </div>
            `;
            cell.onclick = () => openModal(rIndex, c);
            rowDiv.appendChild(cell);
        }
        container.appendChild(rowDiv);
    });
}

// ---------------------------------------------------------
// MODAL LOGIC
// ---------------------------------------------------------
let currentCellId = null;

function openModal(r, c) {
    currentCellId = `${r}-${c}`;
    const data = quizData[currentCellId];
    
    document.getElementById('modalTitle').innerText = `Editing: Row ${ROWS[r]} - Column ${c+1}`;
    document.getElementById('inputPrompt').value = data.prompt;
    document.getElementById('inputResponse').value = data.response;
    document.getElementById('inputHint').value = data.hint;
    
    document.getElementById('inputAudio').checked = data.audio;
    document.getElementById('audioFilenameDisplay').innerText = `Required file: Song ${c+1}-${r+1}.mp3`;

    document.getElementById('inputImage').checked = data.image;
    document.getElementById('inputImageExt').value = data.imageExt || 'jpg';
    updateImageFilenameDisplay(c+1, r+1);
    toggleImageOpts();

    document.getElementById('editModal').classList.add('open');
}

function toggleImageOpts() {
    const enabled = document.getElementById('inputImage').checked;
    const sel = document.getElementById('inputImageExt');
    sel.disabled = !enabled;
    
    if(currentCellId) {
        const parts = currentCellId.split('-');
        updateImageFilenameDisplay(parseInt(parts[1])+1, parseInt(parts[0])+1);
    }
}

function updateImageFilenameDisplay(col, row) {
    const ext = document.getElementById('inputImageExt').value;
    document.getElementById('imageFilenameDisplay').innerText = `Required file: Image ${col}-${row}.${ext}`;
}

document.getElementById('inputImageExt').onchange = function() {
    if(currentCellId) {
        const parts = currentCellId.split('-');
        updateImageFilenameDisplay(parseInt(parts[1])+1, parseInt(parts[0])+1);
    }
};

function closeModal() {
    document.getElementById('editModal').classList.remove('open');
}

function saveCell() {
    if(!currentCellId) return;
    
    quizData[currentCellId] = {
        ...quizData[currentCellId],
        prompt: document.getElementById('inputPrompt').value,
        response: document.getElementById('inputResponse').value,
        hint: document.getElementById('inputHint').value,
        audio: document.getElementById('inputAudio').checked,
        image: document.getElementById('inputImage').checked,
        imageExt: document.getElementById('inputImageExt').value
    };

    renderGrid();
    closeModal();
}

// ---------------------------------------------------------
// HELPER: Multi-line Text Parser
// ---------------------------------------------------------

/**
 * Extracts text from a DOM container, handling both:
 * 1. Multiple <p> tags (Legacy/JeopardyLabs style)
 * 2. Single <p> with <br> tags (Editor style)
 */
function parseComplexHTML(container) {
    if(!container) return "";
    
    // Check if we have multiple P tags (The "Merry Quizmas" file style)
    const pTags = container.querySelectorAll('p');
    
    if(pTags.length > 1) {
        // Collect text from all paragraphs and join with newlines
        return Array.from(pTags)
            .map(p => p.textContent.trim())
            .join('\n');
    }
    
    // Otherwise, handle standard HTML (strip tags, convert BR to newline)
    let html = container.innerHTML;
    
    // Replace <br> with newlines
    html = html.replace(/<br\s*\/?>/gi, '\n');
    
    // Also replace closing </p> with newlines just in case of weird nesting
    html = html.replace(/<\/p>/gi, '\n');
    
    // Use a temp element to strip remaining tags and decode entities
    const temp = document.createElement("div");
    temp.innerHTML = html;
    return temp.textContent.trim();
}

/**
 * Formats newline characters into <br> tags for HTML output
 */
function formatTextForExport(text) {
    if (!text) return "";
    return text.replace(/\n/g, "<br>");
}

// ---------------------------------------------------------
// IMPORT LOGIC
// ---------------------------------------------------------
function importQuiz(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(e.target.result, "text/html");

                // 1. Title
                const titleEl = doc.querySelector('title');
                if(titleEl) document.getElementById('quizTitle').value = titleEl.innerText;

                // 2. Global Hints Settings
                const scripts = doc.querySelectorAll('head script');
                let foundHintSetting = false;
                scripts.forEach(s => {
                    if(s.innerText.includes('var GLOBAL_HINTS_ENABLED')) {
                        if(s.innerText.includes('var GLOBAL_HINTS_ENABLED = false')) {
                            document.getElementById('globalHintsToggle').checked = false;
                        } else {
                            document.getElementById('globalHintsToggle').checked = true;
                        }
                        foundHintSetting = true;
                    }
                });
                // Default to true if not found (older quizzes)
                if(!foundHintSetting) document.getElementById('globalHintsToggle').checked = true;

                // 3. Categories
                const catInputs = document.querySelectorAll('.cat-input');
                const catCells = doc.querySelectorAll('.grid-row-cats .cat-cell');
                catCells.forEach((cell, index) => {
                    if(catInputs[index]) catInputs[index].value = cell.innerText;
                });

                // 4. Grid Data
                const cellGroups = doc.querySelectorAll('.grid-row-questions .cell-group');
                
                cellGroups.forEach(group => {
                    const r = parseInt(group.getAttribute('data-row')) - 1; 
                    const c = parseInt(group.getAttribute('data-col'));
                    const id = `${r}-${c}`;

                    // --- KEY CHANGE: TARGET THE CONTAINER, NOT THE <P> ---
                    // We grab .front and .back containers instead of specific p tags
                    const promptContainer = group.querySelector('.front');
                    const responseContainer = group.querySelector('.back');
                    const hintEl = group.querySelector('.hint-data');
                    
                    // Use the new parser
                    const prompt = parseComplexHTML(promptContainer);
                    const response = parseComplexHTML(responseContainer);
                    const hint = hintEl ? hintEl.innerText : "";
                    
                    const audioAttr = group.getAttribute('data-audio');
                    const audio = audioAttr === "true";

                    const imageAttr = group.getAttribute('data-image');
                    const image = imageAttr === "true";
                    const imageExt = group.getAttribute('data-image-ext') || 'jpg';

                    if(quizData[id]) {
                        quizData[id] = {
                            points: ROWS[r],
                            prompt: prompt,
                            response: response,
                            hint: hint,
                            audio: audio,
                            image: image,
                            imageExt: imageExt
                        };
                    }
                });

                renderGrid();
                alert("Import successful!");

            } catch (err) {
                console.error(err);
                alert("Error parsing file. Ensure it is a valid HTML file.");
            }
        };
        reader.readAsText(input.files[0]);
    }
    input.value = ""; 
}

// ---------------------------------------------------------
// EXPORT LOGIC
// ---------------------------------------------------------
function exportQuiz() {
    const title = document.getElementById('quizTitle').value;
    const hintsEnabled = document.getElementById('globalHintsToggle').checked;
    
    const catInputs = document.querySelectorAll('.cat-input');
    const categories = Array.from(catInputs).map(input => input.value);

    let gridHTML = `
        <div class="grid-row grid-row-cats" role="row">
            ${categories.map(cat => `
                <div class="grid-cell"><div class="cell"><div class="cell-inner cat-cell" role="columnheader">${cat}</div></div></div>
            `).join('')}
        </div>
    `;

    ROWS.forEach((points, r) => {
        const isFirst = r === 0 ? 'grid-first-row' : '';
        const isLast = r === ROWS.length - 1 ? 'grid-last-row' : '';
        
        gridHTML += `<div class="grid-row grid-row-questions ${isFirst} ${isLast}" role="row">`;
        
        for(let c=0; c<COLS; c++) {
            const id = `${r}-${c}`;
            const data = quizData[id];
            const uniqueId = `cell-${r}${c}-${Math.floor(Math.random()*10000)}`;
            const catName = categories[c].replace(/"/g, '&quot;');

            // Convert newlines to <br> for export
            const promptHTML = formatTextForExport(data.prompt);
            const responseHTML = formatTextForExport(data.response);

            gridHTML += `
                <div class="cell-group grid-cell" role="cell" id="${uniqueId}" tabindex="0" 
                     aria-label="${points}" data-row="${r+1}" data-col="${c}" 
                     data-audio="${data.audio}" 
                     data-image="${data.image}" 
                     data-image-ext="${data.imageExt}">
                    <div class="cell points">
                        <div class="cell-inner" data-category="${catName}">${points}</div>
                        <div class="front answer" tabindex="0"><p>${promptHTML}</p></div>
                        <div class="back question" tabindex="0"><p>${responseHTML}</p></div>
                        <div class="hint-data">${data.hint}</div>
                    </div>
                </div>
            `;
        }
        gridHTML += `</div>`;
    });

    const settingsScript = `<script>var GLOBAL_HINTS_ENABLED = ${hintsEnabled};<\/script>`;

    const finalHTML = GAME_TEMPLATE_START + 
                      `<title>${title}</title>` +
                      settingsScript + 
                      GAME_TEMPLATE_MID + 
                      gridHTML + 
                      GAME_TEMPLATE_END;

    const blob = new window.Blob([finalHTML], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ---------------------------------------------------------
// GAME TEMPLATES (The Engine)
// ---------------------------------------------------------

const GAME_TEMPLATE_START = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
<meta name="description" content="Jeopardy Template" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800;900&display=swap" rel="stylesheet">
<style type="text/css">
    :root { --bg-gradient-start: #0f172a; --bg-gradient-end: #312e81; --glass-bg: rgba(255, 255, 255, 0.08); --glass-border: rgba(255, 255, 255, 0.1); --text-main: #ffffff; --text-muted: #94a3b8; --accent-color: #6366f1; --accent-glow: #818cf8; --success: #10b981; --danger: #ef4444; --warning: #f59e0b; --font-main: 'Inter', sans-serif; }
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: var(--font-main); background: radial-gradient(circle at top left, #1e1b4b, #0f172a); background-attachment: fixed; color: var(--text-main); height: 100vh; overflow: hidden; -webkit-font-smoothing: antialiased; }
    #gameplay { display: flex; flex-direction: column; height: 100vh; width: 100vw; padding: 20px 20px 0 20px; position: relative; }
    .grid-container { flex: 1; display: flex; flex-direction: column; overflow: hidden; margin-bottom: 10px; }
    .grid { display: flex; flex-direction: column; width: 100%; height: 100%; max-width: 1600px; margin: 0 auto; gap: 10px; }
    .grid-row { display: flex; flex: 1; gap: 10px; width: 100%; min-height: 0; }
    #footer-area { flex: 0 0 auto; height: 140px; width: 100%; position: relative; display: flex; align-items: center; justify-content: center; padding-bottom: 10px; }
    .grid-cell { flex: 1; position: relative; cursor: pointer; perspective: 1000px; display: flex; flex-direction: column; }
    .grid-cell:focus { outline: none; }
    .cell { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; text-align: center; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: all 0.2s ease; overflow: hidden; }
    .grid-row-cats .cell { background: rgba(99, 102, 241, 0.2); border-bottom: 2px solid var(--accent-color); font-weight: 800; text-transform: uppercase; font-size: 1.2rem; text-shadow: 0 2px 4px rgba(0,0,0,0.3); letter-spacing: 0.05em; }
    .grid-row-questions .cell { font-family: var(--font-main); font-weight: 900; font-size: 4rem; color: var(--accent-glow); text-shadow: 0 0 15px rgba(129, 140, 248, 0.5); }
    .grid-row-questions .grid-cell:hover .cell { background: rgba(255, 255, 255, 0.15); border-color: var(--accent-glow); transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0,0,0,0.2), 0 0 15px var(--accent-color); }
    .inert .cell, .inert { opacity: 0.3; pointer-events: none; filter: grayscale(1); }
    .cell-inner { padding: 5px; width: 100%; word-break: break-word; }
    .front.answer, .back.question, .hint-data { display: none; }
    #teams-container { display: flex; gap: 15px; overflow-x: auto; padding: 5px; max-width: 90%; }
    .team { background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(10px); border: 1px solid var(--glass-border); border-radius: 12px; padding: 10px; min-width: 120px; width: 140px; text-align: center; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); position: relative; }
    .team.active-team { background: rgba(99, 102, 241, 0.25); border-color: var(--accent-glow); box-shadow: 0 0 20px rgba(99, 102, 241, 0.3); transform: translateY(-5px); }
    .team .name { font-size: 0.9rem; font-weight: 600; margin-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px; color: var(--text-main); outline: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .team .points { font-size: 1.8rem; font-weight: 800; color: var(--text-main); margin: 5px 0; }
    .team .pointer { display: flex; justify-content: space-around; margin-top: 5px; opacity: 0; transition: opacity 0.2s; }
    .team:hover .pointer, .team.active-team .pointer { opacity: 1; }
    .team .pointer span { cursor: pointer; font-size: 1.2rem; width: 25px; height: 25px; line-height: 25px; border-radius: 50%; background: rgba(255,255,255,0.1); transition: background 0.2s; }
    .team .pointer span:hover { background: rgba(255,255,255,0.3); }
    .team .pointer .plus { color: var(--success); }
    .team .pointer .minus { color: var(--danger); }
    .menu-picker { position: absolute; bottom: 20px; left: 20px; background: var(--glass-bg); border: 1px solid var(--glass-border); color: var(--text-muted); padding: 12px 20px; border-radius: 8px; text-align: center; text-decoration: none; font-weight: bold; text-transform: uppercase; font-size: 0.8rem; backdrop-filter: blur(5px); transition: all 0.2s; z-index: 50; display: flex; align-items: center; gap: 5px; }
    .menu-picker:hover { background: var(--accent-color); color: white; border-color: var(--accent-glow); }
    .modal-wrapper { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 1000; background: rgba(11, 15, 30, 0.98); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
    #question-modal { display: flex; flex-direction: column; width: 100%; height: 100%; justify-content: center; align-items: center; opacity: 0; transition: opacity 0.3s ease; }
    #question-modal.expanded { opacity: 1; }
    #modal-header { position: absolute; top: 0; left: 0; right: 0; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); z-index: 10; font-size: 0.9rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
    #question-title { color: var(--accent-glow); text-transform: uppercase; font-weight: 700; letter-spacing: 2px; font-size: 1.2rem; }
    #modal-header div[role="button"] { cursor: pointer; opacity: 0.6; transition: opacity 0.2s; display: flex; align-items: center; gap: 10px; }
    #modal-header div[role="button"]:hover { opacity: 1; }
    .modal-body { width: 80%; max-width: 1200px; height: 70vh; display: flex; align-items: center; justify-content: center; text-align: center; position: relative; }
    .modal-inner { font-size: 3rem; font-weight: 700; line-height: 1.4; color: white; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); padding: 60px; border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); max-height: 100%; overflow-y: auto; width: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; }
    #question-modal .front.answer { display: block !important; }
    #question-modal .back.question { display: none; }
    #question-modal .back.question.reveal { display: block !important; }
    #question-modal .question { color: #e2e8f0; margin-top: 30px; border-top: 2px solid rgba(255,255,255,0.1); padding-top: 20px; font-size: 0.8em; color: var(--accent-glow); }
    #question-modal img, #question-modal video { max-width: 100%; border-radius: 8px; margin: 10px auto; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
    kbd { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); padding: 3px 8px; border-radius: 4px; font-size: 0.7em; vertical-align: middle; }
    .audio-controls-container { margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: center; gap: 20px; width: 100%; }
    .audio-btn { background: rgba(255, 255, 255, 0.05); border: 1px solid var(--accent-color); color: white; padding: 12px 24px; border-radius: 50px; font-family: var(--font-main); font-weight: 600; font-size: 1rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 10px; outline: none; text-transform: uppercase; letter-spacing: 1px; }
    .audio-btn:hover { background: var(--accent-color); box-shadow: 0 0 20px var(--accent-glow); transform: scale(1.05); }
    .audio-btn:active { transform: scale(0.95); }
    .hint-container { margin-top: 15px; display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; }
    .hint-btn { background: rgba(245, 158, 11, 0.2); border: 1px solid var(--warning); color: #fbbf24; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-family: var(--font-main); font-weight: 600; font-size: 0.9rem; transition: all 0.2s; text-transform: uppercase; margin-top: 10px; }
    .hint-btn:hover { background: var(--warning); color: #000; box-shadow: 0 0 15px rgba(245, 158, 11, 0.4); }
    .hint-text-display { display: none; background: rgba(255, 255, 255, 0.1); padding: 10px 20px; border-radius: 8px; color: #fbbf24; font-style: italic; font-size: 1.2rem; border-left: 3px solid var(--warning); animation: fadeIn 0.3s ease-in; margin-top: 10px; }
    .hint-text-display.visible { display: block; }
    
    /* MODAL IMAGE SPECIFIC STYLE FOR NO SCROLLING */
    .question-image {
        max-width: 100%;
        max-height: 40vh; /* Reduced height to ensure it fits in modal with other elements */
        width: auto;
        height: auto;
        object-fit: contain;
        display: block;
        margin: 10px auto;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        flex-shrink: 1; /* Allow flexible shrinking */
    }

    #options { display: none; }
    #options .modal { position: relative; background: rgba(30, 41, 59, 0.8); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 40px; max-width: 600px; margin: 10% auto; text-align: center; color: white; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
    #options h1 { margin-bottom: 30px; font-size: 2.5rem; background: linear-gradient(to right, #fff, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    #options select { padding: 12px 20px; font-size: 1.1rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 8px; margin-right: 10px; outline: none; }
    #options input[type="button"] { padding: 12px 30px; font-size: 1.1rem; background: var(--accent-color); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; transition: transform 0.1s, background 0.2s; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4); }
    #options input[type="button"]:hover { background: var(--accent-glow); transform: scale(1.05); }
    #options input[type="button"]#re-init { background: transparent; border: 1px solid rgba(255,255,255,0.3); box-shadow: none; }
    #options input[type="button"]#re-init:hover { background: rgba(255,255,255,0.1); }
    .hide { display: none !important; }
    .resizing { transition: none !important; }
<\/style>
<script type="text/javascript">
function removeClass(selector, cls){ var doms = document.querySelectorAll(selector); for(var i = 0; i < doms.length; i++){ doms[i].classList.remove(cls); } }
function debounce(func, wait, immediate) { var timeout; return function() { var context = this, args = arguments; var later = function() { timeout = null; if (!immediate) func.apply(context, args); }; var callNow = immediate && !timeout; clearTimeout(timeout); timeout = setTimeout(later, wait); if (callNow) func.apply(context, args); }; };
function ready(fn) { if (document.readyState != 'loading' && document.body){ fn(); } else { document.addEventListener('DOMContentLoaded', fn); } }
if (!Math.log2) Math.log2 = function(x) { return Math.log(x) * Math.LOG2E; };
var shrink_cell_cache = {}; var enable_caching = false;
function shrink_cell($cell, $scaler, max_width, max_height, max_font_size, transforms, capsizes){ return _shrink_cell($cell, $scaler, max_width, max_height, max_font_size, transforms, capsizes); }
test_divs = [];
function initDivs(max_font_size){ if(test_divs.length-1 == max_font_size){ return; } for(var i = 0; i <= max_font_size; i++){ var dummy_element = test_divs[i]; if(!dummy_element){ var dummy_element = document.createElement("div"); dummy_element.style.display = "block"; dummy_element.style.position = "absolute"; dummy_element.style.left = "-100000px"; dummy_element.style.top = -(i*120) + "px"; dummy_element.style.fontFamily = "Inter, sans-serif"; dummy_element.style.color = "#000"; dummy_element.style.fontSize = i + "px"; test_divs[i] = dummy_element; var body = document.querySelectorAll('body')[0]; body.appendChild(dummy_element); } } }
function binarySearch(array, pred) { var lo = -1, hi = array.length; while (1 + lo < hi) { var mi = lo + ((hi - lo) >> 1); if (pred(array[mi], array, mi)) { hi = mi; } else { lo = mi; } } return hi; }
function escapeHtml(unsafe) { return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function getText(el){ var treeWalker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null, false); var text = []; while(treeWalker.nextNode()){ var node = treeWalker.currentNode; if(node.nodeType == 3){ text.push(escapeHtml(node.textContent)); } else if(node.tagName == "BR"){ text.push("<BR>"); } else if(node.tagName == "P"){ if(text.length != 0){ text.push("<BR>"); } } } return text.join(""); }
function _shrink_cell($cell, $scaler, max_width, max_height, max_font_size, transforms, capsizes, min_font_size){ var imgs = $cell.querySelectorAll("img"); for(var i = 0; i < imgs.length; i++){ var node = imgs[i]; if(!node.complete && !node.width){ node.addEventListener("load", function foo(){ _shrink_cell($cell, $scaler, max_width, max_height, max_font_size, transforms, capsizes, min_font_size); node.removeEventListener("load", foo); }); return; } } if(capsizes === undefined) capsizes = true; if(min_font_size === undefined) min_font_size = 1; var text = getText($scaler || $cell); initDivs(max_font_size); for(var i = 0; i <= max_font_size; i++){ dummy_element = test_divs[i]; dummy_element.innerHTML = text; dummy_element.style.width = max_width + "px"; dummy_element.style.height = max_height + "px"; } var font_size = binarySearch(test_divs, function(div){ var isHorizontalScrollbar= div.scrollWidth>div.clientWidth; var isVerticalScrollbar = div.scrollHeight>div.clientHeight; var overflows = isHorizontalScrollbar || isVerticalScrollbar; return overflows; }); font_size = font_size - 1; font_size = Math.max(min_font_size, Math.min(font_size, max_font_size)); if(!$scaler){ return {font_size: font_size} } $cell.style.fontSize = ""; $scaler.style.fontSize = font_size + "px"; $scaler.style.transform = ""; var bbox = getBoundingClientRect($scaler); var w = bbox.width; var h = bbox.height; var scale = Math.min(1, Math.min(1.0*(max_width)/w, 1.0*(max_height)/h)); $scaler.style.transform = (transforms || "") + " scale(" + scale + ") "; return {font_size: font_size, scale: scale}; }
function getBoundingClientRect(el){ var bbox = el.getBoundingClientRect(); return { top: bbox.top + (window.scrollY || document.documentElement.scrollTop || 0), left: bbox.left + (window.scrollX || document.documentElement.scrollLeft || 0), width: bbox.width, height: bbox.height, x: bbox.x, y: bbox.y } }
function enqueueRender(){ var item = Array.prototype.slice.call(arguments); item[0].apply(item[1], item.slice(2)); return; }
function matches(el, selector) { return (el.matches || el.matchesSelector || el.msMatchesSelector || el.mozMatchesSelector || el.webkitMatchesSelector || el.oMatchesSelector).call(el, selector); }
function indexInParent(child) { var i = 0; while( (child = child.previousElementSibling) != null ) { i++; } return i; }
function on(eventName, elementSelector, handler, extra){ var names = eventName.split(" "); for(var i = 0; i < names.length; i++){ var eventName = names[i]; document.addEventListener(eventName, function(e) { for (var target = e.target; target && target != this; target = target.parentNode) { if (matches(target, elementSelector)) { handler.call(target, e); break; } } }, extra || false); } }
function closest(element, selector){ do { if(matches(element, selector)){ return element; } } while(element = element.parentElement); return null; }
function retypeset(scope, then){ if(then){ var fn = window[then]; if (typeof fn === 'function') fn(); } return false; }
function prepwork(cell, scale_factor){ if(scale_factor === undefined){ scale_factor = 1; } var width = cell.parentElement.clientWidth; var height = cell.parentElement.clientHeight; var inner = cell.querySelectorAll(".cell-inner")[0]; var capsizes = mode == "play" ? false : true; shrink_cell(cell, inner, width*scale_factor - 10, height*scale_factor - 10, 40, "", capsizes); return inner; }
function minirender(grid, on_done, question_scale_factor){ if(question_scale_factor === undefined){ question_scale_factor = 1; } window.nextthing = function(){ setTimeout(function(){ grid.classList.add("resizing"); miniresize(grid, grid.querySelectorAll(".grid-row-cats .cell"), true, 1); miniresize(grid, grid.querySelectorAll(".grid-row-questions .cell"), false, question_scale_factor); grid.classList.remove("resizing"); if(on_done){ on_done(grid); } }); }; if(!retypeset(grid, "nextthing")){ window.nextthing(); } }
function miniresize(grid, cells, is_cats, scale_factor){ if(is_cats){ var cat = grid.querySelectorAll(".grid-row-cats")[0]; cat.classList.remove("grid-row-cats-resize-done"); cat.style.height = "auto"; var max_height = 0; for(var i = 0; i < cells.length; i++){ var cell = cells[i]; cell.style.paddingTop = 0; var inner = prepwork(cell); cell.client_height = inner.clientHeight; max_height = Math.max(max_height, inner.clientHeight); } cat.classList.add("grid-row-cats-resize-done"); cat.style.height = Math.max(max_height, 60) + "px"; } else { for(var i = 0; i < cells.length; i++){ var cell = cells[i]; enqueueRender(prepwork, null, cell, scale_factor); } } }
<\/script>
<script>
    var modal = function(){}
    var game = {}
    var mode = "play"
    var grid = null;
    var current_cell = null;
    var currentAudioObj = null; 
    game.hintUsed = false;
    try { var do_autoplay = parseInt(window.localStorage.getItem("autoplay")) } catch (e) {}
    do_autoplay = isNaN(do_autoplay) ? true : do_autoplay;
    function getCurrentState(){ var teams = []; var teams_dom = document.querySelectorAll(".team"); for(var i = 0; i < teams_dom.length; i++){ var t = teams_dom[i]; var name = t.querySelectorAll(".name")[0].textContent; var points = t.querySelectorAll(".points")[0].textContent; teams[i] = {name: name, points: points} } var inerts = {}; var inert_dom = document.querySelectorAll(".grid-row-questions .inert"); for(var i = 0; i < inert_dom.length; i++){ var id = inert_dom[i].getAttribute("id"); inerts[id] = true; } return { "teams": teams, "inerts": inerts, } }
    function getOldState(){ try { var old_state = localStorage.getItem("game-158160080") } catch (e) { return null; } if(old_state){ return JSON.parse(old_state); } return null; }
    function clearState(){ try { localStorage.removeItem("game-158160080"); } catch (e) {} }
    function resize(){ minirender(grid, function(g){ g.style.opacity = 1; }, .6); }
    ready(function(){
        grid = document.querySelectorAll(".grid")[0];
        window.addEventListener("resize", debounce(resize, 100, false));
        resize();
        renderState(initial_state);
        document.getElementById("team-chooser").focus();
        var active_team_number = 0; var active_team = null;
        function deactiveTeamOnNextClick(e){ var t = closest(e.target, ".team"); if(t == null || t != active_team){ deactiveTeam(); } }
        function deactiveTeam(){ var els = document.querySelectorAll(".active-team"); for(var i = 0; i < els.length; i++){ els[i].classList.remove("active-team"); els[i].querySelector(".minus").innerText = "-"; els[i].querySelector(".plus").innerText = "+"; } window.removeEventListener("click", deactiveTeamOnNextClick); active_team_number = 0; active_team = null; }
        function activateTeam(team){ active_team = team; active_team.classList.add("active-team"); active_team.querySelector(".minus").innerHTML = "&#8595;"; active_team.querySelector(".plus").innerHTML = "&#8593;"; window.addEventListener("click", deactiveTeamOnNextClick); }
        window.addEventListener("keydown", function(e){ var ESC = 27; var SPACE = 32; var ENTER = 13; var LEFT = 37; var UP = 38; var RIGHT = 39; var DOWN = 40; var on_cell = false; var on_input = false; if(document.activeElement){ on_cell = matches(document.activeElement, ".grid-row-questions .grid-cell"); on_input = matches(document.activeElement, "*[role='textbox']"); } var clickable = on_cell && !document.activeElement.classList.contains('empty'); if(e.altKey && e.keyCode == 65){ do_autoplay = !do_autoplay; alert("Autoplay is " + (do_autoplay ? "on" : "off")); try { window.localStorage.setItem("autoplay", do_autoplay ? "1" : "0") } catch (e) {} } if(!on_input && ((e.keyCode >= 96 && e.keyCode <= 105) || (e.keyCode >=48 && e.keyCode <= 57))){ var n = e.keyCode >= 96 ? e.keyCode - 96 : e.keyCode - 48; active_team_number *= 10; active_team_number += n; var tmp = active_team_number; var $teams = document.querySelectorAll("#teams-container .team"); var $team = $teams[active_team_number - 1]; if(active_team && active_team != $team){ deactiveTeam(); active_team_number = tmp; } if($team){ activateTeam($team) } else { active_team_number = 0; } } if(active_team_number != 0){ if(e.keyCode == ESC){ deactiveTeam(); e.preventDefault(); } else if(e.keyCode == 38){ handlePoints.call(active_team.querySelector(".plus"), e); } else if(e.keyCode == 40){ handlePoints.call(active_team.querySelector(".minus"), e); } } else if(modal.is_open){ if(e.keyCode == ESC){ e.preventDefault(); modal.hide(); } else if(e.keyCode == SPACE){ e.preventDefault(); modal.reveal(); } } else if(on_cell){ if((e.keyCode == ENTER || e.keyCode == SPACE) && clickable){ e.preventDefault(); var event = document.createEvent('HTMLEvents'); event.initEvent('click', true, false); document.activeElement.dispatchEvent(event); } else if(e.keyCode == LEFT){ e.preventDefault(); if(document.activeElement.previousElementSibling){ document.activeElement.previousElementSibling.focus(); } } else if(e.keyCode == RIGHT){ e.preventDefault(); if(document.activeElement.nextElementSibling){ document.activeElement.nextElementSibling.focus(); } } else if(e.keyCode == UP){ e.preventDefault(); var my_col = indexInParent(document.activeElement); var previous_row = document.activeElement.parentElement.previousElementSibling; if(previous_row && previous_row.children[my_col] && matches(previous_row.children[my_col], ".grid-row-questions .grid-cell")){ previous_row.children[my_col].focus(); } } else if(e.keyCode == DOWN){ e.preventDefault(); var my_col = indexInParent(document.activeElement); var next_row = document.activeElement.parentElement.nextElementSibling; if(next_row && next_row.children[my_col] && matches(next_row.children[my_col], ".grid-row-questions .grid-cell")){ next_row.children[my_col].focus(); } } } }, false);
        var debouncedSaveState = debounce(function(){ try { localStorage.setItem("game-158160080", JSON.stringify(getCurrentState())) } catch (e) {} }, 100, false);
        on("keyup change input blur focus", "#teams-container .name, #teams-container .points", debouncedSaveState);
        on("click", "#re-init", function(e){ e.preventDefault(); if(confirm("This will clear the scores and team names, and start a new game. Click OK if you want to do this")){ clearState(); game.init(true); } });
        on("keyup", "#answer-button", function(e){ if(e.keyCode == 13){ e.preventDefault(); e.stopImmediatePropagation(); modal.reveal(); } });
        on("click", "#answer-button", function(e){ modal.reveal(); });
        on("keyup", "#continue-button", function(e){ if(e.keyCode == 13){ e.preventDefault(); e.stopImmediatePropagation(); modal.hide(); } });
        on("click", "#continue-button", function(e){ modal.hide(); });
        on("click", ".grid-row-questions .grid-cell", function(e){ current_cell = this; modal.show(this); });
        on("mousedown", ".minus, .plus", function(e){ e.preventDefault(); });
        on("keydown", ".minus, .plus", function(e){ if(e.keyCode == 13){ handlePoints.call(this, e); } });
        function handlePoints(e){ var $team = closest(this, ".team"); var $points = $team.querySelectorAll(".points")[0]; var points = parseInt($points.innerText, 10); if(isNaN(points)){ alert("Error! The score for this team is not a number. You need to edit the score and change it to a number."); return } var active_question = document.querySelectorAll(".active-question .cell-inner")[0]; var fallback = document.querySelectorAll(".grid-row-questions .cell-inner")[0]; var val = 0; if(active_question){ val = parseInt(active_question.innerText, 10); if(game.hintUsed){ val = Math.floor(val / 2); } } else { val = parseInt(fallback.innerText, 10); } if(this.classList.contains("minus")){ val = -val; } $points.innerText = points + val; if(active_question){ document.querySelectorAll(".active-question")[0].classList.add("inert"); document.querySelectorAll("#question-title")[0].style.color = ""; } debouncedSaveState(); }
        on("click", ".minus, .plus", handlePoints);
    });
    initial_state = {"page": "menu"};
    try { history.replaceState(initial_state, "JeopardyLabs") } catch (e) {}
    game.first_render = true;
    game.initTeam = function(number_of_teams){ document.getElementById("teams-container").style.display = "flex"; var teams = document.querySelectorAll("#teams-container .team"); for(var i = 0; i < number_of_teams; i++){ var t = teams[i]; } }
    game.init = function(clear){ var val = document.querySelectorAll("#options select")[0].value; if(isNaN(val)){ val = 0; do { var n = prompt("Enter the number of teams you have"); val = parseInt(n, 10) || 0; } while(val <= 0); } renderState({"page": "game"}); document.getElementById("teams-container").style.display = "flex"; var teams = document.querySelectorAll("#teams-container .team"); for(var i = 0; i < teams.length; i++){ teams[i].style.display = "none"; } for(var i = 0; i < val; i++){ var t = teams[i]; if(!t){ var t = teams[0].cloneNode(true); teams[0].parentElement.appendChild(t); t.querySelectorAll(".name")[0].textContent = "Team " + (i+1); t.querySelectorAll(".points")[0].textContent = "0"; } else { t = teams[i] } t.style.display = "block"; } var teams = document.querySelectorAll("#teams-container .team"); if(game.first_render){ var old_state = getOldState(); if(old_state){ for(var i = 0; i < val; i++){ var t = teams[i]; if(old_state.teams[i]){ var name = old_state.teams[i].name; var points = old_state.teams[i].points; t.querySelectorAll(".name")[0].textContent = name; t.querySelectorAll(".points")[0].textContent = points; } } var inerts = old_state.inerts; for(var id in inerts){ try { document.getElementById(id).classList.add("inert"); document.getElementById(id).setAttribute("aria-label", "Answered"); } catch (e) { continue; } } } } else if(clear){ for(var i = 0; i < val; i++){ var t = teams[i]; t.querySelectorAll(".name")[0].textContent = "Team " + (i+1); t.querySelectorAll(".points")[0].textContent = "0"; } removeClass(".inert", "inert"); } resize(); try { history.pushState({"page": "game"}, "JeopardyLabs"); } catch (e) {} game.first_render = false; try { document.querySelectorAll(".grid-first-row .grid-cell")[0].focus(); } catch(e) { } }
    function hideModal(){ modal.is_open = false; if(currentAudioObj){ currentAudioObj.pause(); currentAudioObj.currentTime = 0; currentAudioObj = null; } var div = document.getElementById("question-modal"); div.classList.remove("expanded"); setTimeout(function(){ if(!modal.is_open) div.style.display = "none"; }, 300); div.querySelectorAll(".modal-inner")[0].innerHTML = ""; }
    function renderMenu(){ var old_state = getOldState() || !game.first_render; if(!game.first_render){ document.querySelectorAll("#submit")[0].value = "Continue"; document.querySelectorAll("#reset-all")[0].style.display = ""; } else if(old_state){ document.querySelectorAll("#submit")[0].value = "Continue"; document.querySelectorAll("#reset-all")[0].style.display = ""; var teams = old_state.teams.length; var chooser = document.getElementById("team-chooser"); if(teams > 10){ var opt = document.createElement("option"); opt.setAttribute("value", teams); opt.textContent = teams + " teams"; chooser.insertBefore(opt, document.getElementById("last-option")); } document.getElementById("team-chooser").value = teams; } else { document.querySelectorAll("#submit")[0].value = "Start"; document.querySelectorAll("#reset-all")[0].style.display = "none"; } }
    function renderState(state){ document.querySelectorAll("#options")[0].style.display = "none"; document.querySelectorAll("#footer-area")[0].style.display = "none"; document.querySelectorAll("#gameplay")[0].style.filter = ""; hideModal(); if(state.page == "menu"){ document.querySelectorAll("#options")[0].style.display = "block"; renderMenu(); } else if(state.page == "game"){ document.getElementById("footer-area").style.display = "flex"; document.querySelectorAll("#gameplay")[0].style.filter = "blur(0px)"; } else if(state.page == "slide"){ document.getElementById("footer-area").style.display = "flex"; modal.show(document.getElementById(state.cell), true); } }
    window.onpopstate = function(event){ renderState(window.history.state); }
    function trimHTML(el){ var treeWalker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null, false); var nodes_to_delete = []; do { var node = treeWalker.currentNode; if(node.nodeType == 3 && (node.data || "").trim() == ""){ nodes_to_delete.push(node); } else if(node.tagName == "SCRIPT"){ } else if (node.tagName == "BR"){ nodes_to_delete.push(node); } else if(node.tagName == "P" && (node.innerText || "").trim() == ""){ nodes_to_delete.push(node); } else { break; } } while(treeWalker.previousNode()); for(var i = 0; i < nodes_to_delete.length; i++){ try { nodes_to_delete[i].parentElement.removeChild(nodes_to_delete[i]); } catch (e) {} } }
    
    // Updated Reveal Logic: Check global setting before showing hint
    modal.reveal = function(){
        var q = document.querySelectorAll("#question-modal .question")[0];
        if(q){ q.classList.add("reveal"); }
        
        var enableHints = typeof GLOBAL_HINTS_ENABLED !== 'undefined' ? GLOBAL_HINTS_ENABLED : true;
        
        if (enableHints) {
            var hintDisplay = document.getElementById("hint-display-area");
            var hintBtn = document.getElementById("btn-show-hint");
            if(hintDisplay && hintBtn){ hintDisplay.classList.add("visible"); hintBtn.style.display = "none"; }
        }
        
        document.querySelectorAll(".active-question")[0].classList.add("inert");
        if(current_cell){ current_cell.setAttribute("aria-label", "Answered"); }
    }
    
    function autoplay(selector, then){ if(then){ then(); } }
    
    modal.show = function(cell, no_push_state){
        removeClass(".active-question", "active-question"); cell.classList.add("active-question");
        game.hintUsed = false; 
        var col = cell.getAttribute("data-col"); var row = cell.getAttribute("data-row");
        var category = document.querySelectorAll(".grid-row-cats .cat-cell")[col].innerText; var points = cell.querySelectorAll(".cell-inner")[0].innerText;
        var titleEl = document.querySelectorAll("#question-title")[0]; titleEl.innerText = category + " - " + points; titleEl.setAttribute("data-base-points", points); 
        var div_modal = document.getElementById('question-modal'); div_modal.style.display = "flex";
        var inner = document.querySelectorAll("#question-modal .modal-inner")[0];
        var htmlContent = cell.querySelectorAll(".answer")[0].outerHTML + "\\n" + cell.querySelectorAll(".question")[0].outerHTML;
        inner.innerHTML = htmlContent;
        
        var isAudioEnabled = cell.getAttribute("data-audio") !== "false";
        var isImageEnabled = cell.getAttribute("data-image") === "true";
        var imageExt = cell.getAttribute("data-image-ext") || "jpg";

        var combinedHtml = "";

        if(isImageEnabled) {
            var fileCol = parseInt(col, 10) + 1;
            var fileRow = row; 
            var imgFile = "Image " + fileCol + "-" + fileRow + "." + imageExt;
            combinedHtml += '<img src="' + imgFile + '" class="question-image" alt="Question Image">';
        }
        
        if(isAudioEnabled) {
            var fileCol = parseInt(col, 10) + 1;
            var fileRow = row; 
            var audioFilename = "Song " + fileCol + "-" + fileRow + ".mp3";
            combinedHtml += \`
                <div class="audio-controls-container">
                    <audio id="current-modal-audio" src="\${audioFilename}"></audio>
                    <button id="btn-play-pause" class="audio-btn">▶ Play</button>
                    <button id="btn-restart" class="audio-btn">↺ Restart</button>
                </div>\`;
        }

        // Logic to verify if hints are enabled globally
        var enableHints = typeof GLOBAL_HINTS_ENABLED !== 'undefined' ? GLOBAL_HINTS_ENABLED : true;
        
        if (enableHints) {
            var hintEl = cell.querySelector(".hint-data");
            // Only add if hint text exists
            if (hintEl && hintEl.innerText.trim() !== "") {
                var hintText = hintEl.innerText;
                combinedHtml += \`
                    <div class="hint-container">
                        <div id="hint-display-area" class="hint-text-display">\${hintText}</div>
                        <button id="btn-show-hint" class="hint-btn">Show Hint (½ Points)</button>
                    </div>
                \`;
            }
        }
        
        inner.innerHTML += combinedHtml;

        if(isAudioEnabled) {
            var audioObj = document.getElementById("current-modal-audio");
            currentAudioObj = audioObj;
            var btnPlay = document.getElementById("btn-play-pause");
            var btnRestart = document.getElementById("btn-restart");
            btnPlay.onclick = function() { if(audioObj.paused){ audioObj.play(); btnPlay.innerHTML = "❚❚ Pause"; } else { audioObj.pause(); btnPlay.innerHTML = "▶ Play"; } };
            btnRestart.onclick = function() { audioObj.currentTime = 0; audioObj.play(); btnPlay.innerHTML = "❚❚ Pause"; };
            audioObj.onended = function() { btnPlay.innerHTML = "▶ Play"; };
        }

        if (enableHints) {
            var btnHint = document.getElementById("btn-show-hint");
            var displayHint = document.getElementById("hint-display-area");
            if(btnHint) {
                btnHint.onclick = function() {
                    if(!game.hintUsed){
                        game.hintUsed = true;
                        displayHint.classList.add("visible");
                        btnHint.style.display = "none";
                        var currentPoints = parseInt(titleEl.getAttribute("data-base-points"), 10);
                        var halvedPoints = Math.floor(currentPoints / 2);
                        titleEl.innerText = category + " - " + halvedPoints + " (Hint Used)";
                        titleEl.style.color = "#fbbf24";
                    }
                };
            }
        }
        
        if(!no_push_state){ try { history.pushState({"page": "slide", "cell": cell.getAttribute("id")}, "JeopardyLabs"); } catch (e) {} }
        trimHTML(document.querySelectorAll('#question-modal .answer')[0]); trimHTML(document.querySelectorAll('#question-modal .question')[0]);
        setTimeout(function(){ div_modal.classList.add("expanded"); }, 50); modal.is_open = true; document.querySelectorAll(".grid")[0].setAttribute("aria-hidden", "true");
    }
    modal.hide = function(){ document.querySelectorAll(".grid")[0].setAttribute("aria-hidden", "false"); backToGame(); renderState({"page": "game"}); if(current_cell){ current_cell.focus(); } }
    function backToGame(){ var state = window.history.state; if(state.page == "slide"){ window.history.go(-1); } }
    function backToMenu(){ renderState({"page": "menu"}); var state = window.history.state; if(state.page == "slide"){ window.history.go(-2); } else if(state.page == "game"){ window.history.go(-1); } document.getElementById("team-chooser").focus(); }
<\/script>
</head>
<body>
`;

const GAME_TEMPLATE_MID = `
</head>
<body>
    <div id="gameplay">
        <div class="grid-container">
            <div class="grid grid-play" role="table" aria-label="Game Board">
`;

const GAME_TEMPLATE_END = `
            </div>
        </div>
        <div id="question-modal" class="modal-wrapper" role="dialog" aria-label="Prompt" aria-modal="true">
            <div id="modal-header">
                <div tabindex="0" role="button" aria-label="Close prompt (escape)" id="continue-button"><div>Continue <kbd>ESC</kbd></div></div>
                <div id="question-title"></div>
                <div tabindex="0" role="button" aria-label="Reveal answer (spacebar)" id="answer-button" tabindex="0"><div>Reveal Correct Response <kbd>Spacebar</kbd></div></div>
            </div>
            <div class="modal-body">
                <div class="modal-inner"></div>
            </div>
        </div>
        <div id="footer-area">
            <a role="button" class="menu-picker" href="javascript:backToMenu('menu')" aria-label="Menu Button">
                &#9776; Menu
            </a>
            <div id="teams-container">
                <div class="team" style="display:none">
                    <div class="name" role="textbox" contenteditable="true">Team 1</div>
                    <div class="points" role="textbox" contenteditable="true">0</div>
                    <div class="pointer">
                        <span tabindex="0" aria-label="Add points" role="button" class="plus">+</span>
                        <span tabindex="0" aria-label="Subtract points" role="button" class="minus">-</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div id="options" class="modal-wrapper" role="dialog" aria-label="Menu" aria-modal="true">
        <div class="modal">
            <h1>Guess the video game music</h1>
            <div id="team-chooser-wrapper">
                <select id="team-chooser">
                    <option value="0">No teams</option>
                    <option value="1">1 team</option>
                    <option value="2">2 teams</option>
                    <option value="3" selected="true">3 teams</option>
                    <option value="4">4 teams</option>
                    <option value="5">5 teams</option>
                    <option value="6">6 teams</option>
                    <option value="7">7 teams</option>
                    <option value="8">8 teams</option>
                    <option value="9">9 teams</option>
                    <option value="10">10 teams</option>
                    <option id="last-option" value="more">Custom</option>
                </select>
                <input class="submit" type="button" id="submit" value="Start" onclick="game.init()" />
                <span id="reset-all">
                    <input type="button" id="re-init" value="Reset" />
                </span>
            </div>
        </div>
    </div>
</body>
</html>`;

// Initialize the Editor
initData();
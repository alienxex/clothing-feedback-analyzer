/**
 * STYLESENSE CORE LOGIC
 * Handles File Processing -> AI Batching -> UI Rendering
 */

const WORKER_URL = "https://feedbackanalysis.robust9223.workers.dev/"; 
let analysisResults = []; 

/**
 * Main Entry Point: Triggered by the "Start Batch Analysis" button
 */
async function processData() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        alert("Please select a feedback file first.");
        return;
    }

    // --- UI Reset & Show Status ---
    const statusArea = document.getElementById('statusArea');
    const tableContainer = document.getElementById('tableContainer');
    const reportBtn = document.getElementById('reportBtn');
    const tbody = document.getElementById('tableBody');
    const progressFill = document.getElementById('progressFill');
    const statusLabel = document.getElementById('statusLabel');

    statusArea.style.display = 'block';
    tableContainer.style.display = 'none';
    reportBtn.style.display = 'none';
    tbody.innerHTML = "";
    
    updateProgress(10, "Reading and parsing file...");

    try {
        // 1. Parse File (Supports XLSX, CSV, JSON)
        let rawContent = "";
        const extension = file.name.split('.').pop().toLowerCase();

        if (extension === 'xlsx' || extension === 'xls') {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            rawContent = XLSX.utils.sheet_to_csv(firstSheet);
        } else if (extension === 'json') {
            const text = await file.text();
            rawContent = text; // AI will handle JSON string
        } else {
            rawContent = await file.text();
        }

        // 2. Prepare Batch (AI Context Limit Optimization)
        const rows = rawContent.split('\n');
        // We take the header + first 50 rows to prevent timeout/token issues
        const batchData = rows.slice(0, 51).join('\n'); 

        updateProgress(40, `Analyzing ${rows.slice(1, 51).length} reviews via AI...`);

        // 3. Request to Cloudflare Worker
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: batchData })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Worker Error: ${errorText}`);
        }

        updateProgress(80, "Processing AI insights...");

        const result = await response.json();
        
        // 4. Clean & Parse AI Output
        // Worker returns { output: "JSON_STRING" }
        let cleanJson = result.output.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanJson);
        
        // Save results for the report generator
        analysisResults = parsed.analysis || [];

        // 5. Render to Table
        renderTable();

        // 6. Finalize UI
        updateProgress(100, "Analysis Complete!");
        tableContainer.style.display = 'block';
        reportBtn.style.display = 'inline-flex';

    } catch (error) {
        console.error("System Error:", error);
        updateProgress(100, "Error: " + error.message, true);
    }
}

/**
 * UI Helper: Updates the progress bar
 */
function updateProgress(percent, text, isError = false) {
    const fill = document.getElementById('progressFill');
    const label = document.getElementById('statusLabel');
    fill.style.width = percent + "%";
    label.innerText = text;
    if (isError) fill.style.backgroundColor = "#ef4444";
}

/**
 * UI Helper: Injects rows into the HTML table
 */
function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = "";

    analysisResults.forEach(item => {
        const row = document.createElement('tr');
        row.className = "hover:bg-slate-50 transition-colors";

        // Logic for sentiment color
        const qualityColor = item.cloth_quality === "Good" ? "text-emerald-600" : (item.cloth_quality === "Bad" ? "text-red-600" : "text-amber-600");

        row.innerHTML = `
            <td class="px-6 py-4 font-bold text-slate-700">${item.clothing_id || 'N/A'}</td>
            <td class="px-6 py-4">
                <div class="flex flex-col">
                    <span class="text-xs font-bold uppercase ${qualityColor}">Fabric: ${item.fabric_quality}</span>
                    <span class="text-[10px] text-slate-400">Delivery: ${item.delivery_service}</span>
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded font-medium border border-indigo-100">
                    ${item.updates_required || 'No updates'}
                </span>
            </td>
            <td class="px-6 py-4 text-slate-500 italic text-xs leading-relaxed">
                "${item.feedback_summary}"
            </td>
        `;
        tbody.appendChild(row);
    });
}

/**
 * Download Logic: Generates a .txt report
 */
function generateReport() {
    if (!analysisResults.length) return;
    
    let content = "STYLESENSE INTELLIGENCE REPORT\n==============================\n\n";
    analysisResults.forEach(r => {
        content += `PRODUCT ID: ${r.clothing_id}\n`;
        content += `QUALITY: Cloth(${r.cloth_quality}), Fabric(${r.fabric_quality})\n`;
        content += `SERVICE: ${r.delivery_service}\n`;
        content += `ACTION: ${r.updates_required}\n`;
        content += `SUMMARY: ${r.feedback_summary}\n`;
        content += `------------------------------\n\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `StyleSense_Report_${Date.now()}.txt`;
    a.click();
}

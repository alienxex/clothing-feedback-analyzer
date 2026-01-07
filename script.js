/**
 * STYLESENSE - UPDATED SCRIPT
 * Aligns with StyleSense HTML and provides detailed error tracking.
 */

const WORKER_URL = "https://feedbackanalysis.robust9223.workers.dev/"; 
let analysisResults = []; 

async function processData() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        alert("Please select a feedback file first.");
        return;
    }

    // --- UI Update ---
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
    
    updateProgress(10, "Reading file data...");

    try {
        let dataString = "";
        const extension = file.name.split('.').pop().toLowerCase();

        // 1. File Parsing
        if (extension === 'xlsx' || extension === 'xls') {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            dataString = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
        } else {
            dataString = await file.text();
        }

        const rows = dataString.split('\n');
        const payloadText = rows.slice(0, 51).join('\n'); // Limit to 50 rows for performance
        
        updateProgress(40, `Sending ${rows.length - 1} reviews to AI...`);

        // 2. Worker Request
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: payloadText })
        });

        // Detailed Error Handling
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Worker Error (${response.status}): ${errorBody || "Unknown failure"}`);
        }

        updateProgress(80, "Formatting insights...");

        const result = await response.json();
        
        // 3. Parsing AI JSON Output
        let rawOutput = result.output || "";
        let cleanedJson = rawOutput.replace(/```json/g, "").replace(/```/g, "").trim();
        
        const parsedData = JSON.parse(cleanedJson);
        analysisResults = parsedData.analysis || [];

        // 4. Render Table
        renderTableRows();

        updateProgress(100, "Analysis Complete!");
        tableContainer.style.display = 'block';
        reportBtn.style.display = 'inline-flex';

    } catch (error) {
        console.error("StyleSense Debug:", error);
        updateProgress(100, "Error: " + error.message, true);
        alert("Processing Failed: " + error.message);
    }
}

function updateProgress(percent, text, isError = false) {
    const fill = document.getElementById('progressFill');
    const label = document.getElementById('statusLabel');
    fill.style.width = percent + "%";
    label.innerText = text;
    fill.style.backgroundColor = isError ? "#ef4444" : "#4f46e5";
}

function renderTableRows() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = "";

    analysisResults.forEach(item => {
        const row = document.createElement('tr');
        row.className = "hover:bg-slate-50 border-b border-slate-100";
        
        const sentimentColor = item.cloth_quality === "Good" ? "text-emerald-600" : "text-amber-600";

        row.innerHTML = `
            <td class="px-6 py-4 font-bold text-indigo-700">${item.clothing_id}</td>
            <td class="px-6 py-4 font-semibold ${sentimentColor}">${item.fabric_quality} Quality</td>
            <td class="px-6 py-4">${item.updates_required}</td>
            <td class="px-6 py-4 text-slate-500 italic">${item.feedback_summary}</td>
        `;
        tbody.appendChild(row);
    });
}

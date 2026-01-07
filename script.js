/**
 * BRAND INTELLIGENCE SYSTEM - CORE LOGIC
 * Handles multi-format data parsing, AI communication, and reporting.
 */

// Your Cloudflare Worker URL
const WORKER_URL = "https://feedbackanalysis.robust9223.workers.dev/"; 

// Global storage for report generation
let processedData = []; 

/**
 * Main function triggered by the "Start AI Analysis" button
 */
async function processData() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        alert("Please select a feedback file first.");
        return;
    }

    const extension = file.name.split('.').pop().toLowerCase();
    let rawRows = [];

    // 1. Reset & Initialize UI
    document.getElementById('statusArea').style.display = 'block';
    document.getElementById('tableContainer').style.display = 'block';
    document.getElementById('reportBtn').style.display = 'none';
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = "";
    processedData = [];

    try {
        // 2. Multi-format File Parsing Logic
        if (extension === 'xlsx' || extension === 'xls') {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(firstSheet);
            // Convert objects to strings for AI ingestion (take first 10 for analysis)
            rawRows = json.slice(0, 10).map(obj => Object.values(obj).join(" "));
        } else if (extension === 'json') {
            const text = await file.text();
            const json = JSON.parse(text);
            rawRows = json.slice(0, 10).map(obj => Object.values(obj).join(" "));
        } else {
            // Default to CSV
            const text = await file.text();
            // Filter out empty rows and skip the header
            rawRows = text.split('\n').filter(r => r.trim()).slice(1, 11);
        }

        // 3. Batch Process rows through the AI Engine
        for (let i = 0; i < rawRows.length; i++) {
            const rowContent = rawRows[i].toString();
            
            // Update UI status
            document.getElementById('statusLabel').innerText = `Analyzing Record ${i + 1} of ${rawRows.length}...`;
            
            // Call AI via Cloudflare Worker
            const aiResult = await callAI(rowContent);
            
            // Save to memory for the final report
            processedData.push({ original: rowContent, ai: aiResult });
            
            // Render row in the table
            addTableRowToDashboard(rowContent, aiResult);

            // Update Progress Bar
            const progress = Math.round(((i + 1) / rawRows.length) * 100);
            document.getElementById('progressFill').style.width = `${progress}%`;
            document.getElementById('progressText').innerText = `${progress}%`;
        }

        // 4. Finalize Analysis
        document.getElementById('statusLabel').innerText = "Intelligence Analysis Complete";
        document.getElementById('statusLabel').classList.remove('analyzing-text');
        document.getElementById('reportBtn').style.display = 'inline-flex';

    } catch (err) {
        console.error("Data Processing Error:", err);
        document.getElementById('statusLabel').innerText = "Error parsing file. Check format.";
    }
}

/**
 * Communicates with the Cloudflare Worker and parses the specialized AI response
 */
async function callAI(text) {
    try {
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text })
        });

        if (!response.ok) throw new Error("Worker Connection Failed");

        const data = await response.json();
        const rawContent = data.output || "";

        // Strip markdown backticks and specific model prefixes
        const cleaned = rawContent.replace(/

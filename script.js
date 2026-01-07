/**
 * STYLESENSE INTELLIGENCE SYSTEM
 * Handles file processing, AI communication, and reporting.
 */

const WORKER_URL = "https://feedbackanalysis.robust9223.workers.dev/"; 
let analysisResults = []; 

/**
 * Main Trigger: Starts the analysis process
 */
async function processData() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        alert("Please select a feedback file first.");
        return;
    }

    // --- UI Setup ---
    const statusArea = document.getElementById('statusArea');
    const tableContainer = document.getElementById('tableContainer');
    const reportBtn = document.getElementById('reportBtn');
    const tbody = document.getElementById('tableBody');
    
    // Show status, hide previous results
    statusArea.style.display = 'block';
    tableContainer.style.display = 'none';
    reportBtn.style.display = 'none';
    tbody.innerHTML = "";
    
    updateProgress(10, "Reading and Batching Data...");

    try {
        // 1. Read and Parse File based on extension
        let dataString = "";
        const extension = file.name.split('.').pop().toLowerCase();

        if (extension === 'xlsx' || extension === 'xls') {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            // Convert to CSV for AI efficiency
            dataString = XLSX.utils.sheet_to_csv(sheet);
        } else if (extension === 'json') {
            const text = await file.text();
            const json = JSON.parse(text);
            dataString = JSON.stringify(json.slice(0, 50)); 
        } else {
            // Default CSV/Text
            dataString = await file.text();
        }

        // 2. Prepare Batch (Limit to top 50 rows to stay within AI context limits)
        const rows = dataString.split('\n');
        const header = rows[0];
        const batchRows = rows.slice(1, 51).join('\n'); 
        
        if (batchRows.trim().length < 5) {
            throw new Error("File appears empty or data is unreadable.");
        }

        const payloadText = header + "\n" + batchRows;

        updateProgress(40, `Connecting to StyleSense AI models...`);

        // 3. Send to Cloudflare Worker
        const aiResponse = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: payloadText })
        });

        if (!aiResponse.ok) {
            const errData = await aiResponse.json();
            throw new Error(errData.error || "Worker Connection Failed");
        }

        updateProgress(80, "Aggregating Insights...");

        const result = await aiResponse.json();
        
        // 4. Clean and Parse AI JSON
        // The worker returns { output: "JSON String" }
        let rawOutput = result.output || "";
        // Strip potential markdown wrappers
        let cleanedJson = rawOutput.replace(/```json/g, "").replace(/```/g, "").trim();
        
        const parsedData = JSON.parse(cleanedJson);
        analysisResults = parsedData.analysis || []; // Matches the "analysis" array in Worker prompt

        // 5. Populate Table
        renderTableRows();

        // 6. Finalize UI
        updateProgress(100, "Analysis Complete!");
        tableContainer.style.display = 'block';
        reportBtn.style.display = 'inline-flex';

    } catch (error) {
        console.error("StyleSense Error:", error);
        updateProgress(100, "Error: " + error.message, true);
    }
}

/**
 * Helper: Updates Progress Bar and Label
 */
function updateProgress(percent, text, isError = false) {
    const fill = document.getElementById('progressFill');
    const label = document.getElementById('statusLabel');
    
    fill.style.width = percent + "%";
    label.innerText = text;
    
    if (isError) {
        fill.style.backgroundColor = "#ef4444"; // Red for error
        label.style.color = "#ef4444";
    } else {
        fill.style.backgroundColor = "#4f46e5"; // Indigo for success
        label.style.color = "#4f46e5";
    }
}

/**
 * Helper: Builds the UI Table rows
 */
function renderTableRows() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = "";

    analysisResults.forEach(item => {
        const row = document.createElement('tr');
        row.className = "hover:bg-slate-50 transition-colors";
        
        // Sentiment Badge logic based on cloth/fabric quality
        const isGood = item.cloth_quality === "Good" && item.fabric_quality === "Good";
        const isBad = item.cloth_quality === "Bad" || item.fabric_quality === "Bad";
        
        let sentimentHTML = "";
        if (isGood) {
            sentimentHTML = `<span class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md font-bold text-xs uppercase">Premium Quality</span>`;
        } else if (isBad) {
            sentimentHTML = `<span class="px-2 py-1 bg-red-100 text-red-700 rounded-md font-bold text-xs uppercase">Issues Detected</span>`;
        } else {
            sentimentHTML = `<span class="px-2 py-1 bg-amber-100 text-amber-700 rounded-md font-bold text-xs uppercase">Average</span>`;
        }

        row.innerHTML = `
            <td class="px-6 py-4 font-bold text-indigo-700">${item.clothing_id || 'N/A'}</td>
            <td class="px-6 py-4">${sentimentHTML}</td>
            <td class="px-6 py-4 font-medium text-slate-700">${item.updates_required || 'None'}</td>
            <td class="px-6 py-4 text-slate-500 italic">"${item.feedback_summary || 'No summary available.'}"</td>
        `;
        tbody.appendChild(row);
    });
}

/**
 * Report Logic: Downloads results as .txt
 */
function generateReport() {
    if (analysisResults.length === 0) return;
    
    let report = `STYLESENSE PRODUCT INTELLIGENCE REPORT\n`;
    report += `Generated: ${new Date().toLocaleString()}\n`;
    report += `==========================================\n\n`;

    analysisResults.forEach(res => {
        report += `Product ID: ${res.clothing_id}\n`;
        report += `Quality: Cloth (${res.cloth_quality}), Fabric (${res.fabric_quality})\n`;
        report += `Delivery: ${res.delivery_service}\n`;
        report += `Required Updates: ${res.updates_required}\n`;
        report += `Summary: ${res.feedback_summary}\n`;
        report += `------------------------------------------\n\n`;
    });

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `StyleSense_Report_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

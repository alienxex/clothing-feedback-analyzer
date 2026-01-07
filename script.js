/**
 * BRAND INTELLIGENCE SYSTEM - BATCH LOGIC
 * Aggregates feedback by Clothing ID and generates a comprehensive report.
 */

// ---------------------------------------------------------
// CONFIGURATION: PASTE YOUR CLOUDFLARE WORKER URL HERE
// ---------------------------------------------------------
const WORKER_URL = "https://feedbackanalysis.robust9223.workers.dev/";
// ---------------------------------------------------------

// Store final analyzed data
let analysisResults = [];

/**
 * Main Trigger
 */
async function processData() {
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select a feedback file first.");
        return;
    }

    /* ---------- UI RESET ---------- */
    const statusArea = document.getElementById("statusArea");
    const tableContainer = document.getElementById("tableContainer");
    const reportBtn = document.getElementById("reportBtn");
    const tbody = document.getElementById("tableBody");
    const statusLabel = document.getElementById("statusLabel");
    const progressFill = document.getElementById("progressFill");

    if (statusArea) statusArea.style.display = "block";
    if (tableContainer) tableContainer.style.display = "block";
    if (reportBtn) reportBtn.style.display = "none";
    if (tbody) tbody.innerHTML = "";
    if (progressFill) progressFill.style.width = "5%";

    analysisResults = [];
    statusLabel.innerText = "Reading and batching data...";

    try {
        /* ---------- FILE PARSING ---------- */
        let csvText = "";
        const extension = file.name.split(".").pop().toLowerCase();

        if (extension === "xlsx" || extension === "xls") {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            csvText = XLSX.utils.sheet_to_csv(sheet);

        } else if (extension === "json") {
            const text = await file.text();
            const json = JSON.parse(text);
            csvText = JSON.stringify(json.slice(0, 50));

        } else {
            csvText = await file.text();
        }

        /* ---------- BATCH PREPARATION ---------- */
        const rows = csvText.split("\n").filter(r => r.trim());
        if (rows.length < 2) {
            throw new Error("Insufficient data in file.");
        }

        const header = rows[0];
        // Limit to 50 rows to prevent timeout/token limits
        const dataRows = rows.slice(1, 51).join("\n");
        const batchPayload = header + "\n" + dataRows;

        statusLabel.innerText = `Sending ${rows.slice(1, 51).length} reviews to AI...`;
        progressFill.style.width = "40%";

        /* ---------- AI CALL ---------- */
        const aiResponse = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: batchPayload })
        });

        if (!aiResponse.ok) {
            throw new Error("Cloudflare Worker request failed.");
        }

        progressFill.style.width = "70%";
        statusLabel.innerText = "Processing AI insights...";

        const workerResult = await aiResponse.json();
        const rawOutput = workerResult.output || "";

        /* ---------- AI OUTPUT CLEANING ---------- */
        const cleaned = rawOutput
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        let parsedResult;
        try {
            parsedResult = JSON.parse(cleaned);
        } catch (e) {
            console.error("Raw AI Output:", rawOutput);
            throw new Error("AI response was not valid JSON.");
        }

        /* ---------- NORMALIZATION ---------- */
        // Expected format: [{ clothing_id, sentiment, key_issues, summary }]

        if (!Array.isArray(parsedResult)) {
            throw new Error("Unexpected AI output format (Not an array).");
        }

        analysisResults = parsedResult;

        /* ---------- TABLE RENDER ---------- */
        parsedResult.forEach(item => addRow(item));

        progressFill.style.width = "100%";
        statusLabel.innerText = "Batch intelligence analysis complete.";
        reportBtn.style.display = "inline-flex";

    } catch (error) {
        console.error("Batch Processing Error:", error);
        statusLabel.innerText = "Error: " + error.message;
        alert("Processing Failed: " + error.message);
    }
}

/**
 * Adds a summary row to the dashboard table
 */
function addRow(item) {
    const tbody = document.getElementById("tableBody");
    const tr = document.createElement("tr");

    // Helper for cells
    const createCell = (text, className = "") => {
        const td = document.createElement("td");
        td.textContent = text;
        td.className = `px-6 py-4 text-sm border-b border-slate-100 ${className}`;
        return td;
    };

    // 1. Clothing ID
    tr.appendChild(createCell(item.clothing_id || "N/A", "font-medium text-slate-700"));

    // 2. Sentiment (Color Coded)
    let sentClass = "text-slate-600";
    const sent = (item.sentiment || "Unknown").toLowerCase();
    if (sent.includes('positive')) sentClass = "text-green-600 font-bold";
    else if (sent.includes('negative')) sentClass = "text-red-600 font-bold";
    else if (sent.includes('mixed')) sentClass = "text-yellow-600 font-bold";
    
    tr.appendChild(createCell(item.sentiment || "Unknown", sentClass));

    // 3. Key Issues
    const issues = Array.isArray(item.key_issues) ? item.key_issues.join(", ") : (item.key_issues || "—");
    tr.appendChild(createCell(issues, "text-slate-600"));

    // 4. Summary
    tr.appendChild(createCell(item.summary || "", "text-slate-500 italic"));

    tbody.appendChild(tr);
}

/**
 * Generates downloadable intelligence report
 */
function generateReport() {
    let report = "BRAND INTELLIGENCE REPORT\n";
    report += "Generated by StyleSense AI\n";
    report += "========================================\n\n";

    analysisResults.forEach((item, index) => {
        report += `PRODUCT #${index + 1}\n`;
        report += `ID:        ${item.clothing_id}\n`;
        report += `Sentiment: ${item.sentiment}\n`;
        report += `Issues:    ${Array.isArray(item.key_issues) ? item.key_issues.join(", ") : item.key_issues}\n`;
        report += `Summary:   ${item.summary}\n`;
        report += "----------------------------------------\n";
    });

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "brand_intelligence_report.txt";
    document.body.appendChild(a); // Required for Firefox
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
}

/**
 * BRAND INTELLIGENCE SYSTEM - CORE LOGIC
 * Handles multi-format data parsing, AI communication via Cloudflare, and reporting.
 */

// Finalized Cloudflare Worker URL
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
    const statusArea = document.getElementById('statusArea');
    const tableContainer = document.getElementById('tableContainer');
    const reportBtn = document.getElementById('reportBtn');
    const tbody = document.getElementById('tableBody');
    const statusLabel = document.getElementById('statusLabel');

    if(statusArea) statusArea.style.display = 'block';
    if(tableContainer) tableContainer.style.display = 'block';
    if(reportBtn) reportBtn.style.display = 'none';
    if(tbody) tbody.innerHTML = "";
    
    processedData = [];

    try {
        // 2. Multi-format File Parsing Logic
        if (extension === 'xlsx' || extension === 'xls') {
            const data = await file.arrayBuffer();
            // Use the global XLSX variable from the CDN script in index.html
            const workbook = XLSX.read(data);
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(firstSheet);
            // Convert row objects to strings, taking the first 10 for batch analysis
            rawRows = json.slice(0, 10).map(obj => Object.values(obj).join(" "));
        } else if (extension === 'json') {
            const text = await file.text();
            const json = JSON.parse(text);
            // Handle array of objects or array of strings
            rawRows = json.slice(0, 10).map(obj => (typeof obj === 'object' ? Object.values(obj).join(" ") : obj));
        } else {
            // Default to CSV / Text
            const text = await file.text();
            // Split by newline, trim, filter empty rows, skip header (slice 1), take 10 rows
            rawRows = text.split('\n').map(r => r.trim()).filter(r => r !== "").slice(1, 11);
        }

        if (rawRows.length === 0) {
            alert("No data found in file or file is empty.");
            return;
        }

        // 3. Batch Process rows through the AI Engine
        for (let i = 0; i < rawRows.length; i++) {
            const rowContent = rawRows[i].toString();
            
            // Update UI status
            if(statusLabel) statusLabel.innerText = `Analyzing Record ${i + 1} of ${rawRows.length}...`;
            
            // Call AI via Cloudflare Worker
            const aiResult = await callAI(rowContent);
            
            // Save to memory for the final report
            processedData.push({ original: rowContent, ai: aiResult });
            
            // Render row in the table
            addTableRowToDashboard(rowContent, aiResult);

            // Update Progress Bar
            const progress = Math.round(((i + 1) / rawRows.length) * 100);
            const fill = document.getElementById('progressFill');
            const text = document.getElementById('progressText');
            if(fill) fill.style.width = `${progress}%`;
            if(text) text.innerText = `${progress}%`;
        }

        // 4. Finalize Analysis
        if(statusLabel) {
            statusLabel.innerText = "Intelligence Analysis Complete";
            statusLabel.classList.remove('analyzing-text');
        }
        if(reportBtn) reportBtn.style.display = 'inline-flex';

    } catch (err) {
        console.error("Data Processing Error:", err);
        if(statusLabel) statusLabel.innerText = "Error parsing file. Please check format.";
    }
}

/**
 * Communicates with the Cloudflare Worker -> OpenRouter
 * Parses the specialized AI response string
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
        // Handle output from OpenRouter structure
        const rawContent = data.output || "";

        // Strip markdown backticks, newlines, and common model prefixes
        // Example output to parse: "Type: Men | Status: Fix Required | Aspect: Fit | Action: Adjust size"
        const cleaned = rawContent
            .replace(/```/g, "")
            .replace(/^(Result|Output|Analysis|Review):/i, "")
            .trim();
        
        // Parse the structured format
        const info = {};
        cleaned.split('|').forEach(part => {
            const segments = part.split(':');
            if (segments.length >= 2) {
                // Key is the first part, Value is the rest (joined back in case of extra colons)
                const key = segments[0].trim().toLowerCase();
                const value = segments.slice(1).join(':').trim();
                info[key] = value;
            }
        });

        return {
            type: info.type || "General",
            status: info.status || "Review Needed",
            aspect: info.aspect || "Quality Check",
            action: info.action || "Evaluate feedback manually",
            visual: info.visual_edit || "none"
        };
    } catch (e) {
        console.error("AI Communication Failure:", e);
        return { 
            type: "Offline", 
            status: "Error", 
            aspect: "N/A", 
            action: "Check Worker/API Connection",
            visual: "none"
        };
    }
}

/**
 * Dynamically adds a new row to the Results table
 */
function addTableRowToDashboard(originalText, ai) {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    const tr = document.createElement('tr');
    
    // Logic for Status Badges
    const statusLower = (ai.status || "").toLowerCase();
    const isFixNeeded = statusLower.includes("fix") || statusLower.includes("fail") || statusLower.includes("check");
    const badgeClass = isFixNeeded ? "status-fix" : "status-ok";
    
    // Logic for visual edit icon
    const visualLower = (ai.visual || "none").toLowerCase();
    const hasVisual = visualLower !== "none" && visualLower !== "n/a" && visualLower !== "";
    const designIcon = hasVisual ? '<span class="icon" title="Visual Edit Suggested">🎨</span>' : "";

    tr.innerHTML = `
        <td>
            <span class="type-pill">${ai.type}</span><br>
            <div style="margin-top:8px; color:#64748b; font-size:0.8rem;">${originalText.substring(0, 85)}...</div>
        </td>
        <td><span class="badge ${badgeClass}">${ai.status}</span></td>
        <td><strong>${ai.aspect}</strong></td>
        <td class="action-cell">${ai.action} ${designIcon}</td>
    `;
    tbody.appendChild(tr);
}

/**
 * Creates and downloads a text-based Brand Intelligence Report
 */
function generateReport() {
    if (processedData.length === 0) {
        alert("No analysis data available to export.");
        return;
    }

    const timestamp = new Date().toLocaleString();
    let reportText = `BRAND INTELLIGENCE ANALYSIS REPORT\n`;
    reportText += `Generated: ${timestamp}\n`;
    reportText += "=".repeat(50) + "\n\n";

    processedData.forEach((item, index) => {
        reportText += `${index + 1}. [${item.ai.type.toUpperCase()}] STATUS: ${item.ai.status}\n`;
        reportText += `   ASPECT: ${item.ai.aspect}\n`;
        reportText += `   ACTION: ${item.ai.action}\n`;
        if (item.ai.visual && item.ai.visual.toLowerCase() !== 'none') {
            reportText += `   VISUAL EDIT: ${item.ai.visual}\n`;
        }
        reportText += `   FEEDBACK: "${item.original.trim()}"\n`;
        reportText += "-".repeat(30) + "\n";
    });

    const blob = new Blob([reportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Design_Intelligence_Report_${new Date().getTime()}.txt`;
    link.click();
}

/**
 * Event Listener for file selection UI changes
 */
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            if (this.files.length > 0) {
                // Show the processing controls
                const controls = document.getElementById('controls');
                if (controls) controls.style.display = 'flex';
                
                // Reset UI sections for a fresh run
                const statusArea = document.getElementById('statusArea');
                const tableContainer = document.getElementById('tableContainer');
                const reportBtn = document.getElementById('reportBtn');
                
                if(statusArea) statusArea.style.display = 'none';
                if(tableContainer) tableContainer.style.display = 'none';
                if(reportBtn) reportBtn.style.display = 'none';
            }
        });
    }
});

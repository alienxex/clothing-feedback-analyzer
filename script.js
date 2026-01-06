// --- CONFIGURATION ---
// PASTE YOUR CLOUDFLARE WORKER URL HERE
// Example: https://clothing-analyzer.your-name.workers.dev
const WORKER_URL = "https://clothing-analyzer.robust9223.workers.dev/"; 

let feedbackData = []; // Stores the analysis results for the report

// 1. Handle File Selection
document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Show file info and start button
    document.getElementById('fileInfo').innerText = `Selected: ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
    document.getElementById('controls').style.display = 'block';
    
    // Reset previous results
    document.getElementById('actionButtons').style.display = 'none';
    document.getElementById('resultsTableContainer').style.display = 'none';
    document.getElementById('progressContainer').style.display = 'none';
});

// 2. Main Processing Function
async function startBatchProcessing() {
    const file = document.getElementById('fileInput').files[0];
    if (!file) return;

    // UI Updates: Hide controls, show progress
    document.getElementById('controls').style.display = 'none';
    document.getElementById('progressContainer').style.display = 'block';
    document.getElementById('resultsTableContainer').style.display = 'block';
    
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = ""; // Clear old table data
    feedbackData = []; // Clear old report data

    // Read File
    const text = await file.text();
    let lines = [];

    // Parse different file types
    if (file.name.endsWith('.json')) {
        try {
            const json = JSON.parse(text);
            // Handle both array of strings ["text"] or array of objects [{text: "..."}]
            lines = Array.isArray(json) ? json.map(item => typeof item === 'object' ? (item.text || JSON.stringify(item)) : item) : [];
        } catch(e) { alert("Invalid JSON file"); return; }
    } else {
        // For CSV or TXT, split by new line
        lines = text.split('\n').filter(line => line.trim().length > 0);
    }

    // Process each line
    const total = lines.length;
    
    for (let i = 0; i < total; i++) {
        // Clean text (remove CSV quotes if present)
        const rawText = lines[i].replace(/^"|"$/g, '').trim(); 
        if (!rawText) continue;

        // Call your AI API
        const result = await analyzeSingleText(rawText);
        
        // Save Data for CSV Report
        const rowData = {
            id: i + 1,
            text: rawText,
            sentiment: result.label,
            score: result.score
        };
        feedbackData.push(rowData);

        // Update UI (Add Table Row)
        addTableRow(rowData);

        // Update Progress Bar
        const percent = Math.round(((i + 1) / total) * 100) + "%";
        document.getElementById('progressFill').style.width = percent;
        document.getElementById('progressText').innerText = percent;
    }

    // Show Download Button when done
    document.getElementById('actionButtons').style.display = 'flex';
}

// 3. API Caller (Talks to your Cloudflare Worker)
async function analyzeSingleText(text) {
    try {
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text })
        });

        const data = await response.json();
        
        // Parse Hugging Face format (usually [[{label:..., score:...}]])
        const predictions = Array.isArray(data) ? (Array.isArray(data[0]) ? data[0] : data) : [];
        
        if (predictions.length > 0) {
            const top = predictions[0];
            let label = top.label;
            
            // Map model labels to user-friendly terms
            if (label === 'LABEL_1' || label === 'POSITIVE') label = 'POSITIVE';
            if (label === 'LABEL_0' || label === 'NEGATIVE') label = 'NEGATIVE';
            
            return { label: label, score: (top.score * 100).toFixed(1) + "%" };
        }
        return { label: "UNKNOWN", score: "0%" };

    } catch (error) {
        console.error("API Error:", error);
        return { label: "ERROR", score: "0%" };
    }
}

// 4. UI Helper: Add Row to Table
function addTableRow(data) {
    const tbody = document.getElementById('tableBody');
    const row = document.createElement('tr');
    
    // Choose badge color based on sentiment
    let badgeClass = "badge-neu";
    if (data.sentiment === "POSITIVE") badgeClass = "badge-pos";
    if (data.sentiment === "NEGATIVE") badgeClass = "badge-neg";

    // Truncate long text for display
    const displayText = data.text.length > 80 ? data.text.substring(0, 80) + '...' : data.text;

    row.innerHTML = `
        <td>${displayText}</td>
        <td><span class="badge ${badgeClass}">${data.sentiment}</span></td>
        <td>${data.score}</td>
    `;
    tbody.appendChild(row);
}

// 5. Download Report (CSV Generator)
function downloadReport() {
    if (feedbackData.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Original Feedback,Sentiment,Confidence\n"; // Header row

    feedbackData.forEach(row => {
        // Escape quotes and commas to prevent CSV breakage
        const safeText = row.text.replace(/"/g, '""'); 
        csvContent += `${row.id},"${safeText}",${row.sentiment},${row.score}\n`;
    });

    // Trigger download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "brand_analysis_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

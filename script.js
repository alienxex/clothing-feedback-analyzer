/**
 * Smart Designer AI - Website Logic
 * Connects to Cloudflare Worker -> Ngrok -> Local AI Brain
 */

const WORKER_URL = "https://clothing-analyzer.robust9223.workers.dev/"; 

/**
 * Main function to process the uploaded CSV file
 */
async function startBatchProcessing() {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files[0]) {
        alert("Please upload your clothing_reviews.csv.csv file first!");
        return;
    }

    const file = fileInput.files[0];
    const text = await file.text();
    
    // We split by newline and take rows 1 to 11 (skipping header, taking 10 rows for analysis)
    const rows = text.split('\n').filter(row => row.trim() !== "").slice(1, 11); 

    // UI Feedback: Show progress and table
    document.getElementById('progressContainer').style.display = 'block';
    document.getElementById('resultsTableContainer').style.display = 'block';
    
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = "";

    for (let i = 0; i < rows.length; i++) {
        const rawRow = rows[i].trim();
        
        // Use the AI to analyze the feedback text
        const aiData = await analyzeFeedback(rawRow);
        
        // Add results to the professional dashboard table
        addTableRow(rawRow, aiData);
        
        // Update the visual progress bar
        const progress = Math.round(((i + 1) / rows.length) * 100);
        document.getElementById('progressFill').style.width = `${progress}%`;
        document.getElementById('progressText').innerText = `${progress}%`;
    }
    
    document.getElementById('statusLabel').innerText = "Analysis Complete!";
}

/**
 * Communicates with the Cloudflare Worker to get AI analysis
 */
async function analyzeFeedback(rawText) {
    try {
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: rawText })
        });

        if (!response.ok) throw new Error("Worker responded with error");

        const result = await response.json();
        
        // Local AI via ngrok usually returns { "output": "..." } or { "response": "..." }
        // We handle multiple formats just in case
        const rawOutput = result.output || result.response || result[0]?.generated_text || "";

        // The AI output is formatted as: "Type: ... | Status: ... | Action: ..."
        // We convert this string into a clean data object
        const info = {};
        rawOutput.split('|').forEach(part => {
            const [key, value] = part.split(':').map(s => s.trim());
            if (key && value) info[key.toLowerCase()] = value;
        });

        return {
            type: info.type || "N/A",
            status: info.status || "N/A",
            aspect: info.aspect || "General",
            action: info.action || "Checking details...",
            visual: info.visual_edit || "none"
        };
    } catch (e) {
        console.error("Connection failed to Worker/Ngrok:", e);
        return { 
            type: "Offline", 
            status: "Error", 
            aspect: "N/A", 
            action: "Check Ngrok/Worker Status", 
            visual: "none" 
        };
    }
}

/**
 * Dynamically adds a new row to the results table
 */
function addTableRow(originalText, ai) {
    const tbody = document.getElementById('tableBody');
    const row = document.createElement('tr');
    
    // Determine badge color based on status
    const isFix = ai.status.toLowerCase().includes("fix");
    const badgeClass = isFix ? "badge-neg" : "badge-pos";
    
    // Show an icon if the AI suggests a visual design change
    const designIcon = ai.visual !== "none" ? " 🎨" : "";

    row.innerHTML = `
        <td>
            <span class="type-tag">${ai.type}</span><br>
            <span style="color: #64748b; font-size: 0.8rem;">${originalText.substring(0, 65)}...</span>
        </td>
        <td><span class="badge ${badgeClass}">${ai.status}</span></td>
        <td><strong>${ai.aspect}</strong></td>
        <td class="action-text">${ai.action}${designIcon}</td>
    `;
    tbody.appendChild(row);
}

/**
 * Event Listener to show the "Run" button when a file is chosen
 */
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            if (this.files.length > 0) {
                document.getElementById('controls').style.display = 'block';
            }
        });
    }
});

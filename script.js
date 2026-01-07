// Finalized Cloudflare Worker URL
const WORKER_URL = "https://feedbackanalysis.robust9223.workers.dev/"; 

/**
 * Main function to trigger batch processing of the CSV file
 */
async function startBatchProcessing() {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files[0]) {
        alert("Please upload your clothing_reviews.csv.csv file first!");
        return;
    }

    const file = fileInput.files[0];
    const text = await file.text();
    
    // Split into rows and skip the header (Process first 10 rows for testing)
    const rows = text.split('\n').filter(row => row.trim() !== "").slice(1, 11); 

    // UI Updates: Show progress and results table
    document.getElementById('progressContainer').style.display = 'block';
    document.getElementById('resultsTableContainer').style.display = 'block';
    
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = "";

    for (let i = 0; i < rows.length; i++) {
        const rowData = rows[i].trim();
        
        // Step 1: Send text to AI via Cloudflare Worker
        const aiResponse = await analyzeFeedbackWithAI(rowData);
        
        // Step 2: Display the result in the dashboard table
        addTableRowToDashboard(rowData, aiResponse);
        
        // Step 3: Update progress bar
        const progress = Math.round(((i + 1) / rows.length) * 100);
        document.getElementById('progressFill').style.width = `${progress}%`;
        document.getElementById('progressText').innerText = `${progress}%`;
    }
    
    document.getElementById('statusLabel').innerText = "Analysis Complete!";
}

/**
 * Communicates with the Cloudflare Worker (which talks to OpenRouter)
 */
async function analyzeFeedbackWithAI(rawText) {
    try {
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: rawText })
        });

        if (!response.ok) throw new Error("Worker Error");

        const result = await response.json();
        let rawContent = result.output || "";

        // --- CLEANING THE AI OUTPUT ---
        // Remove markdown code blocks if the AI included them
        rawContent = rawContent.replace(/```/g, "");
        // Remove common prefixes like "Result:" or "Analysis:"
        rawContent = rawContent.replace(/^(Result|Analysis|Output):\s*/i, "").trim();

        // Parse the structured string: "Type: X | Status: Y | Action: Z"
        const parsedData = {};
        rawContent.split('|').forEach(segment => {
            const parts = segment.split(':');
            if (parts.length >= 2) {
                const key = parts[0].trim().toLowerCase();
                const value = parts.slice(1).join(':').trim();
                parsedData[key] = value;
            }
        });

        return {
            type: parsedData.type || "General",
            status: parsedData.status || "Review",
            aspect: parsedData.aspect || "Quality",
            action: parsedData.action || "Evaluate feedback",
            visual: parsedData.visual_edit || "none"
        };

    } catch (error) {
        console.error("Connection Failed:", error);
        return { 
            type: "Offline", 
            status: "Error", 
            aspect: "N/A", 
            action: "Check Worker/API Token", 
            visual: "none" 
        };
    }
}

/**
 * Appends a new data row to the HTML table
 */
function addTableRowToDashboard(originalFeedback, ai) {
    const tbody = document.getElementById('tableBody');
    const row = document.createElement('tr');
    
    const isFixRequired = ai.status.toLowerCase().includes("fix");
    const badgeColorClass = isFixRequired ? "badge-neg" : "badge-pos";
    const designIcon = ai.visual !== "none" ? " 🎨" : "";

    row.innerHTML = `
        <td>
            <span class="type-tag">${ai.type}</span><br>
            <span style="color: #64748b; font-size: 0.8rem;">${originalFeedback.substring(0, 70)}...</span>
        </td>
        <td><span class="badge ${badgeColorClass}">${ai.status}</span></td>
        <td><strong>${ai.aspect}</strong></td>
        <td class="action-text">${ai.action}${designIcon}</td>
    `;
    tbody.appendChild(row);
}

/**
 * Handle File Selection Visibility
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

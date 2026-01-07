/**
 * Smart Designer AI - Website Logic
 * Final Version: Fixed parsing for raw AI output
 */

const WORKER_URL = "[https://clothing-analyzer.robust9223.workers.dev/](https://clothing-analyzer.robust9223.workers.dev/)"; 

async function startBatchProcessing() {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files[0]) {
        alert("Please upload your clothing_reviews.csv.csv file first!");
        return;
    }

    const file = fileInput.files[0];
    const text = await file.text();
    
    // Process top 10 rows to ensure fast response and UI stability
    const rows = text.split('\n').filter(row => row.trim() !== "").slice(1, 11); 

    document.getElementById('progressContainer').style.display = 'block';
    document.getElementById('resultsTableContainer').style.display = 'block';
    
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = "";

    for (let i = 0; i < rows.length; i++) {
        const rawRow = rows[i].trim();
        const aiData = await analyzeFeedback(rawRow);
        addTableRow(rawRow, aiData);
        
        const progress = Math.round(((i + 1) / rows.length) * 100);
        document.getElementById('progressFill').style.width = `${progress}%`;
        document.getElementById('progressText').innerText = `${progress}%`;
    }
    
    document.getElementById('statusLabel').innerText = "Analysis Complete!";
}

/**
 * Communicates with the Cloudflare Worker and cleans the raw AI string
 */
async function analyzeFeedback(rawText) {
    try {
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: rawText })
        });

        const result = await response.json();
        
        // Handle different API response structures
        let rawOutput = result.output || result.response || result[0]?.generated_text || "";

        // --- CLEANING LAYER ---
        // 1. Remove Markdown backticks if present
        rawOutput = rawOutput.replace(/```/g, "");
        // 2. Remove "Result:" or "Analysis:" prefixes sometimes added by local models
        rawOutput = rawOutput.replace(/^(Result|Analysis|Output):\s*/i, "");
        // 3. Remove any leading/trailing whitespace
        rawOutput = rawOutput.trim();

        // Convert the string "Type: X | Status: Y..." into a JavaScript Object
        const info = {};
        rawOutput.split('|').forEach(part => {
            const pair = part.split(':');
            if (pair.length >= 2) {
                const key = pair[0].trim().toLowerCase();
                const value = pair.slice(1).join(':').trim(); // Join in case there are extra colons
                info[key] = value;
            }
        });

        return {
            type: info.type || "General",
            status: info.status || "Check Needed",
            aspect: info.aspect || "Review",
            action: info.action || "Evaluate quality",
            visual: info.visual_edit || "none"
        };
    } catch (e) {
        return { type: "N/A", status: "Offline", aspect: "Error", action: "Check Connection", visual: "none" };
    }
}

/**
 * Injects the cleaned data into the Dashboard Table
 */
function addTableRow(originalText, ai) {
    const tbody = document.getElementById('tableBody');
    const row = document.createElement('tr');
    
    const isFix = ai.status.toLowerCase().includes("fix");
    const badgeClass = isFix ? "badge-neg" : "badge-pos";
    const designIcon = ai.visual !== "none" ? " 🎨" : "";

    row.innerHTML = `
        <td>
            <span class="type-tag">${ai.type}</span><br>
            <span style="color: #64748b; font-size: 0.8rem;">${originalText.substring(0, 70)}...</span>
        </td>
        <td><span class="badge ${badgeClass}">${ai.status}</span></td>
        <td><strong>${ai.aspect}</strong></td>
        <td class="action-text">${ai.action}${designIcon}</td>
    `;
    tbody.appendChild(row);
}

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

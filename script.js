/**
 * StyleSense - Client Side Logic
 * Handles file uploads, UI updates, and communication with the Cloudflare Worker.
 */

// ---------------------------------------------------------
// CONFIGURATION: PASTE YOUR CLOUDFLARE WORKER URL HERE
// ---------------------------------------------------------
const WORKER_URL = "https://feedbackanalysis.robust9223.workers.dev/"; 
// ^^^ Replace the text inside quotes with your actual URL ^^^
// ---------------------------------------------------------

let processedData = [];

/**
 * Main function to read file and send data to AI
 */
async function processData() {
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    // Check if user forgot to set the URL in the code
    if (WORKER_URL.includes("your-worker-name") || WORKER_URL === "") {
        alert("Configuration Error: Please open script.js and paste your Cloudflare Worker URL into the WORKER_URL variable.");
        return;
    }

    if (!file) {
        alert("Please select a feedback file to analyze.");
        return;
    }

    // Reset UI
    document.getElementById("statusArea").style.display = "block";
    document.getElementById("tableContainer").style.display = "block";
    document.getElementById("reportBtn").style.display = "none";
    document.getElementById("tableBody").innerHTML = "";
    processedData = [];

    try {
        let rawRows = [];
        const extension = file.name.split(".").pop().toLowerCase();

        // --- 1. FILE PARSING ---
        if (extension === "xlsx" || extension === "xls") {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            // Get data as array of arrays
            const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }); 
            // Flatten and filter empty rows or rows that are too short
            rawRows = json.flat().filter(cell => cell && typeof cell === 'string' && cell.length > 5);
        } else if (extension === "json") {
            const text = await file.text();
            const json = JSON.parse(text);
            if (Array.isArray(json)) {
                // Handle array of strings or array of objects
                rawRows = json.map(item => typeof item === 'object' ? Object.values(item).join(" ") : item);
            }
        } else {
            // Text or CSV fallback
            const text = await file.text();
            rawRows = text.split("\n").filter(r => r.trim().length > 5);
        }

        // Limit for demo safety. Remove .slice(0, 20) to process the whole file.
        const limitedRows = rawRows.slice(0, 20); 

        // --- 2. AI PROCESSING LOOP ---
        for (let i = 0; i < limitedRows.length; i++) {
            const rowContent = limitedRows[i];
            
            // Update Status Indicator
            document.getElementById("statusLabel").innerHTML = `
                <svg class="animate-spin h-4 w-4 text-indigo-600 mr-2 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Analyzing Feedback ${i + 1} of ${limitedRows.length}...`;

            // Call Cloudflare Worker
            const aiResult = await callAI(rowContent);

            // Save & Display Results
            processedData.push({ original: rowContent, ai: aiResult });
            addTableRow(rowContent, aiResult);

            // Update Progress Bar Width
            const progress = Math.round(((i + 1) / limitedRows.length) * 100);
            document.getElementById("progressFill").style.width = `${progress}%`;
            document.getElementById("progressText").innerText = `${progress}%`;
        }

        // Completion State
        document.getElementById("statusLabel").innerText = "Analysis Complete ✅";
        document.getElementById("reportBtn").style.display = "inline-flex";

    } catch (error) {
        console.error("Processing Error:", error);
        alert("Error: " + error.message);
        document.getElementById("statusLabel").innerText = "Error Occurred";
    }
}

/**
 * Sends a single text string to the Worker URL
 */
async function callAI(text) {
    try {
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Server Error: ${err}`);
        }

        const data = await response.json();
        let output = data.output || "No insight found.";
        
        // Clean up any markdown formatting marks from AI
        return output.replace(/```/g, "").trim();
    } catch (error) {
        return `Failed: ${error.message}`;
    }
}

/**
 * Adds a new row to the HTML table
 */
function addTableRow(original, ai) {
    const tbody = document.getElementById("tableBody");
    const tr = document.createElement("tr");
    
    // Color code sentiment based on keywords
    let sentimentClass = "text-slate-700";
    const lowerAi = ai.toLowerCase();
    
    if (lowerAi.includes("positive")) sentimentClass = "text-green-700 font-medium";
    else if (lowerAi.includes("negative")) sentimentClass = "text-red-600 font-medium";
    else if (lowerAi.includes("mixed")) sentimentClass = "text-yellow-600 font-medium";

    tr.innerHTML = `
        <td class="px-6 py-4 text-slate-600 border-b border-slate-100">${original}</td>
        <td class="px-6 py-4 ${sentimentClass} border-b border-slate-100">${ai}</td>
    `;
    tbody.appendChild(tr);
}

/**
 * Generates and downloads a .txt report
 */
function generateReport() {
    let content = "STYLESENSE FEEDBACK REPORT\n";
    content += "====================================\n\n";
    
    processedData.forEach((item, idx) => {
        content += `[${idx + 1}] Feedback: ${item.original}\n`;
        content += `    Analysis: ${item.ai}\n`;
        content += "------------------------------------\n";
    });

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "StyleSense_Report.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

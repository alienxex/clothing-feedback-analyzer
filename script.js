/**
 * StyleSense Intelligence - Frontend Logic
 * This script handles file reading, communication with the Cloudflare Worker,
 * and rendering the analysis table.
 */

async function processData() {
    const fileInput = document.getElementById('filePicker');
    const status = document.getElementById('status');
    const tableBody = document.getElementById('tableBody');
    const resultTable = document.getElementById('resultTable');

    // 1. Validate File Selection
    if (!fileInput.files[0]) {
        alert("Please upload a CSV or Text file first.");
        return;
    }

    const file = fileInput.files[0];
    const rawContent = await file.text();
    
    // UI Feedback: Loading State
    status.innerHTML = `<span style="color: #6366f1;">⏳ Analyzing feedback. Please wait...</span>`;
    tableBody.innerHTML = "";
    resultTable.style.display = 'none';

    try {
        // 2. Send POST request to Cloudflare Worker
        const response = await fetch("https://feedbackanalysis.robust9223.workers.dev/", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({ data: rawContent })
        });

        // Check if the Worker responded successfully
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Worker Error (${response.status}): ${errorText}`);
        }

        const result = await response.json();

        // 3. Handle AI Response
        if (result.error) {
            throw new Error(result.error.message || result.error);
        }

        // OpenRouter results usually reside in choices[0].message.content
        let aiContent = result.choices[0].message.content;
        
        // Sometimes AI includes markdown code blocks (```json ... ```), we must remove them
        if (aiContent.includes("```")) {
            aiContent = aiContent.replace(/```json|```/g, "").trim();
        }

        const parsedData = JSON.parse(aiContent);
        
        // Ensure we are working with an array
        const dataArray = Array.isArray(parsedData) ? parsedData : (parsedData.reports || Object.values(parsedData)[0]);

        if (!Array.isArray(dataArray)) {
            throw new Error("AI did not return a valid list of feedback. Try again.");
        }

        // 4. Render Table Rows
        tableBody.innerHTML = dataArray.map(item => `
            <tr>
                <td><b>${item.id || 'N/A'}</b></td>
                <td>${item.quality || 'N/A'}</td>
                <td>${item.fabric || 'N/A'}</td>
                <td>${item.delivery || 'N/A'}</td>
                <td>${item.changes || 'No changes requested'}</td>
                <td><span class="badge ${(item.priority || 'low').toLowerCase()}">${item.priority || 'Low'}</span></td>
            </tr>
        `).join('');

        // 5. Show Results
        resultTable.style.display = 'table';
        status.innerHTML = `<span style="color: #15803d;">✅ Analysis Complete!</span>`;

    } catch (err) {
        // Detailed Error Reporting
        console.error("Full Script Error:", err);
        status.innerHTML = `<span style="color: #b91c1c;">❌ Error: ${err.message}</span>`;
    }
}

/**
 * Optional: Reset UI function
 */
function resetAnalyzer() {
    document.getElementById('filePicker').value = "";
    document.getElementById('status').innerText = "Waiting for file...";
    document.getElementById('resultTable').style.display = 'none';
    document.getElementById('tableBody').innerHTML = "";
}

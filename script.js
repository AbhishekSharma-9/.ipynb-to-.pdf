const fileInput = document.getElementById('fileInput');
const convertBtn = document.getElementById('convertBtn');
const previewArea = document.getElementById('notebook-preview');
const status = document.getElementById('status');
let filename = 'notebook';

// 1. File Upload Handling
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    filename = file.name.replace('.ipynb', '');
    status.textContent = "Parsing Notebook...";
    convertBtn.disabled = true;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            renderNotebook(data);
        } catch (err) {
            console.error(err);
            status.textContent = "Error: Invalid IPYNB file.";
        }
    };
    reader.readAsText(file);
});

// 2. Render Logic
async function renderNotebook(data) {
    previewArea.innerHTML = ''; 
    const cells = data.cells || [];

    for (const cell of cells) {
        const cellDiv = document.createElement('div');
        cellDiv.className = 'cell';

        // --- CODE CELLS ---
        if (cell.cell_type === 'code') {
            // Input Block -> ATOMIC (no-break)
            const inputGroup = document.createElement('div');
            inputGroup.className = 'inner_cell no-break'; 
            inputGroup.innerHTML = `
                <div class="prompt input">In [${cell.execution_count || ' '}]:</div>
                <div class="content_box">
                    <div class="input_area">
                        <pre><code class="language-python">${escapeHtml(joinSource(cell.source))}</code></pre>
                    </div>
                </div>
            `;
            cellDiv.appendChild(inputGroup);

            // Output Blocks -> ATOMIC (no-break)
            if (cell.outputs && cell.outputs.length) {
                cell.outputs.forEach(out => {
                    const outRow = document.createElement('div');
                    outRow.className = 'inner_cell no-break';
                    let outHtml = '';

                    if (out.data && (out.data['image/png'] || out.data['image/jpeg'])) {
                        const mime = out.data['image/png'] ? 'image/png' : 'image/jpeg';
                        const b64 = Array.isArray(out.data[mime]) ? out.data[mime].join('').replace(/\n/g, '') : out.data[mime];
                        outHtml = `<img src="data:${mime};base64,${b64}" />`;
                    } 
                    else if (out.text || (out.data && out.data['text/plain'])) {
                        const txt = out.text || out.data['text/plain'];
                        outHtml = `<pre>${escapeHtml(joinSource(txt))}</pre>`;
                    } 
                    else if (out.data && out.data['text/html']) {
                        outHtml = `<div style="width:100%">${joinSource(out.data['text/html'])}</div>`;
                    }

                    if(outHtml) {
                        const promptText = (out.output_type === 'execute_result') 
                            ? `Out [${cell.execution_count || ''}]:` 
                            : ''; 
                        
                        outRow.innerHTML = `
                            <div class="prompt output">${promptText}</div>
                            <div class="content_box output_wrapper">${outHtml}</div>
                        `;
                        cellDiv.appendChild(outRow);
                    }
                });
            }
        } 
        // --- MARKDOWN CELLS ---
        else if (cell.cell_type === 'markdown') {
            const mdDiv = document.createElement('div');
            // Mark markdown as no-break so paragraphs don't split awkwardly
            mdDiv.className = 'rendered_html no-break';
            mdDiv.innerHTML = marked.parse(joinSource(cell.source));
            cellDiv.appendChild(mdDiv);
        }

        previewArea.appendChild(cellDiv);
    }

    document.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));

    if (window.MathJax) {
        status.textContent = "Rendering Math...";
        await MathJax.typesetPromise([previewArea]);
    }

    status.textContent = "Ready to Download.";
    convertBtn.disabled = false;
}

// 3. PDF Generation Logic
convertBtn.addEventListener('click', () => {
    status.textContent = "Generating PDF...";
    convertBtn.disabled = true;

    const opt = {
        // MARGINS: [Top, Left, Bottom, Right]
        // Bottom=15mm creates the "Safe Zone" for the footer.
        // Left/Right=0 ensures our CSS padding handles the width centering correctly.
        margin:       [10, 0, 15, 0], 
        filename:     filename + '.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        // 'css' mode respects the 'page-break-inside: avoid' rule we added
        pagebreak:    { mode: 'css', avoid: '.no-break' } 
    };

    html2pdf().from(previewArea).set(opt).toPdf().get('pdf').then((pdf) => {
        const totalPages = pdf.internal.getNumberOfPages();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFontSize(8);
            pdf.setTextColor(120); 
            
            const text = "Made by Karlo Sharma | Github Link - https://abhisheksharma-9.github.io/.ipynb-to-.pdf/";
            
            // Footer Line (Drawn in the 15mm safe zone)
            pdf.setDrawColor(200); 
            pdf.setLineWidth(0.1);
            pdf.line(15, pageHeight - 12, pageWidth - 15, pageHeight - 12);
            
            pdf.text(text, pageWidth / 2, pageHeight - 8, { align: 'center' });
        }
    }).save().then(() => {
        status.textContent = "Download Complete!";
        convertBtn.disabled = false;
    });
});

function joinSource(s) { return Array.isArray(s) ? s.join('') : (s || ''); }
function escapeHtml(t) { return t ? t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : ''; }
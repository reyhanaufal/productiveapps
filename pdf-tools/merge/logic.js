window.addEventListener('DOMContentLoaded', () => {
    
    const pdfInput = document.getElementById('pdf-input');
    const btnProcessMerge = document.getElementById('btn-process-merge');
    const statusMessage = document.getElementById('status-message');
    const fileListPreview = document.getElementById('file-list-preview');
    const pageFormatSelect = document.getElementById('page-format-select');

    const PDFLib = window.PDFLib;
    const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;

    if (!PDFLib || !window.Sortable || !pdfjsLib) {
        statusMessage.style.color = '#e74c3c';
        statusMessage.innerHTML = '❌ <b>Gagal memuat library!</b> Pastikan semua library lokal (pdf-lib, Sortable, pdf.js) tersedia.';
        return; 
    }

    pdfjsLib.GlobalWorkerOptions.workerSrc = '../../lib/pdf.worker.min.js';

    let selectedFiles = [];
    let sortableInstance = null;

    // Fungsi membuat thumbnail dari PDF Hal 1
    const generatePdfThumbnail = async (file) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const page = await pdf.getPage(1);
            
            const viewport = page.getViewport({ scale: 0.3 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({ canvasContext: context, viewport: viewport }).promise;
            return canvas.toDataURL('image/png');
        } catch (err) {
            if (err.name === 'PasswordException') {
                return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="120" viewBox="0 0 100 120"><rect width="100" height="120" fill="%23f0f0f0"/><text x="50" y="60" font-size="40" text-anchor="middle" dominant-baseline="middle">🔒</text><text x="50" y="90" font-size="10" text-anchor="middle" fill="%23e74c3c">Terkunci</text></svg>';
            }
            return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="120"><rect width="100" height="120" fill="%23f0f0f0"/><text x="50" y="60" font-size="30" text-anchor="middle">📄</text></svg>';
        }
    };

    const updateArrayOrder = () => {
        const currentItems = fileListPreview.querySelectorAll('.sortable-item');
        const newOrderedFiles = [];
        
        currentItems.forEach((item, index) => {
            const fileId = item.getAttribute('data-id');
            const file = selectedFiles.find(f => f.uniqueId === fileId);
            if (file) {
                newOrderedFiles.push(file);
                const indexBadge = item.querySelector('.file-index');
                if (indexBadge) indexBadge.textContent = index + 1;
            }
        });
        
        selectedFiles = newOrderedFiles; 
    };

    async function updateFileListUI() {
        if (sortableInstance) sortableInstance.destroy();
        fileListPreview.innerHTML = ''; 

        if (selectedFiles.length < 2) {
            btnProcessMerge.disabled = true;
        }

        if (selectedFiles.length === 0) return;

        statusMessage.style.color = 'black';
        statusMessage.textContent = '⏳ Memuat pratinjau dokumen...';

        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];

            const imgDataUrl = await generatePdfThumbnail(file);

            const card = document.createElement('div');
            card.className = 'sortable-item';
            card.setAttribute('data-id', file.uniqueId); 
            
            const indexBadge = document.createElement('div');
            indexBadge.className = 'file-index';
            indexBadge.textContent = i + 1;

            const handle = document.createElement('div');
            handle.className = 'drag-handle';
            handle.innerHTML = '&#9776;';

            const imgEl = document.createElement('img');
            imgEl.src = imgDataUrl;

            const fileName = document.createElement('span');
            fileName.className = 'file-name';
            fileName.textContent = file.name;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn-small';
            removeBtn.textContent = '❌';
            removeBtn.onclick = () => {
                selectedFiles.splice(i, 1); 
                updateFileListUI(); 
            };

            card.appendChild(indexBadge);
            card.appendChild(handle);
            card.appendChild(imgEl);
            card.appendChild(fileName);
            card.appendChild(removeBtn);
            
            fileListPreview.appendChild(card);
        }

        statusMessage.textContent = '';
        
        const msg = document.createElement('p');
        msg.style.width = "100%";
        msg.style.textAlign = "center";
        msg.style.gridColumn = "1 / -1"; 
        
        if (selectedFiles.length >= 2) {
            btnProcessMerge.disabled = false;
            msg.innerHTML = `<span style="color: #27ae60; font-weight:bold;">✅ ${selectedFiles.length} file siap. Sentuh/Klik ☰ untuk geser urutan.</span>`;
        } else {
            msg.innerHTML = `<span style="color: #e74c3c; font-weight:bold;">⚠️ Pilih minimal 2 file PDF.</span>`;
        }
        
        fileListPreview.appendChild(msg);

        sortableInstance = new Sortable(fileListPreview, {
            animation: 200, 
            handle: '.drag-handle', 
            ghostClass: 'sortable-ghost', 
            dragClass: 'sortable-drag', 
            forceFallback: true, 
            fallbackClass: 'sortable-drag',
            onEnd: function () {
                updateArrayOrder();
            }
        });
    }

    pdfInput.addEventListener('change', (event) => {
        const newFiles = Array.from(event.target.files);
        const filesWithIds = newFiles.map(file => {
            file.uniqueId = `${file.name}-${file.size}-${new Date().getTime()}`;
            return file;
        });

        selectedFiles = selectedFiles.concat(filesWithIds); 
        updateFileListUI(); 
        pdfInput.value = ''; 
    });

    btnProcessMerge.addEventListener('click', async () => {
        if (selectedFiles.length < 2 || !PDFLib) return;

        try {
            btnProcessMerge.disabled = true;
            statusMessage.style.color = 'black';
            statusMessage.textContent = '⏳ Membaca dan menggabungkan dokumen...';

            const { PDFDocument, PageSizes } = PDFLib;
            const mergedPdf = await PDFDocument.create();
            const formatMode = pageFormatSelect.value;

            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                statusMessage.textContent = `⏳ Memproses file ${i + 1} dari ${selectedFiles.length}...`;
                
                const arrayBuffer = await file.arrayBuffer();
                let srcPdf;
                
                try {
                    srcPdf = await PDFDocument.load(arrayBuffer);
                } catch (err) {
                    const errorMsg = err.message.toLowerCase();
                    if (errorMsg.includes('encrypted') || errorMsg.includes('password')) {
                        const userPassword = prompt(`🔒 Dokumen Terkunci!\nFile "${file.name}" butuh password:`);
                        if (userPassword) {
                            try { srcPdf = await PDFDocument.load(arrayBuffer, { password: userPassword }); } 
                            catch (pwdErr) { throw new Error(`Password salah untuk "${file.name}".`); }
                        } else { throw new Error(`Dibatalkan. File "${file.name}" terkunci.`); }
                    } else { throw new Error(`File "${file.name}" rusak.`); }
                }

                // PERBAIKAN: Ambil daftar seluruh halaman secara eksplisit
                const pageIndices = srcPdf.getPageIndices();

                if (formatMode === 'original') {
                    // Opsi 3: Kopi langsung agar teks bisa di-select/copy (Terbaik untuk PDF murni)
                    const copiedPages = await mergedPdf.copyPages(srcPdf, pageIndices);
                    copiedPages.forEach((page) => {
                        mergedPdf.addPage(page);
                    });
                } else {
                    // Opsi 1 & 2: Embed PDF untuk di-resize (Semua halaman ikut dimasukkan)
                    const embeddedPages = await mergedPdf.embedPdf(arrayBuffer, pageIndices);

                    for (let ePage of embeddedPages) {
                        if (formatMode === 'a4_full') {
                            const a4Width = PageSizes.A4[0];
                            const scaleRatio = a4Width / ePage.width;
                            const proportionalHeight = ePage.height * scaleRatio;
                            
                            const newPage = mergedPdf.addPage([a4Width, proportionalHeight]);
                            newPage.drawPage(ePage, {
                                x: 0, y: 0, width: a4Width, height: proportionalHeight
                            });
                        } else {
                            const newPage = mergedPdf.addPage(PageSizes.A4);
                            const margin = 40;
                            const maxDrawWidth = newPage.getWidth() - (margin * 2);
                            const maxDrawHeight = newPage.getHeight() - (margin * 2);

                            const scale = Math.min(maxDrawWidth / ePage.width, maxDrawHeight / ePage.height);
                            const scaledWidth = ePage.width * scale;
                            const scaledHeight = ePage.height * scale;

                            const xPos = (newPage.getWidth() / 2) - (scaledWidth / 2);
                            const yPos = (newPage.getHeight() / 2) - (scaledHeight / 2);

                            newPage.drawPage(ePage, {
                                x: xPos, y: yPos, width: scaledWidth, height: scaledHeight
                            });
                        }
                    }
                }
            }

            statusMessage.textContent = '⏳ Menyimpan hasil...';
            const mergedPdfBytes = await mergedPdf.save();
            
            const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
            const downloadUrl = URL.createObjectURL(blob);
            
            const timestampSN = new Date().getTime();
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `merge-pdf_productiveapps_${timestampSN}.pdf`;
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            statusMessage.style.color = '#27ae60';
            statusMessage.innerHTML = `🎉 <b>Selesai!</b> Semua halaman berhasil digabungkan.`;

        } catch (error) {
            console.error("Detail Error:", error);
            statusMessage.style.color = '#e74c3c';
            statusMessage.innerHTML = `❌ Gagal memproses file.<br><small>${error.message}</small>`;
        } finally {
            btnProcessMerge.disabled = false;
        }
    });
});
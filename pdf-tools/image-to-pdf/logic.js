window.addEventListener('DOMContentLoaded', () => {
    
    const imageInput = document.getElementById('image-input');
    const btnProcessConvert = document.getElementById('btn-process-convert');
    const statusMessage = document.getElementById('status-message');
    const fileListPreview = document.getElementById('file-list-preview');
    const pageFormatSelect = document.getElementById('page-format-select');

    const PDFLib = window.PDFLib;
    if (!PDFLib || !window.Sortable) {
        statusMessage.style.color = '#e74c3c';
        statusMessage.innerHTML = '❌ <b>Gagal memuat library!</b> Pastikan file library lokal Anda lengkap.';
        return; 
    }

    let selectedFiles = [];
    let sortableInstance = null;

    const readFileAsDataURL = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.onerror);
            reader.readAsDataURL(file);
        });
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

        if (selectedFiles.length === 0) {
            btnProcessConvert.disabled = true;
            return;
        }

        statusMessage.style.color = 'black';
        statusMessage.textContent = '⏳ Memuat pratinjau gambar...';

        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];

            try {
                const imgDataUrl = await readFileAsDataURL(file);

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
                imgEl.alt = file.name;

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
            } catch (err) {
                console.error(`Gagal memuat pratinjau`, err);
            }
        }

        statusMessage.textContent = '';
        btnProcessConvert.disabled = false;
        
        const msg = document.createElement('p');
        msg.style.width = "100%";
        msg.style.textAlign = "center";
        msg.style.gridColumn = "1 / -1"; 
        msg.innerHTML = `<span style="color: #27ae60; font-weight:bold;">✅ ${selectedFiles.length} gambar siap diproses.</span>`;
        fileListPreview.appendChild(msg);

        // INISIALISASI SORTABLE DENGAN VISUAL BIRU
        sortableInstance = new Sortable(fileListPreview, {
            animation: 200, 
            handle: '.drag-handle', 
            ghostClass: 'sortable-ghost', // Kelas kotak target biru
            dragClass: 'sortable-drag', // Kelas item yang sedang melayang
            forceFallback: true, // Wajib diaktifkan agar style HP berfungsi maksimal
            fallbackClass: 'sortable-drag',
            onEnd: function () {
                updateArrayOrder();
            }
        });
    }

    imageInput.addEventListener('change', (event) => {
        const newFiles = Array.from(event.target.files);
        const filesWithIds = newFiles.map(file => {
            file.uniqueId = `${file.name}-${file.size}-${new Date().getTime()}`;
            return file;
        });

        selectedFiles = selectedFiles.concat(filesWithIds); 
        updateFileListUI(); 
        imageInput.value = ''; 
    });

    btnProcessConvert.addEventListener('click', async () => {
        if (selectedFiles.length === 0 || !PDFLib) return;

        try {
            btnProcessConvert.disabled = true;
            statusMessage.style.color = 'black';
            statusMessage.textContent = '⏳ Membuat PDF...';

            const { PDFDocument, PageSizes } = PDFLib;
            const pdfDoc = await PDFDocument.create();
            const formatMode = pageFormatSelect.value; // Ambil pilihan dropdown

            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                statusMessage.textContent = `⏳ Memasukkan halaman ${i + 1} dari ${selectedFiles.length}...`;
                
                const arrayBuffer = await file.arrayBuffer();
                let imageElement;
                
                if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
                    imageElement = await pdfDoc.embedJpg(arrayBuffer);
                } else if (file.type === 'image/png') {
                    imageElement = await pdfDoc.embedPng(arrayBuffer);
                } else {
                    continue; 
                }

                // LOGIKA BERDASARKAN PILIHAN DROPDOWN
                if (formatMode === 'original') {
                    // OPSI 3: Resolusi Asli (Halaman mengikuti besar gambar persis)
                    const page = pdfDoc.addPage([imageElement.width, imageElement.height]);
                    page.drawImage(imageElement, { 
                        x: 0, y: 0, width: imageElement.width, height: imageElement.height 
                    });
                
                } else if (formatMode === 'a4_full') {
                    // OPSI 2: Lebar Seragam & Tanpa Margin Putih (TIDAK GEPENG)
                    // Lebar disamakan (seukuran lebar A4), tinggi menyesuaikan rasio asli gambar
                    const a4Width = PageSizes.A4[0]; // Lebar standar A4 (595.28)
                    const scaleRatio = a4Width / imageElement.width; // Hitung faktor pengali
                    const proportionalHeight = imageElement.height * scaleRatio; // Tinggi disesuaikan

                    // Buat halaman dengan lebar tetap, namun tinggi yang dinamis
                    const page = pdfDoc.addPage([a4Width, proportionalHeight]);
                    
                    page.drawImage(imageElement, {
                        x: 0, 
                        y: 0, 
                        width: a4Width, 
                        height: proportionalHeight
                    });

                } else {
                    // OPSI 1: A4 Mutlak dengan Margin Putih
                    const page = pdfDoc.addPage(PageSizes.A4);
                    const margin = 40; 
                    const maxDrawWidth = page.getWidth() - (margin * 2);
                    const maxDrawHeight = page.getHeight() - (margin * 2);

                    const scaledImage = imageElement.scaleToFit(maxDrawWidth, maxDrawHeight);
                    const xPos = (page.getWidth() / 2) - (scaledImage.width / 2);
                    const yPos = (page.getHeight() / 2) - (scaledImage.height / 2);

                    page.drawImage(imageElement, {
                        x: xPos, y: yPos,
                        width: scaledImage.width, height: scaledImage.height,
                    });
                }
            }

            statusMessage.textContent = '⏳ Menyimpan PDF...';
            const pdfBytes = await pdfDoc.save();
            
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const downloadUrl = URL.createObjectURL(blob);
            
            const timestampSN = new Date().getTime();
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `image-to-pdf_productiveapps_${timestampSN}.pdf`;
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            statusMessage.style.color = '#27ae60';
            statusMessage.innerHTML = `🎉 <b>Berhasil!</b> PDF selesai dibuat.`;

        } catch (error) {
            console.error("Detail Error:", error);
            statusMessage.style.color = '#e74c3c';
            statusMessage.innerHTML = `❌ Gagal memproses file.<br><small>${error.message}</small>`;
        } finally {
            btnProcessConvert.disabled = false;
        }
    });
});
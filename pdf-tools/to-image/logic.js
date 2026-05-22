window.addEventListener('DOMContentLoaded', () => {
    
    const pdfInput = document.getElementById('pdf-input');
    const btnProcessConvert = document.getElementById('btn-process-convert');
    const statusMessage = document.getElementById('status-message');
    const imageResults = document.getElementById('image-results');
    const qualitySelect = document.getElementById('quality-select');
    const formatSelect = document.getElementById('format-select');
    
    // Elemen baru
    const confirmArea = document.getElementById('confirm-area');
    const btnDownloadSelected = document.getElementById('btn-download-selected');

    const pdfjs = window.pdfjsLib || window['pdfjs-dist/build/pdf'];

    if (!pdfjs) {
        statusMessage.style.color = '#e74c3c';
        statusMessage.innerHTML = '❌ <b>Gagal memuat sistem pemroses PDF!</b>';
        return; 
    }

    pdfjs.GlobalWorkerOptions.workerSrc = '../../lib/pdf.worker.min.js';

    let selectedFile = null;
    
    // Array Memori untuk menyimpan halaman yang diekstraksi & dipilih
    // Berisi objek { id: number, dataUrl: string, fileExt: string }
    let processedPagesData = []; 

    pdfInput.addEventListener('change', (event) => {
        selectedFile = event.target.files[0];
        if (selectedFile) {
            btnProcessConvert.disabled = false;
            btnProcessConvert.style.display = 'block'; // Pastikan tombol utama muncul
            imageResults.innerHTML = ''; 
            confirmArea.style.display = 'none'; // Sembunyikan area konfirmasi
            statusMessage.innerHTML = `<span style="color: #27ae60;">✅ Siap diekstrak: <b>${selectedFile.name}</b></span>`;
        } else {
            btnProcessConvert.disabled = true;
            statusMessage.innerHTML = '';
        }
    });

    // ====== LOGIKA 1: EKSTRAK DAN TAMPILKAN PREVIEW DENGAN 'X' ======
    btnProcessConvert.addEventListener('click', async () => {
        if (!selectedFile || !pdfjs) return;

        try {
            btnProcessConvert.disabled = true;
            statusMessage.style.color = 'black';
            statusMessage.textContent = '⏳ Membaca dokumen...';
            imageResults.innerHTML = '';
            confirmArea.style.display = 'none'; // Sembunyikan area konfirmasi
            processedPagesData = []; // Kosongkan data halaman sebelumnya

            const arrayBuffer = await selectedFile.arrayBuffer();
            let pdf;
            
            try {
                pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
            } catch (err) {
                if (err.name === 'PasswordException') {
                    const userPassword = prompt(`🔒 Dokumen Terkunci!\nMasukkan password:`);
                    if (!userPassword) throw new Error('Dibatalkan pengguna.');
                    pdf = await pdfjs.getDocument({ data: arrayBuffer, password: userPassword }).promise;
                } else {
                    throw err;
                }
            }

            const totalPages = pdf.numPages;
            const scale = parseFloat(qualitySelect.value);
            const mimeType = formatSelect.value;
            const fileExt = mimeType === 'image/jpeg' ? 'jpg' : 'png';
            const timestampSN = new Date().getTime(); 
            
            // Loop ekstraksi halaman
            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                statusMessage.textContent = `⏳ Merender halaman ${pageNum} dari ${totalPages}...`;
                
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: scale });
                
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                if (mimeType === 'image/jpeg') {
                    context.fillStyle = '#ffffff';
                    context.fillRect(0, 0, canvas.width, canvas.height);
                }

                await page.render({ canvasContext: context, viewport: viewport }).promise;

                const imgDataUrl = canvas.toDataURL(mimeType);

                // --- SIMPAN KE MEMORI PROSES ---
                processedPagesData.push({
                    id: pageNum,
                    dataUrl: imgDataUrl,
                    fileExt: fileExt
                });

                // --- TAMPILKAN KE LAYAR (Preview dengan 'X') ---
                const card = document.createElement('div');
                card.className = 'image-card';
                card.setAttribute('data-page-id', pageNum); // ID untuk referensi hapus
                
                // Tombol Hapus Pojok ('X')
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-btn-corner';
                removeBtn.innerHTML = '×'; // Karakter silang
                removeBtn.title = `Hapus halaman ${pageNum} dari daftar unduhan.`;
                
                // Logika Tombol Hapus
                removeBtn.onclick = () => {
                    // 1. Hapus kartu dari DOM
                    card.remove(); 
                    
                    // 2. Hapus data dari array memori
                    const pageIndex = processedPagesData.findIndex(p => p.id === pageNum);
                    if (pageIndex > -1) {
                        processedPagesData.splice(pageIndex, 1);
                    }
                    
                    // 3. Update status jumlah halaman
                    updateConfirmButtonStatus();
                };

                const imgEl = document.createElement('img');
                imgEl.src = imgDataUrl;
                imgEl.alt = `Halaman ${pageNum}`;

                // Tombol Unduh Individual (Tetap ada)
                const btnDownloadIndiv = document.createElement('button');
                btnDownloadIndiv.className = 'btn-download-img';
                btnDownloadIndiv.innerHTML = `⬇️ Hal. ${pageNum}`;
                
                btnDownloadIndiv.onclick = () => {
                    const a = document.createElement('a');
                    a.href = imgDataUrl;
                    a.download = `page-${pageNum}_${selectedFile.name.replace(/\.[^/.]+$/, "")}.${fileExt}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                };

                card.appendChild(removeBtn); // Tambahkan tombol 'X'
                card.appendChild(imgEl);
                card.appendChild(btnDownloadIndiv);
                imageResults.appendChild(card);
            }

            // --- PROSES SELESAI EKSTRAK ---
            btnProcessConvert.disabled = false;
            btnProcessConvert.style.display = 'none'; // Sembunyikan tombol utama
            
            // Tampilkan area konfirmasi unduhan baru
            confirmArea.style.display = 'block'; 
            updateConfirmButtonStatus(); // Set teks jumlah awal

            statusMessage.style.color = '#27ae60';
            statusMessage.innerHTML = `🎉 <b>Selesai!</b> ${totalPages} halaman telah diekstrak. Silakan pilah halaman yang ingin diunduh.`;

        } catch (error) {
            console.error("Detail Error:", error);
            statusMessage.style.color = '#e74c3c';
            statusMessage.innerHTML = `❌ Gagal memproses file.<br><small>${error.message}</small>`;
        } finally {
            btnProcessConvert.disabled = false;
        }
    });

    // Helper: Update teks jumlah pada tombol konfirmasi
    function updateConfirmButtonStatus() {
        const count = processedPagesData.length;
        if (count === 0) {
            btnDownloadSelected.disabled = true;
            btnDownloadSelected.innerHTML = `2. Tidak ada halaman terpilih.`;
            statusMessage.style.color = '#e74c3c';
            statusMessage.innerHTML = `⚠️ <b>Semua halaman telah dihapus.</b>`;
        } else {
            btnDownloadSelected.disabled = false;
            btnDownloadSelected.innerHTML = `2. Unduh ${count} Halaman Terpilih (.zip)`;
            statusMessage.style.color = '#27ae60';
            statusMessage.innerHTML = `✅ ${count} halaman antre untuk diunduh.`;
        }
    }

    // ====== LOGIKA 2: KONFIRMASI UNDUHAN MASSAL (ZIP) ======
    btnDownloadSelected.addEventListener('click', async () => {
        if (processedPagesData.length === 0) return;

        try {
            btnDownloadSelected.disabled = true;
            statusMessage.style.color = 'black';
            statusMessage.textContent = '⏳ Mengompres file ZIP...';
            
            // Inisialisasi JSZip
            const zip = new JSZip();
            const timestampSN = new Date().getTime(); 
            const baseName = selectedFile.name.replace(/\.[^/.]+$/, "");

            // Masukkan data halaman terpilih ke dalam ZIP
            processedPagesData.forEach(page => {
                // Buat tulisan "data:image/png;base64," agar tersisa data murninya saja
                const base64Data = page.dataUrl.split(',')[1];
                zip.file(`Hal-${page.id}.${page.fileExt}`, base64Data, {base64: true});
            });

            // Proses pembuatan file ZIP
            const zipContent = await zip.generateAsync({ type: "blob" });
            const zipUrl = URL.createObjectURL(zipContent);
            
            // Proses unduh ZIP
            const a = document.createElement('a');
            a.href = zipUrl;
            a.download = `to-image_productiveapps_${timestampSN}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            statusMessage.style.color = '#27ae60';
            statusMessage.innerHTML = `🎉 <b>Berhasil!</b> ${processedPagesData.length} halaman terpilih telah diunduh dalam file ZIP.`;

        } catch (error) {
            console.error("Detail Error ZIP:", error);
            statusMessage.style.color = '#e74c3c';
            statusMessage.innerHTML = `❌ Gagal mengompres file.<br><small>${error.message}</small>`;
        } finally {
            btnDownloadSelected.disabled = false;
        }
    });
});
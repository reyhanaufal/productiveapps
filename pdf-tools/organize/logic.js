pdfjsLib.GlobalWorkerOptions.workerSrc = '../../lib/pdf.worker.min.js';

let currentFileBuffer = null; 

document.getElementById('pdfInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const statusMsg = document.getElementById('statusMsg');
    const editorArea = document.getElementById('editorArea');
    const pageGrid = document.getElementById('pageGrid');
    
    // Failsafe 1: Cek apakah elemen HTML tersedia
    if(!statusMsg || !editorArea || !pageGrid) {
        alert("Error: Struktur HTML ada yang hilang (ID tidak ditemukan). Pastikan id='editorArea' dan id='pageGrid' ada di index.html.");
        return;
    }

    statusMsg.style.color = "#007bff";
    statusMsg.innerText = "⚙️ Mengekstrak halaman... Mohon tunggu.";
    editorArea.style.display = 'none';
    pageGrid.innerHTML = ''; 

    try {
        currentFileBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(currentFileBuffer).promise;
        const totalPages = pdf.numPages;

        for (let i = 1; i <= totalPages; i++) {
            statusMsg.innerText = `⚙️ Menyiapkan pratinjau halaman ${i} dari ${totalPages}...`;
            
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 0.5 }); 

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;

            const card = document.createElement('div');
            card.className = 'page-card';
            card.dataset.pageIndex = i - 1; 
            
            card.innerHTML = `
                <div class="remove-btn-corner" onclick="this.parentElement.remove()" title="Hapus Halaman ini">&times;</div>
                <img src="${canvas.toDataURL('image/jpeg', 0.8)}">
                <span class="page-label">Hal. ${i}</span>
            `;
            
            pageGrid.appendChild(card);
        }

        statusMsg.style.color = "green";
        statusMsg.innerText = "✅ Silakan tahan dan geser (drag) halaman di bawah ini.";
        editorArea.style.display = 'block';

        // Failsafe 2: Cek apakah library Drag & Drop ter-load
        if (typeof Sortable !== 'undefined') {
            new Sortable(pageGrid, {
                animation: 150,
                ghostClass: 'sortable-ghost',
            });
        } else {
            statusMsg.style.color = "orange";
            statusMsg.innerText = "⚠️ Halaman bisa dihapus, tapi fitur Geser (Drag) mati karena Sortable.js tidak ditemukan.";
        }

    } catch (error) {
        console.error(error);
        statusMsg.style.color = "red";
        statusMsg.innerText = "❌ Gagal memuat PDF. Cek Console (F12) untuk detailnya.";
    }
});

document.getElementById('processBtn').addEventListener('click', async () => {
    const statusMsg = document.getElementById('statusMsg');
    const pageCards = document.querySelectorAll('.page-card');
    
    if (pageCards.length === 0) {
        alert("Tidak ada halaman yang tersisa untuk disimpan!");
        return;
    }

    statusMsg.style.color = "#007bff";
    statusMsg.innerText = "💾 Sedang merakit PDF baru...";

    try {
        const newOrderIndices = Array.from(pageCards).map(card => parseInt(card.dataset.pageIndex));
        const { PDFDocument } = window.PDFLib;
        
        const originalPdf = await PDFDocument.load(currentFileBuffer);
        const newPdf = await PDFDocument.create();

        const copiedPages = await newPdf.copyPages(originalPdf, newOrderIndices);
        copiedPages.forEach((page) => newPdf.addPage(page));

        const pdfBytes = await newPdf.save();
        const finalBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        
        const timestampSN = new Date().getTime();
        const newFileName = `organize-pdf_productiveapps_${timestampSN}.pdf`;

        const link = document.createElement('a');
        link.href = URL.createObjectURL(finalBlob);
        link.download = newFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        statusMsg.style.color = "green";
        statusMsg.innerText = `🎉 Berhasil! PDF baru dengan ${pageCards.length} halaman telah diunduh.`;

    } catch (error) {
        console.error(error);
        statusMsg.style.color = "red";
        statusMsg.innerText = "❌ Terjadi kesalahan saat menyimpan PDF: " + error.message;
    }
});
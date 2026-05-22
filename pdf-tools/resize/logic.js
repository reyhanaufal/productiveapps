pdfjsLib.GlobalWorkerOptions.workerSrc = '../../lib/pdf.worker.min.js';

document.getElementById('processBtn').addEventListener('click', async () => {
    const fileInput = document.getElementById('pdfInput');
    const targetSizeInput = document.getElementById('targetSize').value;
    const sizeUnit = document.getElementById('sizeUnit').value;
    const statusMsg = document.getElementById('statusMsg');

    if (!fileInput.files.length) {
        statusMsg.innerText = "❌ Silakan pilih file PDF terlebih dahulu.";
        return;
    }

    if (!targetSizeInput || targetSizeInput <= 0) {
        statusMsg.innerText = "❌ Masukkan target ukuran yang valid.";
        return;
    }

    const file = fileInput.files[0];
    const originalSize = file.size;
    let targetBytes = sizeUnit === 'MB' ? targetSizeInput * 1024 * 1024 : targetSizeInput * 1024;

    if (originalSize <= targetBytes) {
        statusMsg.style.color = "green";
        statusMsg.innerText = "✅ Ukuran file awal sudah di bawah target. Tidak perlu dikompres.";
        return;
    }

    statusMsg.style.color = "#007bff";
    statusMsg.innerText = "⚙️ Sedang menghitung & memproses kompresi... Mohon tunggu.";

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const totalPages = pdf.numPages;

        let ratio = targetBytes / originalSize;
        let qualityFactor = Math.max(0.3, ratio); 

        const { PDFDocument } = window.PDFLib;
        const newPdf = await PDFDocument.create();

        for (let i = 1; i <= totalPages; i++) {
            statusMsg.innerText = `⚙️ Mengompresi halaman ${i} dari ${totalPages}...`;
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            const imgDataUrl = canvas.toDataURL('image/jpeg', qualityFactor);

            const imgBytes = await fetch(imgDataUrl).then(res => res.arrayBuffer());
            const jpgImage = await newPdf.embedJpg(imgBytes);
            const newPage = newPdf.addPage([viewport.width, viewport.height]);
            
            newPage.drawImage(jpgImage, {
                x: 0,
                y: 0,
                width: viewport.width,
                height: viewport.height,
            });
        }

        statusMsg.innerText = "💾 Menyelesaikan file...";
        const pdfBytes = await newPdf.save();
        const finalBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        
        const finalSizeMB = (finalBlob.size / (1024 * 1024)).toFixed(2);

        // ====== PERBAIKAN FORMAT NAMA FILE DOWNLOAD ======
        const timestampSN = new Date().getTime();
        const newFileName = `pdf-resize_productiveapps_${timestampSN}.pdf`;

        savePDFLocally(finalBlob, newFileName);
        // =================================================

        statusMsg.style.color = "green";
        statusMsg.innerText = `🎉 Selesai! Ukuran akhir: ~${finalSizeMB} MB.`;

    } catch (error) {
        console.error(error);
        statusMsg.style.color = "red";
        statusMsg.innerText = "❌ Terjadi kesalahan saat mengompres: " + error.message;
    }
});

function savePDFLocally(blobData, fileName) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blobData);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}
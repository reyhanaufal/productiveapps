// Konfigurasi letak worker PDF.js (Sesuaikan dengan folder lib Anda)
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
    const originalSize = file.size; // dalam Bytes
    
    // Konversi target pengguna ke Bytes
    let targetBytes = sizeUnit === 'MB' ? targetSizeInput * 1024 * 1024 : targetSizeInput * 1024;

    if (originalSize <= targetBytes) {
        statusMsg.style.color = "green";
        statusMsg.innerText = "✅ Ukuran file awal sudah di bawah target. Tidak perlu dikompres.";
        return;
    }

    statusMsg.style.color = "#007bff";
    statusMsg.innerText = "⚙️ Sedang menghitung & memproses kompresi... Mohon tunggu.";

    try {
        // 1. Baca PDF menggunakan PDF.js
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const totalPages = pdf.numPages;

        // 2. Hitung rasio kompresi kualitas gambar (Quality Factor: 0.1 sampai 0.9)
        // Logika sederhana: Jika butuh kompresi 50%, kualitas JPG diset ke 0.5
        let ratio = targetBytes / originalSize;
        // Beri batas bawah agar teks tidak terlalu hancur (minimal 0.3)
        let qualityFactor = Math.max(0.3, ratio); 

        // 3. Siapkan dokumen PDF baru menggunakan PDF-lib
        const { PDFDocument } = window.PDFLib;
        const newPdf = await PDFDocument.create();

        // 4. Proses Ekstrak dan Render per Halaman
        for (let i = 1; i <= totalPages; i++) {
            statusMsg.innerText = `⚙️ Mengompresi halaman ${i} dari ${totalPages}...`;
            
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 }); // Skala standar agar tidak pecah

            // Buat Canvas virtual di memory
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            // Render PDF ke Canvas
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;

            // Konversi Canvas ke gambar JPG terkompresi
            const imgDataUrl = canvas.toDataURL('image/jpeg', qualityFactor);

            // Masukkan gambar tersebut ke PDF baru
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

        // 5. Simpan PDF Baru
        statusMsg.innerText = "💾 Menyelesaikan file...";
        const pdfBytes = await newPdf.save();
        const finalBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        
        const finalSizeMB = (finalBlob.size / (1024 * 1024)).toFixed(2);

        // Panggil fungsi penyimpanan (bisa disesuaikan dengan fungsi saveFileLocally Anda sebelumnya)
        savePDFLocally(finalBlob, `Resized_${file.name}`);

        statusMsg.style.color = "green";
        statusMsg.innerText = `🎉 Selesai! Ukuran akhir: ~${finalSizeMB} MB.`;

    } catch (error) {
        console.error(error);
        statusMsg.style.color = "red";
        statusMsg.innerText = "❌ Terjadi kesalahan saat mengompres: " + error.message;
    }
});

// Fungsi unduh langsung ke penyimpanan lokal perangkat
function savePDFLocally(blobData, fileName) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blobData);
    link.download = fileName;
    
    // Simulasikan klik pada tautan secara transparan
    document.body.appendChild(link);
    link.click();
    
    // Bersihkan memori
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}
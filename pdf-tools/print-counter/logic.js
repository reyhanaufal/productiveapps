pdfjsLib.GlobalWorkerOptions.workerSrc = '../../lib/pdf.worker.min.js';

document.getElementById('processBtn').addEventListener('click', async () => {
    const fileInput = document.getElementById('pdfInput');
    const priceBW = parseInt(document.getElementById('priceBW').value) || 0;
    const priceColor = parseInt(document.getElementById('priceColor').value) || 0;
    const isDuplex = document.getElementById('duplexCheck').checked;
    
    const statusMsg = document.getElementById('statusMsg');
    const reportCard = document.getElementById('reportCard');

    if (!fileInput.files.length) {
        statusMsg.style.color = "red";
        statusMsg.innerText = "❌ Silakan pilih file PDF terlebih dahulu.";
        return;
    }

    reportCard.style.display = 'none'; // Sembunyikan laporan lama jika ada
    const file = fileInput.files[0];
    statusMsg.style.color = "#007bff";

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const totalPages = pdf.numPages;

        let bwCount = 0;
        let colorCount = 0;
        let colorPagesArray = []; // Menyimpan nomor halaman mana saja yang berwarna
        let bwPagesArray = []; // Menyimpan nomor halaman hitam putih

        // Loop untuk memindai setiap halaman
        for (let i = 1; i <= totalPages; i++) {
            statusMsg.innerText = `🔍 Memindai halaman ${i} dari ${totalPages}...`;
            
            const page = await pdf.getPage(i);
            // Skala kecil (0.3) agar proses pemindaian pixel RAM-nya sangat ringan & cepat
            const viewport = page.getViewport({ scale: 0.3 }); 

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            // Render halaman ke canvas
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;

            // Logika Deteksi Warna
            const isColor = detectColor(ctx, canvas.width, canvas.height);

            if (isColor) {
             colorCount++;
             colorPagesArray.push(i);
         } else {
             bwCount++;
             bwPagesArray.push(i); // Rekam nomor halamannya
         }
        }

        statusMsg.style.color = "green";
        statusMsg.innerText = "✅ Pemindaian selesai!";

        // ==========================================
        // PERHITUNGAN BIAYA & KERTAS
        // ==========================================
        
        // 1. Hitung Kertas Fisik
        let paperNeeded = totalPages;
        if (isDuplex) {
            // Jika bolak balik, 5 halaman = butuh 3 lembar kertas (pembulatan ke atas)
            paperNeeded = Math.ceil(totalPages / 2); 
        }

        // 2. Hitung Harga
        const totalCost = (bwCount * priceBW) + (colorCount * priceColor);

        // 3. Tampilkan Laporan ke UI
        document.getElementById('resTotalPages').innerText = totalPages;
        document.getElementById('resBWPages').innerText = bwCount;
        document.getElementById('resColorPages').innerText = colorCount;
        document.getElementById('resPaperCount').innerText = `${paperNeeded} Lembar`;
        
        // Format rupiah
        document.getElementById('resTotalPrice').innerText = new Intl.NumberFormat('id-ID', { 
            style: 'currency', currency: 'IDR', maximumFractionDigits: 0
        }).format(totalCost);

        // Output List Warna
     const colorListElement = document.getElementById('colorPagesList');
     if (colorCount > 0) {
         colorListElement.innerText = `Halaman warna pada hal: ${colorPagesArray.join(', ')}`;
     } else {
         colorListElement.innerText = "Tidak ada halaman berwarna.";
     }

     // Output List Hitam Putih
     const bwListElement = document.getElementById('bwPagesList');
     if (bwCount > 0) {
         bwListElement.innerText = `Halaman hitam putih pada hal: ${bwPagesArray.join(', ')}`;
     } else {
         bwListElement.innerText = "Tidak ada halaman hitam putih murni.";
     }

        reportCard.style.display = 'block'; // Tampilkan kartu laporan

    } catch (error) {
        console.error(error);
        statusMsg.style.color = "red";
        statusMsg.innerText = "❌ Terjadi kesalahan saat membaca dokumen.";
    }
});

// FUNGSI INTI: Analisis Pixel untuk deteksi warna
function detectColor(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height).data;
    
    // imageData berisi susunan array [Red, Green, Blue, Alpha] per pixel
    // Kita lompat per 16 indeks (menghemat CPU dengan mengecek sebagian area saja, cukup akurat)
    for (let i = 0; i < imageData.length; i += 16) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const a = imageData[i + 3];

        // Abaikan pixel yang transparan
        if (a < 50) continue; 

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        
        // Cek variasi warna (Jika selisih warna tertinggi & terendah RGB > 20, berarti bukan abu-abu)
        if (max - min > 20) {
            // Abaikan perbedaan kecil akibat anti-aliasing (teks hitam yang ngeblur)
            if (max > 40 && min < 225) { 
                return true; // Ditemukan pixel berwarna! Langsung hentikan pencarian di halaman ini
            }
        }
    }
    
    return false; // Jika sampai akhir loop tidak ketemu warna, berarti hitam putih
}
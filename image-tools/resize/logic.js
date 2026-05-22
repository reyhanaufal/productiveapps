document.getElementById('processBtn').addEventListener('click', async () => {
    const fileInput = document.getElementById('imageInput');
    const targetSizeInput = document.getElementById('targetSize').value;
    const sizeUnit = document.getElementById('sizeUnit').value;
    const outputFormat = document.getElementById('outputFormat').value;
    const statusMsg = document.getElementById('statusMsg');

    if (!fileInput.files.length) {
        statusMsg.style.color = "red";
        statusMsg.innerText = "❌ Silakan pilih file gambar terlebih dahulu.";
        return;
    }

    if (!targetSizeInput || targetSizeInput <= 0) {
        statusMsg.style.color = "red";
        statusMsg.innerText = "❌ Masukkan target ukuran yang valid.";
        return;
    }

    const file = fileInput.files[0];
    let targetBytes = sizeUnit === 'MB' ? targetSizeInput * 1024 * 1024 : targetSizeInput * 1024;

    statusMsg.style.color = "#007bff";
    statusMsg.innerText = "⚙️ Sedang memproses gambar... Mohon tunggu.";

    try {
        const compressedBlob = await compressImageToTarget(file, targetBytes, outputFormat);
        
        const finalSize = sizeUnit === 'MB' 
            ? (compressedBlob.size / (1024 * 1024)).toFixed(2) + " MB"
            : (compressedBlob.size / 1024).toFixed(2) + " KB";

        // Dapatkan ekstensi file berdasarkan format output pilihan user
        let ext = outputFormat.split('/')[1];
        if(ext === 'jpeg') ext = 'jpg';

        // ====== PERBAIKAN FORMAT NAMA FILE DOWNLOAD ======
        const timestampSN = new Date().getTime();
        const newFileName = `image-resize_productiveapps_${timestampSN}.${ext}`;

        saveImageLocally(compressedBlob, newFileName);
        // =================================================

        statusMsg.style.color = "green";
        statusMsg.innerText = `🎉 Berhasil! Diunduh otomatis. Ukuran akhir: ~${finalSize}`;

    } catch (error) {
        console.error(error);
        statusMsg.style.color = "red";
        statusMsg.innerText = "❌ Terjadi kesalahan: " + error.message;
    }
});

function compressImageToTarget(file, targetBytes, format) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;
            let quality = 0.9; 
            let scale = 1.0;

            if (file.size > targetBytes) {
                let ratio = targetBytes / file.size;
                scale = Math.sqrt(ratio); 
                if (format !== 'image/png') {
                    quality = Math.max(0.4, ratio); 
                } else {
                    scale = scale * 0.8; 
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width * scale;
            canvas.height = height * scale;
            
            const ctx = canvas.getContext('2d');
            if (format === 'image/jpeg') {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            canvas.toBlob((blob) => {
                resolve(blob);
            }, format, quality);
        };
        
        img.onerror = () => reject(new Error("Gagal memuat gambar"));
        img.src = URL.createObjectURL(file);
    });
}

// Fungsi unduh langsung ke penyimpanan (Bypass Tab Baru)
function saveImageLocally(blobData, fileName) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blobData);
    link.download = fileName;
    
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}
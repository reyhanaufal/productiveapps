// 1. Logika untuk mengganti tampilan antarmuka (UI) saat Mode diubah
document.getElementById('resizeMode').addEventListener('change', function() {
    const sizeGroup = document.getElementById('modeSizeGroup');
    const dimGroup = document.getElementById('modeDimensionGroup');
    
    if (this.value === 'size') {
        sizeGroup.style.display = 'block';
        dimGroup.style.display = 'none';
    } else {
        sizeGroup.style.display = 'none';
        dimGroup.style.display = 'block';
    }
});

// 2. Bonus UX: Baca dimensi asli gambar saat dipilih, tampilkan ke pengguna
document.getElementById('imageInput').addEventListener('change', function() {
    const infoTxt = document.getElementById('imageInfoTxt');
    if(this.files.length > 0) {
        const file = this.files[0];
        const img = new Image();
        img.onload = function() {
            infoTxt.innerHTML = `File terpilih: <strong>${file.name}</strong><br>Resolusi asli: ${this.width} x ${this.height} px`;
            // Isi placeholder dimensi dengan ukuran asli
            document.getElementById('targetWidth').placeholder = `Lebar Asli: ${this.width}`;
            document.getElementById('targetHeight').placeholder = `Tinggi Asli: ${this.height}`;
        }
        img.src = URL.createObjectURL(file);
    } else {
        infoTxt.innerText = "Pilih 1 file gambar (JPG, PNG, atau WebP).";
    }
});

// 3. Eksekusi Utama
document.getElementById('processBtn').addEventListener('click', async () => {
    const fileInput = document.getElementById('imageInput');
    const mode = document.getElementById('resizeMode').value;
    const outputFormat = document.getElementById('outputFormat').value;
    const statusMsg = document.getElementById('statusMsg');

    if (!fileInput.files.length) {
        statusMsg.style.color = "red";
        statusMsg.innerText = "❌ Silakan pilih file gambar terlebih dahulu.";
        return;
    }

    // Variabel untuk menampung pengaturan
    let targetBytes = 0;
    let tWidth = 0;
    let tHeight = 0;

    // Validasi berdasarkan Mode
    if (mode === 'size') {
        const targetSizeInput = document.getElementById('targetSize').value;
        const sizeUnit = document.getElementById('sizeUnit').value;
        if (!targetSizeInput || targetSizeInput <= 0) {
            statusMsg.style.color = "red";
            statusMsg.innerText = "❌ Masukkan target ukuran yang valid.";
            return;
        }
        targetBytes = sizeUnit === 'MB' ? targetSizeInput * 1024 * 1024 : targetSizeInput * 1024;
    } else {
        tWidth = parseInt(document.getElementById('targetWidth').value) || 0;
        tHeight = parseInt(document.getElementById('targetHeight').value) || 0;
        if (tWidth === 0 && tHeight === 0) {
            statusMsg.style.color = "red";
            statusMsg.innerText = "❌ Masukkan minimal satu nilai Lebar atau Tinggi resolusi.";
            return;
        }
    }

    const file = fileInput.files[0];
    statusMsg.style.color = "#007bff";
    statusMsg.innerText = "⚙️ Sedang memproses gambar... Mohon tunggu.";

    try {
        // Panggil fungsi pemrosesan baru yang sudah ditingkatkan
        const processedBlob = await processImageDynamic(file, mode, targetBytes, tWidth, tHeight, outputFormat);
        
        const finalSizeKB = (processedBlob.size / 1024).toFixed(2);
        let ext = outputFormat.split('/')[1];
        if(ext === 'jpeg') ext = 'jpg';

        const timestampSN = new Date().getTime();
        const newFileName = `image-resize_productiveapps_${timestampSN}.${ext}`;

        saveImageLocally(processedBlob, newFileName);

        statusMsg.style.color = "green";
        statusMsg.innerText = `🎉 Berhasil! Ukuran akhir: ~${finalSizeKB} KB.`;

    } catch (error) {
        console.error(error);
        statusMsg.style.color = "red";
        statusMsg.innerText = "❌ Terjadi kesalahan: " + error.message;
    }
});

// FUNGSI INTI: Logika gabungan untuk Size & Dimension
function processImageDynamic(file, mode, targetBytes, targetW, targetH, format) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let finalWidth = img.width;
            let finalHeight = img.height;
            let quality = 0.9; 

            // Logika 1: Jika Mode Ukuran (Size)
            if (mode === 'size') {
                if (file.size > targetBytes) {
                    let ratio = targetBytes / file.size;
                    let scale = Math.sqrt(ratio); 
                    if (format !== 'image/png') {
                        quality = Math.max(0.4, ratio); 
                    } else {
                        scale = scale * 0.8; 
                    }
                    finalWidth = Math.round(img.width * scale);
                    finalHeight = Math.round(img.height * scale);
                }
            } 
            // Logika 2: Jika Mode Resolusi Piksel (Dimension)
            else if (mode === 'dimension') {
                // Jika dua-duanya diisi (Paksa rasio gepeng jika tidak sesuai)
                if (targetW > 0 && targetH > 0) {
                    finalWidth = targetW;
                    finalHeight = targetH;
                } 
                // Jika hanya Lebar yang diisi (Tinggi mengikuti proporsi)
                else if (targetW > 0 && targetH === 0) {
                    finalWidth = targetW;
                    finalHeight = Math.round((img.height / img.width) * targetW);
                } 
                // Jika hanya Tinggi yang diisi (Lebar mengikuti proporsi)
                else if (targetW === 0 && targetH > 0) {
                    finalHeight = targetH;
                    finalWidth = Math.round((img.width / img.height) * targetH);
                }
                
                // Kualitas sedikit diturunkan untuk output web standar
                if (format !== 'image/png') quality = 0.85;
            }

            const canvas = document.createElement('canvas');
            canvas.width = finalWidth;
            canvas.height = finalHeight;
            const ctx = canvas.getContext('2d');
            
            // Background putih untuk transparansi ke JPG
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

function saveImageLocally(blobData, fileName) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blobData);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}
// ==================== GLOBAL VARIABLES ====================
let videoStream = null;
let currentCamera = 'user'; // 'user' = depan, 'environment' = belakang
let currentPhotoBlob = null;
let currentPhotoType = ''; // 'selfie', 'objek', 'upload'
let currentLocation = null;
let currentTimestamp = null;

// DOM Elements
const video = document.getElementById('video');
const switchCameraBtn = document.getElementById('switchCameraBtn');
const captureFrontBtn = document.getElementById('captureFrontBtn');
const captureBackBtn = document.getElementById('captureBackBtn');
const uploadBtn = document.getElementById('uploadBtn');
const uploadInput = document.getElementById('uploadInput');
const previewImg = document.getElementById('previewImg');
const resultLabel = document.getElementById('resultLabel');
const downloadBtn = document.getElementById('downloadBtn');
const locationText = document.getElementById('locationText');
const timestampText = document.getElementById('timestampText');
const coordText = document.getElementById('coordText');
const refreshLocationBtn = document.getElementById('refreshLocationBtn');
const cameraLabel = document.getElementById('cameraLabel');
const statusDiv = document.getElementById('status');

// ==================== INITIALIZATION ====================
async function init() {
    await getLocationAndTime();
    await startCamera('user');
}

// ==================== GET LOCATION & TIME ====================
async function getLocationAndTime() {
    statusDiv.textContent = '📍 Mendapatkan lokasi...';
    locationText.textContent = 'Mencari sinyal GPS...';

    // Get timestamp
    const now = new Date();
    currentTimestamp = now.toLocaleString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    timestampText.textContent = currentTimestamp;

    // Get location
    if ('geolocation' in navigator) {
        const geoOptions = {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        };

        const success = async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            currentLocation = { lat, lng };
            coordText.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

            try {
                // Reverse geocoding
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
                    headers: { 'Accept-Language': 'id' }
                });
                const geoData = await geoRes.json();
                const address = geoData.display_name?.split(',')[0] || 'Lokasi terdeteksi';
                const city = geoData.address?.city || geoData.address?.town || geoData.address?.county || '';
                locationText.textContent = city ? `${address}, ${city}` : address;
                statusDiv.textContent = '✅ Lokasi berhasil didapatkan';
            } catch {
                locationText.textContent = `Koordinat: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                statusDiv.textContent = '✅ Lokasi didapat (Nama alamat tidak tersedia)';
            }
        };

        const error = (err) => {
            console.error('Location error:', err);
            let msg = '❌ Gagal dapat lokasi.';
            if (err.code === 1) msg = '❌ Izin lokasi ditolak. Cek pengaturan browser.';
            if (err.code === 2) msg = '❌ Sinyal GPS tidak tersedia.';
            if (err.code === 3) {
                msg = '⏳ Timeout. Mencoba akurasi rendah...';
                // Fallback ke akurasi rendah jika high accuracy timeout
                navigator.geolocation.getCurrentPosition(success, (e) => {
                    locationText.textContent = '❌ Gagal mendapatkan lokasi.';
                    statusDiv.textContent = '⚠️ GPS Timeout atau tidak aktif.';
                }, { enableHighAccuracy: false, timeout: 10000 });
            }
            locationText.textContent = msg;
            statusDiv.textContent = '⚠️ Masalah lokasi: ' + err.message;
        };

        navigator.geolocation.getCurrentPosition(success, error, geoOptions);
    } else {
        locationText.textContent = '❌ Browser tidak support GPS';
        statusDiv.textContent = '❌ Perangkat tidak mendukung Geolocation.';
    }

    // Check if Secure Context
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        statusDiv.innerHTML = '⚠️ <b>Peringatan:</b> Lokasi butuh <b>HTTPS</b>. <br>Gunakan hosting dengan SSL (seperti GitHub Pages/Vercel).';
        statusDiv.style.color = '#ff9f43';
    }
}

// ==================== START CAMERA ====================
async function startCamera(faceMode) {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
    }

    const constraints = {
        video: {
            facingMode: { exact: faceMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
        }
    };

    try {
        videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = videoStream;
        cameraLabel.textContent = faceMode === 'user' ? '🤳 Kamera Depan' : '📷 Kamera Belakang';
        statusDiv.textContent = `✅ Kamera ${faceMode === 'user' ? 'depan' : 'belakang'} aktif`;
    } catch (error) {
        console.error('Camera error:', error);
        // Fallback: coba tanpa facingMode spesifik
        try {
            videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = videoStream;
            cameraLabel.textContent = '📷 Kamera (default)';
            statusDiv.textContent = '⚠️ Gagal memilih kamera spesifik, menggunakan default';
        } catch {
            statusDiv.textContent = '❌ Tidak bisa akses kamera. Periksa izin.';
        }
    }
}

// ==================== SWITCH CAMERA ====================
async function switchCamera() {
    currentCamera = currentCamera === 'user' ? 'environment' : 'user';
    await startCamera(currentCamera);
}

// ==================== CAPTURE PHOTO ====================
function capturePhoto(type) {
    if (!video.videoWidth || !video.videoHeight) {
        statusDiv.textContent = '❌ Kamera belum siap. Tunggu sebentar.';
        return;
    }

    statusDiv.textContent = '📸 Mengambil foto...';

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Add watermark
    addWatermark(canvas);

    // Convert to blob
    canvas.toBlob((blob) => {
        currentPhotoBlob = blob;
        currentPhotoType = type === 'front' ? 'selfie' : 'objek';
        
        const url = URL.createObjectURL(blob);
        previewImg.src = url;
        downloadBtn.disabled = false;
        resultLabel.textContent = type === 'front' ? '📸 Hasil: Selfie' : '📸 Hasil: Objek';
        
        statusDiv.textContent = `✅ Foto ${currentPhotoType} berhasil diambil!`;
        
        // Auto scroll ke preview
        document.getElementById('previewCard').scrollIntoView({ behavior: 'smooth' });
    }, 'image/jpeg', 0.9);
}

// ==================== WATERMARK LOGIC ====================
function addWatermark(canvas) {
    const ctx = canvas.getContext('2d');
    
    // Ukuran font dinamis berdasarkan tinggi canvas (sekitar 3% dari tinggi)
    const fontSize = Math.max(14, Math.floor(canvas.height * 0.03));
    ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = 'white';
    
    // Shadow untuk keterbacaan di background terang
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = Math.max(2, fontSize / 4);
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    const padding = fontSize;
    const watermarkY = canvas.height - padding;
    const timeText = currentTimestamp || new Date().toLocaleString('id-ID');
    const locText = locationText.textContent.includes('❌') || locationText.textContent.includes('Mendapatkan') 
        ? 'Lokasi tidak tersedia' 
        : locationText.textContent;

    // Gambar teks (Lokasi & Waktu)
    ctx.fillText(`📍 ${locText}`, padding, watermarkY - (fontSize * 1.5));
    ctx.fillText(`🕐 ${timeText}`, padding, watermarkY);
    
    // Reset shadow agar tidak mengganggu operasi gambar lain jika ada
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
}

// ==================== UPLOAD PHOTO ====================
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    statusDiv.textContent = '⏳ Memproses foto upload...';

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            
            // Gunakan resolusi asli gambar
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            // Gambar foto asli
            ctx.drawImage(img, 0, 0);

            // Tambahkan watermark
            addWatermark(canvas);

            // Tampilkan hasil
            canvas.toBlob((blob) => {
                currentPhotoBlob = blob;
                currentPhotoType = 'upload';
                
                const url = URL.createObjectURL(blob);
                previewImg.src = url;
                downloadBtn.disabled = false;
                resultLabel.textContent = '📸 Hasil: Galeri';
                
                statusDiv.textContent = '✅ Foto galeri berhasil diproses dengan watermark!';
                
                // Scroll ke preview
                document.getElementById('previewCard').scrollIntoView({ behavior: 'smooth' });
            }, 'image/jpeg', 0.9);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ==================== DOWNLOAD PHOTO ====================
function downloadPhoto() {
    if (!currentPhotoBlob) {
        statusDiv.textContent = '❌ Tidak ada foto untuk di-download';
        return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${currentPhotoType}_${timestamp}.jpg`;

    const url = URL.createObjectURL(currentPhotoBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    statusDiv.textContent = `✅ Foto ${currentPhotoType} berhasil di-download!`;
}

// ==================== EVENT LISTENERS ====================
switchCameraBtn.addEventListener('click', switchCamera);
captureFrontBtn.addEventListener('click', () => capturePhoto('front'));
captureBackBtn.addEventListener('click', () => capturePhoto('back'));
downloadBtn.addEventListener('click', downloadPhoto);
uploadBtn.addEventListener('click', () => uploadInput.click());
uploadInput.addEventListener('change', handleFileUpload);
refreshLocationBtn.addEventListener('click', () => {
    getLocationAndTime();
});

// Update timestamp setiap detik (opsional)
setInterval(() => {
    const now = new Date();
    timestampText.textContent = now.toLocaleString('id-ID');
    currentTimestamp = timestampText.textContent;
}, 1000);

// ==================== START APP ====================
init();

// ==================== PWA INSTALL PROMPT (optional) ====================
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Optional: show install button
});
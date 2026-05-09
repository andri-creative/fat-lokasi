// ==================== GLOBAL VARIABLES ====================
let videoStream = null;
let currentCamera = 'user'; // 'user' = depan, 'environment' = belakang
let currentPhotoBlob = null;
let currentPhotoType = ''; // 'selfie', 'objek', 'upload'
let currentLocation = null;
let currentTimestamp = null;
let map = null;
let marker = null;

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
    initMap(); // Inisialisasi peta kosong
    await getLocationAndTime();
    await startCamera('user');
}

// ==================== INITIALIZE MAP ====================
function initMap() {
    // Default: Indonesia (Jakarta) jika belum ada lokasi
    const defaultLat = -6.2088;
    const defaultLng = 106.8456;
    
    map = L.map('map').setView([defaultLat, defaultLng], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    marker = L.marker([defaultLat, defaultLng]).addTo(map);
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

            // Update Map
            if (map && marker) {
                map.setView([lat, lng], 15);
                marker.setLatLng([lat, lng]);
            }

            try {
                // Reverse geocoding - AMBIL ALAMAT LENGKAP
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
                    headers: { 'Accept-Language': 'id' }
                });
                const geoData = await geoRes.json();
                const fullAddress = geoData.display_name || 'Lokasi terdeteksi';
                locationText.textContent = fullAddress;
                statusDiv.textContent = '✅ Lokasi & Alamat berhasil didapatkan';
            } catch (e) {
                console.error("Geocoding error:", e);
                locationText.textContent = `Koordinat: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                statusDiv.textContent = '✅ Lokasi didapat (Detail alamat gagal dimuat)';
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
async function capturePhoto(type) {
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
    await addWatermark(canvas);

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
async function addWatermark(canvas) {
    const ctx = canvas.getContext('2d');
    
    // 1. TAMBAHKAN MINI MAP DI POJOK ATAS (Jika lokasi tersedia)
    if (currentLocation) {
        try {
            const { lat, lng } = currentLocation;
            const mapSize = Math.floor(canvas.height * 0.25); // Ukuran peta 25% dari tinggi foto
            
            // Gunakan Yandex Static Maps (Lebih stabil & support CORS)
            // Format Yandex: lng,lat
            const staticMapUrl = `https://static-maps.yandex.ru/1.x/?ll=${lng},${lat}&z=14&l=map&size=${mapSize},${mapSize}`;
            
            // Fallback URL jika Yandex gagal (OSM)
            const fallbackUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=14&size=${mapSize}x${mapSize}&markers=${lat},${lng},ol-marker`;
            
            const mapImg = new Image();
            mapImg.crossOrigin = "anonymous"; 
            
            const loadMap = (url) => {
                return new Promise((resolve, reject) => {
                    mapImg.onload = resolve;
                    mapImg.onerror = reject;
                    mapImg.src = url;
                    setTimeout(() => reject(new Error("Timeout")), 4000);
                });
            };

            try {
                await loadMap(staticMapUrl);
            } catch (e) {
                console.warn("Yandex Map gagal, mencoba fallback...");
                await loadMap(fallbackUrl).catch(() => null);
            }

            if (mapImg.complete && mapImg.naturalWidth > 0) {
                const margin = 20;
                const mapX = canvas.width - mapSize - margin;
                const mapY = margin;
                
                // Gambar border putih tebal agar terlihat di foto gelap/terang
                ctx.fillStyle = 'white';
                ctx.fillRect(mapX - 8, mapY - 8, mapSize + 16, mapSize + 16);
                
                // Gambar peta
                ctx.drawImage(mapImg, mapX, mapY, mapSize, mapSize);
                
                // Tambahkan marker merah manual di tengah peta agar lebih jelas
                ctx.fillStyle = 'red';
                ctx.beginPath();
                ctx.arc(mapX + mapSize/2, mapY + mapSize/2, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        } catch (e) {
            console.error("Gagal memuat mini map watermark:", e);
        }
    }

    // 2. TAMBAHKAN TEKS WATERMARK DI BAWAH (Dengan Text Wrapping)
    const fontSize = Math.max(14, Math.floor(canvas.height * 0.028)); // Sedikit lebih kecil agar muat banyak
    ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = 'white';
    
    // Shadow untuk keterbacaan
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    const padding = fontSize * 1.5;
    const maxWidth = canvas.width - (padding * 2);
    const lineHeight = fontSize * 1.4;
    
    const timeText = currentTimestamp || new Date().toLocaleString('id-ID');
    const locText = locationText.textContent.includes('❌') || locationText.textContent.includes('Mendapatkan') || locationText.textContent.includes('Mencari')
        ? 'Lokasi tidak tersedia' 
        : `📍 ${locationText.textContent}`;

    // Fungsi Pembantu: Wrap Text
    function wrapText(context, text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = context.measureText(currentLine + " " + word).width;
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        return lines;
    }

    const addressLines = wrapText(ctx, locText, maxWidth);
    
    // Tentukan posisi Y awal (naik ke atas sebanyak jumlah baris)
    let currentY = canvas.height - padding - (addressLines.length * lineHeight);

    // Gambar Alamat (Baris per Baris)
    addressLines.forEach((line) => {
        ctx.fillText(line, padding, currentY);
        currentY += lineHeight;
    });

    // Gambar Jam/Waktu (Di bawah alamat)
    ctx.fillText(`🕐 ${timeText}`, padding, currentY);
    
    // Reset shadow
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
        img.onload = async () => {
            const canvas = document.createElement('canvas');
            
            // Gunakan resolusi asli gambar
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            // Gambar foto asli
            ctx.drawImage(img, 0, 0);

            // Tambahkan watermark
            await addWatermark(canvas);

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
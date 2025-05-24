
// tec.js - versão com controle manual de câmera e integração com modelo Teachable Machine

const MODEL_URL = "https://teachablemachine.withgoogle.com/models/h245knWf6/";

const domElements = {
  webcamBtn: document.getElementById('webcam-btn'),
  uploadBtn: document.getElementById('upload-btn'),
  uploadSection: document.getElementById('upload-section'),
  webcamSection: document.getElementById('webcam-section'),
  imagePreviewContainer: document.getElementById('image-preview-container'),
  imageUpload: document.getElementById('image-upload'),
  imagePreview: document.getElementById('image-preview'),
  analyzeBtn: document.getElementById('analyze-btn'),
  startWebcamBtn: document.getElementById('start-webcam-btn'),
  switchCameraBtn: document.getElementById('switch-camera-btn'),
  labelContainer: document.getElementById('label-container'),
  webcamContainer: document.getElementById('webcam-container')
};

const appState = {
  model: null,
  maxPredictions: 0,
  isModelLoaded: false,
  isWebcamActive: false,
  currentCameraIndex: 0,
  videoDevices: [],
  stream: null,
  videoElement: null
};

document.addEventListener('DOMContentLoaded', async () => {
  await initializeApp();
});

async function initializeApp() {
  await loadModel();
  setupEventListeners();
  initLabelContainer();
  await getAvailableVideoDevices();
}

async function loadModel() {
  const modelURL = MODEL_URL + "model.json";
  const metadataURL = MODEL_URL + "metadata.json";
  appState.model = await tmImage.load(modelURL, metadataURL);
  appState.maxPredictions = appState.model.getTotalClasses();
  appState.isModelLoaded = true;
}

function setupEventListeners() {
  domElements.webcamBtn?.addEventListener('click', switchToWebcamMode);
  domElements.uploadBtn?.addEventListener('click', switchToUploadMode);
  domElements.imageUpload?.addEventListener('change', handleImageUpload);
  domElements.analyzeBtn?.addEventListener('click', analyzeUploadedImage);
  domElements.startWebcamBtn?.addEventListener('click', toggleWebcam);
  domElements.switchCameraBtn?.addEventListener('click', switchCamera);
  window.addEventListener('beforeunload', stopWebcam);
}

async function getAvailableVideoDevices() {
  await navigator.mediaDevices.getUserMedia({ video: true });
  const devices = await navigator.mediaDevices.enumerateDevices();
  appState.videoDevices = devices.filter(device => device.kind === 'videoinput');
}

function switchToWebcamMode() {
  domElements.webcamBtn.classList.add('active');
  domElements.uploadBtn.classList.remove('active');
  domElements.uploadSection.classList.add('hidden');
  domElements.webcamSection.classList.remove('hidden');
  domElements.imagePreviewContainer.classList.add('hidden');
  clearResults();
}

function switchToUploadMode() {
  domElements.uploadBtn.classList.add('active');
  domElements.webcamBtn.classList.remove('active');
  domElements.uploadSection.classList.remove('hidden');
  domElements.webcamSection.classList.add('hidden');
  stopWebcam();
  clearResults();
}

async function toggleWebcam() {
  if (appState.isWebcamActive) {
    stopWebcam();
    updateWebcamButton(false);
  } else {
    await startWebcam();
    updateWebcamButton(true);
  }
}

async function startWebcam() {
  try {
    clearResults();

    const deviceId = appState.videoDevices[appState.currentCameraIndex]?.deviceId;
    if (!deviceId) {
      alert("Nenhuma câmera encontrada.");
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId }, width: 400, height: 400 },
      audio: false
    });

    stopWebcam();

    const video = document.createElement('video');
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.width = 400;
    video.height = 400;
    video.srcObject = stream;
    appState.videoElement = video;
    appState.stream = stream;
    appState.isWebcamActive = true;

    domElements.webcamContainer.innerHTML = '';
    domElements.webcamContainer.appendChild(video);

    video.addEventListener('loadeddata', () => webcamLoop());
  } catch (err) {
    console.error("Erro ao iniciar webcam:", err);
    alert("Erro ao acessar a câmera: " + err.message);
  }
}

function stopWebcam() {
  if (appState.stream) {
    appState.stream.getTracks().forEach(track => track.stop());
  }
  appState.stream = null;
  appState.videoElement = null;
  appState.isWebcamActive = false;
  domElements.webcamContainer.innerHTML = '';
}

function updateWebcamButton(isActive) {
  domElements.startWebcamBtn.innerHTML = isActive ? '<i class="fas fa-stop"></i> Parar Câmera' : '<i class="fas fa-play"></i> Iniciar Câmera';
}

async function switchCamera() {
  if (appState.videoDevices.length <= 1) return;
  appState.currentCameraIndex = (appState.currentCameraIndex + 1) % appState.videoDevices.length;
  await startWebcam();
}

async function webcamLoop() {
  if (!appState.isWebcamActive || !appState.videoElement) return;

  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(appState.videoElement, 0, 0, canvas.width, canvas.height);

  if (appState.model) {
    const prediction = await appState.model.predict(canvas);
    displayPredictions(prediction);
  }

  requestAnimationFrame(webcamLoop);
}

function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    domElements.imagePreview.src = e.target.result;
    domElements.imagePreviewContainer.classList.remove('hidden');
    clearResults();
  };
  reader.readAsDataURL(file);
}

async function analyzeUploadedImage() {
  if (!appState.isModelLoaded || !domElements.imagePreview.src) return;

  const prediction = await appState.model.predict(domElements.imagePreview);
  displayPredictions(prediction);
}

function displayPredictions(predictions) {
  validatePredictionsContainer();
  domElements.labelContainer.innerHTML = '';
  predictions.sort((a, b) => b.probability - a.probability).forEach(pred => {
    const el = document.createElement('div');
    el.className = 'prediction-item';
    el.innerHTML = `
      <div class="progress-bar" style="width: ${pred.probability * 100}%"></div>
      <div class="prediction-text">
        <span class="material-name">${formatMaterialName(pred.className)}</span>
        <span class="percentage">${(pred.probability * 100).toFixed(1)}%</span>
      </div>`;
    domElements.labelContainer.appendChild(el);
  });
}

function validatePredictionsContainer() {
  if (!domElements.labelContainer) {
    domElements.labelContainer = document.createElement('div');
    domElements.labelContainer.id = 'label-container';
    document.body.appendChild(domElements.labelContainer);
  }
}

function formatMaterialName(className) {
  return className.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function clearResults() {
  if (domElements.labelContainer) {
    domElements.labelContainer.innerHTML = '<div class="empty-message">Aguardando análise...</div>';
  }
}

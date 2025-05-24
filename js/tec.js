// =============================================
// CONFIGURAÇÕES E VARIÁVEIS GLOBAIS
// =============================================
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/h245knWf6/";

// Elementos do DOM
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
  toggleFlashBtn: document.getElementById('toggle-flash-btn'),
  labelContainer: document.getElementById('label-container'),
  webcamContainer: document.getElementById('webcam-container')
};

// Estado da aplicação
const appState = {
  model: null,
  webcam: null,
  maxPredictions: 0,
  isWebcamActive: false,
  isModelLoaded: false,
  currentCamera: 'environment', // 'environment' (traseira) ou 'user' (frontal)
  isFlashOn: false,
  stream: null,
  track: null
};

// =============================================
// INICIALIZAÇÃO DA APLICAÇÃO
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initializeApp();
    console.log('Aplicativo inicializado com sucesso!');
  } catch (error) {
    handleInitializationError(error);
  }
});

async function initializeApp() {
  // Carregar modelo de IA
  await loadModel();
  
  // Configurar listeners de eventos
  setupEventListeners();
  
  // Inicializar container de resultados
  initLabelContainer();
}

function handleInitializationError(error) {
  console.error('Erro na inicialização:', error);
  alert('Erro ao carregar o aplicativo. Por favor, recarregue a página.');
}

// =============================================
// CARREGAMENTO DO MODELO
// =============================================
async function loadModel() {
  try {
    const modelURL = MODEL_URL + "model.json";
    const metadataURL = MODEL_URL + "metadata.json";
    
    appState.model = await tmImage.load(modelURL, metadataURL);
    appState.maxPredictions = appState.model.getTotalClasses();
    appState.isModelLoaded = true;
  } catch (error) {
    console.error('Erro ao carregar o modelo:', error);
    throw new Error('Não foi possível carregar o modelo de IA');
  }
}

// =============================================
// CONFIGURAÇÃO DA INTERFACE
// =============================================
function setupEventListeners() {
  // Controle de modos (webcam/upload)
  if (domElements.webcamBtn && domElements.uploadBtn) {
    domElements.webcamBtn.addEventListener('click', switchToWebcamMode);
    domElements.uploadBtn.addEventListener('click', switchToUploadMode);
  }
  
  // Upload de imagem
  if (domElements.imageUpload) {
    domElements.imageUpload.addEventListener('change', handleImageUpload);
  }
  
  // Análise de imagem
  if (domElements.analyzeBtn) {
    domElements.analyzeBtn.addEventListener('click', analyzeUploadedImage);
  }
  
  // Controle da webcam
  if (domElements.startWebcamBtn) {
    domElements.startWebcamBtn.addEventListener('click', toggleWebcam);
  }
  
  // Alternar câmera
  if (domElements.switchCameraBtn) {
    domElements.switchCameraBtn.addEventListener('click', switchCamera);
  }
  
  // Controlar flash
  if (domElements.toggleFlashBtn) {
    domElements.toggleFlashBtn.addEventListener('click', toggleFlash);
  }
  
  // Parar webcam ao sair da página
  window.addEventListener('beforeunload', stopWebcam);
}

function initLabelContainer() {
  if (!domElements.labelContainer) {
    console.warn('Container de labels não encontrado, criando um novo...');
    domElements.labelContainer = document.createElement('div');
    domElements.labelContainer.id = 'label-container';
    document.querySelector('.ai-controls')?.appendChild(domElements.labelContainer);
  }
}

// =============================================
// CONTROLE DE MODOS (WEBCAM/UPLOAD)
// =============================================
function switchToWebcamMode() {
  try {
    domElements.webcamBtn.classList.add('active');
    domElements.uploadBtn.classList.remove('active');
    domElements.uploadSection.classList.add('hidden');
    domElements.webcamSection.classList.remove('hidden');
    domElements.imagePreviewContainer.classList.add('hidden');
    clearResults();
  } catch (error) {
    console.error('Erro ao alternar para webcam:', error);
  }
}

function switchToUploadMode() {
  try {
    domElements.uploadBtn.classList.add('active');
    domElements.webcamBtn.classList.remove('active');
    domElements.uploadSection.classList.remove('hidden');
    domElements.webcamSection.classList.add('hidden');
    
    if (appState.isWebcamActive) {
      stopWebcam();
    }
    
    clearResults();
  } catch (error) {
    console.error('Erro ao alternar para upload:', error);
  }
}

// =============================================
// MANIPULAÇÃO DE IMAGENS
// =============================================
function handleImageUpload(event) {
  try {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = function(e) {
      domElements.imagePreview.src = e.target.result;
      domElements.imagePreviewContainer.classList.remove('hidden');
      clearResults();
    }
    
    reader.onerror = function() {
      throw new Error('Erro ao ler o arquivo de imagem');
    }
    
    reader.readAsDataURL(file);
  } catch (error) {
    console.error('Erro no upload de imagem:', error);
    alert('Erro ao carregar a imagem. Por favor, tente novamente.');
  }
}

async function analyzeUploadedImage() {
  try {
    validateAnalysisPreconditions();
    showLoading(true);
    
    const prediction = await appState.model.predict(domElements.imagePreview);
    displayPredictions(prediction);
  } catch (error) {
    handleAnalysisError(error);
  } finally {
    showLoading(false);
  }
}

function validateAnalysisPreconditions() {
  if (!appState.isModelLoaded) {
    throw new Error('Modelo não carregado');
  }
  
  if (!domElements.imagePreview.src || domElements.imagePreview.src === '#') {
    throw new Error('Nenhuma imagem selecionada');
  }
}

function handleAnalysisError(error) {
  console.error('Erro na análise de imagem:', error);
  displayErrorMessage(error.message || 'Erro ao analisar a imagem');
}

// =============================================
// CONTROLE DA WEBCAM
// =============================================
async function toggleWebcam() {
  try {
    if (appState.isWebcamActive) {
      await stopWebcam();
      updateWebcamButton(false);
      hideCameraControls();
    } else {
      await startWebcam();
      updateWebcamButton(true);
      showCameraControls();
    }
  } catch (error) {
    console.error('Erro ao alternar webcam:', error);
    alert('Erro ao acessar a câmera: ' + error.message);
  }
}

function showCameraControls() {
  if (domElements.switchCameraBtn) {
    domElements.switchCameraBtn.style.display = 'inline-block';
  }
  if (domElements.toggleFlashBtn) {
    domElements.toggleFlashBtn.style.display = appState.currentCamera === 'environment' ? 'inline-block' : 'none';
  }
}

function hideCameraControls() {
  if (domElements.switchCameraBtn) {
    domElements.switchCameraBtn.style.display = 'none';
  }
  if (domElements.toggleFlashBtn) {
    domElements.toggleFlashBtn.style.display = 'none';
  }
}

async function startWebcam() {
  try {
    clearResults();
    
    const flip = appState.currentCamera === 'user'; // Flip apenas para câmera frontal
    appState.webcam = new tmImage.Webcam(400, 400, flip);
    
    // Configurações adicionais para seleção de câmera
    const constraints = {
      video: {
        facingMode: appState.currentCamera,
        width: { ideal: 400 },
        height: { ideal: 400 }
      },
      audio: false
    };
    
    await appState.webcam.setup(constraints);
    await appState.webcam.play();
    
    // Armazenar a stream para controle posterior
    appState.stream = appState.webcam.video.srcObject;
    appState.track = appState.stream.getVideoTracks()[0];
    
    appState.isWebcamActive = true;
    
    if (domElements.webcamContainer) {
      domElements.webcamContainer.innerHTML = '';
      domElements.webcamContainer.appendChild(appState.webcam.canvas);
    }
    
    window.requestAnimationFrame(webcamLoop);
  } catch (error) {
    console.error('Erro ao iniciar webcam:', error);
    throw error;
  }
}

async function webcamLoop() {
  try {
    if (appState.isWebcamActive && appState.webcam) {
      appState.webcam.update();
      await predictWebcam();
      window.requestAnimationFrame(webcamLoop);
    }
  } catch (error) {
    console.error('Erro no webcam loop:', error);
    await stopWebcam();
  }
}

async function predictWebcam() {
  try {
    if (!appState.webcam || !appState.model) return;
    
    const prediction = await appState.model.predict(appState.webcam.canvas);
    displayPredictions(prediction);
  } catch (error) {
    console.error('Erro na previsão da webcam:', error);
    throw error;
  }
}

async function stopWebcam() {
  try {
    if (appState.webcam) {
      await appState.webcam.stop();
      appState.webcam = null;
    }
    if (appState.stream) {
      appState.stream.getTracks().forEach(track => track.stop());
      appState.stream = null;
      appState.track = null;
    }
    appState.isWebcamActive = false;
    appState.isFlashOn = false;
    
    if (domElements.webcamContainer) {
      domElements.webcamContainer.innerHTML = '';
    }
  } catch (error) {
    console.error('Erro ao parar webcam:', error);
    throw error;
  }
}

function updateWebcamButton(isActive) {
  if (domElements.startWebcamBtn) {
    if (isActive) {
      domElements.startWebcamBtn.innerHTML = '<i class="fas fa-stop"></i> Parar Câmera';
      domElements.startWebcamBtn.classList.add('active');
    } else {
      domElements.startWebcamBtn.innerHTML = '<i class="fas fa-play"></i> Iniciar Câmera';
      domElements.startWebcamBtn.classList.remove('active');
    }
  }
}

async function switchCamera() {
  try {
    if (!appState.isWebcamActive) return;
    
    // Alternar entre câmeras
    appState.currentCamera = appState.currentCamera === 'user' ? 'environment' : 'user';
    
    // Atualizar texto do botão
    if (domElements.switchCameraBtn) {
      const icon = appState.currentCamera === 'user' ? 'fa-camera' : 'fa-camera-retro';
      domElements.switchCameraBtn.innerHTML = `<i class="fas ${icon}"></i> Alternar Câmera`;
    }
    
    // Atualizar visibilidade do botão de flash
    if (domElements.toggleFlashBtn) {
      domElements.toggleFlashBtn.style.display = appState.currentCamera === 'environment' ? 'inline-block' : 'none';
      // Desligar flash ao alternar câmeras
      if (appState.isFlashOn) {
        await toggleFlash(false);
      }
    }
    
    // Reiniciar a webcam com a nova câmera
    await stopWebcam();
    await startWebcam();
  } catch (error) {
    console.error('Erro ao alternar câmera:', error);
    alert('Erro ao alternar câmera: ' + error.message);
  }
}

async function toggleFlash(forceState = null) {
  try {
    // Verificar se a câmera traseira está ativa
    if (appState.currentCamera !== 'environment') {
      alert('Flash disponível apenas na câmera traseira');
      return;
    }
    
    // Determinar novo estado
    const newState = forceState !== null ? forceState : !appState.isFlashOn;
    
    // Aplicar configurações de flash (se suportado)
    if (appState.track && typeof appState.track.applyConstraints === 'function') {
      try {
        await appState.track.applyConstraints({
          advanced: [{ torch: newState }]
        });
        appState.isFlashOn = newState;
      } catch (flashError) {
        console.warn('Flash não suportado ou erro ao ativar:', flashError);
        appState.isFlashOn = false;
      }
    }
    
    // Atualizar botão
    if (domElements.toggleFlashBtn) {
      const icon = appState.isFlashOn ? 'fa-lightbulb' : 'fa-lightbulb';
      const text = appState.isFlashOn ? 'Desligar Flash' : 'Ligar Flash';
      domElements.toggleFlashBtn.innerHTML = `<i class="fas ${icon}"></i> ${text}`;
    }
    
    // Feedback visual quando não suportado
    if (!appState.isFlashOn && forceState === null) {
      alert('Seu dispositivo não suporta flash ou não foi possível ativá-lo');
    }
  } catch (error) {
    console.error('Erro ao controlar flash:', error);
    appState.isFlashOn = false;
  }
}

// =============================================
// EXIBIÇÃO DE RESULTADOS
// =============================================
function displayPredictions(predictions) {
  try {
    validatePredictionsContainer();
    
    if (!predictions || !Array.isArray(predictions)) {
      throw new Error('Previsões inválidas');
    }
    
    const sortedPredictions = [...predictions].sort((a, b) => b.probability - a.probability);
    renderPredictions(sortedPredictions);
  } catch (error) {
    console.error('Erro ao exibir previsões:', error);
    displayErrorMessage('Erro ao exibir resultados');
  }
}

function validatePredictionsContainer() {
  if (!domElements.labelContainer) {
    initLabelContainer();
    if (!domElements.labelContainer) {
      throw new Error('Container de resultados não disponível');
    }
  }
}

function renderPredictions(predictions) {
  domElements.labelContainer.innerHTML = '';
  
  predictions.forEach(pred => {
    if (pred.probability > 0.01) {
      const predictionElement = createPredictionElement(pred);
      domElements.labelContainer.appendChild(predictionElement);
    }
  });
}

function createPredictionElement(prediction) {
  const element = document.createElement('div');
  element.className = 'prediction-item';
  
  const progressBar = document.createElement('div');
  progressBar.className = 'progress-bar';
  progressBar.style.width = `${prediction.probability * 100}%`;
  
  const textContainer = document.createElement('div');
  textContainer.className = 'prediction-text';
  
  const materialName = document.createElement('span');
  materialName.className = 'material-name';
  materialName.textContent = formatMaterialName(prediction.className);
  
  const percentage = document.createElement('span');
  percentage.className = 'percentage';
  percentage.textContent = `${(prediction.probability * 100).toFixed(1)}%`;
  
  textContainer.appendChild(materialName);
  textContainer.appendChild(percentage);
  element.appendChild(progressBar);
  element.appendChild(textContainer);
  
  return element;
}

function formatMaterialName(className) {
  return className.split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// =============================================
// UTILITÁRIOS
// =============================================
function clearResults() {
  if (domElements.labelContainer) {
    domElements.labelContainer.innerHTML = '<div class="empty-message">Aguardando análise...</div>';
  }
}

function displayErrorMessage(message) {
  if (domElements.labelContainer) {
    domElements.labelContainer.innerHTML = `<div class="error-message">${message}</div>`;
  }
}

function showLoading(show) {
  const loadingIndicator = document.getElementById('loading-indicator') || createLoadingIndicator();
  loadingIndicator.style.display = show ? 'block' : 'none';
  
  if (show && domElements.labelContainer) {
    domElements.labelContainer.innerHTML = '<div class="loading-message">Analisando...</div>';
  }
}

function createLoadingIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'loading-indicator';
  indicator.className = 'loading-indicator';
  indicator.innerHTML = '<div class="spinner"></div>';
  indicator.style.display = 'none';
  
  document.body.appendChild(indicator);
  return indicator;
}
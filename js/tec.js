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
  flashBtn: document.getElementById('flash-btn'),
  labelContainer: document.getElementById('label-container'),
  webcamContainer: document.getElementById('webcam-container'),
  loadingMessage: document.getElementById('loading-message')
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
  track: null,
  animationFrameId: null
};

// =============================================
// INICIALIZAÇÃO DA APLICAÇÃO
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await checkBrowserCompatibility();
    await initializeApp();
    console.log('Aplicativo inicializado com sucesso!');
  } catch (error) {
    handleInitializationError(error);
  }
});

async function checkBrowserCompatibility() {
  // Verificar suporte a APIs necessárias
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const errorMsg = 'Seu navegador não suporta acesso à câmera ou está bloqueado.';
    console.error(errorMsg);
    displayErrorMessage(errorMsg, true);
    
    if (domElements.startWebcamBtn) domElements.startWebcamBtn.disabled = true;
    if (domElements.switchCameraBtn) domElements.switchCameraBtn.disabled = true;
    if (domElements.flashBtn) domElements.flashBtn.disabled = true;
    
    throw new Error(errorMsg);
  }

  // Verificar suporte ao TensorFlow.js
  if (!tf || !tf.ready()) {
    const errorMsg = 'TensorFlow.js não está carregado corretamente.';
    console.error(errorMsg);
    displayErrorMessage(errorMsg, true);
    throw new Error(errorMsg);
  }
}

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
  displayErrorMessage('Erro ao carregar o aplicativo. Por favor, recarregue a página.', true);
}

// =============================================
// CARREGAMENTO DO MODELO
// =============================================
async function loadModel() {
  try {
    showLoading(true, 'Carregando modelo de IA...');
    
    const modelURL = MODEL_URL + "model.json";
    const metadataURL = MODEL_URL + "metadata.json";
    
    appState.model = await tmImage.load(modelURL, metadataURL);
    appState.maxPredictions = appState.model.getTotalClasses();
    appState.isModelLoaded = true;
    
    console.log('Modelo carregado com sucesso!');
  } catch (error) {
    console.error('Erro ao carregar o modelo:', error);
    displayErrorMessage('Não foi possível carregar o modelo de IA. Verifique sua conexão.', true);
    throw error;
  } finally {
    showLoading(false);
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
  
  // Controle do flash
  if (domElements.flashBtn) {
    domElements.flashBtn.addEventListener('click', toggleFlash);
  }
  
  // Parar webcam ao sair da página
  window.addEventListener('beforeunload', stopWebcam);
  window.addEventListener('pagehide', stopWebcam);
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

    // Verificar tipo de arquivo
    if (!file.type.match('image.*')) {
      displayErrorMessage('Por favor, selecione um arquivo de imagem válido (JPEG, PNG, etc).');
      return;
    }

    // Verificar tamanho do arquivo (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      displayErrorMessage('A imagem é muito grande. Por favor, selecione uma imagem menor que 5MB.');
      return;
    }

    const reader = new FileReader();
    
    reader.onload = function(e) {
      domElements.imagePreview.src = e.target.result;
      domElements.imagePreviewContainer.classList.remove('hidden');
      domElements.analyzeBtn.disabled = false;
      clearResults();
    }
    
    reader.onerror = function() {
      throw new Error('Erro ao ler o arquivo de imagem');
    }
    
    reader.readAsDataURL(file);
  } catch (error) {
    console.error('Erro no upload de imagem:', error);
    displayErrorMessage('Erro ao carregar a imagem. Por favor, tente novamente.');
  }
}

async function analyzeUploadedImage() {
  try {
    validateAnalysisPreconditions();
    showLoading(true, 'Analisando imagem...');
    
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
    throw new Error('Modelo de IA não foi carregado corretamente');
  }
  
  if (!domElements.imagePreview.src || domElements.imagePreview.src === '#') {
    throw new Error('Nenhuma imagem selecionada para análise');
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
    } else {
      await checkCameraPermissions();
      await startWebcam();
      updateWebcamButton(true);
    }
  } catch (error) {
    console.error('Erro ao alternar webcam:', error);
    displayErrorMessage(error.message || 'Erro ao acessar a câmera');
  }
}

async function checkCameraPermissions() {
  try {
    // Verificar se temos permissão para acessar a câmera
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    let errorMessage = 'Erro ao acessar a câmera: ';
    
    if (error.name === 'NotAllowedError') {
      errorMessage = 'Permissão de câmera negada. Por favor, permita o acesso à câmera nas configurações do seu navegador.';
    } else if (error.name === 'NotFoundError') {
      errorMessage = 'Nenhuma câmera encontrada no dispositivo.';
    } else if (error.name === 'NotReadableError') {
      errorMessage = 'Não foi possível acessar a câmera. Ela pode estar em uso por outro aplicativo.';
    } else {
      errorMessage += error.message;
    }
    
    throw new Error(errorMessage);
  }
}

async function startWebcam() {
  try {
    clearResults();
    showLoading(true, 'Iniciando câmera...');

    // Verificar dispositivos disponíveis
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    if (videoDevices.length === 0) {
      throw new Error('Nenhuma câmera encontrada no dispositivo');
    }

    // Configurações iniciais
    let constraints = {
      video: {
        facingMode: appState.currentCamera,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    // Tentar obter o stream com fallback para configurações mais simples
    try {
      appState.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.warn('Usando fallback para configurações mais simples de câmera');
      constraints.video = { facingMode: appState.currentCamera };
      appState.stream = await navigator.mediaDevices.getUserMedia(constraints);
    }

    appState.track = appState.stream.getVideoTracks()[0];
    
    // Configurar a webcam do Teachable Machine
    const flip = appState.currentCamera === 'user';
    appState.webcam = new tmImage.Webcam(400, 400, flip);
    
    await appState.webcam.setup(constraints);
    
    if (!appState.webcam.canvas) {
      throw new Error('Canvas da webcam não foi criado corretamente');
    }

    appState.isWebcamActive = true;

    if (domElements.webcamContainer) {
      domElements.webcamContainer.innerHTML = '';
      domElements.webcamContainer.appendChild(appState.webcam.canvas);
    }
    
    // Atualizar controles
    updateCameraButton();
    updateFlashButton();
    checkFlashSupport();
    
    // Iniciar loop de previsão
    appState.animationFrameId = window.requestAnimationFrame(webcamLoop);
  } catch (error) {
    console.error('Erro ao iniciar webcam:', error);
    throw error;
  } finally {
    showLoading(false);
  }
}

function checkFlashSupport() {
  if (!appState.track || !domElements.flashBtn) return;
  
  const capabilities = appState.track.getCapabilities();
  if (!capabilities.torch) {
    domElements.flashBtn.disabled = true;
    domElements.flashBtn.title = 'Flash não suportado nesta câmera';
  } else {
    domElements.flashBtn.disabled = false;
    domElements.flashBtn.title = '';
  }
}

async function switchCamera() {
  try {
    if (!appState.isWebcamActive) return;
    
    showLoading(true, 'Alternando câmera...');
    
    // Alternar entre câmera frontal e traseira
    appState.currentCamera = appState.currentCamera === 'user' ? 'environment' : 'user';
    
    // Reiniciar a webcam com a nova câmera
    await stopWebcam();
    await startWebcam();
  } catch (error) {
    console.error('Erro ao alternar câmera:', error);
    displayErrorMessage('Erro ao alternar câmera: ' + error.message);
  } finally {
    showLoading(false);
  }
}

function updateCameraButton() {
  if (domElements.switchCameraBtn) {
    if (appState.currentCamera === 'user') {
      domElements.switchCameraBtn.innerHTML = '<i class="fas fa-camera-retro"></i> Câmera Traseira';
    } else {
      domElements.switchCameraBtn.innerHTML = '<i class="fas fa-camera-retro"></i> Câmera Frontal';
    }
    domElements.switchCameraBtn.disabled = false;
  }
}

async function toggleFlash() {
  try {
    if (!appState.isWebcamActive || !appState.track) return;
    
    // Verificar se o flash é suportado
    const capabilities = appState.track.getCapabilities();
    if (!capabilities.torch) {
      displayErrorMessage('Flash não é suportado nesta câmera');
      return;
    }
    
    // Alternar estado do flash
    appState.isFlashOn = !appState.isFlashOn;
    
    // Aplicar configuração do flash
    await appState.track.applyConstraints({
      advanced: [{ torch: appState.isFlashOn }]
    });
    
    console.log(`Flash ${appState.isFlashOn ? 'ligado' : 'desligado'}`);
  } catch (error) {
    console.error('Erro ao controlar flash:', error);
    displayErrorMessage('Erro ao controlar flash: ' + error.message);
  } finally {
    updateFlashButton();
  }
}

function updateFlashButton() {
  if (domElements.flashBtn) {
    if (appState.isFlashOn) {
      domElements.flashBtn.innerHTML = '<i class="fas fa-lightbulb"></i> Desligar Flash';
      domElements.flashBtn.classList.add('active');
    } else {
      domElements.flashBtn.innerHTML = '<i class="fas fa-lightbulb"></i> Ligar Flash';
      domElements.flashBtn.classList.remove('active');
    }
  }
}

async function webcamLoop() {
  try {
    if (appState.isWebcamActive && appState.webcam) {
      // Verificar se o canvas ainda está no DOM
      if (!document.body.contains(appState.webcam.canvas)) {
        throw new Error('Canvas da webcam foi removido do DOM');
      }
      
      appState.webcam.update();
      await predictWebcam();
      appState.animationFrameId = window.requestAnimationFrame(webcamLoop);
    }
  } catch (error) {
    console.error('Erro no webcam loop:', error);
    await stopWebcam();
    displayErrorMessage('Erro na câmera: ' + error.message);
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
    showLoading(true, 'Parando câmera...');
    
    // Cancelar o loop de animação
    if (appState.animationFrameId) {
      window.cancelAnimationFrame(appState.animationFrameId);
      appState.animationFrameId = null;
    }
    
    // Desligar o flash se estiver ligado
    if (appState.isFlashOn && appState.track) {
      appState.isFlashOn = false;
      try {
        await appState.track.applyConstraints({
          advanced: [{ torch: false }]
        });
      } catch (error) {
        console.error('Erro ao desligar flash:', error);
      }
    }
    
    // Parar a webcam do Teachable Machine
    if (appState.webcam) {
      try {
        await appState.webcam.stop();
      } catch (error) {
        console.error('Erro ao parar webcam:', error);
      }
      appState.webcam = null;
    }
    
    // Parar o stream de mídia
    if (appState.stream) {
      appState.stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (error) {
          console.error('Erro ao parar track:', error);
        }
      });
      appState.stream = null;
      appState.track = null;
    }
    
    appState.isWebcamActive = false;
    
    if (domElements.webcamContainer) {
      domElements.webcamContainer.innerHTML = '';
    }
    
    // Atualizar botões
    updateWebcamButton(false);
    updateFlashButton();
  } catch (error) {
    console.error('Erro ao parar webcam:', error);
    throw error;
  } finally {
    showLoading(false);
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
  
  // Mostrar apenas as previsões com probabilidade significativa
  const filteredPredictions = predictions.filter(pred => pred.probability > 0.01);
  
  if (filteredPredictions.length === 0) {
    const noResults = document.createElement('div');
    noResults.className = 'no-results';
    noResults.textContent = 'Nenhum material reciclável identificado com confiança suficiente.';
    domElements.labelContainer.appendChild(noResults);
    return;
  }
  
  filteredPredictions.forEach(pred => {
    const predictionElement = createPredictionElement(pred);
    domElements.labelContainer.appendChild(predictionElement);
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
    domElements.labelContainer.innerHTML = '';
  }
}

function showLoading(isLoading, message = '') {
  const loadingElement = document.getElementById('loading-overlay');
  
  if (isLoading) {
    if (domElements.loadingMessage) {
      domElements.loadingMessage.textContent = message || 'Processando...';
    }
    loadingElement.style.display = 'flex';
  } else {
    loadingElement.style.display = 'none';
  }
}

function displayErrorMessage(message, isPermanent = false) {
  const errorElement = document.getElementById('error-message');
  
  errorElement.textContent = message;
  errorElement.style.display = 'block';
  
  if (!isPermanent) {
    // Esconder após 5 segundos
    setTimeout(() => {
      errorElement.style.display = 'none';
    }, 5000);
  }
}
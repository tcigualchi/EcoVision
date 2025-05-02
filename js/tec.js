// =============================================
// CONFIGURAÇÕES E VARIÁVEIS GLOBAIS
// =============================================
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/h245knWf6/";

// Elementos do DOM
const domElements = {
    // Botões e seções
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
    
    // Containers
    labelContainer: document.getElementById('label-container'),
    webcamContainer: document.getElementById('webcam-container'),
    
    // Mensagens
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingMessage: document.getElementById('loading-message'),
    errorMessage: document.getElementById('error-message')
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
        // Verificar elementos críticos do DOM
        if (!checkCriticalDOMElements()) {
            throw new Error('Elementos críticos do DOM não foram encontrados');
        }

        // Verificar suporte a APIs necessárias
        await checkBrowserCompatibility();
        
        // Inicializar aplicativo
        await initializeApp();
        
        console.log('Aplicativo inicializado com sucesso!');
    } catch (error) {
        console.error('Erro na inicialização:', error);
        displayErrorMessage('Erro ao carregar o aplicativo. Por favor, recarregue a página.', true);
    }
});

function checkCriticalDOMElements() {
    const criticalElements = [
        domElements.loadingOverlay,
        domElements.loadingMessage,
        domElements.errorMessage,
        domElements.webcamContainer,
        domElements.labelContainer
    ];

    return criticalElements.every(element => element !== null);
}

async function checkBrowserCompatibility() {
    // Verificar suporte a APIs de mídia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const errorMsg = 'Seu navegador não suporta acesso à câmera ou está bloqueado.';
        throw new Error(errorMsg);
    }

    // Verificar suporte ao TensorFlow.js
    if (typeof tf === 'undefined' || !tf.ready) {
        const errorMsg = 'TensorFlow.js não está carregado corretamente.';
        throw new Error(errorMsg);
    }

    // Verificar suporte à API Teachable Machine
    if (typeof tmImage === 'undefined') {
        const errorMsg = 'API Teachable Machine não está carregada corretamente.';
        throw new Error(errorMsg);
    }
}

async function initializeApp() {
    // Carregar modelo de IA
    await loadModel();
    
    // Configurar listeners de eventos
    setupEventListeners();
}

// =============================================
// CARREGAMENTO DO MODELO
// =============================================
async function loadModel() {
    try {
        showLoading(true, 'Carregando modelo de IA...');
        
        const modelURL = MODEL_URL + "model.json";
        const metadataURL = MODEL_URL + "metadata.json";
        
        // Verificar conexão com o modelo
        try {
            const response = await fetch(modelURL);
            if (!response.ok) throw new Error('Modelo não encontrado');
        } catch (error) {
            throw new Error('Não foi possível acessar o modelo. Verifique sua conexão.');
        }
        
        // Carregar modelo
        appState.model = await tmImage.load(modelURL, metadataURL);
        appState.maxPredictions = appState.model.getTotalClasses();
        appState.isModelLoaded = true;
        
        console.log('Modelo carregado com sucesso!');
    } catch (error) {
        console.error('Erro ao carregar o modelo:', error);
        throw new Error('Não foi possível carregar o modelo de IA: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// =============================================
// CONFIGURAÇÃO DA INTERFACE
// =============================================
function setupEventListeners() {
    // Controle de modos (webcam/upload)
    domElements.webcamBtn.addEventListener('click', switchToWebcamMode);
    domElements.uploadBtn.addEventListener('click', switchToUploadMode);
    
    // Upload de imagem
    domElements.imageUpload.addEventListener('change', handleImageUpload);
    
    // Análise de imagem
    domElements.analyzeBtn.addEventListener('click', analyzeUploadedImage);
    
    // Controle da webcam
    domElements.startWebcamBtn.addEventListener('click', toggleWebcam);
    
    // Alternar câmera
    domElements.switchCameraBtn.addEventListener('click', switchCamera);
    
    // Controle do flash
    domElements.flashBtn.addEventListener('click', toggleFlash);
    
    // Parar webcam ao sair da página
    window.addEventListener('beforeunload', stopWebcam);
    window.addEventListener('pagehide', stopWebcam);
}

// =============================================
// CONTROLE DE MODOS (WEBCAM/UPLOAD)
// =============================================
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
    
    if (appState.isWebcamActive) {
        stopWebcam();
    }
    
    clearResults();
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
        console.error('Erro na análise de imagem:', error);
        displayErrorMessage(error.message || 'Erro ao analisar a imagem');
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

// =============================================
// CONTROLE DA WEBCAM
// =============================================
async function toggleWebcam() {
    try {
        if (appState.isWebcamActive) {
            await stopWebcam();
            updateWebcamButton(false);
            return;
        }

        // Verificar permissões antes de tentar iniciar
        await checkCameraPermissions();
        
        // Iniciar webcam
        await startWebcam();
        updateWebcamButton(true);
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
    } catch (error) {
        let errorMessage;
        
        if (error.name === 'NotAllowedError') {
            errorMessage = 'Permissão de câmera negada. Por favor, permita o acesso à câmera nas configurações do seu navegador.';
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'Nenhuma câmera encontrada no dispositivo.';
        } else if (error.name === 'NotReadableError') {
            errorMessage = 'Não foi possível acessar a câmera. Ela pode estar em uso por outro aplicativo.';
        } else {
            errorMessage = 'Erro ao acessar a câmera: ' + error.message;
        }
        
        throw new Error(errorMessage);
    }
}

async function startWebcam() {
  try {
      clearResults();
      showLoading(true, 'Iniciando câmera...');

      // Mostrar mensagem enquanto a câmera carrega
      domElements.webcamContainer.innerHTML = '<div class="camera-loading">Iniciando câmera...</div>';

      // Configurações da câmera
      const constraints = {
          video: {
              facingMode: appState.currentCamera,
              width: { ideal: 1280 },
              height: { ideal: 720 }
          }
      };

      // Obter stream da câmera
      appState.stream = await navigator.mediaDevices.getUserMedia(constraints);
      appState.track = appState.stream.getVideoTracks()[0];
      
      // Configurar a webcam
      const flip = appState.currentCamera === 'user';
      appState.webcam = new tmImage.Webcam(500, 375, flip); // Largura e altura fixas
      
      // Setup com as constraints reais
      await appState.webcam.setup({
          video: {
              deviceId: appState.track.getSettings().deviceId,
              width: { ideal: 500 },
              height: { ideal: 375 }
          }
      });

      // Verificar se o canvas foi criado
      if (!appState.webcam.canvas) {
          throw new Error('Não foi possível criar a visualização da câmera');
      }

      appState.isWebcamActive = true;

      // Adicionar canvas ao container
      domElements.webcamContainer.innerHTML = '';
      domElements.webcamContainer.appendChild(appState.webcam.canvas);
      
      // Iniciar loop de previsão
      appState.animationFrameId = window.requestAnimationFrame(webcamLoop);

  } catch (error) {
      console.error('Erro ao iniciar webcam:', error);
      
      let errorMessage = 'Erro ao acessar a câmera: ';
      if (error.name === 'NotAllowedError') {
          errorMessage = 'Permissão de câmera negada. Por favor, permita o acesso à câmera.';
      } else if (error.name === 'NotFoundError') {
          errorMessage = 'Nenhuma câmera encontrada.';
      } else if (error.name === 'NotReadableError') {
          errorMessage = 'Não foi possível acessar a câmera (pode estar em uso por outro aplicativo).';
      } else {
          errorMessage += error.message;
      }
      
      domElements.webcamContainer.innerHTML = '<div class="camera-loading" style="color:red">'+errorMessage+'</div>';
      displayErrorMessage(errorMessage);
      
      // Resetar estado
      appState.isWebcamActive = false;
      if (appState.stream) {
          appState.stream.getTracks().forEach(track => track.stop());
          appState.stream = null;
      }
  } finally {
      showLoading(false);
  }
}

// Verificação de elementos críticos
document.addEventListener('DOMContentLoaded', () => {
  const requiredElements = [
      'webcam-container', 'image-preview', 'loading-overlay', 
      'error-message', 'start-webcam-btn'
  ];
  
  requiredElements.forEach(id => {
      if (!document.getElementById(id)) {
          console.error(`Elemento crítico não encontrado: #${id}`);
          alert(`Erro de configuração: elemento #${id} não encontrado.`);
      }
  });
});

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
    if (appState.currentCamera === 'user') {
        domElements.switchCameraBtn.innerHTML = '<i class="fas fa-camera-retro"></i> Câmera Traseira';
    } else {
        domElements.switchCameraBtn.innerHTML = '<i class="fas fa-camera-retro"></i> Câmera Frontal';
    }
    domElements.switchCameraBtn.disabled = false;
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
    if (appState.isFlashOn) {
        domElements.flashBtn.innerHTML = '<i class="fas fa-lightbulb"></i> Desligar Flash';
        domElements.flashBtn.classList.add('active');
    } else {
        domElements.flashBtn.innerHTML = '<i class="fas fa-lightbulb"></i> Ligar Flash';
        domElements.flashBtn.classList.remove('active');
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
    if (!appState.webcam || !appState.model) return;
    
    try {
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
        
        // Limpar container da webcam
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
    if (isActive) {
        domElements.startWebcamBtn.innerHTML = '<i class="fas fa-stop"></i> Parar Câmera';
        domElements.startWebcamBtn.classList.add('active');
    } else {
        domElements.startWebcamBtn.innerHTML = '<i class="fas fa-play"></i> Iniciar Câmera';
        domElements.startWebcamBtn.classList.remove('active');
    }
}

// =============================================
// EXIBIÇÃO DE RESULTADOS
// =============================================
function displayPredictions(predictions) {
    try {
        if (!predictions || !Array.isArray(predictions)) {
            throw new Error('Previsões inválidas');
        }
        
        // Ordenar previsões por probabilidade
        const sortedPredictions = [...predictions].sort((a, b) => b.probability - a.probability);
        
        // Limpar resultados anteriores
        domElements.labelContainer.innerHTML = '';
        
        // Filtrar previsões com probabilidade significativa (>1%)
        const filteredPredictions = sortedPredictions.filter(pred => pred.probability > 0.01);
        
        if (filteredPredictions.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'no-results';
            noResults.textContent = 'Nenhum material reciclável identificado com confiança suficiente.';
            domElements.labelContainer.appendChild(noResults);
            return;
        }
        
        // Exibir cada previsão
        filteredPredictions.forEach(pred => {
            const predictionElement = createPredictionElement(pred);
            domElements.labelContainer.appendChild(predictionElement);
        });
    } catch (error) {
        console.error('Erro ao exibir previsões:', error);
        displayErrorMessage('Erro ao exibir resultados');
    }
}

function createPredictionElement(prediction) {
    const element = document.createElement('div');
    element.className = 'prediction-item';
    
    // Barra de progresso
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.style.width = `${prediction.probability * 100}%`;
    
    // Container de texto
    const textContainer = document.createElement('div');
    textContainer.className = 'prediction-text';
    
    // Nome do material
    const materialName = document.createElement('span');
    materialName.className = 'material-name';
    materialName.textContent = formatMaterialName(prediction.className);
    
    // Porcentagem
    const percentage = document.createElement('span');
    percentage.className = 'percentage';
    percentage.textContent = `${(prediction.probability * 100).toFixed(1)}%`;
    
    // Montar estrutura
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
// FUNÇÕES UTILITÁRIAS
// =============================================
function clearResults() {
    if (domElements.labelContainer) {
        domElements.labelContainer.innerHTML = '';
    }
}

function showLoading(isLoading, message = '') {
    if (!domElements.loadingOverlay || !domElements.loadingMessage) return;
    
    if (isLoading) {
        domElements.loadingMessage.textContent = message || 'Processando...';
        domElements.loadingOverlay.style.display = 'flex';
    } else {
        domElements.loadingOverlay.style.display = 'none';
    }
}

function displayErrorMessage(message, isPermanent = false) {
    if (!domElements.errorMessage) return;
    
    domElements.errorMessage.textContent = message;
    domElements.errorMessage.style.display = 'block';
    
    if (!isPermanent) {
        setTimeout(() => {
            if (domElements.errorMessage) {
                domElements.errorMessage.style.display = 'none';
            }
        }, 5000);
    }
}
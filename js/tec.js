// URL do modelo Teachable Machine
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/h245knWf6/";

// Variáveis globais
let model;
let webcam;
let labelContainer;
let maxPredictions;
let isWebcamActive = false;

// Elementos do DOM
const webcamBtn = document.getElementById('webcam-btn');
const uploadBtn = document.getElementById('upload-btn');
const uploadSection = document.getElementById('upload-section');
const webcamSection = document.getElementById('webcam-section');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imageUpload = document.getElementById('image-upload');
const imagePreview = document.getElementById('image-preview');
const analyzeBtn = document.getElementById('analyze-btn');
const startWebcamBtn = document.getElementById('start-webcam-btn');

// Inicialização quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Carregar o modelo de IA
        await loadModel();
        
        // Configurar eventos
        setupEventListeners();
        
        // Inicializar o container de labels
        initLabelContainer();
        
        console.log('Aplicativo inicializado com sucesso!');
    } catch (error) {
        console.error('Erro na inicialização:', error);
        alert('Erro ao carregar o aplicativo. Por favor, recarregue a página.');
    }
});

// Carregar o modelo de IA
async function loadModel() {
    try {
        const modelURL = MODEL_URL + "model.json";
        const metadataURL = MODEL_URL + "metadata.json";
        
        model = await tmImage.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();
        
        console.log('Modelo carregado com sucesso');
    } catch (error) {
        console.error('Erro ao carregar o modelo:', error);
        throw new Error('Não foi possível carregar o modelo de IA');
    }
}

// Configurar os event listeners
function setupEventListeners() {
    // Alternar entre webcam e upload
    if (webcamBtn && uploadBtn) {
        webcamBtn.addEventListener('click', switchToWebcam);
        uploadBtn.addEventListener('click', switchToUpload);
    }
    
    // Upload de imagem
    if (imageUpload) {
        imageUpload.addEventListener('change', handleImageUpload);
    }
    
    // Analisar imagem
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', analyzeUploadedImage);
    }
    
    // Iniciar webcam
    if (startWebcamBtn) {
        startWebcamBtn.addEventListener('click', toggleWebcam);
    }
    
    // Parar webcam quando sair da página
    window.addEventListener('beforeunload', stopWebcam);
}

// Inicializar o container de labels
function initLabelContainer() {
    labelContainer = document.getElementById('label-container');
    if (!labelContainer) {
        console.warn('Container de labels não encontrado');
        // Criar um container dinamicamente se não existir
        const resultsSection = document.querySelector('.ai-controls');
        if (resultsSection) {
            labelContainer = document.createElement('div');
            labelContainer.id = 'label-container';
            resultsSection.appendChild(labelContainer);
        }
    }
}

// Alternar para modo webcam
async function switchToWebcam() {
    try {
        webcamBtn.classList.add('active');
        uploadBtn.classList.remove('active');
        uploadSection.classList.add('hidden');
        webcamSection.classList.remove('hidden');
        imagePreviewContainer.classList.add('hidden');
        
        // Limpar resultados anteriores
        clearResults();
    } catch (error) {
        console.error('Erro ao alternar para webcam:', error);
    }
}

// Alternar para modo upload
function switchToUpload() {
    try {
        uploadBtn.classList.add('active');
        webcamBtn.classList.remove('active');
        uploadSection.classList.remove('hidden');
        webcamSection.classList.add('hidden');
        
        // Parar webcam se estiver ativa
        if (isWebcamActive) {
            stopWebcam();
        }
        
        // Limpar resultados anteriores
        clearResults();
    } catch (error) {
        console.error('Erro ao alternar para upload:', error);
    }
}

// Manipular upload de imagem
function handleImageUpload(event) {
    try {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        
        reader.onload = function(e) {
            imagePreview.src = e.target.result;
            imagePreviewContainer.classList.remove('hidden');
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

// Analisar imagem enviada
async function analyzeUploadedImage() {
    try {
        // Validar estado
        if (!model) {
            throw new Error('Modelo não carregado');
        }
        
        if (!imagePreview.src || imagePreview.src === '#') {
            throw new Error('Nenhuma imagem selecionada');
        }
        
        // Mostrar indicador de carregamento
        showLoading(true);
        
        // Fazer previsão
        const prediction = await model.predict(imagePreview);
        
        // Exibir resultados
        displayPredictions(prediction);
    } catch (error) {
        console.error('Erro na análise de imagem:', error);
        displayErrorMessage(error.message || 'Erro ao analisar a imagem');
    } finally {
        showLoading(false);
    }
}

// Ligar/desligar webcam
async function toggleWebcam() {
    try {
        if (isWebcamActive) {
            await stopWebcam();
            startWebcamBtn.innerHTML = '<i class="fas fa-play"></i> Iniciar Câmera';
        } else {
            await startWebcam();
            startWebcamBtn.innerHTML = '<i class="fas fa-stop"></i> Parar Câmera';
        }
    } catch (error) {
        console.error('Erro ao alternar webcam:', error);
        alert('Erro ao acessar a câmera: ' + error.message);
    }
}

// Iniciar webcam
async function startWebcam() {
    try {
        // Inicializar container de labels
        initLabelContainer();
        clearResults();
        
        // Configurar webcam
        const flip = true; // Espelhar a imagem
        webcam = new tmImage.Webcam(400, 400, flip);
        
        await webcam.setup();
        await webcam.play();
        
        // Atualizar estado
        isWebcamActive = true;
        
        // Adicionar canvas ao DOM
        const webcamContainer = document.getElementById('webcam-container');
        if (webcamContainer) {
            webcamContainer.innerHTML = '';
            webcamContainer.appendChild(webcam.canvas);
        }
        
        // Iniciar loop de previsão
        window.requestAnimationFrame(webcamLoop);
    } catch (error) {
        console.error('Erro ao iniciar webcam:', error);
        throw error;
    }
}

// Loop de previsão da webcam
async function webcamLoop() {
    try {
        if (isWebcamActive && webcam) {
            webcam.update(); // Atualizar frame da webcam
            await predictWebcam();
            window.requestAnimationFrame(webcamLoop);
        }
    } catch (error) {
        console.error('Erro no webcam loop:', error);
        stopWebcam();
    }
}

// Fazer previsão com webcam
async function predictWebcam() {
    try {
        if (!webcam || !model) return;
        
        const prediction = await model.predict(webcam.canvas);
        displayPredictions(prediction);
    } catch (error) {
        console.error('Erro na previsão da webcam:', error);
        throw error;
    }
}

// Parar webcam
async function stopWebcam() {
    try {
        if (webcam) {
            await webcam.stop();
            webcam = null;
        }
        isWebcamActive = false;
        
        // Limpar container da webcam
        const webcamContainer = document.getElementById('webcam-container');
        if (webcamContainer) {
            webcamContainer.innerHTML = '';
        }
    } catch (error) {
        console.error('Erro ao parar webcam:', error);
        throw error;
    }
}

// Exibir previsões
function displayPredictions(predictions) {
    try {
        // Verificar se temos um container válido
        if (!labelContainer) {
            initLabelContainer();
            if (!labelContainer) return;
        }
        
        // Verificar previsões válidas
        if (!predictions || !Array.isArray(predictions)) {
            throw new Error('Previsões inválidas');
        }
        
        // Ordenar por probabilidade (maior primeiro)
        const sortedPredictions = [...predictions].sort((a, b) => b.probability - a.probability);
        
        // Limpar resultados anteriores
        labelContainer.innerHTML = '';
        
        // Adicionar cada previsão ao container
        sortedPredictions.forEach(pred => {
            if (pred.probability > 0.01) { // Mostrar apenas resultados relevantes
                const predictionElement = createPredictionElement(pred);
                labelContainer.appendChild(predictionElement);
            }
        });
    } catch (error) {
        console.error('Erro ao exibir previsões:', error);
        displayErrorMessage('Erro ao exibir resultados');
    }
}

// Criar elemento de previsão individual
function createPredictionElement(prediction) {
    const element = document.createElement('div');
    element.className = 'prediction-item';
    
    // Barra de progresso visual
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.style.width = `${prediction.probability * 100}%`;
    
    // Container do texto
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

// Formatar nome do material para exibição
function formatMaterialName(className) {
    // Converter de "nome_do_material" para "Nome do material"
    return className.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Limpar resultados
function clearResults() {
    if (labelContainer) {
        labelContainer.innerHTML = '<div class="empty-message">Aguardando análise...</div>';
    }
}

// Mostrar mensagem de erro
function displayErrorMessage(message) {
    if (labelContainer) {
        labelContainer.innerHTML = `<div class="error-message">${message}</div>`;
    } else {
        alert(message);
    }
}

// Mostrar/ocultar indicador de carregamento
function showLoading(show) {
    const loadingIndicator = document.getElementById('loading-indicator') || createLoadingIndicator();
    
    if (show) {
        loadingIndicator.style.display = 'block';
        if (labelContainer) {
            labelContainer.innerHTML = '<div class="loading-message">Analisando...</div>';
        }
    } else {
        loadingIndicator.style.display = 'none';
    }
}

// Criar indicador de carregamento se não existir
function createLoadingIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'loading-indicator';
    indicator.className = 'loading-indicator';
    indicator.innerHTML = '<div class="spinner"></div>';
    indicator.style.display = 'none';
    
    document.body.appendChild(indicator);
    return indicator;
}
// ============================================
// GOOGLE SHEETS INTEGRATION - ORÇAMENTOS
// Carrega apenas os dados do cardápio (leitura)
// ============================================

const SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbxs3-BUH6JeWt5cXF_ZWmoh9fibYV2qPdGLoM8zbC6Sg2pcV005GHKkDwUUSqHCUtqC/exec';

// Chave única para cache
const CACHE_VERSION = 'v3';
const CACHE_KEY = `doceGestaoData_${CACHE_VERSION}`;

// Configurações
const CONFIG = {
    LOAD_TIMEOUT: 10000, // 10 segundos
    CACHE_MAX_AGE: 180000 // 3 minutos
};

// ============================================
// CARREGAR DADOS DO GOOGLE SHEETS
// ============================================

async function loadMenuFromSheets(showLoading = true) {
    try {
        const cacheBuster = Date.now();
        const callbackName = 'loadMenuData_' + cacheBuster;

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error('Timeout ao carregar'));
            }, CONFIG.LOAD_TIMEOUT);

            window[callbackName] = function(data) {
                clearTimeout(timeout);
                cleanup();

                if (data && data.success) {
                    // Atualizar estado
                    if (data.settings) state.settings = data.settings;
                    if (data.categories) state.categories = data.categories;
                    if (data.items) state.menuItems = data.items;

                    // Salvar no localStorage
                    saveToLocalStorage({
                        settings: state.settings,
                        categories: state.categories,
                        items: state.menuItems,
                        timestamp: new Date().toISOString()
                    });

                    console.log('✅ Cardápio carregado do Sheets');
                    resolve();
                } else {
                    reject(new Error('Dados inválidos'));
                }
            };

            function cleanup() {
                if (window[callbackName]) delete window[callbackName];
                if (script && script.parentNode) script.parentNode.removeChild(script);
            }

            const script = document.createElement('script');
            script.src = `${SHEETS_API_URL}?callback=${callbackName}&_=${cacheBuster}`;
            script.onerror = () => {
                clearTimeout(timeout);
                cleanup();
                reject(new Error('Erro ao carregar script'));
            };

            document.head.appendChild(script);
        });

    } catch (error) {
        console.error('⚠️ Não foi possível carregar do Sheets:', error);
        throw error;
    }
}

// ============================================
// LOCAL STORAGE
// ============================================

function saveToLocalStorage(data) {
    try {
        data.cacheVersion = CACHE_VERSION;
        data.lastAccess = Date.now();
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        console.log('💾 Backup local salvo');
    } catch (error) {
        console.error('❌ Erro ao salvar localmente:', error);
    }
}

function loadFromLocalStorage() {
    try {
        // Limpar versões antigas
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('doceGestaoData') && key !== CACHE_KEY) {
                localStorage.removeItem(key);
            }
        }

        const saved = localStorage.getItem(CACHE_KEY);
        if (!saved) {
            console.log('ℹ️ Nenhum cache válido encontrado');
            return false;
        }

        const data = JSON.parse(saved);

        // Verificar versão
        if (data.cacheVersion !== CACHE_VERSION) {
            console.log('⚠️ Versão do cache incompatível');
            localStorage.removeItem(CACHE_KEY);
            return false;
        }

        // Verificar idade dos dados
        if (data.timestamp) {
            const savedTime = new Date(data.timestamp);
            const now = new Date();
            const ageInMs = now - savedTime;

            if (ageInMs > CONFIG.CACHE_MAX_AGE) {
                console.log('⚠️ Cache expirado');
                return false;
            }
        }

        // Carregar dados do cache
        if (data.settings) state.settings = data.settings;
        if (data.categories) state.categories = data.categories;
        if (data.items) state.menuItems = data.items;

        console.log('💾 Cache válido carregado');
        return true;

    } catch (error) {
        console.error('❌ Erro ao carregar cache:', error);
        localStorage.removeItem(CACHE_KEY);
        return false;
    }
}

// ============================================
// MOSTRAR/ESCONDER LOADING
// ============================================

function showLoading() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.classList.remove('hidden');
    }
}

function hideLoading() {
    const loadingScreen = document.getElementById('loadingScreen');
    const mainContainer = document.querySelector('.main-container');

    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
    }

    if (mainContainer) {
        mainContainer.style.opacity = '1';
        mainContainer.style.transition = 'opacity 0.5s ease';
    }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

async function initializeOrcamentos() {
    console.log('🚀 Iniciando página de orçamentos...');

    showLoading();

    // Tentar carregar do Sheets primeiro
    let loadedFromSheets = false;

    try {
        console.log('☁️ Tentando carregar do Google Sheets...');

        await Promise.race([
            loadMenuFromSheets(false),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), CONFIG.LOAD_TIMEOUT)
            )
        ]);

        loadedFromSheets = true;
        console.log('✅ Dados carregados do Sheets com sucesso');

    } catch (error) {
        console.warn('⚠️ Falha ao carregar do Sheets:', error.message);

        // Fallback: tentar cache local
        const hasCache = loadFromLocalStorage();

        if (hasCache) {
            console.log('💾 Usando cache local como fallback');
        } else {
            console.log('ℹ️ Nenhum cache disponível');
        }
    }

    // Atualizar interface
    updateUI();

    // Esconder loading
    setTimeout(hideLoading, loadedFromSheets ? 500 : 1000);

    console.log('✨ Sistema de orçamentos inicializado');
}

// ============================================
// INICIAR
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializeOrcamentos, 100);
    });
} else {
    setTimeout(initializeOrcamentos, 100);
}
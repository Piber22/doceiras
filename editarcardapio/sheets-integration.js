// ============================================
// GOOGLE SHEETS INTEGRATION V3
// SOLUÇÃO DEFINITIVA: Cache-busting + Loading Screen
// ============================================

const SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbygCVqFvTAbGijU4FYXbR4qOECP0P1XoYSRYVwWX1z-U3mimlS5Y-UNZv2oD4Dc86Gc/exec';

// Chave única para versão do cache
const CACHE_VERSION = 'v3';
const CACHE_KEY = `doceGestaoData_${CACHE_VERSION}`;

// Estado de sincronização
let syncStatus = {
    isSyncing: false,
    lastSaved: null,
    lastLoaded: null,
    hasUnsavedChanges: false,
    saveTimeout: null,
    saveQueue: []
};

// Configurações
const CONFIG = {
    AUTO_SYNC_INTERVAL: 30000, // 30 segundos
    CACHE_MAX_AGE: 180000, // 3 minutos
    LOAD_TIMEOUT: 10000, // 10 segundos
    FORCE_RELOAD_INTERVAL: 86400000 // 24 horas
};

// ============================================
// SALVAR DADOS NO GOOGLE SHEETS
// ============================================

async function saveToSheets() {
    if (syncStatus.isSyncing) {
        console.log('⏳ Já está salvando, adicionando à fila...');
        syncStatus.saveQueue.push(Date.now());
        return;
    }

    try {
        syncStatus.isSyncing = true;

        const dataToSave = {
            type: 'saveAll',
            settings: state.settings,
            categories: state.categories,
            items: state.items,
            timestamp: new Date().toISOString()
        };

        // Salvar no localStorage primeiro (garantia)
        saveToLocalStorage(dataToSave);

        // Enviar para Google Sheets com cache-busting
        await fetch(`${SHEETS_API_URL}?_=${Date.now()}`, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dataToSave)
        });

        syncStatus.lastSaved = new Date();
        syncStatus.hasUnsavedChanges = false;

        console.log('✅ Dados salvos às', syncStatus.lastSaved.toLocaleTimeString());

        // Processar fila
        if (syncStatus.saveQueue.length > 0) {
            syncStatus.saveQueue = [];
            setTimeout(() => saveToSheets(), 1000);
        }

    } catch (error) {
        console.error('❌ Erro ao salvar:', error);

    } finally {
        syncStatus.isSyncing = false;
    }
}

// ============================================
// CARREGAR DO SHEETS (PRIORIDADE)
// ============================================

async function loadFromSheets(showLoading = true) {
    try {
        // Adicionar parâmetro de cache-busting
        const cacheBuster = Date.now();
        const callbackName = 'loadSheetsData_' + cacheBuster;

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
                    if (data.items) state.items = data.items;

                    // Re-renderizar
                    updateUI();

                    // Salvar no localStorage
                    saveToLocalStorage({
                        settings: state.settings,
                        categories: state.categories,
                        items: state.items,
                        timestamp: new Date().toISOString()
                    });

                    syncStatus.lastLoaded = new Date();
                    console.log('✅ Dados carregados do Sheets');
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
            // Cache-busting na URL
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
// LOCAL STORAGE COM VALIDAÇÃO
// ============================================

function saveToLocalStorage(data) {
    try {
        data.cacheVersion = CACHE_VERSION;
        data.lastAccess = Date.now();
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        console.log('💾 Backup local salvo (versão:', CACHE_VERSION + ')');
    } catch (error) {
        console.error('❌ Erro ao salvar localmente:', error);
    }
}

function loadFromLocalStorage() {
    try {
        // Limpar versões antigas do cache
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('doceGestaoData') && key !== CACHE_KEY) {
                localStorage.removeItem(key);
                console.log('🧹 Cache antigo removido:', key);
            }
        }

        const saved = localStorage.getItem(CACHE_KEY);
        if (!saved) {
            console.log('ℹ️ Nenhum cache válido encontrado');
            return false;
        }

        const data = JSON.parse(saved);

        // Verificar versão do cache
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
            const ageInMinutes = ageInMs / 1000 / 60;

            console.log(`💾 Cache tem ${ageInMinutes.toFixed(1)} minutos`);

            // Cache expirado
            if (ageInMs > CONFIG.CACHE_MAX_AGE) {
                console.log('⚠️ Cache expirado (>3 min)');
                return false;
            }
        }

        // Verificar último acesso (força reload após 24h)
        if (data.lastAccess) {
            const timeSinceAccess = Date.now() - data.lastAccess;
            if (timeSinceAccess > CONFIG.FORCE_RELOAD_INTERVAL) {
                console.log('⚠️ Forçando reload após 24h');
                localStorage.removeItem(CACHE_KEY);
                return false;
            }
        }

        // Carregar dados do cache
        if (data.settings) state.settings = data.settings;
        if (data.categories) state.categories = data.categories;
        if (data.items) state.items = data.items;

        const timestamp = new Date(data.timestamp).toLocaleString();
        console.log('💾 Cache válido carregado:', timestamp);

        return true;

    } catch (error) {
        console.error('❌ Erro ao carregar cache:', error);
        localStorage.removeItem(CACHE_KEY);
        return false;
    }
}

// ============================================
// ATUALIZAR INTERFACE
// ============================================

function updateUI() {
    renderCategories();
    renderItemsList();
    renderPreview();

    document.getElementById('inputTitle').value = state.settings.title;
    document.getElementById('inputSubtitle').value = state.settings.subtitle;
    document.getElementById('inputContact').value = state.settings.contact;

    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === state.settings.themeColor);
    });

    // Atualizar última visualização
    updateLastAccess();
}

// Atualizar timestamp de último acesso
function updateLastAccess() {
    try {
        const saved = localStorage.getItem(CACHE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            data.lastAccess = Date.now();
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        }
    } catch (e) {
        console.error('Erro ao atualizar último acesso:', e);
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
// AUTO-SAVE
// ============================================

function scheduleAutoSave() {
    syncStatus.hasUnsavedChanges = true;

    if (syncStatus.saveTimeout) {
        clearTimeout(syncStatus.saveTimeout);
    }

    syncStatus.saveTimeout = setTimeout(() => {
        saveToSheets();
    }, 2000);
}

// ============================================
// AUTO-SYNC (VERIFICAR ATUALIZAÇÕES)
// ============================================

function startAutoSync() {
    // Verificar atualizações periodicamente
    setInterval(async () => {
        // Só sincronizar se não estiver editando
        if (!syncStatus.hasUnsavedChanges && !syncStatus.isSyncing) {
            try {
                await loadFromSheets(false);
                console.log('🔄 Auto-sync: Dados atualizados');
            } catch (e) {
                console.log('⚠️ Auto-sync: Falha silenciosa');
            }
        }
    }, CONFIG.AUTO_SYNC_INTERVAL);
}

// ============================================
// SYNC AO FOCAR NA ABA
// ============================================

function setupVisibilitySync() {
    document.addEventListener('visibilitychange', async () => {
        if (!document.hidden && !syncStatus.hasUnsavedChanges) {
            console.log('👀 Aba focada, verificando atualizações...');
            try {
                await loadFromSheets(false);
            } catch (e) {
                console.log('⚠️ Falha ao sincronizar');
            }
        }
    });
}

// ============================================
// INICIALIZAÇÃO INTELIGENTE V3
// ============================================

async function initializeSheetsIntegration() {
    console.log('🚀 Iniciando Doce Gestão v3...');

    // Mostrar loading screen
    showLoading();

    // Limpar caches antigos de outras versões
    clearOldCaches();

    // ESTRATÉGIA: Sempre tentar Sheets primeiro
    let loadedFromSheets = false;

    try {
        console.log('☁️ Tentando carregar do Google Sheets...');

        // Timeout mais curto
        await Promise.race([
            loadFromSheets(false),
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
            updateUI();
        } else {
            console.log('ℹ️ Nenhum cache disponível, usando dados padrão');
        }
    }

    // Configurar auto-save e listeners
    setupEventListeners();
    overrideOriginalFunctions();
    startAutoSync();
    setupVisibilitySync();

    // Esconder loading após tudo carregar
    setTimeout(hideLoading, loadedFromSheets ? 500 : 1000);

    console.log('✨ Sistema inicializado com sucesso');
}

// Limpar caches de versões antigas
function clearOldCaches() {
    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('doceGestaoData') && key !== CACHE_KEY) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log('🧹 Cache antigo removido:', key);
        });
    } catch (e) {
        console.error('Erro ao limpar caches:', e);
    }
}

// ============================================
// EVENT LISTENERS E OVERRIDES
// ============================================

function setupEventListeners() {
    ['inputTitle', 'inputSubtitle', 'inputContact'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', scheduleAutoSave);
    });

    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', scheduleAutoSave);
    });
}

function overrideOriginalFunctions() {
    const original = {
        addCategory: window.addCategory,
        updateCategory: window.updateCategory,
        removeCategory: window.removeCategory,
        removeItem: window.removeItem,
        handleSaveItem: window.handleSaveItem
    };

    window.addCategory = function() {
        original.addCategory();
        scheduleAutoSave();
    };

    window.updateCategory = function(id, name) {
        original.updateCategory(id, name);
        scheduleAutoSave();
    };

    window.removeCategory = function(id) {
        original.removeCategory(id);
        scheduleAutoSave();
    };

    window.removeItem = function(id) {
        original.removeItem(id);
        scheduleAutoSave();
    };

    window.handleSaveItem = function(e) {
        original.handleSaveItem(e);
        scheduleAutoSave();
    };

    document.getElementById('itemsList')?.addEventListener('drop', () => {
        setTimeout(scheduleAutoSave, 500);
    });
}

// ============================================
// INICIAR
// ============================================

// Aguardar DOM carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializeSheetsIntegration, 100);
    });
} else {
    setTimeout(initializeSheetsIntegration, 100);
}
// ============================================
// GOOGLE SHEETS INTEGRATION V4
// SEMPRE PRIORIZA SHEETS - SEM CACHE LOCAL
// ============================================

const SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbxfZRwumUk1HhRfnimEGMTvOymqObpgDV5TaUWQPqe1tAhgKjGDLkOHCiWQMd0dDKyx/exec';

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
    LOAD_TIMEOUT: 15000, // 15 segundos
    SAVE_RETRY_ATTEMPTS: 2,
    RETRY_DELAY_MS: 1000
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

    // Verificar conexão
    if (!navigator.onLine) {
        console.warn('📴 Sem conexão - dados não salvos no servidor');
        syncStatus.hasUnsavedChanges = true;
        return;
    }

    try {
        syncStatus.isSyncing = true;
        console.log('💾 Iniciando salvamento no Google Sheets...');

        const dataToSave = {
            type: 'saveAll',
            settings: state.settings,
            categories: state.categories,
            items: state.items,
            timestamp: new Date().toISOString()
        };

        console.log('📤 Dados a serem enviados:', {
            categorias: dataToSave.categories.length,
            itens: dataToSave.items.length,
            timestamp: dataToSave.timestamp
        });

        // Enviar para Google Sheets com retry
        let lastError;
        for (let attempt = 0; attempt < CONFIG.SAVE_RETRY_ATTEMPTS; attempt++) {
            try {
                console.log(`🔄 Tentativa ${attempt + 1}/${CONFIG.SAVE_RETRY_ATTEMPTS}...`);

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

                console.log('✅ Dados salvos com sucesso às', syncStatus.lastSaved.toLocaleTimeString());

                // Processar fila
                if (syncStatus.saveQueue.length > 0) {
                    console.log(`📋 Processando ${syncStatus.saveQueue.length} item(ns) da fila...`);
                    syncStatus.saveQueue = [];
                    setTimeout(() => saveToSheets(), 1000);
                }

                return; // Sucesso

            } catch (error) {
                lastError = error;
                console.warn(`⚠️ Tentativa ${attempt + 1} falhou:`, error.message);

                if (attempt < CONFIG.SAVE_RETRY_ATTEMPTS - 1) {
                    const delay = CONFIG.RETRY_DELAY_MS * (attempt + 1);
                    console.log(`⏱️ Aguardando ${delay}ms antes da próxima tentativa...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError || new Error('Falha em todas as tentativas');

    } catch (error) {
        console.error('❌ Erro ao salvar no Google Sheets:', error);
        console.error('Stack trace:', error.stack);
        syncStatus.hasUnsavedChanges = true;

    } finally {
        syncStatus.isSyncing = false;
    }
}

// ============================================
// CARREGAR DO SHEETS (SEMPRE PRIORIDADE)
// ============================================

async function loadFromSheets() {
    console.log('☁️ Carregando dados do Google Sheets...');

    // ESTRATÉGIA 1: Tentar Fetch API primeiro
    try {
        console.log('🔵 Tentativa 1: Fetch API...');
        const cacheBuster = Date.now();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.LOAD_TIMEOUT);

        const response = await fetch(`${SHEETS_API_URL}?action=getData&_=${cacheBuster}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
            cache: 'no-cache',
            credentials: 'omit',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();

            if (data && data.success) {
                console.log('✅ Dados recebidos via Fetch API:', {
                    categorias: data.categories?.length || 0,
                    itens: data.items?.length || 0,
                    timestamp: data.timestamp
                });

                // Atualizar estado
                if (data.settings) state.settings = data.settings;
                if (data.categories) state.categories = data.categories;
                if (data.items) state.items = data.items;

                updateUI();
                syncStatus.lastLoaded = new Date();
                console.log('✅ Interface atualizada com sucesso');
                return;
            }
        }
    } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
            console.warn('⚠️ Fetch API - Timeout após', CONFIG.LOAD_TIMEOUT, 'ms');
        } else {
            console.warn('⚠️ Fetch API falhou:', fetchError.message);
        }
    }

    // ESTRATÉGIA 2: Fallback para JSONP
    console.log('🟡 Tentativa 2: JSONP Fallback...');

    return new Promise((resolve, reject) => {
        const cacheBuster = Date.now();
        const callbackName = 'loadSheetsData_' + cacheBuster;
        let timeoutId;
        let script;

        const cleanup = () => {
            if (timeoutId) clearTimeout(timeoutId);
            if (window[callbackName]) delete window[callbackName];
            if (script && script.parentNode) script.parentNode.removeChild(script);
        };

        // Timeout
        timeoutId = setTimeout(() => {
            cleanup();
            console.error('❌ JSONP - Timeout após', CONFIG.LOAD_TIMEOUT, 'ms');
            reject(new Error('Timeout ao carregar via JSONP'));
        }, CONFIG.LOAD_TIMEOUT);

        // Callback
        window[callbackName] = function(data) {
            cleanup();

            if (data && data.success) {
                console.log('✅ Dados recebidos via JSONP:', {
                    categorias: data.categories?.length || 0,
                    itens: data.items?.length || 0,
                    timestamp: data.timestamp
                });

                // Atualizar estado
                if (data.settings) state.settings = data.settings;
                if (data.categories) state.categories = data.categories;
                if (data.items) state.items = data.items;

                updateUI();
                syncStatus.lastLoaded = new Date();
                console.log('✅ Interface atualizada com sucesso');
                resolve();
            } else {
                console.error('❌ Dados inválidos recebidos:', data);
                reject(new Error('Dados inválidos'));
            }
        };

        // Criar script
        script = document.createElement('script');
        script.src = `${SHEETS_API_URL}?callback=${callbackName}&_=${cacheBuster}`;
        script.setAttribute('crossorigin', 'anonymous');

        script.onerror = (error) => {
            cleanup();
            console.error('❌ Erro ao carregar script JSONP:', error);
            reject(new Error('Erro ao carregar script: Network error'));
        };

        console.log('📡 Carregando via JSONP:', script.src);
        document.head.appendChild(script);
    });
}

// ============================================
// ATUALIZAR INTERFACE
// ============================================

function updateUI() {
    console.log('🎨 Atualizando interface...');

    renderCategories();
    renderItemsList();
    renderPreview();

    document.getElementById('inputTitle').value = state.settings.title;
    document.getElementById('inputSubtitle').value = state.settings.subtitle;
    document.getElementById('inputContact').value = state.settings.contact;

    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === state.settings.themeColor);
    });

    console.log('✅ Interface atualizada');
}

// ============================================
// AUTO-SAVE
// ============================================

function scheduleAutoSave() {
    syncStatus.hasUnsavedChanges = true;

    if (syncStatus.saveTimeout) {
        clearTimeout(syncStatus.saveTimeout);
    }

    console.log('⏱️ Auto-save agendado para 2 segundos...');

    syncStatus.saveTimeout = setTimeout(() => {
        saveToSheets();
    }, 2000);
}

// ============================================
// AUTO-SYNC (VERIFICAR ATUALIZAÇÕES)
// ============================================

function startAutoSync() {
    console.log('🔄 Auto-sync iniciado (intervalo:', CONFIG.AUTO_SYNC_INTERVAL / 1000, 'segundos)');

    setInterval(async () => {
        // Só sincronizar se não estiver editando
        if (!syncStatus.hasUnsavedChanges && !syncStatus.isSyncing && navigator.onLine) {
            console.log('🔄 Auto-sync: Verificando atualizações...');
            try {
                await loadFromSheets();
            } catch (e) {
                console.warn('⚠️ Auto-sync falhou (silencioso):', e.message);
            }
        }
    }, CONFIG.AUTO_SYNC_INTERVAL);
}

// ============================================
// SYNC AO FOCAR NA ABA
// ============================================

function setupVisibilitySync() {
    document.addEventListener('visibilitychange', async () => {
        if (!document.hidden && !syncStatus.hasUnsavedChanges && navigator.onLine) {
            console.log('👀 Aba focada, verificando atualizações...');
            try {
                await loadFromSheets();
            } catch (e) {
                console.warn('⚠️ Falha ao sincronizar ao focar aba:', e.message);
            }
        }
    });
}

// ============================================
// SYNC AO VOLTAR ONLINE
// ============================================

function setupOnlineSync() {
    window.addEventListener('online', async () => {
        console.log('🌐 Conexão restaurada!');

        // Salvar mudanças pendentes primeiro
        if (syncStatus.hasUnsavedChanges) {
            console.log('📤 Salvando mudanças pendentes...');
            await saveToSheets();
        }

        // Depois carregar atualizações
        try {
            console.log('📥 Carregando atualizações...');
            await loadFromSheets();
        } catch (e) {
            console.warn('⚠️ Falha na sincronização após reconexão:', e.message);
        }
    });

    window.addEventListener('offline', () => {
        console.warn('📴 Conexão perdida - trabalhando offline');
        console.warn('⚠️ Mudanças não serão salvas no servidor até reconectar');
    });
}

// ============================================
// MOSTRAR/ESCONDER LOADING
// ============================================

function showLoading() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.classList.remove('hidden');
        console.log('⏳ Loading screen exibido');
    }
}

function hideLoading() {
    const loadingScreen = document.getElementById('loadingScreen');
    const mainContainer = document.querySelector('.main-container');

    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
        console.log('✅ Loading screen ocultado');
    }

    if (mainContainer) {
        mainContainer.style.opacity = '1';
        mainContainer.style.transition = 'opacity 0.5s ease';
    }
}

// ============================================
// INICIALIZAÇÃO - SEMPRE SHEETS PRIMEIRO
// ============================================

async function initializeSheetsIntegration() {
    console.log('═══════════════════════════════════════');
    console.log('🚀 INICIANDO DOCE GESTÃO V4');
    console.log('═══════════════════════════════════════');
    console.log('📅 Data/Hora:', new Date().toLocaleString());
    console.log('🌐 Online:', navigator.onLine);
    console.log('📱 User Agent:', navigator.userAgent);
    console.log('═══════════════════════════════════════');

    showLoading();

    // SEMPRE tentar carregar do Google Sheets primeiro
    try {
        console.log('☁️ PRIORIDADE: Carregando do Google Sheets...');

        await Promise.race([
            loadFromSheets(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout global')), CONFIG.LOAD_TIMEOUT)
            )
        ]);

        console.log('✅ Dados carregados com sucesso do Google Sheets');

    } catch (error) {
        console.error('═══════════════════════════════════════');
        console.error('❌ FALHA CRÍTICA AO CARREGAR DO SHEETS');
        console.error('═══════════════════════════════════════');
        console.error('Erro:', error.message);
        console.error('Stack:', error.stack);
        console.error('═══════════════════════════════════════');

        // Usar dados padrão se falhar completamente
        console.warn('⚠️ Usando dados padrão do sistema');
        updateUI();

        // Alertar usuário apenas se online
        if (navigator.onLine) {
            setTimeout(() => {
                alert('⚠️ Não foi possível conectar ao servidor.\n\nVerifique sua conexão e recarregue a página.');
            }, 500);
        }
    }

    // Configurar eventos e auto-sync
    console.log('⚙️ Configurando event listeners...');
    setupEventListeners();
    overrideOriginalFunctions();

    if (navigator.onLine) {
        startAutoSync();
    }

    setupVisibilitySync();
    setupOnlineSync();

    hideLoading();

    console.log('═══════════════════════════════════════');
    console.log('✨ SISTEMA INICIALIZADO COM SUCESSO');
    console.log('═══════════════════════════════════════');
}

// ============================================
// EVENT LISTENERS E OVERRIDES
// ============================================

function setupEventListeners() {
    ['inputTitle', 'inputSubtitle', 'inputContact'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', () => {
                console.log('📝 Campo alterado:', id);
                scheduleAutoSave();
            });
        }
    });

    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            console.log('🎨 Cor alterada para:', btn.dataset.color);
            scheduleAutoSave();
        });
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
        console.log('➕ Categoria adicionada');
        original.addCategory();
        scheduleAutoSave();
    };

    window.updateCategory = function(id, name) {
        console.log('✏️ Categoria atualizada:', id, name);
        original.updateCategory(id, name);
        scheduleAutoSave();
    };

    window.removeCategory = function(id) {
        console.log('🗑️ Categoria removida:', id);
        original.removeCategory(id);
        scheduleAutoSave();
    };

    window.removeItem = function(id) {
        console.log('🗑️ Item removido:', id);
        original.removeItem(id);
        scheduleAutoSave();
    };

    window.handleSaveItem = function(e) {
        console.log('💾 Item salvo/editado');
        original.handleSaveItem(e);
        scheduleAutoSave();
    };
}

// ============================================
// INICIAR QUANDO DOM CARREGAR
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializeSheetsIntegration, 100);
    });
} else {
    setTimeout(initializeSheetsIntegration, 100);
}
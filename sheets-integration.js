// ============================================
// GOOGLE SHEETS INTEGRATION V2
// Melhorias: Sempre tenta Sheets primeiro + Validação de cache + Auto-sync
// ============================================

const SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbxs3-BUH6JeWt5cXF_ZWmoh9fibYV2qPdGLoM8zbC6Sg2pcV005GHKkDwUUSqHCUtqC/exec';

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
    CACHE_MAX_AGE: 300000, // 5 minutos
    LOAD_TIMEOUT: 15000 // 15 segundos
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
        showSyncStatus('Salvando...', 'saving');

        const dataToSave = {
            type: 'saveAll',
            settings: state.settings,
            categories: state.categories,
            items: state.items,
            timestamp: new Date().toISOString()
        };

        // Salvar no localStorage primeiro (garantia)
        saveToLocalStorage(dataToSave);

        // Enviar para Google Sheets
        await fetch(SHEETS_API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dataToSave)
        });

        syncStatus.lastSaved = new Date();
        syncStatus.hasUnsavedChanges = false;

        showSyncStatus('✓ Salvo', 'success');
        console.log('✅ Dados salvos às', syncStatus.lastSaved.toLocaleTimeString());

        // Processar fila
        if (syncStatus.saveQueue.length > 0) {
            syncStatus.saveQueue = [];
            setTimeout(() => saveToSheets(), 1000);
        }

    } catch (error) {
        console.error('❌ Erro ao salvar:', error);
        showSyncStatus('⚠ Erro ao salvar', 'error');

    } finally {
        syncStatus.isSyncing = false;
    }
}

// ============================================
// CARREGAR DO SHEETS (PRIORIDADE)
// ============================================

async function loadFromSheets(showLoading = true) {
    try {
        if (showLoading) {
            showSyncStatus('Carregando...', 'loading');
        }

        const callbackName = 'loadSheetsData_' + Date.now();

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
                    
                    if (showLoading) {
                        showSyncStatus('✓ Atualizado', 'success');
                    }
                    
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
            script.src = `${SHEETS_API_URL}?callback=${callbackName}&t=${Date.now()}`;
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
        localStorage.setItem('doceGestaoData', JSON.stringify(data));
        console.log('💾 Backup local salvo');
    } catch (error) {
        console.error('❌ Erro ao salvar localmente:', error);
    }
}

function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('doceGestaoData');
        if (!saved) {
            console.log('ℹ️ Nenhum dado local encontrado');
            return false;
        }

        const data = JSON.parse(saved);

        // NOVO: Verificar idade dos dados
        if (data.timestamp) {
            const savedTime = new Date(data.timestamp);
            const now = new Date();
            const ageInMs = now - savedTime;
            const ageInMinutes = ageInMs / 1000 / 60;

            console.log(`💾 Dados locais têm ${ageInMinutes.toFixed(1)} minutos`);

            // Se dados têm mais de 5 minutos, são considerados antigos
            if (ageInMs > CONFIG.CACHE_MAX_AGE) {
                console.log('⚠️ Dados locais desatualizados (>5 min)');
                return false; // Forçar reload do Sheets
            }
        }

        // Carregar dados locais
        if (data.settings) state.settings = data.settings;
        if (data.categories) state.categories = data.categories;
        if (data.items) state.items = data.items;

        updateUI();

        const timestamp = new Date(data.timestamp).toLocaleString();
        console.log('💾 Dados locais carregados:', timestamp);
        
        return true;

    } catch (error) {
        console.error('❌ Erro ao carregar dados locais:', error);
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
}

// ============================================
// AUTO-SAVE
// ============================================

function scheduleAutoSave() {
    syncStatus.hasUnsavedChanges = true;
    showSyncStatus('Não salvo...', 'warning');

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
        // Só sincronizar se não estiver editando (sem mudanças não salvas)
        if (!syncStatus.hasUnsavedChanges && !syncStatus.isSyncing) {
            try {
                await loadFromSheets(false); // Sem mostrar loading
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
// BOTÃO DE REFRESH MANUAL
// ============================================

function addRefreshButton() {
    const header = document.querySelector('.header-container');
    
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'btn-primary';
    refreshBtn.style.marginLeft = '8px';
    refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
    refreshBtn.title = 'Atualizar dados do servidor';
    
    refreshBtn.addEventListener('click', async () => {
        const icon = refreshBtn.querySelector('i');
        icon.classList.add('fa-spin');
        
        try {
            await loadFromSheets(true);
        } catch (e) {
            alert('Não foi possível carregar do servidor. Tente novamente.');
        }
        
        icon.classList.remove('fa-spin');
    });
    
    header.appendChild(refreshBtn);
}

// ============================================
// INDICADOR VISUAL
// ============================================

function createSyncIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'syncIndicator';
    indicator.style.cssText = `
        position: fixed;
        top: 70px;
        right: 20px;
        background: white;
        padding: 8px 16px;
        border-radius: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        font-size: 12px;
        font-weight: bold;
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 1000;
        transition: all 0.3s;
        border: 1px solid #e5e7eb;
        cursor: pointer;
    `;

    indicator.innerHTML = `
        <i class="fas fa-cloud" style="font-size: 14px;"></i>
        <span id="syncText">Inicializando...</span>
    `;

    indicator.addEventListener('click', showDetailedStatus);
    document.body.appendChild(indicator);
}

function showSyncStatus(message, type = 'info') {
    const indicator = document.getElementById('syncIndicator');
    if (!indicator) return;

    const text = document.getElementById('syncText');
    const icon = indicator.querySelector('i');

    text.textContent = message;

    indicator.style.background = 'white';
    indicator.style.color = '#6b7280';
    indicator.style.borderColor = '#e5e7eb';

    switch(type) {
        case 'success':
            indicator.style.background = '#dcfce7';
            indicator.style.color = '#16a34a';
            indicator.style.borderColor = '#86efac';
            icon.className = 'fas fa-check-circle';

            setTimeout(() => {
                if (text.textContent === message) {
                    indicator.style.opacity = '0.7';
                    text.textContent = 'Online';
                    icon.className = 'fas fa-cloud';
                }
            }, 3000);
            break;

        case 'error':
            indicator.style.background = '#fee2e2';
            indicator.style.color = '#dc2626';
            indicator.style.borderColor = '#fca5a5';
            icon.className = 'fas fa-exclamation-circle';
            break;

        case 'warning':
            indicator.style.background = '#fef3c7';
            indicator.style.color = '#d97706';
            indicator.style.borderColor = '#fcd34d';
            icon.className = 'fas fa-exclamation-triangle';
            break;

        case 'saving':
        case 'loading':
            indicator.style.background = '#dbeafe';
            indicator.style.color = '#2563eb';
            indicator.style.borderColor = '#93c5fd';
            icon.className = 'fas fa-spinner fa-spin';
            break;

        default:
            icon.className = 'fas fa-cloud';
    }
}

function showDetailedStatus() {
    const lastSaved = syncStatus.lastSaved 
        ? syncStatus.lastSaved.toLocaleTimeString() 
        : 'Nunca';
    
    const lastLoaded = syncStatus.lastLoaded
        ? syncStatus.lastLoaded.toLocaleTimeString()
        : 'Nunca';

    const unsaved = syncStatus.hasUnsavedChanges ? 'Sim' : 'Não';

    alert(`📊 Status de Sincronização\n\n` +
          `Último carregamento: ${lastLoaded}\n` +
          `Último salvamento: ${lastSaved}\n` +
          `Alterações não salvas: ${unsaved}\n` +
          `Fila de salvamentos: ${syncStatus.saveQueue.length}\n\n` +
          `🔄 Auto-sync: Ativo (30s)\n` +
          `💾 Backup local: Ativo`);
}

// ============================================
// INICIALIZAÇÃO INTELIGENTE
// ============================================

async function initializeSheetsIntegration() {
    console.log('🔄 Inicializando sistema de sincronização V2...');

    createSyncIndicator();

    // Verificar URL
    if (SHEETS_API_URL === 'COLE_SUA_URL_AQUI') {
        console.warn('⚠️ URL do Google Sheets não configurada!');
        showSyncStatus('Apenas local', 'warning');
        loadFromLocalStorage();
        return;
    }

    // ESTRATÉGIA: Tentar Sheets primeiro, usar cache como fallback
    try {
        // 1. Verificar se há dados locais válidos (< 5 min)
        const hasValidCache = loadFromLocalStorage();

        if (hasValidCache) {
            console.log('✅ Cache válido encontrado, usando temporariamente');
            showSyncStatus('Cache válido', 'info');
        }

        // 2. SEMPRE tentar carregar do Sheets (em background se tiver cache)
        console.log('🌐 Tentando carregar do Google Sheets...');
        await loadFromSheets(!hasValidCache); // Só mostra loading se não tiver cache

        console.log('✅ Dados sincronizados com sucesso!');

    } catch (error) {
        console.error('⚠️ Falha ao carregar do Sheets:', error);
        
        // Se não conseguiu do Sheets, tentar localStorage (sem validação de idade)
        const saved = localStorage.getItem('doceGestaoData');
        if (saved) {
            console.log('💾 Usando dados locais como fallback');
            const data = JSON.parse(saved);
            if (data.settings) state.settings = data.settings;
            if (data.categories) state.categories = data.categories;
            if (data.items) state.items = data.items;
            updateUI();
            showSyncStatus('Modo offline', 'warning');
        } else {
            console.log('❌ Nenhum dado disponível');
            showSyncStatus('Sem dados', 'error');
        }
    }

    // Configurar listeners
    setupEventListeners();
    overrideOriginalFunctions();
    
    // Iniciar recursos avançados
    startAutoSync();
    setupVisibilitySync();
    addRefreshButton();

    console.log('✅ Sistema V2 ativo!');
    console.log('🔄 Auto-sync: 30 segundos');
    console.log('👀 Sync ao focar: Ativo');
    console.log('⏱️ Cache válido: 5 minutos');
}

// ============================================
// EVENT LISTENERS
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

setTimeout(() => {
    initializeSheetsIntegration();
}, 500);

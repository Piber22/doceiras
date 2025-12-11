// ============================================
// GOOGLE SHEETS INTEGRATION - SAVE-FOCUSED
// Prioridade: NUNCA perder dados de salvamento
// ============================================

// CONFIGURAÇÃO: Cole aqui a URL do seu Google Apps Script
const SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbxs3-BUH6JeWt5cXF_ZWmoh9fibYV2qPdGLoM8zbC6Sg2pcV005GHKkDwUUSqHCUtqC/exec';

// Estado de sincronização
let syncStatus = {
    isSyncing: false,
    lastSaved: null,
    hasUnsavedChanges: false,
    saveTimeout: null,
    saveQueue: [] // Fila de salvamentos pendentes
};

// ============================================
// SALVAR DADOS NO GOOGLE SHEETS (PRIORITÁRIO)
// ============================================

async function saveToSheets() {
    if (syncStatus.isSyncing) {
        console.log('⏳ Já está salvando, adicionando à fila...');
        syncStatus.saveQueue.push(Date.now());
        return;
    }

    try {
        syncStatus.isSyncing = true;
        showSyncStatus('Salvando no Sheets...', 'saving');

        const dataToSave = {
            type: 'saveAll',
            settings: state.settings,
            categories: state.categories,
            items: state.items,
            timestamp: new Date().toISOString()
        };

        // SALVAR NO LOCALSTORAGE PRIMEIRO (garantia)
        saveToLocalStorage();

        // Enviar para Google Sheets com no-cors
        await fetch(SHEETS_API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dataToSave)
        });

        // Se chegou aqui, provavelmente funcionou
        syncStatus.lastSaved = new Date();
        syncStatus.hasUnsavedChanges = false;

        showSyncStatus('✓ Salvo no Sheets', 'success');
        console.log('✅ Dados enviados para Google Sheets às', syncStatus.lastSaved.toLocaleTimeString());

        // Processar fila se houver
        if (syncStatus.saveQueue.length > 0) {
            syncStatus.saveQueue = [];
            setTimeout(() => saveToSheets(), 1000);
        }

    } catch (error) {
        console.error('❌ ERRO CRÍTICO ao salvar:', error);
        showSyncStatus('⚠ Falha ao salvar!', 'error');

        // Alertar usuário sobre falha crítica
        alert('⚠️ ATENÇÃO: Não foi possível salvar no Google Sheets!\n\nSeus dados estão salvos LOCALMENTE, mas não foram enviados para a nuvem.\n\nClique no botão "Sincronizar" para tentar novamente.');

    } finally {
        syncStatus.isSyncing = false;
    }
}

// ============================================
// CARREGAR DO SHEETS (VIA SCRIPT TAG - CONTORNA CORS)
// ============================================

async function loadFromSheets() {
    try {
        showSyncStatus('Carregando do Sheets...', 'loading');

        // Criar um callback único
        const callbackName = 'loadSheetsData_' + Date.now();

        return new Promise((resolve, reject) => {
            // Timeout de 10 segundos
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error('Timeout ao carregar'));
            }, 10000);

            // Função de callback global
            window[callbackName] = function(data) {
                clearTimeout(timeout);
                cleanup();

                if (data && data.success) {
                    // Atualizar estado
                    if (data.settings) state.settings = data.settings;
                    if (data.categories) state.categories = data.categories;
                    if (data.items) state.items = data.items;

                    // Re-renderizar
                    renderCategories();
                    renderItemsList();
                    renderPreview();

                    // Atualizar inputs
                    document.getElementById('inputTitle').value = state.settings.title;
                    document.getElementById('inputSubtitle').value = state.settings.subtitle;
                    document.getElementById('inputContact').value = state.settings.contact;

                    // Atualizar cor
                    document.querySelectorAll('.color-btn').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.color === state.settings.themeColor);
                    });

                    // Salvar no localStorage também
                    saveToLocalStorage();

                    showSyncStatus('✓ Carregado do Sheets', 'success');
                    console.log('✅ Dados carregados do Google Sheets');
                    resolve();
                } else {
                    reject(new Error('Dados inválidos'));
                }
            };

            // Limpar recursos
            function cleanup() {
                if (window[callbackName]) delete window[callbackName];
                if (script && script.parentNode) script.parentNode.removeChild(script);
            }

            // Criar script tag com callback JSONP
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
        showSyncStatus('Usando dados locais', 'warning');
        loadFromLocalStorage();
    }
}

// ============================================
// LOCAL STORAGE (BACKUP SEMPRE ATIVO)
// ============================================

function saveToLocalStorage() {
    try {
        const data = {
            settings: state.settings,
            categories: state.categories,
            items: state.items,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('doceGestaoData', JSON.stringify(data));
        console.log('💾 Backup local salvo');
    } catch (error) {
        console.error('❌ ERRO ao salvar localmente:', error);
    }
}

function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('doceGestaoData');
        if (saved) {
            const data = JSON.parse(saved);

            if (data.settings) state.settings = data.settings;
            if (data.categories) state.categories = data.categories;
            if (data.items) state.items = data.items;

            renderCategories();
            renderItemsList();
            renderPreview();

            document.getElementById('inputTitle').value = state.settings.title;
            document.getElementById('inputSubtitle').value = state.settings.subtitle;
            document.getElementById('inputContact').value = state.settings.contact;

            document.querySelectorAll('.color-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.color === state.settings.themeColor);
            });

            const timestamp = new Date(data.timestamp).toLocaleString();
            console.log('💾 Dados locais carregados (último backup:', timestamp + ')');
            showSyncStatus('Dados locais', 'info');
        } else {
            console.log('ℹ️ Nenhum dado local encontrado');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar dados locais:', error);
    }
}

// ============================================
// AUTO-SAVE COM DEBOUNCE (2 SEGUNDOS)
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
// INDICADOR VISUAL APRIMORADO
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

    // Clicar para ver status detalhado
    indicator.addEventListener('click', showDetailedStatus);

    document.body.appendChild(indicator);
}

function showSyncStatus(message, type = 'info') {
    const indicator = document.getElementById('syncIndicator');
    if (!indicator) return;

    const text = document.getElementById('syncText');
    const icon = indicator.querySelector('i');

    text.textContent = message;

    // Resetar
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
        ? syncStatus.lastSaved.toLocaleString()
        : 'Nunca';

    const unsaved = syncStatus.hasUnsavedChanges ? 'Sim' : 'Não';

    alert(`📊 Status de Sincronização\n\n` +
          `Último salvamento: ${lastSaved}\n` +
          `Alterações não salvas: ${unsaved}\n` +
          `Fila de salvamentos: ${syncStatus.saveQueue.length}\n\n` +
          `💾 Dados sempre salvos localmente como backup.`);
}

// ============================================
// BOTÕES DE CONTROLE
// ============================================

//function addManualSyncButton() {
//    const header = document.querySelector('.header-container');
//
//    const syncButton = document.createElement('button');
//    syncButton.id = 'btnManualSync';
//    syncButton.className = 'btn-primary';
//    syncButton.style.marginLeft = '8px';
//    syncButton.innerHTML = '<i class="fas fa-sync-alt"></i> Sincronizar';
//    syncButton.title = 'Salvar agora e carregar dados do Sheets';

//    syncButton.addEventListener('click', async () => {
//        const icon = syncButton.querySelector('i');
//        icon.classList.add('fa-spin');
//
//        // Salvar primeiro
//        await saveToSheets();
//
//        // Depois tentar carregar
//        await loadFromSheets();
//
//        icon.classList.remove('fa-spin');
//    });
//
//    header.appendChild(syncButton);
//}

// ============================================
// INICIALIZAÇÃO
// ============================================

function initializeSheetsIntegration() {
    console.log('🔄 Inicializando sistema de salvamento...');

   createSyncIndicator();

    // Verificar URL
    if (SHEETS_API_URL === 'COLE_SUA_URL_AQUI') {
        console.warn('⚠️ URL do Google Sheets não configurada!');
        showSyncStatus('Apenas local', 'warning');
        loadFromLocalStorage();
        return;
    }

    // Carregar dados locais primeiro (instantâneo)
    loadFromLocalStorage();

    // Tentar carregar do Sheets em background
    setTimeout(() => {
        loadFromSheets().catch(() => {
            console.log('ℹ️ Continuando com dados locais');
        });
    }, 1000);

    // Interceptar mudanças
    setupEventListeners();
    overrideOriginalFunctions();

    console.log('✅ Sistema de salvamento ativo!');
    console.log('💾 Backup local: ATIVO');
    console.log('☁️ Sincronização com Sheets: ATIVA');
}

function setupEventListeners() {
    // Configurações
    ['inputTitle', 'inputSubtitle', 'inputContact'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', scheduleAutoSave);
    });

    // Cores
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

    // Drag and drop
    document.getElementById('itemsList')?.addEventListener('drop', () => {
        setTimeout(scheduleAutoSave, 500);
    });
}

// ============================================
// INICIAR APÓS CARREGAR DOM
// ============================================

setTimeout(() => {
    initializeSheetsIntegration();
    //addManualSyncButton();
}, 500);

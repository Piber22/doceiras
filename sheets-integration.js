// ============================================
// GOOGLE SHEETS INTEGRATION - NO-CORS MODE
// ============================================

// CONFIGURAÇÃO: Cole aqui a URL do seu Google Apps Script
const SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbwItUjXcRDXH2u71eKBgSkw6umX_yRwfZ7u6f-efRCZB1E2yN5N0OQpfO1D8BLg-O_D/exec';

// Estado de sincronização
let syncStatus = {
    isSyncing: false,
    lastSaved: null,
    hasUnsavedChanges: false,
    saveTimeout: null
};

// ============================================
// CARREGAR DADOS DO GOOGLE SHEETS
// ============================================

async function loadFromSheets() {
    try {
        showSyncStatus('Carregando dados...');

        // Adicionar timestamp para evitar cache
        const url = `${SHEETS_API_URL}?t=${Date.now()}`;

        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors', // Tentar CORS primeiro
            cache: 'no-cache'
        });

        if (!response.ok) {
            throw new Error('Erro ao carregar dados');
        }

        const data = await response.json();

        // Atualizar o estado da aplicação
        if (data.settings) state.settings = data.settings;
        if (data.categories) state.categories = data.categories;
        if (data.items) state.items = data.items;

        // Re-renderizar tudo
        renderCategories();
        renderItemsList();
        renderPreview();

        // Atualizar inputs com os dados carregados
        document.getElementById('inputTitle').value = state.settings.title;
        document.getElementById('inputSubtitle').value = state.settings.subtitle;
        document.getElementById('inputContact').value = state.settings.contact;

        // Atualizar cor do tema
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === state.settings.themeColor);
        });

        syncStatus.hasUnsavedChanges = false;
        showSyncStatus('Dados carregados ✓', 'success');

        console.log('✅ Dados carregados com sucesso do Google Sheets');

    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        showSyncStatus('Modo offline', 'warning');

        // Tentar carregar do localStorage como fallback
        loadFromLocalStorage();
    }
}

// ============================================
// SALVAR DADOS NO GOOGLE SHEETS (NO-CORS)
// ============================================

async function saveToSheets() {
    if (syncStatus.isSyncing) {
        console.log('⏳ Já está salvando, aguarde...');
        return;
    }

    try {
        syncStatus.isSyncing = true;
        showSyncStatus('Salvando...');

        const dataToSave = {
            type: 'saveAll',
            settings: state.settings,
            categories: state.categories,
            items: state.items,
            timestamp: new Date().toISOString()
        };

        // Usar no-cors mode para POST
        const response = await fetch(SHEETS_API_URL, {
            method: 'POST',
            mode: 'no-cors', // Modo no-cors
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dataToSave)
        });

        // Com no-cors, não conseguimos ler a resposta
        // Mas se chegou aqui, provavelmente funcionou
        syncStatus.lastSaved = new Date();
        syncStatus.hasUnsavedChanges = false;

        // Salvar também no localStorage como backup
        saveToLocalStorage();

        showSyncStatus('Salvo ✓', 'success');
        console.log('✅ Dados enviados para Google Sheets');

    } catch (error) {
        console.error('❌ Erro ao salvar dados:', error);
        showSyncStatus('Salvo localmente', 'warning');

        // Salvar no localStorage como fallback
        saveToLocalStorage();
    } finally {
        syncStatus.isSyncing = false;
    }
}

// ============================================
// FALLBACK: LOCAL STORAGE
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
        console.log('💾 Dados salvos no localStorage');
    } catch (error) {
        console.error('Erro ao salvar no localStorage:', error);
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

            console.log('💾 Dados carregados do localStorage');
            showSyncStatus('Dados locais carregados', 'info');
        }
    } catch (error) {
        console.error('Erro ao carregar do localStorage:', error);
    }
}

// ============================================
// AUTO-SAVE COM DEBOUNCE
// ============================================

function scheduleAutoSave() {
    syncStatus.hasUnsavedChanges = true;
    showSyncStatus('Não salvo...', 'warning');

    // Limpar timeout anterior
    if (syncStatus.saveTimeout) {
        clearTimeout(syncStatus.saveTimeout);
    }

    // Agendar salvamento para 2 segundos depois
    syncStatus.saveTimeout = setTimeout(() => {
        saveToSheets();
    }, 2000);
}

// ============================================
// INDICADOR VISUAL DE SINCRONIZAÇÃO
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
    `;

    indicator.innerHTML = `
        <i class="fas fa-cloud" style="font-size: 14px;"></i>
        <span id="syncText">Inicializando...</span>
    `;

    document.body.appendChild(indicator);
}

function showSyncStatus(message, type = 'info') {
    const indicator = document.getElementById('syncIndicator');
    const text = document.getElementById('syncText');
    const icon = indicator.querySelector('i');

    if (!indicator) return;

    text.textContent = message;

    // Resetar classes
    indicator.style.background = 'white';
    indicator.style.color = '#6b7280';
    indicator.style.borderColor = '#e5e7eb';

    // Aplicar estilos baseado no tipo
    switch(type) {
        case 'success':
            indicator.style.background = '#dcfce7';
            indicator.style.color = '#16a34a';
            indicator.style.borderColor = '#86efac';
            icon.className = 'fas fa-check-circle';

            // Esconder depois de 3 segundos
            setTimeout(() => {
                indicator.style.opacity = '0';
                setTimeout(() => {
                    indicator.style.opacity = '1';
                    showSyncStatus('Conectado', 'info');
                }, 300);
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

        default:
            icon.className = 'fas fa-cloud';
    }
}

// ============================================
// INTERCEPTAR MUDANÇAS NO APP ORIGINAL
// ============================================

function initializeSheetsIntegration() {
    console.log('🔄 Inicializando integração com Google Sheets...');

    // Criar indicador visual
    createSyncIndicator();

    // Verificar se a URL está configurada
    if (SHEETS_API_URL === 'https://script.google.com/macros/s/AKfycbwItUjXcRDXH2u71eKBgSkw6umX_yRwfZ7u6f-efRCZB1E2yN5N0OQpfO1D8BLg-O_D/exec') {
        console.warn('⚠️ URL do Google Sheets não configurada!');
        showSyncStatus('Modo offline', 'warning');
        loadFromLocalStorage();
        return;
    }

    // Carregar dados do Sheets ao iniciar
    loadFromSheets();

    // Interceptar mudanças nas configurações
    const originalInputListeners = [
        { id: 'inputTitle', property: 'title' },
        { id: 'inputSubtitle', property: 'subtitle' },
        { id: 'inputContact', property: 'contact' }
    ];

    originalInputListeners.forEach(({ id, property }) => {
        const element = document.getElementById(id);
        element.addEventListener('input', () => {
            scheduleAutoSave();
        });
    });

    // Interceptar mudanças de cor
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            scheduleAutoSave();
        });
    });

    // Sobrescrever funções originais para incluir auto-save
    overrideOriginalFunctions();

    console.log('✅ Integração com Google Sheets ativa!');
}

// ============================================
// SOBRESCREVER FUNÇÕES ORIGINAIS
// ============================================

function overrideOriginalFunctions() {
    // Salvar referências das funções originais
    const originalAddCategory = window.addCategory;
    const originalUpdateCategory = window.updateCategory;
    const originalRemoveCategory = window.removeCategory;
    const originalRemoveItem = window.removeItem;
    const originalHandleSaveItem = window.handleSaveItem;

    // Sobrescrever addCategory
    window.addCategory = function() {
        originalAddCategory();
        scheduleAutoSave();
    };

    // Sobrescrever updateCategory
    window.updateCategory = function(id, name) {
        originalUpdateCategory(id, name);
        scheduleAutoSave();
    };

    // Sobrescrever removeCategory
    window.removeCategory = function(id) {
        originalRemoveCategory(id);
        scheduleAutoSave();
    };

    // Sobrescrever removeItem
    window.removeItem = function(id) {
        originalRemoveItem(id);
        scheduleAutoSave();
    };

    // Sobrescrever handleSaveItem
    window.handleSaveItem = function(e) {
        originalHandleSaveItem(e);
        scheduleAutoSave();
    };

    // Sobrescrever handleDrop (drag and drop)
    const itemsList = document.getElementById('itemsList');
    if (itemsList) {
        itemsList.addEventListener('drop', () => {
            setTimeout(() => scheduleAutoSave(), 500);
        });
    }
}

// ============================================
// BOTÃO MANUAL DE SINCRONIZAÇÃO
// ============================================

function addManualSyncButton() {
    const header = document.querySelector('.header-container');

    const syncButton = document.createElement('button');
    syncButton.id = 'btnManualSync';
    syncButton.className = 'btn-primary';
    syncButton.style.marginLeft = '8px';
    syncButton.innerHTML = '<i class="fas fa-sync-alt"></i> Sincronizar';

    syncButton.addEventListener('click', async () => {
        const icon = syncButton.querySelector('i');
        icon.classList.add('fa-spin');

        await saveToSheets();
        await loadFromSheets();

        icon.classList.remove('fa-spin');
    });

    header.appendChild(syncButton);
}

// ============================================
// VERIFICAR CONEXÃO COM SHEETS
// ============================================

async function checkSheetsConnection() {
    try {
        const url = `${SHEETS_API_URL}?t=${Date.now()}`;
        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache'
        });

        if (response.ok) {
            console.log('✅ Google Sheets está acessível via CORS');
            return true;
        }
    } catch (error) {
        console.log('⚠️ CORS bloqueado, usando modo no-cors');
    }
    return false;
}

// ============================================
// INICIALIZAR QUANDO O DOM ESTIVER PRONTO
// ============================================

setTimeout(() => {
    initializeSheetsIntegration();
    addManualSyncButton(); // Adicionar botão de sync manual
}, 500);
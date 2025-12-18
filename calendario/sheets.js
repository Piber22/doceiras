// ============================================
// GOOGLE SHEETS INTEGRATION
// ============================================

const SHEETS_CONFIG = {
    // Cole aqui a URL da sua API do Google Apps Script
    apiUrl: 'https://script.google.com/macros/s/AKfycbxfWuDeB-3BfO7pDm-50gLf5VaBW3o1HqdGvInpI_FjsJtTVVkBQQVjiH4TUqylJA4D/exec',

    // Timeout para requisições (em milissegundos)
    timeout: 10000
};

// ============================================
// FUNÇÕES DE API
// ============================================

/**
 * Faz requisição para a API do Google Sheets
 * IMPORTANTE: Usa URLSearchParams para evitar CORS preflight
 */
async function sheetsRequest(action, data = {}) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), SHEETS_CONFIG.timeout);

        // Monta a URL com parâmetros para GET
        const params = new URLSearchParams({
            action: action,
            data: JSON.stringify(data)
        });

        const response = await fetch(`${SHEETS_CONFIG.apiUrl}?${params.toString()}`, {
            method: 'GET',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        const result = await response.json();

        if (result.error) {
            throw new Error(result.error);
        }

        return result;
    } catch (error) {
        console.error('Erro na requisição:', error);
        throw error;
    }
}

/**
 * Carrega todas as encomendas da planilha
 */
async function loadOrders() {
    try {
        const result = await sheetsRequest('getOrders');
        return result.data || [];
    } catch (error) {
        console.error('Erro ao carregar encomendas:', error);
        throw new Error('Não foi possível carregar as encomendas. Verifique sua conexão.');
    }
}

/**
 * Adiciona uma nova encomenda
 */
async function addOrder(order) {
    try {
        const result = await sheetsRequest('addOrder', order);
        return result.data;
    } catch (error) {
        console.error('Erro ao adicionar encomenda:', error);
        throw new Error('Não foi possível adicionar a encomenda.');
    }
}

/**
 * Atualiza uma encomenda existente
 */
async function updateOrder(order) {
    try {
        const result = await sheetsRequest('updateOrder', order);
        return result.data;
    } catch (error) {
        console.error('Erro ao atualizar encomenda:', error);
        throw new Error('Não foi possível atualizar a encomenda.');
    }
}

/**
 * Remove uma encomenda
 */
async function deleteOrder(orderId) {
    try {
        const result = await sheetsRequest('deleteOrder', { id: orderId });
        return result.success;
    } catch (error) {
        console.error('Erro ao excluir encomenda:', error);
        throw new Error('Não foi possível excluir a encomenda.');
    }
}

// ============================================
// CACHE LOCAL (para melhor performance)
// ============================================

const OrdersCache = {
    data: null,
    lastUpdate: null,
    cacheTimeout: 30000, // 30 segundos

    set(orders) {
        this.data = orders;
        this.lastUpdate = Date.now();
    },

    get() {
        if (!this.data || !this.lastUpdate) {
            return null;
        }

        const now = Date.now();
        if (now - this.lastUpdate > this.cacheTimeout) {
            return null; // Cache expirado
        }

        return this.data;
    },

    clear() {
        this.data = null;
        this.lastUpdate = null;
    }
};

// ============================================
// FUNÇÕES PÚBLICAS COM CACHE
// ============================================

/**
 * Carrega encomendas com cache
 */
async function getOrders(forceRefresh = false) {
    if (!forceRefresh) {
        const cached = OrdersCache.get();
        if (cached) {
            return cached;
        }
    }

    const orders = await loadOrders();
    OrdersCache.set(orders);
    return orders;
}

/**
 * Salva encomenda (adiciona ou atualiza)
 */
async function saveOrder(order) {
    let result;

    if (order.id && order.id.toString().length > 5) {
        // É uma atualização (ID já existe e não é timestamp)
        result = await updateOrder(order);
    } else {
        // É uma nova encomenda
        const newOrder = {
            ...order,
            id: Date.now().toString() // Gera ID temporário
        };
        result = await addOrder(newOrder);
    }

    OrdersCache.clear(); // Limpa cache após modificação
    return result;
}

/**
 * Remove encomenda
 */
async function removeOrder(orderId) {
    const result = await deleteOrder(orderId);
    OrdersCache.clear(); // Limpa cache após modificação
    return result;
}

// ============================================
// HELPERS PARA UI
// ============================================

/**
 * Mostra loading overlay
 */
function showLoading(message = 'Carregando...') {
    let overlay = document.getElementById('loadingOverlay');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <p class="loading-message">${message}</p>
            </div>
        `;
        document.body.appendChild(overlay);

        // Adiciona CSS se ainda não existe
        if (!document.getElementById('loadingStyles')) {
            const style = document.createElement('style');
            style.id = 'loadingStyles';
            style.textContent = `
                #loadingOverlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                }
                .loading-content {
                    background: white;
                    padding: 32px;
                    border-radius: 20px;
                    text-align: center;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                }
                .loading-spinner {
                    width: 48px;
                    height: 48px;
                    border: 4px solid #fce7f3;
                    border-top-color: #ec4899;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    margin: 0 auto 16px;
                }
                .loading-message {
                    color: #374151;
                    font-weight: 600;
                    font-size: 16px;
                    margin: 0;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    } else {
        overlay.querySelector('.loading-message').textContent = message;
    }

    overlay.style.display = 'flex';
}

/**
 * Esconde loading overlay
 */
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

/**
 * Mostra mensagem de erro
 */
function showError(message) {
    const errorToast = document.createElement('div');
    errorToast.style.cssText = `
        position: fixed;
        bottom: 90px;
        left: 50%;
        transform: translateX(-50%);
        background: #ef4444;
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        font-weight: 600;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: fadeIn 0.3s;
        max-width: 90%;
        text-align: center;
    `;
    errorToast.innerHTML = `
        <i class="fas fa-exclamation-circle" style="margin-right: 8px;"></i>
        ${message}
    `;
    document.body.appendChild(errorToast);

    setTimeout(() => {
        errorToast.style.animation = 'fadeOut 0.3s';
        setTimeout(() => errorToast.remove(), 300);
    }, 4000);
}

// ============================================
// VERIFICAÇÃO DE CONFIGURAÇÃO
// ============================================

/**
 * Verifica se a API está configurada
 */
function isConfigured() {
    return SHEETS_CONFIG.apiUrl &&
           SHEETS_CONFIG.apiUrl !== 'SUA_URL_DO_GOOGLE_APPS_SCRIPT_AQUI';
}

/**
 * Testa conexão com a API
 */
async function testConnection() {
    try {
        showLoading('Testando conexão...');
        await sheetsRequest('test');
        hideLoading();
        return true;
    } catch (error) {
        hideLoading();
        showError('Falha na conexão com Google Sheets');
        return false;
    }
}

// ============================================
// EXPORTAR FUNÇÕES
// ============================================

window.SheetsAPI = {
    // Operações principais
    getOrders,
    saveOrder,
    removeOrder,

    // UI helpers
    showLoading,
    hideLoading,
    showError,

    // Configuração
    isConfigured,
    testConnection,

    // Cache
    clearCache: () => OrdersCache.clear()
};
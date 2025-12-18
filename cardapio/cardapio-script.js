// ============================================
// CARDÁPIO PÚBLICO - APENAS LEITURA
// ============================================

// Usar a mesma URL do Google Sheets
const SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbxfZRwumUk1HhRfnimEGMTvOymqObpgDV5TaUWQPqe1tAhgKjGDLkOHCiWQMd0dDKyx/exec';

// State
let menuData = {
    settings: {},
    categories: [],
    items: []
};

// ============================================
// CARREGAR DADOS DO GOOGLE SHEETS
// ============================================

async function loadMenuData() {
    try {
        // Criar um callback único para JSONP
        const callbackName = 'loadMenuData_' + Date.now();

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error('Timeout ao carregar'));
            }, 15000);

            window[callbackName] = function(data) {
                clearTimeout(timeout);
                cleanup();

                if (data && data.success) {
                    menuData.settings = data.settings || {};
                    menuData.categories = data.categories || [];
                    menuData.items = data.items || [];
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
        throw error;
    }
}

// ============================================
// RENDERIZAR CARDÁPIO
// ============================================

function renderMenu() {
    const { settings, categories, items } = menuData;

    // Header
    document.getElementById('menuTitle').textContent = settings.title || 'Cardápio';
    document.getElementById('menuSubtitle').textContent = settings.subtitle || '';
    document.getElementById('contactNumber').textContent = settings.contact || '';

    // Aplicar tema
    const header = document.getElementById('header');
    header.className = 'header theme-' + (settings.themeColor || 'pink');

    // WhatsApp link
    const phone = settings.contact ? settings.contact.replace(/\D/g, '') : '';
    const message = encodeURIComponent(`Olá! Vi o cardápio e gostaria de fazer um pedido 😊`);
    document.getElementById('whatsappLink').href = `https://wa.me/55${phone}?text=${message}`;

    // Content
    const content = document.getElementById('menuContent');
    content.innerHTML = '';

    // Filtrar apenas itens visíveis
    const visibleItems = items.filter(item => item.visible !== false);

    if (visibleItems.length === 0) {
        content.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-cookie-bite"></i>
                <h3>Cardápio em breve!</h3>
                <p>Estamos preparando delícias especiais para você.</p>
            </div>
        `;
        return;
    }

    // Renderizar por categoria
    categories.forEach(category => {
        const categoryItems = visibleItems.filter(item => item.categoryId === category.id);

        if (categoryItems.length === 0) return;

        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category';

        const categoryTitle = document.createElement('h2');
        categoryTitle.className = 'category-title';
        categoryTitle.textContent = category.name;

        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'category-items';

        categoryItems.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'item';

            const itemInfo = document.createElement('div');
            itemInfo.className = 'item-info';

            const itemHeader = document.createElement('div');
            itemHeader.className = 'item-header';

            const itemName = document.createElement('h3');
            itemName.className = 'item-name';
            itemName.textContent = item.name;

            itemHeader.appendChild(itemName);

            if (item.highlight) {
                const badge = document.createElement('span');
                badge.className = 'item-badge';
                badge.textContent = 'Novo';
                itemHeader.appendChild(badge);
            }

            itemInfo.appendChild(itemHeader);

            if (item.description) {
                const description = document.createElement('p');
                description.className = 'item-description';
                description.textContent = item.description;
                itemInfo.appendChild(description);
            }

            const priceContainer = document.createElement('div');
            const priceLabel = document.createElement('span');
            priceLabel.className = 'item-price-label';
            priceLabel.textContent = 'Preço';

            const price = document.createElement('div');
            price.className = 'item-price';
            price.textContent = `R$ ${item.price.toFixed(2).replace('.', ',')}`;

            priceContainer.appendChild(priceLabel);
            priceContainer.appendChild(price);

            itemDiv.appendChild(itemInfo);
            itemDiv.appendChild(priceContainer);

            itemsContainer.appendChild(itemDiv);
        });

        categoryDiv.appendChild(categoryTitle);
        categoryDiv.appendChild(itemsContainer);
        content.appendChild(categoryDiv);
    });
}

// ============================================
// MOSTRAR/OCULTAR SEÇÕES
// ============================================

function showLoading() {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('error').style.display = 'none';
    document.getElementById('cardapio').style.display = 'none';
}

function showError() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'flex';
    document.getElementById('cardapio').style.display = 'none';
}

function showMenu() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'none';
    document.getElementById('cardapio').style.display = 'block';
}

// ============================================
// INICIALIZAR
// ============================================

async function init() {
    showLoading();

    try {
        await loadMenuData();
        renderMenu();
        showMenu();

        console.log('✅ Cardápio carregado com sucesso!');

    } catch (error) {
        console.error('❌ Erro ao carregar cardápio:', error);
        showError();
    }
}

// Carregar ao abrir a página
document.addEventListener('DOMContentLoaded', init);

// Recarregar a cada 5 minutos (para pegar atualizações)
setInterval(() => {
    loadMenuData().then(() => {
        renderMenu();
        console.log('🔄 Cardápio atualizado automaticamente');
    }).catch(err => {
        console.log('⚠️ Falha na atualização automática:', err);
    });
}, 300000); // 5 minutos
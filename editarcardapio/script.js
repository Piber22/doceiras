// App State
let state = {
    items: [],
    categories: [
        { id: '1', name: 'Bolos & Tortas' },
        { id: '2', name: 'Docinhos & Brigadeiros' },
        { id: '3', name: 'Bebidas & Cafés' },
        { id: '4', name: 'Especiais & Sazonais' }
    ],
    settings: {
        title: 'Doces da Ana',
        subtitle: 'Confeitaria Artesanal & Afeto',
        contact: '(11) 99999-9999',
        themeColor: 'pink'
    },
    editingItem: null
};

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    renderCategories();
    renderItemsList();
    renderPreview();
});

// Event Listeners
function initializeEventListeners() {
    // Settings inputs
    document.getElementById('inputTitle').addEventListener('input', (e) => {
        state.settings.title = e.target.value;
        renderPreview();
    });

    document.getElementById('inputSubtitle').addEventListener('input', (e) => {
        state.settings.subtitle = e.target.value;
        renderPreview();
    });

    document.getElementById('inputContact').addEventListener('input', (e) => {
        state.settings.contact = e.target.value;
        renderPreview();
    });

    // Theme colors
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.settings.themeColor = e.target.dataset.color;
            renderPreview();
        });
    });

    // Add category button
    document.getElementById('btnAddCategory').addEventListener('click', addCategory);

    // New item button
    document.getElementById('btnNewItem').addEventListener('click', openNewItemForm);

    // Modal form
    document.getElementById('btnCancel').addEventListener('click', closeModal);
    document.getElementById('itemForm').addEventListener('submit', handleSaveItem);

    // Floating actions
    document.getElementById('btnCopyText').addEventListener('click', handleCopyText);
    document.getElementById('btnExportImage').addEventListener('click', handleExportImage);
    document.getElementById('btnOpenMenu').addEventListener('click', openMenuLink);

    // Close modal on backdrop click
    document.getElementById('modalForm').addEventListener('click', (e) => {
        if (e.target.id === 'modalForm') {
            closeModal();
        }
    });
}

// Categories Management
function renderCategories() {
    const container = document.getElementById('categoriesList');
    container.innerHTML = '';

    state.categories.forEach(category => {
        const div = document.createElement('div');
        div.className = 'category-item';
        div.innerHTML = `
            <input type="text" value="${category.name}" data-id="${category.id}">
            <button class="btn-delete" data-id="${category.id}">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;

        const input = div.querySelector('input');
        input.addEventListener('input', (e) => updateCategory(category.id, e.target.value));

        const deleteBtn = div.querySelector('.btn-delete');
        deleteBtn.addEventListener('click', () => removeCategory(category.id));

        container.appendChild(div);
    });

    // Update category select in form
    updateCategorySelect();
}

function addCategory() {
    const newCategory = {
        id: Date.now().toString(),
        name: 'Nova Categoria'
    };
    state.categories.push(newCategory);
    renderCategories();
    updateCategorySelect();
}

function updateCategory(id, name) {
    const category = state.categories.find(c => c.id === id);
    if (category) {
        category.name = name;
        updateCategorySelect();
        renderItemsList();
        renderPreview();
    }
}

function removeCategory(id) {
    if (confirm('Tem certeza? Os itens desta categoria ficarão ocultos até serem movidos.')) {
        state.categories = state.categories.filter(c => c.id !== id);
        renderCategories();
        updateCategorySelect();
        renderItemsList();
        renderPreview();
    }
}

function updateCategorySelect() {
    const select = document.getElementById('itemCategory');
    select.innerHTML = '';
    state.categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        select.appendChild(option);
    });
}

// Items Management
function renderItemsList() {
    const container = document.getElementById('itemsList');
    const card = document.getElementById('itemsListCard');

    if (state.items.length === 0) {
        card.style.display = 'none';
        return;
    }

    card.style.display = 'block';
    container.innerHTML = '';

    state.categories.forEach(category => {
        const categoryItems = state.items.filter(item => item.categoryId === category.id);

        if (categoryItems.length === 0) return;

        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'items-category';
        categoryDiv.innerHTML = `
            <h3 class="category-header">${category.name}</h3>
            <div class="items-container" data-category-id="${category.id}"></div>
        `;

        const itemsContainer = categoryDiv.querySelector('.items-container');

        categoryItems.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'item-card';
            itemDiv.draggable = true;
            itemDiv.dataset.itemId = item.id;

            // Adicionar classe se estiver oculto
            if (!item.visible) {
                itemDiv.classList.add('item-hidden');
            }

            itemDiv.innerHTML = `
                <div class="item-left">
                    <div class="drag-handle">
                        <i class="fas fa-grip-vertical"></i>
                    </div>
                    <div class="item-info">
                        <h4>${item.name}</h4>
                        <p>R$ ${item.price.toFixed(2).replace('.', ',')}</p>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn-icon visibility ${item.visible ? 'visible' : 'hidden'}" onclick="toggleVisibility('${item.id}')" title="${item.visible ? 'Ocultar item' : 'Mostrar item'}">
                        <i class="fas fa-eye${item.visible ? '' : '-slash'}"></i>
                    </button>
                    <button class="btn-icon edit" onclick="startEditing('${item.id}')">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    <button class="btn-icon delete" onclick="removeItem('${item.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

            // Drag and drop events
            itemDiv.addEventListener('dragstart', handleDragStart);
            itemDiv.addEventListener('dragend', handleDragEnd);

            itemsContainer.appendChild(itemDiv);
        });

        // Make container droppable
        itemsContainer.addEventListener('dragover', handleDragOver);
        itemsContainer.addEventListener('drop', handleDrop);

        container.appendChild(categoryDiv);
    });

    renderPreview();
}

// Drag and Drop Functions
let draggedElement = null;

function handleDragStart(e) {
    draggedElement = e.currentTarget;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    draggedElement = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const container = e.currentTarget;
    const afterElement = getDragAfterElement(container, e.clientY);
    const draggable = draggedElement;

    if (afterElement == null) {
        container.appendChild(draggable);
    } else {
        container.insertBefore(draggable, afterElement);
    }
}

function handleDrop(e) {
    e.preventDefault();

    const categoryId = e.currentTarget.dataset.categoryId;
    const itemId = draggedElement.dataset.itemId;

    // Update item's category
    const item = state.items.find(i => i.id === itemId);
    if (item) {
        item.categoryId = categoryId;
    }

    // Reorder items based on DOM order
    const newOrder = [];
    document.querySelectorAll('.items-container').forEach(container => {
        container.querySelectorAll('.item-card').forEach(card => {
            const id = card.dataset.itemId;
            const item = state.items.find(i => i.id === id);
            if (item) newOrder.push(item);
        });
    });

    state.items = newOrder;
    renderItemsList();

    // Disparar auto-save
    setTimeout(() => {
        if (typeof scheduleAutoSave === 'function') {
            scheduleAutoSave();
        }
    }, 100);
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.item-card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Toggle Visibility
function toggleVisibility(id) {
    const item = state.items.find(i => i.id === id);
    if (item) {
        item.visible = !item.visible;
        renderItemsList();
        renderPreview();

        // Disparar auto-save
        setTimeout(() => {
            if (typeof scheduleAutoSave === 'function') {
                scheduleAutoSave();
            }
        }, 100);
    }
}

function removeItem(id) {
    if (confirm('Deseja remover este item?')) {
        state.items = state.items.filter(i => i.id !== id);
        renderItemsList();

        // Disparar auto-save
        setTimeout(() => {
            if (typeof scheduleAutoSave === 'function') {
                scheduleAutoSave();
            }
        }, 100);
    }
}

function startEditing(id) {
    const item = state.items.find(i => i.id === id);
    if (item) {
        state.editingItem = item;
        openEditForm(item);
    }
}

// Modal Form
function openNewItemForm() {
    state.editingItem = null;
    document.getElementById('modalTitle').textContent = 'Novo Doce';
    document.getElementById('itemForm').reset();
    document.getElementById('btnSubmit');
    document.querySelector('.btn-submit').textContent = 'Adicionar ao Menu';
    document.getElementById('modalForm').classList.add('active');
}

function openEditForm(item) {
    document.getElementById('modalTitle').textContent = 'Editar Doce';
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemDescription').value = item.description;
    document.getElementById('itemPrice').value = item.price.toFixed(2);
    document.getElementById('itemCategory').value = item.categoryId;
    document.querySelector('.btn-submit').textContent = 'Salvar Alterações';
    document.getElementById('modalForm').classList.add('active');
}

function closeModal() {
    document.getElementById('modalForm').classList.remove('active');
    state.editingItem = null;
}

function handleSaveItem(e) {
    e.preventDefault();

    const name = document.getElementById('itemName').value;
    const description = document.getElementById('itemDescription').value;
    const price = parseFloat(document.getElementById('itemPrice').value);
    const categoryId = document.getElementById('itemCategory').value;

    if (!name || !price || !categoryId) return;

    if (state.editingItem) {
        // Edit existing item
        const item = state.items.find(i => i.id === state.editingItem.id);
        if (item) {
            item.name = name;
            item.description = description;
            item.price = price;
            item.categoryId = categoryId;
        }
    } else {
        // Add new item
        const newItem = {
            id: Date.now().toString(),
            name,
            description,
            price,
            categoryId,
            highlight: false,
            visible: true
        };
        state.items.push(newItem);
    }

    renderItemsList();
    closeModal();

    // Disparar auto-save
    setTimeout(() => {
        if (typeof scheduleAutoSave === 'function') {
            scheduleAutoSave();
        }
    }, 100);
}

// Preview Rendering
function renderPreview() {
    const preview = document.getElementById('menuPreview');
    const themeClass = `theme-${state.settings.themeColor}`;

    let html = `
        <div class="preview-header ${themeClass}">
            <h1>${state.settings.title}</h1>
            <p>${state.settings.subtitle}</p>
        </div>
        <div class="preview-content">
    `;

    state.categories.forEach(category => {
        const categoryItems = state.items.filter(item => item.categoryId === category.id && item.visible);

        if (categoryItems.length === 0) return;

        html += `
            <div class="preview-category">
                <h3 class="preview-category-title">${category.name}</h3>
                <div class="preview-items">
        `;

        categoryItems.forEach(item => {
            html += `
                <div class="preview-item">
                    <div class="preview-item-left">
                        <div class="preview-item-header">
                            <div class="preview-item-name">${item.name}</div>
                            ${item.highlight ? '<span class="preview-item-badge">Novo</span>' : ''}
                        </div>
                        ${item.description ? `<p class="preview-item-description">${item.description}</p>` : ''}
                    </div>
                    <div class="preview-item-price">
                        R$ ${item.price.toFixed(2).replace('.', ',')}
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    html += `
        </div>
        <div class="preview-footer ${themeClass}">
            <i class="fab fa-whatsapp"></i>
            ${state.settings.contact}
        </div>
    `;

    preview.innerHTML = html;
}

// Export Functions
function handleCopyText() {
    let text = `🍰 *${state.settings.title.toUpperCase()}* 🍰\n_${state.settings.subtitle}_\n\n`;

    state.categories.forEach(cat => {
        const catItems = state.items.filter(i => i.categoryId === cat.id && i.visible);
        if (catItems.length > 0) {
            text += `*${cat.name.toUpperCase()}*\n`;
            catItems.forEach(item => {
                text += `▪️ *${item.name}* - R$ ${item.price.toFixed(2).replace('.', ',')}\n`;
                if (item.description) text += `   _${item.description}_\n`;
            });
            text += `\n`;
        }
    });

    text += `📲 Pedidos: *${state.settings.contact}*`;

    navigator.clipboard.writeText(text).then(() => {
        alert('✨ Cardápio copiado! Agora é só colar no WhatsApp.');
    }).catch(err => {
        console.error('Erro ao copiar:', err);
        alert('Erro ao copiar o texto. Tente novamente.');
    });
}

function handleExportImage() {
    const preview = document.getElementById('menuPreview');
    const button = document.getElementById('btnExportImage');
    const icon = button.querySelector('.action-icon i');

    // Show loading
    icon.className = 'fas fa-spinner fa-spin';
    button.disabled = true;

    html2canvas(preview, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true
    }).then(canvas => {
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const date = new Date().toISOString().slice(0, 10);
            link.download = `cardapio-${date}.png`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);

            // Reset button
            icon.className = 'fas fa-image';
            button.disabled = false;
        });
    }).catch(err => {
        console.error('Erro ao gerar imagem:', err);
        alert('Ops! Não conseguimos gerar a imagem agora. Tente novamente.');

        // Reset button
        icon.className = 'fas fa-image';
        button.disabled = false;
    });
}

// Link do Cardápio Completo
function openMenuLink() {
    const currentUrl = window.location.href;
    const baseUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/') + 1);
    const menuUrl = baseUrl + '../cardapio/cardapio.html';

    document.getElementById('menuLink').value = menuUrl;
    document.getElementById('modalLink').classList.add('active');
}

function closeModalLink() {
    document.getElementById('modalLink').classList.remove('active');
}

function copyMenuLink(event) {
    const linkInput = document.getElementById('menuLink');
    linkInput.select();
    linkInput.setSelectionRange(0, 99999); // Para mobile

    // Função interna para mostrar o sucesso (botão verde)
    const showSuccess = () => {
        // Tenta pegar o botão pelo evento, ou busca pelo seletor se falhar
        const btn = event ? (event.currentTarget || event.target.closest('button')) : document.querySelector('#modalLink .btn-submit');

        if (btn) {
            const originalText = '<i class="fas fa-copy"></i> Copiar Link'; // Texto original fixo para garantir retorno
            btn.innerHTML = '<i class="fas fa-check"></i> Copiado!';
            btn.style.background = '#16a34a';

            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.style.background = '';
            }, 2000);
        }
    };

    // TENTATIVA 1: API Moderna (navigator.clipboard)
    // Geralmente requer HTTPS
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(linkInput.value)
            .then(showSuccess)
            .catch(() => {
                // Se falhar (ex: erro de permissão), vai para o método antigo
                fallbackCopyText();
            });
    } else {
        // Se o navegador for antigo
        fallbackCopyText();
    }

    // TENTATIVA 2: Método Clássico (document.execCommand)
    // Funciona melhor em testes locais e navegadores antigos
    function fallbackCopyText() {
        try {
            // O texto já está selecionado pelo .select() acima
            const successful = document.execCommand('copy');
            if (successful) {
                showSuccess();
            } else {
                throw new Error('Falha no comando copy');
            }
        } catch (err) {
            console.error('Erro ao copiar:', err);
            alert('Erro ao copiar link. Por favor, selecione e copie manualmente.');
        }
    }
}
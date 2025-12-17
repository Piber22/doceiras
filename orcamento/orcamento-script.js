// App State
let state = {
    menuItems: [],
    categories: [],
    settings: {},
    selectedItems: [],
    budgetInfo: {
        clientName: '',
        eventDate: '',
        deliveryFee: 0
    }
};

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
});

// Event Listeners
function initializeEventListeners() {
    // Budget info inputs
    document.getElementById('inputClientName').addEventListener('input', (e) => {
        state.budgetInfo.clientName = e.target.value;
        renderPreview();
    });



    document.getElementById('inputDeliveryFee').addEventListener('input', (e) => {
        state.budgetInfo.deliveryFee = parseFloat(e.target.value) || 0;
        updateSummary();
        renderPreview();
    });

    // Action buttons
    document.getElementById('btnNewBudget').addEventListener('click', clearBudget);
    document.getElementById('btnClearBudget').addEventListener('click', clearBudget);
    document.getElementById('btnCopyText').addEventListener('click', handleCopyText);
    document.getElementById('btnExportImage').addEventListener('click', handleExportImage);
}

// Render Items Selection
function renderItemsSelection() {
    const container = document.getElementById('itemsSelection');
    container.innerHTML = '';

    if (state.menuItems.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 32px; color: #9ca3af;">
                <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 16px; display: block;"></i>
                <p>Nenhum item encontrado no cardápio.</p>
                <p style="font-size: 12px; margin-top: 8px;">Adicione itens na página de edição do cardápio.</p>
            </div>
        `;
        return;
    }

    // Group items by category
    state.categories.forEach(category => {
        const categoryItems = state.menuItems.filter(item =>
            item.categoryId === category.id && item.visible
        );

        if (categoryItems.length === 0) return;

        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category-section';
        categoryDiv.innerHTML = `<div class="category-section-title">${category.name}</div>`;

        categoryItems.forEach(item => {
            const isSelected = state.selectedItems.some(si => si.id === item.id);

            const itemDiv = document.createElement('div');
            itemDiv.className = `selectable-item ${isSelected ? 'selected' : ''}`;
            itemDiv.innerHTML = `
                <div class="item-checkbox">
                    <i class="fas fa-check"></i>
                </div>
                <div class="item-selection-info">
                    <div class="item-selection-name">${item.name}</div>
                    <div class="item-selection-price">R$ ${item.price.toFixed(2).replace('.', ',')}</div>
                </div>
            `;

            itemDiv.addEventListener('click', () => toggleItemSelection(item));
            categoryDiv.appendChild(itemDiv);
        });

        container.appendChild(categoryDiv);
    });
}

// Toggle Item Selection
function toggleItemSelection(item) {
    const index = state.selectedItems.findIndex(si => si.id === item.id);

    if (index === -1) {
        // Add item
        state.selectedItems.push({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: 1
        });
    } else {
        // Remove item
        state.selectedItems.splice(index, 1);
    }

    renderItemsSelection();
    renderSelectedItems();
    updateSummary();
    renderPreview();
}

// Render Selected Items
function renderSelectedItems() {
    const container = document.getElementById('selectedItemsList');
    const card = document.getElementById('selectedItemsCard');

    if (state.selectedItems.length === 0) {
        card.style.display = 'none';
        return;
    }

    card.style.display = 'block';
    container.innerHTML = '';

    state.selectedItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'selected-item-card';

        const itemTotal = item.price * item.quantity;

        itemDiv.innerHTML = `
            <div class="selected-item-info">
                <div class="selected-item-name">${item.name}</div>
                <div class="selected-item-price">R$ ${item.price.toFixed(2).replace('.', ',')} cada</div>
            </div>
            <div class="quantity-control">
                <button class="qty-btn" data-id="${item.id}" data-action="decrease">
                    <i class="fas fa-minus"></i>
                </button>
                <input type="number" class="qty-input" value="${item.quantity}" min="1" data-id="${item.id}">
                <button class="qty-btn" data-id="${item.id}" data-action="increase">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
            <div class="item-total">R$ ${itemTotal.toFixed(2).replace('.', ',')}</div>
            <button class="btn-remove-item" data-id="${item.id}">
                <i class="fas fa-trash"></i>
            </button>
        `;

        // Quantity buttons
        itemDiv.querySelectorAll('.qty-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const action = btn.dataset.action;
                updateQuantity(id, action);
            });
        });

        // Quantity input
        const qtyInput = itemDiv.querySelector('.qty-input');
        qtyInput.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const value = parseInt(e.target.value) || 1;
            setQuantity(id, value);
        });

        // Remove button
        itemDiv.querySelector('.btn-remove-item').addEventListener('click', () => {
            removeSelectedItem(item.id);
        });

        container.appendChild(itemDiv);
    });
}

// Update Quantity
function updateQuantity(itemId, action) {
    const item = state.selectedItems.find(si => si.id === itemId);
    if (!item) return;

    if (action === 'increase') {
        item.quantity++;
    } else if (action === 'decrease' && item.quantity > 1) {
        item.quantity--;
    }

    renderSelectedItems();
    updateSummary();
    renderPreview();
}

// Set Quantity
function setQuantity(itemId, quantity) {
    const item = state.selectedItems.find(si => si.id === itemId);
    if (!item) return;

    item.quantity = Math.max(1, quantity);
    renderSelectedItems();
    updateSummary();
    renderPreview();
}

// Remove Selected Item
function removeSelectedItem(itemId) {
    state.selectedItems = state.selectedItems.filter(si => si.id !== itemId);
    renderItemsSelection();
    renderSelectedItems();
    updateSummary();
    renderPreview();
}

// Update Summary
function updateSummary() {
    const subtotal = state.selectedItems.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
    }, 0);

    const deliveryFee = state.budgetInfo.deliveryFee;
    const total = subtotal + deliveryFee;

    document.getElementById('subtotalValue').textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
    document.getElementById('deliveryValue').textContent = `R$ ${deliveryFee.toFixed(2).replace('.', ',')}`;
    document.getElementById('totalValue').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

// Render Preview
function renderPreview() {
    const preview = document.getElementById('budgetPreview');

    if (state.selectedItems.length === 0) {
        preview.innerHTML = `
            <div class="empty-preview">
                <i class="fas fa-file-invoice-dollar"></i>
                <h3>Orçamento Vazio</h3>
                <p>Selecione itens do cardápio para começar</p>
            </div>
        `;
        return;
    }

    const subtotal = state.selectedItems.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
    }, 0);

    const deliveryFee = state.budgetInfo.deliveryFee;
    const total = subtotal + deliveryFee;

    const storeName = state.settings.title || 'Doces da Ana';
    const storeSubtitle = state.settings.subtitle || 'Confeitaria Artesanal';
    const storeContact = state.settings.contact || '(11) 99999-9999';
    const clientName = state.budgetInfo.clientName || 'Cliente';
    const eventDate = state.budgetInfo.eventDate ?
        new Date(state.budgetInfo.eventDate + 'T00:00:00').toLocaleDateString('pt-BR') :
        'A definir';

    let html = `
        <div class="preview-budget-header">
            <div class="preview-budget-title">${storeName}</div>
            <div class="preview-budget-subtitle">${storeSubtitle}</div>
        </div>

        <div class="preview-client-info">
            <div class="preview-client-row">
                <span class="preview-client-label">Cliente:</span>
                <span class="preview-client-value">${clientName}</span>
            </div>

            <div class="preview-client-row">
                <span class="preview-client-label">Data:</span>
                <span class="preview-client-value">${new Date().toLocaleDateString('pt-BR')}</span>
            </div>
        </div>

        <div class="preview-items-section">
            <div class="preview-items-title">Itens do Orçamento</div>
    `;

    state.selectedItems.forEach(item => {
        const itemTotal = item.price * item.quantity;
        html += `
            <div class="preview-item">
                <div class="preview-item-left">
                    <div class="preview-item-name">${item.name}</div>
                    <div class="preview-item-details">
                        ${item.quantity}x R$ ${item.price.toFixed(2).replace('.', ',')}
                    </div>
                </div>
                <div class="preview-item-total">R$ ${itemTotal.toFixed(2).replace('.', ',')}</div>
            </div>
        `;
    });

    html += `
        </div>

        <div class="preview-summary">
            <div class="preview-summary-row">
                <span>Subtotal:</span>
                <span>R$ ${subtotal.toFixed(2).replace('.', ',')}</span>
            </div>
            <div class="preview-summary-row">
                <span>Taxa de Entrega:</span>
                <span>R$ ${deliveryFee.toFixed(2).replace('.', ',')}</span>
            </div>
            <div class="preview-summary-row total">
                <span>Total:</span>
                <span>R$ ${total.toFixed(2).replace('.', ',')}</span>
            </div>
        </div>

        <div class="preview-footer">
            <i class="fab fa-whatsapp"></i> ${storeContact}
        </div>
    `;

    preview.innerHTML = html;
}

// Clear Budget
function clearBudget() {
    if (state.selectedItems.length > 0) {
        if (!confirm('Deseja limpar o orçamento atual?')) {
            return;
        }
    }

    state.selectedItems = [];
    state.budgetInfo = {
        clientName: '',
        eventDate: '',
        deliveryFee: 0
    };

    document.getElementById('inputClientName').value = '';
    document.getElementById('inputDeliveryFee').value = '0';

    renderItemsSelection();
    renderSelectedItems();
    updateSummary();
    renderPreview();
}

// Copy Text
function handleCopyText() {
    if (state.selectedItems.length === 0) {
        alert('⚠️ Adicione itens ao orçamento primeiro!');
        return;
    }

    const storeName = state.settings.title || 'Doces da Ana';
    const storeSubtitle = state.settings.subtitle || 'Confeitaria Artesanal';
    const storeContact = state.settings.contact || '(11) 99999-9999';
    const clientName = state.budgetInfo.clientName || 'Cliente';
    const eventDate = state.budgetInfo.eventDate ?
        new Date(state.budgetInfo.eventDate + 'T00:00:00').toLocaleDateString('pt-BR') :
        'A definir';

    const subtotal = state.selectedItems.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
    }, 0);

    const deliveryFee = state.budgetInfo.deliveryFee;
    const total = subtotal + deliveryFee;

    let text = `🍰 *ORÇAMENTO - ${storeName.toUpperCase()}* 🍰\n`;
    text += `_${storeSubtitle}_\n\n`;
    text += `👤 *Cliente:* ${clientName}\n`;
    text += `📅 *Data do Evento:* ${eventDate}\n`;
    text += `📋 *Data do Orçamento:* ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    text += `*━━━━━ ITENS ━━━━━*\n\n`;

    state.selectedItems.forEach(item => {
        const itemTotal = item.price * item.quantity;
        text += `▪️ *${item.name}*\n`;
        text += `   ${item.quantity}x R$ ${item.price.toFixed(2).replace('.', ',')} = R$ ${itemTotal.toFixed(2).replace('.', ',')}\n\n`;
    });

    text += `*━━━━━ VALORES ━━━━━*\n\n`;
    text += `Subtotal: R$ ${subtotal.toFixed(2).replace('.', ',')}\n`;
    text += `Taxa de Entrega: R$ ${deliveryFee.toFixed(2).replace('.', ',')}\n`;
    text += `*TOTAL: R$ ${total.toFixed(2).replace('.', ',')}*\n\n`;
    text += `📲 Contato: *${storeContact}*`;

    navigator.clipboard.writeText(text).then(() => {
        alert('✨ Orçamento copiado! Agora é só colar no WhatsApp.');
    }).catch(err => {
        console.error('Erro ao copiar:', err);
        alert('Erro ao copiar o texto. Tente novamente.');
    });
}

// Export Image
function handleExportImage() {
    if (state.selectedItems.length === 0) {
        alert('⚠️ Adicione itens ao orçamento primeiro!');
        return;
    }

    const preview = document.getElementById('budgetPreview');
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
            const clientName = state.budgetInfo.clientName || 'cliente';
            const safeName = clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const date = new Date().toISOString().slice(0, 10);
            link.download = `orcamento-${safeName}-${date}.png`;
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

// Update UI (called after data loads)
function updateUI() {
    renderItemsSelection();
    renderSelectedItems();
    updateSummary();
    renderPreview();
}
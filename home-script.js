document.addEventListener('DOMContentLoaded', () => {
    // Adiciona um pequeno efeito de vibração suave ao entrar na página
    const buttons = document.querySelectorAll('.menu-button');

    buttons.forEach((btn, index) => {
        btn.style.animationDelay = `${index * 0.1}s`;
    });

    console.log("Doce Gestão: Dashboard Inicial carregado.");
});
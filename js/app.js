document.addEventListener('DOMContentLoaded', () => {
    // 1. Logika Accordion Menu (Menu Lipat)
    const accordionToggles = document.querySelectorAll('.accordion-toggle');
    
    accordionToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            // Ubah panah (tambah/hapus class active)
            this.classList.toggle('active');
            
            // Tampilkan/Sembunyikan konten di bawahnya
            const content = this.nextElementSibling;
            content.classList.toggle('open');
        });
    });

    // 2. Logika Navigasi Pindah Fitur
    const menuButtons = document.querySelectorAll('.menu-btn:not(.disabled)');
    const appFrame = document.getElementById('app-frame');
    
    // 3. Elemen Mobile
    const mobileToggleBtn = document.getElementById('mobile-toggle-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    function toggleMobileMenu() {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('open');
    }

    if (mobileToggleBtn) { mobileToggleBtn.addEventListener('click', toggleMobileMenu); }
    if (sidebarOverlay) { sidebarOverlay.addEventListener('click', toggleMobileMenu); }

    menuButtons.forEach(button => {
        button.addEventListener('click', function() {
            menuButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            const targetHtml = this.getAttribute('data-target');
            appFrame.src = targetHtml;

            if (window.innerWidth <= 768) {
                toggleMobileMenu();
            }
        });
    });
});
// cookie.js
window.initCookieBanner = function() {
    const COOKIE_NAME = 'eresespondentN-access';
    const COOKIE_DAYS = 365;

    // Одно информационное окно на пользователя. Бампните версию в имени куки,
    // если поменяли набор слайдов и окно нужно показать снова.
    const INFO_MODAL_COOKIE = 'info-modal-2026-1';

    function setCookie(name, value, days) {
        let expires = '';
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = '; expires=' + date.toUTCString();
        }
        document.cookie = name + '=' + (value || '') + expires + '; path=/; SameSite=Lax';
    }

    function getCookie(name) {
        const nameEQ = name + '=';
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    function closeModal(modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 400);
    }

    // Навигация по слайдам внутри уже отфильтрованного окна.
    function initSlides(modalId = null) {
        const container = modalId ? document.getElementById(modalId) : document;
        if (!container) return;
        const slides = container.querySelectorAll('.modal-slide');
        const prevBtn = container.querySelector('.slide-prev-vertical');
        const nextBtn = container.querySelector('.slide-next-vertical');

        if (!slides.length) return;

        let currentSlide = 0;

        function showSlide(index) {
            slides.forEach(slide => slide.classList.remove('active'));
            slides[index].classList.add('active');

            const counter = slides[index].querySelector('.slide-counter');
            if (counter) counter.textContent = `${index + 1}/${slides.length}`;

            currentSlide = index;
        }

        function nextSlide() {
            showSlide((currentSlide + 1) % slides.length);
        }

        function prevSlide() {
            showSlide((currentSlide - 1 + slides.length) % slides.length);
        }

        if (prevBtn) prevBtn.addEventListener('click', prevSlide);
        if (nextBtn) nextBtn.addEventListener('click', nextSlide);

        // единственный слайд — навигация не нужна
        if (slides.length < 2) {
            if (prevBtn) prevBtn.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'none';
        }

        showSlide(0);
    }

    // Информационное окно: оставляем только слайды роли пользователя
    // (admin — все) и показываем один раз. К заполненности профиля не привязано.
    function initInfoModal() {
        const modal = document.getElementById('system-info-modal');
        if (!modal) return;

        const role = modal.getAttribute('data-user-role') || 'respondent';

        modal.querySelectorAll('.modal-slide').forEach(slide => {
            const slideRole = slide.getAttribute('data-role');
            if (role !== 'admin' && slideRole && slideRole !== role) {
                slide.remove();
            }
        });

        if (!modal.querySelector('.modal-slide')) return;
        if (getCookie(INFO_MODAL_COOKIE)) return;

        setTimeout(() => {
            modal.style.display = 'flex';
            setTimeout(() => {
                modal.classList.add('active');
                initSlides('system-info-modal');
            }, 10);
        }, 500);

        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                setCookie(INFO_MODAL_COOKIE, 'shown', COOKIE_DAYS);
                closeModal(modal);
            });
        }
    }

    // Баннер cookies
    if (!getCookie(COOKIE_NAME)) {
        const banner = document.getElementById('cookie-consent-banner');
        if (banner) {
            setTimeout(() => {
                banner.style.display = 'block';
                setTimeout(() => {
                    banner.classList.add('show');
                }, 10);
            }, 500);

            const acceptBtn = document.getElementById('accept-cookies');
            const declineBtn = document.getElementById('decline-cookies');

            if (acceptBtn) {
                acceptBtn.addEventListener('click', function() {
                    setCookie(COOKIE_NAME, 'accepted', COOKIE_DAYS);
                    banner.classList.remove('show');
                    setTimeout(() => {
                        banner.style.display = 'none';
                    }, 400);
                });
            }

            if (declineBtn) {
                declineBtn.addEventListener('click', function() {
                    banner.classList.remove('show');
                    setTimeout(() => {
                        banner.style.display = 'none';
                    }, 400);
                });
            }
        }
    }

    initInfoModal();
};

document.addEventListener('DOMContentLoaded', function() {
    if (typeof window.initCookieBanner === 'function') {
        window.initCookieBanner();
    }
});

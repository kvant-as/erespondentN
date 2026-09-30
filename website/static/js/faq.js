const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const faqMenu = document.getElementById('status-faqlist');

if (mobileMenuToggle && faqMenu) {
    mobileMenuToggle.addEventListener('click', function() {
        faqMenu.classList.toggle('mobile-open');
        
        if (faqMenu.classList.contains('mobile-open')) {
            this.textContent = 'Скрыть категории вопросов';
        } else {
            this.textContent = 'Показать категории вопросов';
        }
    });
    
    // Закрытие меню при клике на вопрос на мобильных
    document.querySelectorAll('#status-faqlist li[data-question]').forEach(item => {
        item.addEventListener('click', function() {
            if (window.innerWidth <= 768) {
                faqMenu.classList.remove('mobile-open');
                mobileMenuToggle.textContent = 'Показать категории вопросов';
            }
        });
    });
}

// Поиск вопросов FAQ
const faqSearch = document.getElementById('faqSearch');
const faqSearchResults = document.getElementById('faqSearchResults');

faqSearch.addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase().trim();
    faqSearchResults.innerHTML = '';
    
    if (searchTerm.length < 2) {
        faqSearchResults.style.display = 'none';
        return;
    }
    
    const allQuestions = document.querySelectorAll('#status-faqlist li[data-question]');
    const matchingQuestions = [];
    
    allQuestions.forEach(questionItem => {
        const questionText = questionItem.textContent.toLowerCase();
        const questionId = questionItem.getAttribute('data-question');
        
        if (questionText.includes(searchTerm)) {
            matchingQuestions.push({
                id: questionId,
                text: questionItem.textContent,
                element: questionItem
            });
        }
    });
    
    if (matchingQuestions.length > 0) {
        matchingQuestions.forEach(question => {
            const resultItem = document.createElement('div');
            resultItem.className = 'faq-search-result-item';
            resultItem.textContent = question.text;
            resultItem.dataset.questionId = question.id;
            
            resultItem.addEventListener('click', function() {
                loadFAQContent(question.id);
                faqSearch.value = '';
                faqSearchResults.style.display = 'none';
            });
            
            faqSearchResults.appendChild(resultItem);
        });
        faqSearchResults.style.display = 'block';
    } else {
        const noResults = document.createElement('div');
        noResults.className = 'faq-search-no-results';
        noResults.textContent = 'Вопросов не найдено';
        faqSearchResults.appendChild(noResults);
        faqSearchResults.style.display = 'block';
    }
});

// Закрытие результатов поиска при клике вне
document.addEventListener('click', function(e) {
    if (!faqSearch.contains(e.target) && !faqSearchResults.contains(e.target)) {
        faqSearchResults.style.display = 'none';
    }
});

// Очистка поиска при клике на ESC
faqSearch.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        faqSearch.value = '';
        faqSearchResults.style.display = 'none';
    }
});

document.querySelectorAll('#status-faqlist li[data-content]').forEach(item => {
    item.addEventListener('click', (e) => {
        // Блокируем только клик на SVG и path
        // const clickedElement = e.target;
        // if (clickedElement.closest('svg') || clickedElement.closest('path')) {
        //     return;
        // }
        
        const contentId = item.getAttribute('data-content');
        const contentElement = document.getElementById(contentId);
        const svg = item.querySelector('svg');
        
        if (contentElement.style.display === 'none' || contentElement.style.display === '') {
            contentElement.style.display = 'block';
            if (svg) svg.classList.add('rotate-180');
        } else {
            contentElement.style.display = 'none';
            if (svg) svg.classList.remove('rotate-180');
        }
    });
});

function loadFAQContent(questionId) {
    const faqContent = document.getElementById('faqContent');
    const placeholder = faqContent.querySelector('.faq-content-placeholder');
    
    document.querySelectorAll('.info_page[data-question-id]').forEach(container => {
        container.style.display = 'none';
    });
    
    if (placeholder) {
        placeholder.style.display = 'none';
    }
    
    const contentDiv = faqContent.querySelector(`.info_page[data-question-id="${questionId}"]`);
    if (contentDiv) {
        contentDiv.style.display = 'block';

        faqContent.classList.add('faq-content-active');

        history.pushState({ questionId: questionId }, '', `#faq${questionId}`);

        document.querySelectorAll('#status-faqlist li[data-question]').forEach(item => {
            item.classList.remove('active-question');
        });
        const selectedItem = document.querySelector(`#status-faqlist li[data-question="${questionId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('active-question');
        }

        // При переходе между вопросами (в т.ч. кнопками "вперёд"/"назад" в
        // браузере, когда меняется #faqN) страница должна показывать ответ
        // с самого начала, а не с того места, где пользователь долистал
        // предыдущий вопрос.
        window.scrollTo(0, 0);
    }
}

function loadContentFromHash() {
    const hash = window.location.hash.substring(1);
    if (hash && hash.startsWith('faq')) {
        const questionId = hash.replace('faq', '');
        loadFAQContent(questionId);
        
        const questionItem = document.querySelector(`li[data-question="${questionId}"]`);
        if (questionItem) {
            const parentCategory = questionItem.closest('.content');
            if (parentCategory) {
                const categoryId = parentCategory.id;
                const categoryHeader = document.querySelector(`li[data-content="${categoryId}"]`);
                if (categoryHeader) {
                    parentCategory.style.display = 'block';
                    const svg = categoryHeader.querySelector('svg');
                    if (svg) svg.classList.add('rotate-180');
                }
            }
        }
    } else {
        const faqContent = document.getElementById('faqContent');
        const placeholder = faqContent.querySelector('.faq-content-placeholder');
        if (placeholder) {
            placeholder.style.display = 'block';
        }
        document.querySelectorAll('.info_page[data-question-id]').forEach(container => {
            container.style.display = 'none';
        });
    }
}

document.querySelectorAll('#status-faqlist li[data-question]').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const questionId = item.getAttribute('data-question');
        loadFAQContent(questionId);
    });
});

// Содержание раздела внутри ответа (например, "Особенности заполнения
// отчета") — клик по пункту плавно прокручивает к соответствующему
// подразделу того же ответа.
document.querySelectorAll('.faq-section-nav .nav-link[data-target]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.getElementById(link.getAttribute('data-target'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

window.addEventListener('popstate', function(event) {
    loadContentFromHash();
});

// На случай прямого перехода по ссылке вида /FAQ#faq14 (не через клик по
// пункту списка, а сменой хэша страницы), которая popstate не вызывает.
window.addEventListener('hashchange', function() {
    loadContentFromHash();
});

// class VideoPlayer {
//     constructor(playerElement) {
//         this.player = playerElement;
//         this.video = playerElement.querySelector('.media-video');
//         this.poster = playerElement.querySelector('.video-poster');
//         this.controls = playerElement.querySelector('.video-controls');
//         this.playBtn = playerElement.querySelector('.play-pause');
//         this.progressBar = playerElement.querySelector('.progress-bar');
//         this.progressFill = playerElement.querySelector('.progress-fill');
//         this.progressThumb = playerElement.querySelector('.progress-thumb');
//         this.currentTimeEl = playerElement.querySelector('.current-time');
//         this.durationEl = playerElement.querySelector('.duration');
//         this.fullscreenBtn = playerElement.querySelector('.fullscreen-btn');
//         this.loadingIndicator = playerElement.querySelector('.loading-indicator');
        
//         // Новые элементы для таймкодов
//         this.timestampsContainer = playerElement.closest('.video-container')?.querySelector('.timestamps-container');
//         this.timestampItems = this.timestampsContainer ? 
//             this.timestampsContainer.querySelectorAll('.timestamp-item') : [];
        
//         this.init();
//         this.initTimestamps(); // Инициализация таймкодов
//     }
    
//     init() {
//         this.video.controls = false;
        
//         this.video.addEventListener('loadedmetadata', () => {
//             this.durationEl.textContent = this.formatTime(this.video.duration);
//         });
        
//         this.video.addEventListener('timeupdate', () => {
//             this.updateProgress();
//             this.currentTimeEl.textContent = this.formatTime(this.video.currentTime);
//             this.updateActiveTimestamp(); // Обновление активного таймкода
//         });
        
//         this.video.addEventListener('play', () => {
//             this.player.classList.add('playing');
//             this.poster.style.opacity = '0';
//             this.poster.style.pointerEvents = 'none';
//         });
        
//         this.video.addEventListener('pause', () => {
//             this.player.classList.remove('playing');
//         });
        
//         this.video.addEventListener('waiting', () => {
//             this.loadingIndicator.classList.add('active');
//         });
        
//         this.video.addEventListener('playing', () => {
//             this.loadingIndicator.classList.remove('active');
//         });
        
//         this.poster.addEventListener('click', (e) => {
//             e.stopPropagation();
//             this.togglePlay();
//         });
        
//         this.playBtn.addEventListener('click', (e) => {
//             e.stopPropagation();
//             this.togglePlay();
//         });
        
//         this.setupProgressBar();
        
//         this.fullscreenBtn.addEventListener('click', (e) => {
//             e.stopPropagation();
//             this.toggleFullscreen();
//         });
        
//         this.setupControlsVisibility();
//     }
    
//     // Инициализация обработчиков для таймкодов
//     initTimestamps() {
//         if (!this.timestampItems.length) return;
        
//         this.timestampItems.forEach(item => {
//             item.addEventListener('click', (e) => {
//                 e.stopPropagation();
//                 const time = parseInt(item.dataset.time, 10);
//                 this.seekToTime(time);
                
//                 // Подсветка выбранного таймкода
//                 this.timestampItems.forEach(t => t.classList.remove('active'));
//                 item.classList.add('active');
                
//                 // Автоматическое воспроизведение при клике на таймкод (опционально)
//                 if (this.video.paused) {
//                     this.video.play();
//                 }
//             });
//         });
//     }
    
//     // Перемотка к указанному времени
//     seekToTime(seconds) {
//         if (this.video.duration) {
//             this.video.currentTime = seconds;
            
//             // Показать уведомление о перемотке (опционально)
//             this.showSeekNotification(seconds);
//         }
//     }
    
//     // Показать уведомление о перемотке
//     showSeekNotification(seconds) {
//         // Создаем временное уведомление
//         const notification = document.createElement('div');
//         notification.className = 'seek-notification';
//         notification.textContent = `Перемотка: ${this.formatTime(seconds)}`;
        
//         // Стили для уведомления
//         notification.style.cssText = `
//             position: absolute;
//             top: 50%;
//             left: 50%;
//             transform: translate(-50%, -50%);
//             background: rgba(0, 0, 0, 0.8);
//             color: white;
//             padding: 8px 16px;
//             border-radius: 20px;
//             font-size: 14px;
//             z-index: 100;
//             pointer-events: none;
//             animation: fadeOut 1s ease forwards;
//         `;
        
//         this.player.appendChild(notification);
        
//         // Удаляем уведомление через 1 секунду
//         setTimeout(() => {
//             notification.remove();
//         }, 1000);
//     }
    
//     // Обновление активного таймкода на основе текущего времени видео
//     updateActiveTimestamp() {
//         if (!this.timestampItems.length) return;
        
//         const currentTime = this.video.currentTime;
//         let activeIndex = -1;
        
//         // Находим последний таймкод, который меньше или равен текущему времени
//         for (let i = 0; i < this.timestampItems.length; i++) {
//             const itemTime = parseInt(this.timestampItems[i].dataset.time, 10);
//             if (itemTime <= currentTime) {
//                 activeIndex = i;
//             } else {
//                 break;
//             }
//         }
        
//         // Обновляем классы
//         this.timestampItems.forEach((item, index) => {
//             if (index === activeIndex) {
//                 item.classList.add('active');
//             } else {
//                 item.classList.remove('active');
//             }
//         });
        
//         // Прокрутка к активному таймкоду, если контейнер с прокруткой
//         if (activeIndex !== -1 && this.timestampsContainer) {
//             const activeItem = this.timestampItems[activeIndex];
//             const container = this.timestampsContainer.querySelector('.timestamps-list');
            
//             if (container && container.scrollHeight > container.clientHeight) {
//                 const itemOffset = activeItem.offsetTop;
//                 const containerHeight = container.clientHeight;
//                 const scrollTo = itemOffset - containerHeight / 2;
                
//                 container.scrollTo({
//                     top: scrollTo,
//                     behavior: 'smooth'
//                 });
//             }
//         }
//     }
    
//     setupProgressBar() {
//         const progressClick = (e) => {
//             e.stopPropagation();
//             const rect = this.progressBar.getBoundingClientRect();
//             const percent = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
//             this.video.currentTime = percent * this.video.duration;
//             this.updateProgress();
//         };
        
//         this.progressBar.addEventListener('click', progressClick);
        
//         let isDragging = false;
        
//         const startDrag = (e) => {
//             e.stopPropagation();
//             isDragging = true;
//             progressClick(e);
//             document.addEventListener('mousemove', duringDrag);
//             document.addEventListener('mouseup', stopDrag);
//         };
        
//         const duringDrag = (e) => {
//             if (!isDragging) return;
//             progressClick(e);
//         };
        
//         const stopDrag = () => {
//             isDragging = false;
//             document.removeEventListener('mousemove', duringDrag);
//             document.removeEventListener('mouseup', stopDrag);
//         };
        
//         this.progressBar.addEventListener('mousedown', startDrag);
//         this.progressThumb.addEventListener('mousedown', startDrag);
//     }
    
//     setupControlsVisibility() {
//         let controlsTimeout;
        
//         const showControls = () => {
//             this.controls.classList.add('visible');
//             clearTimeout(controlsTimeout);
            
//             if (!this.video.paused) {
//                 controlsTimeout = setTimeout(() => {
//                     this.controls.classList.remove('visible');
//                 }, 2000);
//             }
//         };
        
//         this.player.addEventListener('mousemove', showControls);
//         this.player.addEventListener('click', showControls);
//         this.video.addEventListener('play', showControls);
        
//         this.player.addEventListener('mouseleave', () => {
//             if (!this.video.paused) {
//                 setTimeout(() => {
//                     this.controls.classList.remove('visible');
//                 }, 500);
//             }
//         });
        
//         this.video.addEventListener('pause', () => {
//             this.controls.classList.add('visible');
//         });
//     }
    
//     togglePlay() {
//         if (this.video.paused) {
//             this.video.play().catch(e => {
//                 console.error('Ошибка воспроизведения:', e);
//             });
//         } else {
//             this.video.pause();
//         }
//     }
    
//     updateProgress() {
//         if (this.video.duration) {
//             const percent = (this.video.currentTime / this.video.duration) * 100;
//             this.progressFill.style.width = `${percent}%`;
//             this.progressThumb.style.left = `${percent}%`;
//         }
//     }
    
//     formatTime(seconds) {
//         if (isNaN(seconds)) return '0:00';
//         const mins = Math.floor(seconds / 60);
//         const secs = Math.floor(seconds % 60);
//         return `${mins}:${secs.toString().padStart(2, '0')}`;
//     }
    
//     toggleFullscreen() {
//         if (!document.fullscreenElement) {
//             this.player.classList.add('fullscreen');
//             if (this.player.requestFullscreen) {
//                 this.player.requestFullscreen();
//             }
//         } else {
//             this.player.classList.remove('fullscreen');
//             if (document.exitFullscreen) {
//                 document.exitFullscreen();
//             }
//         }
//     }
// }

// document.addEventListener('DOMContentLoaded', () => {
//     document.querySelectorAll('.video-player').forEach(player => {
//         new VideoPlayer(player);
//     });
// });

document.addEventListener('DOMContentLoaded', function() {
    loadContentFromHash();
    
    // document.querySelectorAll('#status-faqlist li[data-content]').forEach(item => {
    //     item.addEventListener('click', function(e) {
    //         if (!e.target.closest('[data-question]')) {
    //             history.pushState({}, '', window.location.pathname);
    //             const faqContent = document.getElementById('faqContent');
    //             const placeholder = faqContent.querySelector('.faq-content-placeholder');
    //             if (placeholder) {
    //                 placeholder.style.display = 'block';
    //             }
    //             document.querySelectorAll('.info_page[data-question-id]').forEach(container => {
    //                 container.style.display = 'none';
    //             });
    //             document.querySelectorAll('#status-faqlist li[data-question]').forEach(item => {
    //                 item.classList.remove('active-question');
    //             });
    //         }
    //     });
    // });
});


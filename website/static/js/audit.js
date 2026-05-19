class AuditModule {
    constructor() {
        this.currentStatus = document.getElementById('current-status')?.value || 'all_reports';
        this.yearFilter = document.getElementById('year-filter-value')?.value || '';
        this.quarterFilter = document.getElementById('quarter-filter-value')?.value || '';
        this.previousReportRow = null;
        this.selectedReportId = null;
        this.longPressTimer = null;
        this.LONG_PRESS_DELAY = 500;
        this.isLongPress = false;
        
        this.currentPage = 1;
        this.pageSize = 50;
        this.hasMore = true;
        this.isLoading = false;
        this.allReports = [];
        this.totalReports = 0;
        this.intersectionObserver = null;
        
        this.init();
    }

    async init() {
        await this.loadData();
        this.attachEventListeners();
        this.attachGlobalEventListeners();
        this.initCustomDropdown(); // ← ДОБАВЬТЕ ЭТУ СТРОКУ
    }

    attachGlobalEventListeners() {
        const rollbackButton = document.getElementById('rollbackButton');
        if (rollbackButton) {
            rollbackButton.addEventListener('click', (event) => this.handleRollback(event));
        }

        window.addEventListener('scroll', () => this.handleScroll());
        
        const contextMenuReport = document.getElementById('contextMenu_report');
        if (contextMenuReport) {
            document.addEventListener('click', (event) => this.hideContextMenu(event));
            document.addEventListener('touchstart', (event) => this.hideContextMenu(event));
        }
        
        this.setupNavigationItems();
        this.setupModals();
        this.setupDownloadLinks();
    }

    async loadData() {
        const loadingSpinner = document.getElementById('loading-spinner');
        const reportsContent = document.getElementById('reports-content');
        const emptyState = document.getElementById('empty-state');
        
        if (loadingSpinner) loadingSpinner.style.display = 'flex';
        if (reportsContent) reportsContent.style.display = 'none';
        if (emptyState) emptyState.style.display = 'none';

        this.animateStatsLoading();
        
        this.currentPage = 1;
        this.hasMore = true;
        this.allReports = [];

        try {
            const data = await this.fetchAuditData(1, false);
            if (data.success) {
                this.updateStatsWithAnimation(data.stats);
                this.renderReports(this.allReports);
                
                if (loadingSpinner) loadingSpinner.style.display = 'none';
                
                this.attachRowEventListeners();
                this.setupInfiniteScroll();
            }
        } catch (error) {
            console.error('Error loading data:', error);
            if (loadingSpinner) loadingSpinner.style.display = 'none';
            this.showError('Ошибка загрузки данных');
        }
    }

    setupInfiniteScroll() {
        const trigger = document.getElementById('infinite-scroll-trigger');
        if (!trigger) return;

        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }

        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && this.hasMore && !this.isLoading) {
                    this.loadMoreReports();
                }
            });
        }, { 
            threshold: 0.1,
            rootMargin: '0px 0px 100px 0px'
        });

        this.intersectionObserver.observe(trigger);
    }

    async loadMoreReports() {
        if (this.isLoading || !this.hasMore) return;
        
        this.isLoading = true;
        const loadingMore = document.getElementById('loading-more');
        if (loadingMore) loadingMore.style.display = 'flex';
        
        try {
            this.currentPage++;
            const data = await this.fetchAuditData(this.currentPage, true);
            
            if (data.success) {
                this.renderReports(this.allReports);
                this.attachRowEventListeners();
            }
        } catch (error) {
            console.error('Error loading more reports:', error);
            this.hasMore = false;
        } finally {
            this.isLoading = false;
            const loadingMore = document.getElementById('loading-more');
            if (loadingMore) loadingMore.style.display = 'none';
        }
    }

    attachRowEventListeners() {
        const reportRows = document.querySelectorAll('.report_row');
        
        reportRows.forEach((row) => {
            row.removeEventListener('click', this.handleRowClick);
            row.removeEventListener('contextmenu', this.handleContextMenu);
            row.removeEventListener('touchstart', this.handleTouchStart);
            row.removeEventListener('touchmove', this.handleTouchMove);
            row.removeEventListener('touchend', this.handleTouchEnd);
            row.removeEventListener('touchcancel', this.handleTouchCancel);
            row.removeEventListener('dragstart', this.handleDragStart);
            row.removeEventListener('dragend', this.handleDragEnd);
            
            this.handleRowClick = this.handleRowClick.bind(this);
            this.handleContextMenu = this.handleContextMenu.bind(this);
            this.handleTouchStart = this.handleTouchStart.bind(this);
            this.handleTouchMove = this.handleTouchMove.bind(this);
            this.handleTouchEnd = this.handleTouchEnd.bind(this);
            this.handleTouchCancel = this.handleTouchCancel.bind(this);
            this.handleDragStart = this.handleDragStart.bind(this);
            this.handleDragEnd = this.handleDragEnd.bind(this);
            
            row.addEventListener('click', this.handleRowClick);
            row.addEventListener('contextmenu', this.handleContextMenu);
            row.addEventListener('touchstart', this.handleTouchStart);
            row.addEventListener('touchmove', this.handleTouchMove);
            row.addEventListener('touchend', this.handleTouchEnd);
            row.addEventListener('touchcancel', this.handleTouchCancel);
            row.addEventListener('dragstart', this.handleDragStart);
            row.addEventListener('dragend', this.handleDragEnd);
        });
        
        this.setupDropTargets();
    }

    handleRowClick(event) {
        const row = event.currentTarget;
        if (this.isLongPress) {
            this.isLongPress = false;
            return;
        }
        
        if (row.dataset.id) {
            this.selectedReportId = row.dataset.id;
            if (row.classList.contains('active-report')) {
                row.classList.remove('active-report');
                this.previousReportRow = null;
            } else {
                if (this.previousReportRow) {
                    this.previousReportRow.classList.remove('active-report');
                }
                row.classList.add('active-report');
                this.previousReportRow = row;
            }
            this.hideContextMenu();
        }
    }

    handleContextMenu(event) {
        event.preventDefault();
        this.showContextMenu(event, event.currentTarget);
    }

    handleTouchStart(event) {
        this.isLongPress = false;
        this.longPressTimer = setTimeout(() => {
            this.isLongPress = true;
            this.showContextMenu(event, event.currentTarget);
        }, this.LONG_PRESS_DELAY);
    }

    handleTouchMove(event) {
        clearTimeout(this.longPressTimer);
    }

    handleTouchEnd(event) {
        clearTimeout(this.longPressTimer);
    }

    handleTouchCancel(event) {
        clearTimeout(this.longPressTimer);
    }

    handleDragStart(event) {
        const row = event.currentTarget;
        const reportId = row.dataset.id;
        
        const statusCell = row.children[8];
        const statusBadge = statusCell?.querySelector('.status-badge');
        const statusText = statusBadge?.querySelector('span:last-child')?.textContent.trim() || '';
        
        if (statusText === 'Непросмотренный') {
            event.dataTransfer.setData('text/plain', reportId);
            row.classList.add('dragging');
            this.setDraggingState(true);
        } else {
            event.preventDefault();
        }
        
        if (this.previousReportRow) {
            this.previousReportRow.classList.remove('active-report');
        }
        row.classList.add('active-report');
        this.previousReportRow = row;
    }

    handleDragEnd(event) {
        const row = event.currentTarget;
        row.classList.remove('dragging');
        this.setDraggingState(false);
    }

    showContextMenu(event, row) {
        event.preventDefault();
        const contextMenuReport = document.getElementById('contextMenu_report');
        if (!contextMenuReport) return;
        
        if (row.dataset.id) {
            this.selectedReportId = row.dataset.id;
            
            if (this.previousReportRow) {
                this.previousReportRow.classList.remove('active-report');
            }
            row.classList.add('active-report');
            this.previousReportRow = row;
            
            let pageX, pageY;
            if (event.touches) {
                pageX = event.touches[0].pageX;
                pageY = event.touches[0].pageY;
            } else {
                pageX = event.pageX;
                pageY = event.pageY;
            }
            
            contextMenuReport.style.top = pageY + 'px';
            contextMenuReport.style.left = pageX + 'px';
            contextMenuReport.style.display = 'flex';
            
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }
    }

    hideContextMenu(event) {
        const contextMenuReport = document.getElementById('contextMenu_report');
        if (contextMenuReport && (!event || !contextMenuReport.contains(event.target))) {
            contextMenuReport.style.display = 'none';
        }
    }

    setDraggingState(isDragging) {
        const with_remarks = document.querySelector('li[data-action="remarks"]');
        const to_conf = document.querySelector('li[data-action="to_download"]');
        const to_del = document.querySelector('li[data-action="to_delete"]');
        
        if (with_remarks) {
            with_remarks.style.background = isDragging ? 'rgb(255, 211, 129)' : '';
            with_remarks.style.color = isDragging ? 'black' : '';
            with_remarks.style.padding = isDragging ? '20px 50px' : '';
            with_remarks.style.marginBottom = isDragging ? '0' : '';
        }
        if (to_conf) {
            to_conf.style.background = isDragging ? 'rgb(144, 255, 162)' : '';
            to_conf.style.color = isDragging ? 'black' : '';
            to_conf.style.padding = isDragging ? '20px 50px' : '';
            to_conf.style.marginBottom = isDragging ? '0' : '';
        }
        if (to_del) {
            to_del.style.background = isDragging ? 'rgb(255, 139, 139)' : '';
            to_del.style.color = isDragging ? 'black' : '';
            to_del.style.padding = isDragging ? '20px 50px' : '';
            to_del.style.marginBottom = isDragging ? '0' : '';
        }
    }

    setupDropTargets() {
        const navigationItems = document.querySelectorAll('.menu_audit li');
        
        navigationItems.forEach((item) => {
            const action = item.dataset.action;
            if (['remarks', 'to_download', 'to_delete'].includes(action)) {
                item.removeEventListener('dragover', this.handleDragOver);
                item.removeEventListener('dragenter', this.handleDragEnter);
                item.removeEventListener('dragleave', this.handleDragLeave);
                item.removeEventListener('drop', this.handleDrop);
                
                this.handleDragOver = this.handleDragOver.bind(this);
                this.handleDragEnter = this.handleDragEnter.bind(this);
                this.handleDragLeave = this.handleDragLeave.bind(this);
                this.handleDrop = this.handleDrop.bind(this);
                
                item.addEventListener('dragover', this.handleDragOver);
                item.addEventListener('dragenter', this.handleDragEnter);
                item.addEventListener('dragleave', this.handleDragLeave);
                item.addEventListener('drop', this.handleDrop);
            }
        });
    }

    handleDragOver(event) {
        event.preventDefault();
    }

    handleDragEnter(event) {
        event.preventDefault();
        event.currentTarget.classList.add('dragging');
    }

    handleDragLeave(event) {
        event.preventDefault();
        event.currentTarget.classList.remove('dragging');
    }

    handleDrop(event) {
        event.preventDefault();
        const targetItem = event.currentTarget;
        targetItem.classList.remove('dragging');
        const reportId = event.dataTransfer.getData('text/plain');
        const action = targetItem.dataset.action;
        
        const form = document.getElementById('change-category-form');
        const reportIdInput = document.getElementById('report-id-input');
        const actionInput = document.getElementById('action-input');
        
        const activeReport = document.querySelector('.active-report');
        if (activeReport && activeReport.dataset.id === reportId && form) {
            if (reportIdInput) reportIdInput.value = reportId;
            if (actionInput) actionInput.value = action;
            form.submit();
        }
        
        if (this.previousReportRow) {
            this.previousReportRow.classList.remove('active-report');
            this.previousReportRow = null;
        }
    }

    setupNavigationItems() {
        const navItems = document.querySelectorAll('.menu_audit li[data-action]');
        
        navItems.forEach(item => {
            item.removeEventListener('click', this.handleNavClick);
            this.handleNavClick = (event) => {
                navItems.forEach(i => i.classList.remove('active_functions_menu'));
                item.classList.add('active_functions_menu');
                
                const action = item.getAttribute('data-action');
                window.location.href = `/audit-area/${action}?year=${this.getQueryParam('year')}&quarter=${this.getQueryParam('quarter')}`;
            };
            item.addEventListener('click', this.handleNavClick);
        });
        
        const currentAction = window.location.pathname.split('/').pop();
        navItems.forEach(item => {
            if (item.getAttribute('data-action') === currentAction) {
                item.classList.add('active_functions_menu');
            }
        });
    }

    handleRollback(event) {
        const activeRow = document.querySelector('.report_row.active-report');
        if (activeRow !== null) {
            const ReportId = activeRow.dataset.id;
            if (ReportId) {
                const deleteForm = document.getElementById('deleteReport');
                if (deleteForm) {
                    deleteForm.action = '/rollbackreport/' + ReportId;
                }
            }
        } else {
            alert('Выберите отчет для отката');
            event.preventDefault();
        }
    }

    handleScroll() {
        const menu = document.querySelector('.sticky_menu');
        if (menu) {
            if (window.scrollY > 60) {
                menu.classList.add('shadow');
            } else {
                menu.classList.remove('shadow');
            }
        }
    }

    setupModals() {
        const ChooseAudit_modal = document.getElementById('ChooseAuditModal');
        if (ChooseAudit_modal) {
            const close_ChooseAudit_modal = ChooseAudit_modal.querySelector('.close');
            if (close_ChooseAudit_modal) {
                close_ChooseAudit_modal.addEventListener('click', () => {
                    ChooseAudit_modal.style.display = 'none';
                });
            }
            ChooseAudit_modal.addEventListener('click', (event) => {
                if (event.target === ChooseAudit_modal) {
                    ChooseAudit_modal.style.display = 'none';
                }
            });
        }
        
        this.handleModal('period_modal', 'link_period');
        this.handleModal('load_reports_modal', 'link_load');
    }

    handleModal(modalId, linkId) {
        const modal = document.getElementById(modalId);
        const openLink = document.getElementById(linkId);
        if (modal && openLink) {
            const closeBtn = modal.querySelector('.close');
            openLink.addEventListener('click', (event) => {
                if (openLink.style.opacity === '0.5') {
                    event.preventDefault();
                } else {
                    modal.classList.add('active');
                }
            });
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.classList.remove('active');
                });
            }
            window.addEventListener('click', (event) => {
                if (event.target === modal) {
                    modal.classList.remove('active');
                }
            });
        }
    }

    setupDownloadLinks() {
        const dbfLink = document.getElementById('douwnload_DBF_link');
        if (dbfLink) {
            dbfLink.addEventListener('click', () => {
                document.getElementById('douwnload_DBF_form')?.submit();
            });
        }
        
        const xmlLink = document.getElementById('douwnload_XML_link');
        if (xmlLink) {
            xmlLink.addEventListener('click', () => {
                document.getElementById('douwnload_XML_form')?.submit();
            });
        }
    }

    getQueryParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param) || '';
    }

    async fetchAuditData(page = 1, append = false) {
        const params = new URLSearchParams({
            status: this.currentStatus,
            year: this.yearFilter,
            quarter: this.quarterFilter,
            page: page,
            per_page: this.pageSize
        });
        
        const searchName = document.getElementById('organization-filter')?.value;
        const searchOkpo = document.getElementById('okpo-filter')?.value;
        const regionFilter = document.getElementById('region-filter')?.value;
        
        if (searchName) params.append('search_name', searchName);
        if (searchOkpo) params.append('search_okpo', searchOkpo);
        if (regionFilter) params.append('region', regionFilter);
        
        const response = await fetch(`/api/audit-data?${params}`);
        const data = await response.json();
        
        if (append) {
            this.allReports = [...this.allReports, ...data.reports];
        } else {
            this.allReports = data.reports;
        }
        
        this.totalReports = data.total;
        this.hasMore = data.has_more;
        
        return data;
    }

    animateStatsLoading() {
        const statElements = [
            document.querySelector('[data-action="not_viewed"] .count-reports span'),
            document.querySelector('[data-action="to_delete"] .count-reports span'),
            document.querySelector('[data-action="remarks"] .count-reports span'),
            document.querySelector('[data-action="to_download"] .count-reports span'),
            document.querySelector('[data-action="all_reports"] .count-reports span')
        ];
        
        statElements.forEach(element => {
            if (element) {
                element.classList.add('stat-loading');
                element.textContent = '...';
            }
        });
    }

    updateStatsWithAnimation(stats) {
        const statElements = {
            'not_viewed': document.querySelector('[data-action="not_viewed"] .count-reports span'),
            'to_delete': document.querySelector('[data-action="to_delete"] .count-reports span'),
            'remarks': document.querySelector('[data-action="remarks"] .count-reports span'),
            'to_download': document.querySelector('[data-action="to_download"] .count-reports span'),
            'all_reports': document.querySelector('[data-action="all_reports"] .count-reports span')
        };
        
        for (const [key, element] of Object.entries(statElements)) {
            if (element && stats[key] !== undefined) {
                element.classList.remove('stat-loading');
                element.classList.add('stat-updated');
                this.animateNumber(element, element.textContent, stats[key]);
                setTimeout(() => {
                    element.classList.remove('stat-updated');
                }, 500);
            }
        }
    }

    animateNumber(element, oldValue, newValue) {
        const start = parseInt(oldValue) || 0;
        const end = parseInt(newValue) || 0;
        const duration = 500;
        const startTime = performance.now();
        
        const updateNumber = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const current = Math.floor(start + (end - start) * this.easeOutCubic(progress));
            element.textContent = current;
            
            if (progress < 1) {
                requestAnimationFrame(updateNumber);
            } else {
                element.textContent = end;
            }
        };
        
        requestAnimationFrame(updateNumber);
    }

    easeOutCubic(x) {
        return 1 - Math.pow(1 - x, 3);
    }

    updateStats(stats) {
        const statElements = {
            'not_viewed': document.querySelector('[data-action="not_viewed"] .count-reports span'),
            'to_delete': document.querySelector('[data-action="to_delete"] .count-reports span'),
            'remarks': document.querySelector('[data-action="remarks"] .count-reports span'),
            'to_download': document.querySelector('[data-action="to_download"] .count-reports span'),
            'all_reports': document.querySelector('[data-action="all_reports"] .count-reports span')
        };
        
        for (const [key, element] of Object.entries(statElements)) {
            if (element && stats[key] !== undefined) {
                element.textContent = stats[key];
            }
        }
    }

    renderReports(reports) {
        const tbody = document.getElementById('reports-tbody');
        const reportsContent = document.getElementById('reports-content');
        const emptyState = document.getElementById('empty-state');
        
        if (!tbody) return;

        if (!reports || reports.length === 0) {
            if (tbody) tbody.innerHTML = '';
            if (reportsContent) reportsContent.style.display = 'none';
            if (emptyState) emptyState.style.display = 'flex';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        if (reportsContent) reportsContent.style.display = 'block';

        const sortedReports = [...reports].sort((a, b) => {
            return new Date(a.sent_datetime) - new Date(b.sent_datetime);
        });
        
        tbody.innerHTML = sortedReports.map(report => this.getReportRowHTML(report)).join('');
    }


    groupReportsByVersion(reports) {
        const grouped = {};
        reports.forEach(report => {
            if (!grouped[report.id]) {
                grouped[report.id] = {
                    id: report.id,
                    organization_name: report.organization_name,
                    okpo: report.okpo,
                    year: report.year,
                    quarter: report.quarter,
                    versions: []
                };
            }
            grouped[report.id].versions.push(report);
        });
        return grouped;
    }

    generateReportsHTML(groupedReports) {
        let html = '';
        const sortedReports = Object.values(groupedReports)
            .map(row => {
                const version = row.versions[0];
                return {
                    ...row,
                    sent_time: version.sent_time
                };
            })
            .sort((a, b) => {
                return new Date(a.sent_time) - new Date(b.sent_time);
            });
        
        for (const row of sortedReports) {
            const version = row.versions[0];
            html += this.getReportRowHTML(row, version);
        }
        return html;
    }

    formatDate(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        return `${day}-${month}-${year}`;
    }

    getReportRowHTML(report) {
        const formattedDate = this.formatDate(report.sent_time);
        return `
            <tr class="report_row ${report.has_not ? 'hascomment-row' : ''}" data-id="${report.id}" draggable="true">
                <td>
                </td>
                <td style="padding: 4px;">
                    <button class="open-report-btn" onclick="window.location.href='/audit-area/report/${report.version_id}'">   
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>Просмотр</span>
                    </button>
                </td>
                <td style="display: none;">
                    <input type="text" id="report_id" value="${report.id}" readonly>
                </td>
                <td>
                    <input type="text" value='${this.escapeHtml(report.organization_name).toUpperCase()}' readonly style="width: 100%; border: none; background: transparent; text-transform: uppercase;">
                </td>
                <td>
                    <input type="text" value="${report.okpo}" readonly style="width: 100%; border: none; background: transparent;">
                </td>
                <td>
                    <input type="text" value="${report.year}" readonly style="width: 100%; border: none; background: transparent;">
                </td>
                <td>
                    <input type="text" value="${report.quarter}" readonly style="width: 100%; border: none; background: transparent;">
                </td>
                <td>
                    <input type="text" value="${formattedDate}" readonly style="width: 100%; border: none; background: transparent;">
                </td>
                <td>
                    ${this.getStatusBadge(report.status)}
                </td>
                <td>
                </td>
            </tr>
        `;
    }

    getStatusBadge(status) {
        const badges = {
            'Одобрен': {
                class: 'status-approved',
                icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />',
                text: 'Одобрен'
            },
            'Отправлен': {
                class: 'status-pending',
                icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />',
                text: 'Непросмотренный'
            },
            'Есть замечания': {
                class: 'status-warning',
                icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />',
                text: 'Есть замечания'
            },
            'Готов к удалению': {
                class: 'status-delete',
                icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />',
                text: 'Готов к удалению'
            }
        };

        const badge = badges[status];
        if (badge) {
            return `
                <span class="status-badge ${badge.class}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${badge.icon}
                    </svg>
                    <span>${badge.text}</span>
                </span>
            `;
        }
        return `<span class="status-badge status-default"><span>${status}</span></span>`;
    }

    initCustomDropdown() {
        const dropdown = document.getElementById('region-dropdown');
        const trigger = document.getElementById('region-trigger');
        const menu = document.getElementById('region-menu');
        const dropdownText = trigger.querySelector('.dropdown-text');
        
        if (!dropdown || !trigger || !menu) return;
        
        // Открытие/закрытие
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
        });
        
        // Выбор значения
        menu.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = item.dataset.value;
                const text = item.textContent;
                
                // Обновляем текст
                dropdownText.textContent = text;
                
                // Обновляем выбранный класс
                menu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                
                // Закрываем дропдаун
                dropdown.classList.remove('open');
                
                // Вызываем фильтрацию
                this.filterReports();
            });
        });
        
        // Закрытие при клике вне
        document.addEventListener('click', () => {
            dropdown.classList.remove('open');
        });
    }

    // Обновите метод filterReports
    async filterReports() {
        const searchName = document.getElementById('organization-filter')?.value || '';
        const searchOkpo = document.getElementById('okpo-filter')?.value || '';
        
        // Получаем выбранное значение из кастомного дропдауна
        const selectedItem = document.querySelector('#region-menu .dropdown-item.selected');
        const regionFilter = selectedItem?.dataset.value || '';
        
        const loadingSpinner = document.getElementById('loading-spinner');
        const reportsContent = document.getElementById('reports-content');
        const emptyState = document.getElementById('empty-state');
        
        if (loadingSpinner) loadingSpinner.style.display = 'flex';
        if (reportsContent) reportsContent.style.display = 'none';
        if (emptyState) emptyState.style.display = 'none';

        this.currentPage = 1;
        this.hasMore = true;
        this.allReports = [];

        try {
            const params = new URLSearchParams({
                status: this.currentStatus,
                year: this.yearFilter,
                quarter: this.quarterFilter,
                search_name: searchName,
                search_okpo: searchOkpo,
                region: regionFilter,
                page: 1,
                per_page: this.pageSize
            });
            
            const response = await fetch(`/api/audit-data?${params}`);
            const data = await response.json();
            
            if (data.success) {
                this.allReports = data.reports;
                this.totalReports = data.total;
                this.hasMore = data.has_more;
                
                this.renderReports(this.allReports);
                
                if (loadingSpinner) loadingSpinner.style.display = 'none';
                
                this.attachRowEventListeners();
                this.setupInfiniteScroll();
            }
        } catch (error) {
            console.error('Error filtering reports:', error);
            if (loadingSpinner) loadingSpinner.style.display = 'none';
            this.showError('Ошибка фильтрации');
        }
    }

    showError(message) {
        const reportsContent = document.getElementById('reports-content');
        const emptyState = document.getElementById('empty-state');
        
        if (reportsContent) reportsContent.style.display = 'none';
        if (emptyState) {
            emptyState.style.display = 'flex';
            emptyState.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <h3>Ошибка</h3>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    attachEventListeners() {
        const organizationFilter = document.getElementById('organization-filter');
        const okpoFilter = document.getElementById('okpo-filter');
        const regionFilter = document.getElementById('region-filter');
        
        let searchTimeout;
        const handleSearch = () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.filterReports();
            }, 300);
        };

        if (organizationFilter) {
            organizationFilter.removeEventListener('input', handleSearch);
            organizationFilter.addEventListener('input', handleSearch);
        }
        if (okpoFilter) {
            okpoFilter.removeEventListener('input', handleSearch);
            okpoFilter.addEventListener('input', handleSearch);
        }
        if (regionFilter) {
            regionFilter.removeEventListener('change', handleSearch);
            regionFilter.addEventListener('change', handleSearch);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AuditModule();
});
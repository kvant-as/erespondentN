"""Печать квитанций отчёта в PDF: те же строки, что в таблице квитанций на
странице (ticket_track.track_rows), плюс сведения об отчёте в шапке."""

import os
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from common_models import current_utc_time
from .ticket_track import DATE_FMT, review_org_for, track_rows

FONT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'fonts')
REGULAR, BOLD = 'MontserratRegular', 'MontserratBold'

INK = colors.HexColor('#111827')
MUTED = colors.HexColor('#6b7280')
LINE = colors.HexColor('#e5e7eb')
STATUS_COLORS = {
    'status-approved': '#15803d',
    'status-warning': '#b45309',
    'status-delete': '#b91c1c',
    'status-pending': '#1d4ed8',
    'status-draft': '#4b5563',
}


def _register_fonts():
    names = pdfmetrics.getRegisteredFontNames()
    if REGULAR not in names:
        pdfmetrics.registerFont(TTFont(REGULAR, os.path.join(FONT_DIR, 'Montserrat-Regular.ttf')))
    if BOLD not in names:
        pdfmetrics.registerFont(TTFont(BOLD, os.path.join(FONT_DIR, 'Montserrat-Bold.ttf')))


def _style(name, font=REGULAR, size=8.5, leading=None, color=INK):
    return ParagraphStyle(name, fontName=font, fontSize=size, leading=leading or size * 1.35, textColor=color)


def _p(text, style):
    return Paragraph(escape(text or '').replace('\n', '<br/>'), style)


def build_tickets_pdf(version):
    _register_fonts()
    report = version.report
    org = report.organization
    review_org = review_org_for(report)
    rows = track_rows(version)
    printed_at = current_utc_time().strftime(DATE_FMT)

    title_st = _style('title', BOLD, 15, 19)
    label_st = _style('label', size=8, color=MUTED)
    value_st = _style('value', BOLD, 9)
    head_st = _style('head', BOLD, 8, color=colors.HexColor('#4b5563'))
    cell_st = _style('cell')
    cell_bold = _style('cell_bold', BOLD)
    code_st = _style('code', size=7, color=colors.HexColor('#8a94a3'))

    story = [Paragraph('Квитанции по отчёту', title_st), Spacer(1, 4 * mm)]

    meta = [
        ('Организация', org.full_name if org else '—'),
        ('УНП', (org.ynp if org else None) or '—'),
        ('ОКПО', (org.okpo if org else None) or '—'),
        ('Отчётный период', f'{report.quarter} квартал {report.year} г.'),
        ('Текущий статус', version.status or '—'),
        ('Проверяет', review_org.full_name if review_org else 'Региональное управление по надзору'),
    ]
    meta_rows = [[_p(label, label_st), _p(value, value_st)] for label, value in meta]
    meta_table = Table(meta_rows, colWidths=[38 * mm, 160 * mm], hAlign='LEFT')
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
    ]))
    story += [meta_table, Spacer(1, 6 * mm)]

    if not rows:
        story.append(_p('Квитанций пока нет: они появятся после отправки отчёта на проверку.', cell_st))
    else:
        header = [_p(h, head_st) for h in ('Тип действия', 'Организация', 'ФИО, телефон', 'Статус', 'Дата', 'Замечания')]
        data = [header]
        last = len(rows) - 1
        for i, r in enumerate(rows):
            type_st = cell_bold if i == last else cell_st
            org_cell = [_p(r['org_name'], cell_st)]
            if r['org'] is not None and r['org'].ynp:
                org_cell.append(_p(f"УНП {r['org'].ynp}", code_st))
            status_st = _style(f'status{i}', BOLD if i == last else REGULAR, 8.5,
                               color=colors.HexColor(STATUS_COLORS.get(r['badge_cls'], '#4b5563')))
            data.append([
                _p(r['type_label'], type_st),
                org_cell,
                _p(r['person'], cell_st),
                _p(r['badge_label'], status_st),
                _p(r['date'].strftime(DATE_FMT) if r['date'] else '', cell_st),
                _p(r['note'], cell_st),
            ])
        widths = [42 * mm, 58 * mm, 50 * mm, 36 * mm, 29 * mm, 54 * mm]
        table = Table(data, colWidths=widths, repeatRows=1)
        style = [
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f3f4f6')),
            ('LINEBELOW', (0, 0), (-1, -1), 0.4, LINE),
            ('BOX', (0, 0), (-1, -1), 0.6, colors.HexColor('#d1d5db')),
            ('LEFTPADDING', (0, 0), (-1, -1), 5),
            ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('BACKGROUND', (0, len(data) - 1), (-1, len(data) - 1), colors.HexColor('#f0f7ff')),
        ]
        table.setStyle(TableStyle(style))
        story.append(table)

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont(REGULAR, 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(doc.leftMargin, 8 * mm, f'ErespondentN · напечатано {printed_at}')
        canvas.drawRightString(doc.pagesize[0] - doc.rightMargin, 8 * mm, f'Стр. {doc.page}')
        canvas.restoreState()

    buffer = BytesIO()
    okpo = (org.okpo if org else None) or str(report.id)
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4), leftMargin=14 * mm, rightMargin=14 * mm,
                            topMargin=14 * mm, bottomMargin=16 * mm,
                            title=f'Квитанции по отчёту {okpo} за {report.quarter} квартал {report.year}',
                            author='ErespondentN')
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()

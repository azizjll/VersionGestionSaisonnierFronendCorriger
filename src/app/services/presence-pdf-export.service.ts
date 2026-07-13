import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Injectable({ providedIn: 'root' })
export class PresencePdfExportService {

  export(
    rows: any[],
    config: { tauxJournalier: number; dureeContrat: number; campagneNom: string },
    totals: { totalJours: number; totalAbsences: number; totalMontant: number },
    directionNom = '',
    rhNom = ''
  ): void {

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const today = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });

    const PRIMARY:  [number,number,number] = [30,  80,  160];
    const LIGHT:    [number,number,number] = [235, 242, 255];
    const DARK:     [number,number,number] = [45,  45,  55];
    const GRAY:     [number,number,number] = [100, 100, 110];
    const WHITE:    [number,number,number] = [255, 255, 255];
    const LINE:     [number,number,number] = [200, 210, 230];
    const ALT_ROW:  [number,number,number] = [248, 250, 255];

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // ── HEADER ──────────────────────────────────────────────────────
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 0, pageW, 28, 'F');

    doc.setTextColor(...WHITE);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('ÉTAT DE PRÉSENCE ET DE PAIEMENT', pageW / 2, 11, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Campagne : ${config.campagneNom}  —  Direction : ${directionNom || 'Toutes'}`, pageW / 2, 20, { align: 'center' });

    // Sous-header info
    doc.setFillColor(...LIGHT);
    doc.rect(0, 28, pageW, 16, 'F');

    doc.setTextColor(...DARK);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Taux journalier :', 14, 35);
    doc.setFont('helvetica', 'normal');
    doc.text(`${config.tauxJournalier.toFixed(3)} DT`, 44, 35);

    doc.setFont('helvetica', 'bold');
    doc.text('Durée contrat :', 80, 35);
    doc.setFont('helvetica', 'normal');
    doc.text(`${config.dureeContrat} jours`, 107, 35);

    doc.setFont('helvetica', 'bold');
    doc.text('Établi par :', 14, 42);
    doc.setFont('helvetica', 'normal');
    doc.text(rhNom || '—', 35, 42);

    doc.setFont('helvetica', 'bold');
    doc.text("Date d'édition :", pageW - 14, 35, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(today, pageW - 14, 42, { align: 'right' });

    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(14, 47, pageW - 14, 47);

    // ── TABLEAU ──────────────────────────────────────────────────────
    const tableRows = rows.map((r, idx) => [
      idx + 1,
      r.nom,
      r.cin,
      r.rib || '—',
      r.absences,
      r.dureeContrat - r.absences,
      r.dureeContrat,
      r.montantNet.toFixed(3),
    ]);

    // Ligne totaux
    tableRows.push([
      '', 'TOTAL GÉNÉRAL', '', '',
      totals.totalAbsences,
      totals.totalJours - totals.totalAbsences,
      totals.totalJours,
      totals.totalMontant.toFixed(3),
    ] as any);

    autoTable(doc, {
      startY: 53,
      head: [[
        'N°', 'Nom et Prénom', 'CIN', 'N° Compte (RIB)',
        'Absences (j)', 'Jours travaillés', 'Durée (j)',
        'Montant net (DT)'
      ]],
      body: tableRows,
      theme: 'grid',
      styles: {
        fontSize: 7.5, cellPadding: 2.8,
        font: 'helvetica', textColor: DARK,
        lineColor: LINE, lineWidth: 0.2,
      },
      headStyles: {
        fillColor: PRIMARY, textColor: WHITE,
        fontStyle: 'bold', fontSize: 8, halign: 'center',
      },
      alternateRowStyles: { fillColor: ALT_ROW },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 45 },
        2: { halign: 'center', cellWidth: 25 },
        3: { cellWidth: 48 },
        4: { halign: 'center', cellWidth: 25 },
        5: { halign: 'center', cellWidth: 28 },
        6: { halign: 'center', cellWidth: 22 },
        7: { halign: 'center', cellWidth: 30 },
      },
      didDrawCell: (data) => {
        // Ligne totaux en gras (dernière ligne)
        if (data.section === 'body' && data.row.index === rows.length) {
          doc.setFillColor(235, 242, 255);
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...PRIMARY);
          doc.setFontSize(7.5);
          if (data.cell.raw !== '') {
            doc.text(
              String(data.cell.raw),
              data.cell.x + data.cell.width / 2,
              data.cell.y + data.cell.height / 2 + 2,
              { align: 'center' }
            );
          }
        }
      },
    });

    // ── FOOTER ───────────────────────────────────────────────────────
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.3);
      doc.line(14, pageH - 10, pageW - 14, pageH - 10);
      doc.setTextColor(...GRAY);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'italic');
      doc.text(
        `Document généré automatiquement — ${today} — ${config.campagneNom}`,
        pageW / 2, pageH - 5, { align: 'center' }
      );
      doc.setFontSize(7);
      doc.text(`Page ${i} / ${totalPages}`, pageW - 14, pageH - 5, { align: 'right' });
    }

    const nomFichier = `etat-paiement-${(directionNom || 'global').replace(/\s/g,'-')}-${today.replace(/\s/g,'-')}.pdf`;
    doc.save(nomFichier);
  }
}
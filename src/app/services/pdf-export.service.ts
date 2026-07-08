import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Injectable({ providedIn: 'root' })
export class PdfExportService {

  exportCandidatures(
    candidatures: any[],
    rhNom: string,
    rhPrenom: string,
    directionNom: string,
    structureMap: Record<number, string> = {}
  ): void {

    // 🔥 FILTRE : seulement ACCEPTÉE ou REFUSÉE
    const filtered = candidatures.filter(c =>
      c.statut === 'ACCEPTEE' || c.statut === 'REJETEE'
    );

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const today = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    const primaryColor: [number, number, number] = [30, 80, 160];
    const white: [number, number, number] = [255, 255, 255];
    const darkGray: [number, number, number] = [45, 45, 55];
    const lineColor: [number, number, number] = [200, 210, 230];

    const pageW = doc.internal.pageSize.getWidth();

    const statusLabel = (s: string): string => ({
      EN_ATTENTE: 'En attente',
      ACCEPTEE: 'Acceptée',
      REJETEE: 'Refusée',
      EN_ATTENTE_VALIDATION_ADMIN: 'Valid. ADM',
      A_CORRIGER: 'À corriger'
    } as any)[s] ?? s;

    // ================= HEADER =================
    const drawHeader = () => {
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, pageW, 28, 'F');

      doc.setTextColor(...white);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('ÉTAT DES CANDIDATURES SAISONNIÈRES', pageW / 2, 12, { align: 'center' });

      doc.setFontSize(9);
      doc.text(` ${directionNom}`, pageW / 2, 20, { align: 'center' });

      doc.setDrawColor(...lineColor);
      doc.line(14, 30, pageW - 14, 30);
    };

    drawHeader();

    // ================= INFO BLOCK (CENTRÉ) =================
    doc.setTextColor(...darkGray);
    doc.setFontSize(10);

    const centerX = pageW / 2;

    doc.setFont('helvetica', 'bold');
    doc.text(`Établi par : ${rhPrenom} ${rhNom}`, centerX, 38, { align: 'center' });


    doc.setFont('helvetica', 'normal');
    doc.text(`Date d'édition : ${today}`, centerX, 50, { align: 'center' });

    // ================= TABLE DATA =================
    const rows = filtered.map((c, idx) => [
      idx + 1,
      `${c.saisonnier.prenom} ${c.saisonnier.nom}`,
      c.saisonnier.cin ?? '—',
      c.saisonnier.email ?? '—',
      c.saisonnier.telephone ?? '—',
      c.saisonnier.rib ?? '—',

      c.saisonnier.matriculeParent ?? '—',
      c.saisonnier.nomPrenomParent ?? '—',

      c.saisonnier.niveauEtude ?? '—',
      c.saisonnier.diplome ?? '—',
      c.saisonnier.specialiteDiplome ?? '—',

      structureMap[c.id] ?? '—',
      c.saisonnier.moisTravail ?? '—',

      // 🔥 STATUS ajouté
      statusLabel(c.statut)
    ]);

    // ================= TABLE =================
    autoTable(doc, {
      startY: 60,

      head: [[
        '#',
        'Nom et prénom',
        'CIN',
        'Email',
        'Tel',
        'RIB',
        'Matricule Parent',
        'Nom Parent',
        'Niveau',
        'Diplôme',
        'Spécialité',
        'Structure',
        'Mois',
        'Statut'
      ]],

      body: rows,

      theme: 'grid',

      styles: {
        fontSize: 7,
        cellPadding: 2,
        overflow: 'linebreak',
        halign: 'center',
        valign: 'middle'
      },

      headStyles: {
        fillColor: primaryColor,
        textColor: white,
        fontSize: 7,
        halign: 'center'
      },

      margin: { left: 6, right: 6 },

      tableWidth: 'auto'
    });

    // ================= SAVE =================
    doc.save(`candidatures-${directionNom}.pdf`);
  }
}
import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx-js-style';  // remplace 'xlsx'
import { SaisonnierDTO, SaisonnierService } from 'src/app/services/saisonnier.service';
import { AuthService } from 'src/app/services/auth.service';
import { CampagneService } from 'src/app/services/campagne.service';
import { StructureDTO, StructureService } from 'src/app/structure.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface SaisonnierPaie {
  id: number;
  // ← depuis le backend
  nom: string;
  prenom: string;
  cin: number;
  rib: string;
  moisTravail: string;
  // ← gérés localement
  dateMbacharah: string;
  duree: number;
  absences: number;
  montantNet: number;
  nomTitulaireCompte: string;
  cinTitulaire: string;
  paye: boolean;
}
@Component({
  selector: 'app-presence-paiement',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe, DatePipe],
  templateUrl: './presence-paiement.component.html',
  styleUrls: ['./presence-paiement.component.scss']
})
export class PresencePaiementComponent implements OnInit {

  // ── Paramètres ────────────────────────────────────
  tauxJourDT  = 8;          // 240 DT / 30 jours = 8 DT/jour
  dureeContrat = 30;
  dateMbacharah = '2025-07-01';
  campagneId: number | null = null;
  campagnes: any[] = [];    // à charger depuis CampagneService si disponible

  currentYear = new Date().getFullYear();
  regionId: number | null = null;

  structures: StructureDTO[] = [];
selectedStructureId: number | null = null;

selectedMois = 'ALL';
moisOptions = [
  { value: 'ALL', label: 'Tous les mois' },
  { value: 'JUILLET', label: 'Juillet' },
  { value: 'AOUT', label: 'Août' },
  { value: 'JUILLET_AOUT', label: 'Juillet & Août' }
];


budgetCampagne = 0;      // salaire mensuel par saisonnier
campagneNom   = '';      // nom de la campagne active


  // ── UI state ──────────────────────────────────────
  searchQ      = '';
  filterPaye   = 'ALL';
  showDetail   = false;
  selectedSaisonnier: SaisonnierPaie | null = null;

  // ── Données ───────────────────────────────────────
  saisonniers: SaisonnierPaie[] = [];

    // ── Méthodes privées pour le style PDF ──────────────────────────
  private applyRowAlternating(data: any, rowIndex: number): void {
    data.cell.styles.fillColor = rowIndex % 2 === 0
      ? [241, 245, 249]
      : [255, 255, 255];
  }

  private applyAbsenceStyle(data: any, s: any): void {
    if (s.absences > 0) {
      data.cell.styles.fillColor = [254, 226, 226];
      data.cell.styles.textColor = [153, 27, 27];
    } else {
      data.cell.styles.fillColor = [209, 250, 229];
      data.cell.styles.textColor = [6, 95, 70];
    }
    data.cell.styles.fontStyle = 'bold';
  }

  private applyMontantStyle(data: any): void {
    data.cell.styles.textColor = [30, 58, 95];
    data.cell.styles.fontStyle = 'bold';
  }

  private applyStatutStyle(data: any, s: any): void {
    data.cell.styles.textColor = s.paye ? [6, 95, 70] : [153, 27, 27];
    data.cell.styles.fontStyle = 'bold';
  }

constructor(
    private readonly saisonnierService: SaisonnierService,
    private readonly authService: AuthService,
    private readonly campagneService: CampagneService,
    private readonly structureService: StructureService

) {}

  ngOnInit(): void {
  this.loadFromStorage();

  this.authService.getMyRegion().subscribe({
    next: (region) => {
      this.regionId = region.id;

      this.campagneService.getCampagnesActives().subscribe({
        next: (campagnes) => {
          if (campagnes.length > 0) {
            this.campagneId = campagnes[0].id;

            // ✅ Récupérer le budget de la campagne active
            const budget = Number(campagnes[0].budget);
            this.budgetCampagne = budget;
this.campagneNom    = campagnes[0].libelle ?? '';

            if (budget > 0 && this.dureeContrat > 0) {
              this.tauxJourDT = Math.round((budget / this.dureeContrat) * 1000) / 1000;
            }

            this.loadSaisonniers();

            this.structureService.getStructuresByRegion(region.id, this.campagneId).subscribe({
              next: (data) => { this.structures = data; },
              error: (err) => console.error('Erreur structures:', err)
            });
          }
        },
        error: (err) => console.error('Erreur campagne:', err)
      });
    },
    error: (err) => console.error('Erreur région RH:', err)
  });
}


onDureeContratChange(): void {
  if (this.budgetCampagne > 0 && this.dureeContrat > 0) {
    this.tauxJourDT = Math.round((this.budgetCampagne / this.dureeContrat) * 1000) / 1000;
  }
  this.recalcAll();
}



onStructureChange(): void {
  if (!this.campagneId) return;

  if (!this.selectedStructureId) {
    this.loadSaisonniers();
    return;
  }

  this.saisonnierService.getByCampagneAndStructure(
    this.campagneId,
    this.selectedStructureId
  ).subscribe({
    next: (dtos) => {
      const localMap = this.buildLocalMap();
      const acceptes = dtos.filter((dto: any) => dto.statut === 'ACCEPTEE'); // ✅ filtrer

      this.saisonniers = acceptes.map(dto => {  // 🔴 acceptes et non dtos
        const saved = localMap[dto.id] ?? {};
        return {
          id:                 dto.id,
          nom:                dto.nom,
          prenom:             dto.prenom,
          cin:                dto.cin,
          rib:                saved.rib ?? dto.rib ?? '',
          dateMbacharah:      saved.dateMbacharah ?? this.dateMbacharah,
          duree:              saved.duree ?? this.dureeContrat,
          absences:           saved.absences ?? 0,
          montantNet:         0,
          nomTitulaireCompte: saved.nomTitulaireCompte ?? '',
          cinTitulaire:       saved.cinTitulaire ?? '',
          paye:               saved.paye ?? false,
          moisTravail:        dto.moisTravail ?? saved.moisTravail ?? 'JUILLET',
        };
      });
      this.recalcAll();
    },
    error: (err) => console.error('Erreur filtre structure:', err)
  });
}


  // ── Chargement depuis le backend (ou mock) ────────
  loadSaisonniers(): void {
  if (!this.campagneId || !this.regionId) return;

  this.saisonnierService.getByCampagneAndRegion(this.campagneId, this.regionId).subscribe({
    next: (dtos: SaisonnierDTO[]) => {
      const localMap = this.buildLocalMap();

      // ✅ plus besoin de filtrer, le backend retourne déjà uniquement les ACCEPTEE
      this.saisonniers = dtos.map(dto => {
        const saved = localMap[dto.id] ?? {};
        return {
          id:                 dto.id,
          nom:                dto.nom,
          prenom:             dto.prenom,
          cin:                dto.cin as any,
          rib:                saved.rib ?? dto.rib ?? '',
          dateMbacharah:      saved.dateMbacharah ?? this.dateMbacharah,
          duree:              saved.duree ?? this.dureeContrat,
	  absences:           dto.absences ?? saved.absences ?? 0,
          montantNet:         0,
          nomTitulaireCompte: saved.nomTitulaireCompte ?? '',
          cinTitulaire:       saved.cinTitulaire ?? '',
          paye:               saved.paye ?? false,
          moisTravail:        dto.moisTravail ?? saved.moisTravail ?? 'JUILLET',
        };
      });
      this.recalcAll();
    }
  });
}


get structuresEC(): StructureDTO[] {
    return this.structures.filter(s => s.type === 'ESPACE_COMMERCIAL');
}

get structuresCT(): StructureDTO[] {
    return this.structures.filter(s => s.type === 'CENTRE_TECHNIQUE');
}

  private buildLocalMap(): Record<number, Partial<SaisonnierPaie>> {
    const raw = localStorage.getItem('tt_paie_data');
    if (!raw) return {};
    try {
      const arr: SaisonnierPaie[] = JSON.parse(raw);
      return Object.fromEntries(arr.map(s => [s.id, s]));
    } catch { return {}; }
  }

  // ── Calculs ───────────────────────────────────────

 recalcRow(s: SaisonnierPaie): void {
  const dureeTotale = this.getDureeContrat(s);

  s.duree      = Math.max(0, dureeTotale - s.absences);
  s.montantNet = s.duree * this.tauxJourDT;

  this.saisonnierService.updateAbsences(s.id, s.absences).subscribe({
    error: (err) => console.error('Erreur mise à jour absences:', err)
  });

  this.save();
}

  recalcAll(): void {
    for (const s of this.saisonniers) {
      s.duree = this.dureeContrat;
      s.dateMbacharah = this.dateMbacharah;
      this.recalcRow(s);
    }
    this.save();
  }

  // ── Totaux ────────────────────────────────────────
  getTotalMontant():   number { return this.saisonniers.reduce((s, x) => s + x.montantNet, 0); }
  getTotalAbsences():  number { return this.saisonniers.reduce((s, x) => s + x.absences, 0); }
  getTotalJours():     number { return this.saisonniers.reduce((s, x) => s + x.duree, 0); }
  getDureeContrat(s: SaisonnierPaie): number {
    return s.moisTravail === 'JUILLET_AOUT' ? 60 : this.dureeContrat;
  }
  // ── Filtre / recherche ────────────────────────────

get filteredSaisonniers(): SaisonnierPaie[] {

  const q = this.searchQ.toLowerCase().trim();

  return this.saisonniers.filter(s => {

    const matchSearch =
      !q ||
      s.nom.toLowerCase().includes(q) ||
      s.prenom.toLowerCase().includes(q) ||
      s.cin.toString().includes(q);

    const matchFilter =
      this.filterPaye === 'ALL' ||
      (this.filterPaye === 'PAYE' && s.paye) ||
      (this.filterPaye === 'IMPAYE' && !s.paye);

    let matchMonth = true;

    if (this.selectedMois !== 'ALL') {

      if (this.selectedMois === 'JUILLET') {
        matchMonth =
          s.moisTravail === 'JUILLET' ||
          s.moisTravail === 'JUILLET_AOUT';

      } else if (this.selectedMois === 'AOUT') {
        matchMonth =
          s.moisTravail === 'AOUT' ||
          s.moisTravail === 'JUILLET_AOUT';

      } else {
        // Cas JUILLET_AOUT (et tout autre mois simple) : correspondance stricte
        matchMonth =
          s.moisTravail === this.selectedMois;
      }
    }

    return matchSearch && matchFilter && matchMonth;
  });
}



  // ── Actions ───────────────────────────────────────
  togglePaye(s: SaisonnierPaie): void {
    s.paye = !s.paye;
    this.save();
  }

  openDetail(s: SaisonnierPaie): void {
    this.selectedSaisonnier = s;
    this.showDetail = true;
  }

  // ── Persistance locale ────────────────────────────
  save(): void {
    localStorage.setItem('tt_paie_data', JSON.stringify(this.saisonniers));
    localStorage.setItem('tt_paie_params', JSON.stringify({
      tauxJourDT: this.tauxJourDT,
      dureeContrat: this.dureeContrat,
      dateMbacharah: this.dateMbacharah,
    }));
  }

  loadFromStorage(): void {
    const data   = localStorage.getItem('tt_paie_data');
    const params = localStorage.getItem('tt_paie_params');
    if (data)   { try { this.saisonniers = JSON.parse(data); } catch {} }
    if (params) {
      try {
        const p = JSON.parse(params);
        this.tauxJourDT    = p.tauxJourDT    ?? 8;
        this.dureeContrat  = p.dureeContrat  ?? 30;
        this.dateMbacharah = p.dateMbacharah ?? '2025-07-01';
      } catch {}
    }
  }

  // ── Export Excel ─────────────────────────────────

exportExcel(): void {
  const wb = XLSX.utils.book_new();

  // ── Styles réutilisables ──────────────────────────────────────────────
  const BLUE_DARK  = '1E3A5F';
  const BLUE_MED   = '2563EB';
  const GREEN_BG   = 'D1FAE5';
  const GREEN_FG   = '065F46';
  const RED_BG     = 'FEE2E2';
  const RED_FG     = '991B1B';
  const GREY_BG    = 'F1F5F9';
  const WHITE      = 'FFFFFF';

 
  const fontTitle  = { name: 'Arial', sz: 14, bold: true, color: { rgb: WHITE } };
  const fontSub    = { name: 'Arial', sz: 10, italic: true, color: { rgb: WHITE } };
  const fontHeader = { name: 'Arial', sz: 10, bold: true, color: { rgb: WHITE } };
  const fontTotal  = { name: 'Arial', sz: 10, bold: true, color: { rgb: WHITE } };

  const borderThin = {
    top:    { style: 'thin', color: { rgb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
    left:   { style: 'thin', color: { rgb: 'CBD5E1' } },
    right:  { style: 'thin', color: { rgb: 'CBD5E1' } },
  };

  const cellTitle: any = {
    font: fontTitle,
    fill: { fgColor: { rgb: BLUE_DARK } },
    alignment: { horizontal: 'center', vertical: 'center' },
  };

 

  const cellHeader: any = {
    font: fontHeader,
    fill: { fgColor: { rgb: BLUE_MED } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: borderThin,
  };

  const cellTotalLabel: any = {
    font: fontTotal,
    fill: { fgColor: { rgb: BLUE_DARK } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderThin,
  };

  const cellTotalVal: any = {
    font: fontTotal,
    fill: { fgColor: { rgb: BLUE_DARK } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderThin,
  };

  // ── Construction de la feuille cellule par cellule ────────────────────
  const ws: any = {};
  const COLS = 6;         // A→G
  const dataStartRow = 5; // ligne Excel où commence les données (1-indexed)

  // Ligne 1 : titre principal
  ws['A1'] = { v: 'Campagne des saisonniers - Etat de Présence', s: cellTitle };
  for (let c = 1; c < COLS; c++) {
    ws[XLSX.utils.encode_cell({ r: 0, c })] = { v: '', s: cellTitle };
  }

  // Ligne 2 : sous-titre paramètres
 

  // Ligne 3 : vide (espacement)
  ws['A3'] = { v: '', s: { fill: { fgColor: { rgb: WHITE } } } };

  // Ligne 4 : en-têtes colonnes
const headers = ['N°', 'Nom et Prénom', 'N° CIN', 'Nbre de jours de travail', "Nbre de jours d'absences", 'N° Compte'];
  headers.forEach((h, c) => {
    ws[XLSX.utils.encode_cell({ r: 3, c })] = { v: h, s: cellHeader };
  });

  // Lignes de données
  const saisonniers = this.filteredSaisonniers;
  saisonniers.forEach((s, i) => {
    const r = dataStartRow - 1 + i;  // 0-indexed row
    const isAlt = i % 2 === 0;
    const bgColor = isAlt ? GREY_BG : WHITE;

    const cellData = (v: any, center = false, bold = false): any => ({
      v,
      s: {
        font: { name: 'Arial', sz: 10, bold, color: { rgb: '1E293B' } },
        fill: { fgColor: { rgb: bgColor } },
        alignment: { horizontal: center ? 'center' : 'left', vertical: 'center' },
        border: borderThin,
      },
    });

    ws[XLSX.utils.encode_cell({ r, c: 0 })] = cellData(i + 1, true, true);
    ws[XLSX.utils.encode_cell({ r, c: 1 })] = cellData(`${s.prenom} ${s.nom}`);
    ws[XLSX.utils.encode_cell({ r, c: 2 })] = cellData(s.cin, true);
    ws[XLSX.utils.encode_cell({ r, c: 3 })] = cellData(s.duree, true);

    // Absences : colorée selon valeur
    const absColor = s.absences > 0
      ? { bg: RED_BG,   fg: RED_FG }
      : { bg: GREEN_BG, fg: GREEN_FG };
    ws[XLSX.utils.encode_cell({ r, c: 4 })] = {
      v: s.absences,
      s: {
        font: { name: 'Arial', sz: 10, bold: true, color: { rgb: absColor.fg } },
        fill: { fgColor: { rgb: absColor.bg } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: borderThin,
      },
    };

    // Montant net : formaté
   

    // Statut payé
    ws[XLSX.utils.encode_cell({ r, c: 5 })] = cellData(s.rib || '—', true);
  });

  // Ligne Total
  const totalRow = dataStartRow - 1 + saisonniers.length;
  ws[XLSX.utils.encode_cell({ r: totalRow, c: 0 })] = { v: 'TOTAL',                         s: cellTotalLabel };
  ws[XLSX.utils.encode_cell({ r: totalRow, c: 1 })] = { v: `${saisonniers.length} saisonniers`,   s: cellTotalLabel };
  ws[XLSX.utils.encode_cell({ r: totalRow, c: 2 })] = { v: '',                               s: cellTotalVal };
  ws[XLSX.utils.encode_cell({ r: totalRow, c: 3 })] = { v: this.getTotalJours(),             s: cellTotalVal };
  ws[XLSX.utils.encode_cell({ r: totalRow, c: 4 })] = { v: this.getTotalAbsences(),          s: cellTotalVal };
 
  ws[XLSX.utils.encode_cell({ r: totalRow, c: 6 })] = { v: '', s: cellTotalVal };

  // ── Fusions (merge) ───────────────────────────────────────────────────
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } },   // titre
    { s: { r: 1, c: 0 }, e: { r: 1, c: COLS - 1 } },   // sous-titre
    { s: { r: totalRow, c: 0 }, e: { r: totalRow, c: 1 } }, // "TOTAL" + nb agents
  ];

  // ── Largeurs colonnes ─────────────────────────────────────────────────
  ws['!cols'] = [
    { wch: 5  },   // N°
    { wch: 28 },   // Nom
    { wch: 14 },   // CIN
    { wch: 14 },   // Durée
    { wch: 14 },   // Absences
    { wch: 26 },   // N° Compte
  ];

  // ── Hauteurs lignes ───────────────────────────────────────────────────
  ws['!rows'] = [
    { hpt: 30 },  // titre
    { hpt: 22 },  // sous-titre
    { hpt: 8  },  // vide
    { hpt: 36 },  // en-têtes
  ];

  // ── Plage de la feuille ───────────────────────────────────────────────
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: totalRow, c: COLS - 1 },
  });

  XLSX.utils.book_append_sheet(wb, ws, `Paiement ${this.currentYear}`);
  XLSX.writeFile(wb, `paie_saisonniers_${this.currentYear}.xlsx`);
}


  // ── Export PDF (print) ────────────────────────────

 exportPdf(): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const PAGE_W = doc.internal.pageSize.getWidth();

  // ── Logo / En-tête ────────────────────────────────────────────────────
  // Bande bleue foncée en haut
  doc.setFillColor(30, 58, 95);          // #1E3A5F
  doc.rect(0, 0, PAGE_W, 22, 'F');

  // Titre
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('Tunisie Telecom', 14, 10);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Présence & Paiement — Saisonniers', 14, 17);

  // Infos campagne à droite
  doc.setFontSize(9);
  doc.text(`Campagne ${this.currentYear}`, PAGE_W - 14, 10, { align: 'right' });
  doc.text(
    `Taux journalier : ${this.tauxJourDT} DT  |  Durée : ${this.dureeContrat} jours`,
    PAGE_W - 14, 17, { align: 'right' }
  );

  // ── Bande info sous l'en-tête ─────────────────────────────────────────
  doc.setFillColor(37, 99, 235);         // #2563EB
  doc.rect(0, 22, PAGE_W, 8, 'F');
  doc.setFontSize(8);
  doc.setTextColor(219, 234, 254);       // bleu très clair
  doc.text(
    `Total agents : ${this.filteredSaisonniers.length}  |  ` +
    `Total jours travaillés : ${this.getTotalJours()}  |  ` +
    `Total absences : ${this.getTotalAbsences()}  |  ` +
    `Montant total : ${this.getTotalMontant().toFixed(3)} DT`,
    PAGE_W / 2, 27, { align: 'center' }
  );

  // ── Tableau ───────────────────────────────────────────────────────────
  const headers = [['N°', 'Nom et Prénom', 'N° CIN', 'Nbre de jours de travail', 'Nbre de jours d/absences', 'Montant net (DT)', 'N° Compte']];

  const bodyData = this.filteredSaisonniers.map((s, i) => [
    (i + 1).toString(),
    `${s.prenom} ${s.nom}`,
    s.cin.toString(),
    s.duree.toString(),
    s.absences.toString(),
    `${s.montantNet.toFixed(3)} DT`,
    s.rib || '—',
   
  ]);

  autoTable(doc, {
    head: headers,
    body: bodyData,
    startY: 34,
    margin: { left: 14, right: 14 },
    tableWidth: 'auto',

    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 3,
      valign: 'middle',
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },

    headStyles: {
      fillColor: [37, 99, 235],          // #2563EB
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8.5,
    },

    columnStyles: {
      0: { halign: 'center', cellWidth: 10  },   // N°
      1: { halign: 'left',   cellWidth: 50  },   // Nom
      2: { halign: 'center', cellWidth: 25  },   // CIN
      3: { halign: 'center', cellWidth: 20  },   // Durée
      4: { halign: 'center', cellWidth: 22  },   // Absences
      5: { halign: 'center', cellWidth: 32  },   // Montant
      6: { halign: 'center', cellWidth: 50  },   // RIB
     
    },

    // Lignes alternées + coloration conditionnelle
    didParseCell: (data) => {
  if (data.section !== 'body') return;

  const rowIndex = data.row.index;
  const colIndex = data.column.index;
  const s = this.filteredSaisonniers[rowIndex];

  this.applyRowAlternating(data, rowIndex);

  if (colIndex === 4) this.applyAbsenceStyle(data, s);
  if (colIndex === 5) this.applyMontantStyle(data);
  if (colIndex === 7) this.applyStatutStyle(data, s);
},

    // Ligne de total en bas du tableau
    foot: [[
      '',
      `${this.filteredSaisonniers.length} saisonniers`,
      '',
      this.getTotalJours().toString(),
      this.getTotalAbsences().toString(),
      `${this.getTotalMontant().toFixed(3)} DT`,
      '', ''
    ]],

    footStyles: {
      fillColor:  [30, 58, 95],
      textColor:  [255, 255, 255],
      fontStyle:  'bold',
      halign:     'center',
      fontSize:   8.5,
    },

    // Numérotation des pages
    didDrawPage: (data) => {
      const pageCount = (doc.internal as any).getNumberOfPages();
      const pageNum   = (doc as any).internal.getCurrentPageInfo().pageNumber;
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${pageNum} / ${pageCount}  —  Exporté le ${new Date().toLocaleDateString('fr-TN')}`,
        PAGE_W / 2,
        doc.internal.pageSize.getHeight() - 5,
        { align: 'center' }
      );
    },
  });

  doc.save(`paie_saisonniers_${this.currentYear}.pdf`);
}

  // ── Imprimer fiche individuelle ───────────────────
  printFiche(s: SaisonnierPaie): void {
  const html = `
    <html><head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; direction: rtl; padding: 32px; }
        h2 { text-align: center; color: #1e3a5f; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        td { padding: 10px 14px; border: 1px solid #ddd; font-size: 14px; }
        td:first-child { font-weight: bold; background: #f8fafc; width: 40%; }
        .total { background: #1e3a5f; color: white; font-size: 16px; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h3 { color: #2563eb; }
      </style>
    </head><body>
      <div class="header">
        <strong>تونس تيليكوم — Tunisie Telecom</strong>
        <h2>بطاقة أجرة عون متعاقد موسمي — ${this.currentYear}</h2>
      </div>
      <table>
        <tr><td>Nom et Prénom</td><td>${s.prenom} ${s.nom}</td></tr>
        <tr><td>N° CIN</td><td>${s.cin}</td></tr>
        <tr><td>Durée de travail(Jours)</td><td>${s.duree} يوم</td></tr>
        <tr><td>Absences(Jours)</td><td>${s.absences} يوم</td></tr>
        <tr><td>أيام العمل الفعلية</td><td>${s.duree - s.absences} يوم</td></tr>
        <tr><td>المبلغ الصافي</td><td class="total"><strong>${s.montantNet.toFixed(3)} DT</strong></td></tr>
        <tr><td>N° Compte</td><td>${s.rib || '—'}</td></tr>
      </table>
      <br>
      <table>
        <tr><td>الأجر الإجمالي</td><td>${s.duree} × ${this.tauxJourDT} = ${(s.duree * this.tauxJourDT).toFixed(3)} DT</td></tr>
        <tr><td>خصم الغيابات</td><td>${s.absences} × ${this.tauxJourDT} = ${(s.absences * this.tauxJourDT).toFixed(3)} DT</td></tr>
        <tr><td><strong>الصافي للصرف</strong></td><td><strong>${s.montantNet.toFixed(3)} DT</strong></td></tr>
      </table>
      <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }</script>
    </body></html>
  `;

  // ✅ Blob URL — remplace document.write (déprécié)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const w = globalThis.open(url, '_blank');

  // Libérer l'URL après ouverture
  w?.addEventListener('load', () => URL.revokeObjectURL(url));
}
}

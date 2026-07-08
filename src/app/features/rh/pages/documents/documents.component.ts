import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import * as XLSX from 'xlsx';
import { DocumentService } from 'src/app/services/document.service';
import { DocumentCampagneDTO, DocumentCampagneService } from 'src/app/services/document-campagne.service';
import { AuthService } from 'src/app/services/auth.service';
import { StructureService } from 'src/app/structure.service';
import { EtatRHService } from 'src/app/service/etat-rh.service';
import { environment } from 'src/environments/environment';

export interface Structure {
  name: string;
  type: 'ESPACE_COMMERCIAL' | 'CENTRE_TECHNIQUE'| 'STRUCTURE_CENTRALE';
  adresse: string;
  autorises: number;   
  recrutes: number;
}

export interface Region {
  name: string;
  structures: Structure[];
}

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.scss']
})
export class DocumentsComponent implements OnInit {

activeTab: 'campagne' | 'excel' | 'etat' = 'campagne';

circulairePdfUrl: string = '';
  zoomLevel = 100;
  selectedRegion = '';
  filterType: 'ALL' | 'ESPACE_COMMERCIAL' | 'CENTRE_TECHNIQUE' | 'STRUCTURE_CENTRALE' = 'ALL';
  structureData: Record<string, any> = {};

  safePdfUrl: SafeResourceUrl | null = null;
  isLoadingPdf = true;  // indicateur de chargement du PDF

  selectedDoc: DocumentCampagneDTO | null = null;
safeDocUrl: SafeResourceUrl | null = null;

  // ── Upload state ──────────────────────────────────────
  isUploading = false;
  uploadSuccess = false;
  uploadError = '';

  documentsCampagne: DocumentCampagneDTO[] = [];
loadingDocs = false;

  regions: Region[] = [];

  monEtat: any = null;
isUploadingEtat = false;
etatUploadSuccess = false;

  // ── Constructor : injection DocumentService ───────────
  constructor(
   private readonly sanitizer: DomSanitizer,
    private readonly documentService: DocumentService,
      private readonly documentCampagneService: DocumentCampagneService ,
      private readonly authService: AuthService,
        private readonly structureService: StructureService,  // ← ajouter
        private readonly etatRHService: EtatRHService             


  ) {}

  ngOnInit(): void {
    this.initStructureData();
    this.loadFromStorage();
    this.loadCirculaireFromServer();
     this.loadDocumentsCampagne(); 
       this.loadRegions(); // ← ajouter
         this.loadMonEtat();


  }


  loadMonEtat(): void {
  this.etatRHService.getMonEtat().subscribe({
    next: (data) => this.monEtat = data,
    error: () => this.monEtat = null
  });
}

onEtatSelected(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file?.type === 'application/pdf') this.uploadEtat(file);
}

uploadEtat(file: File): void {
  this.isUploadingEtat = true;
  this.etatRHService.uploadEtat(file).subscribe({
    next: (res) => {
      this.monEtat = res;
      this.isUploadingEtat = false;
      this.etatUploadSuccess = true;
      setTimeout(() => this.etatUploadSuccess = false, 4000);
    },
    error: (err) => {
      this.isUploadingEtat = false;
      // ← afficher le message exact du backend
      console.error('Erreur upload état:', err);
      console.error('Message backend:', err.error);
      alert('Erreur : ' + (err.error || err.message));
    }
  });
}

 loadRegions(): void {
  this.structureService.getStructuresCampagneActive().subscribe({
    next: (data) => {
      // Grouper les structures par région (comme HomeAdminComponent)
      const regionMap = new Map<string, Structure[]>();

      data.forEach(s => {
        if (!regionMap.has(s.region)) {
          regionMap.set(s.region, []);
        }
        regionMap.get(s.region)!.push({
          name: s.nom,
          type: s.type,
          adresse: s.adresse,
          autorises:s.autorises??0,
          recrutes:s.recrutes??0
        });
      });

      this.regions = Array.from(regionMap.entries()).map(([name, structures]) => ({
        name,
        structures
      }));

      this.initStructureData();
    },
    error: err => console.error('Erreur chargement structures', err)
  });
}



  loadDocumentsCampagne(): void {
  this.loadingDocs = true;
  // Adapter l'id campagne active selon votre logique
  const campagneId = 1;
  this.documentCampagneService.getDocumentsByCampagne(campagneId).subscribe({
    next: (data) => {
      this.documentsCampagne = data;
      this.loadingDocs = false;
    },
    error: () => { this.loadingDocs = false; }
  });
}

getDocIcon(type: string): string {
  const icons: Record<string, string> = {
    'CONTRAT':    'M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
    'NOTICE':     'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6',
    'FORMULAIRE': 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2',
  };
  return icons[type] ?? 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6';
}

selectDoc(doc: DocumentCampagneDTO): void {
  const urlAutorisee =
    doc.url.startsWith('/files/') ||
    doc.url.startsWith(environment.apiUrl);

  if (!urlAutorisee) return;

  this.selectedDoc = doc;
  // ✅ bypass justifié : URL validée contre l'origine du backend
  this.safeDocUrl = this.sanitizer.bypassSecurityTrustResourceUrl(doc.url);
}

closeDocViewer(): void {
  this.selectedDoc = null;
  this.safeDocUrl = null;
}

  // ══════════════════════════════════════════════════════
  //  PDF — Upload + chargement depuis serveur
  // ══════════════════════════════════════════════════════

  /** Charge le dernier PDF CIRCULAIRE_2025 depuis le serveur */
loadCirculaireFromServer(): void {
  this.isLoadingPdf = true;

  this.documentService.getDocumentByType('CIRCULAIRE_2025').subscribe({
    next: (doc) => {
      if (doc?.url) {
        const urlAutorisee =
          doc.url.startsWith('/files/') ||
          doc.url.startsWith(environment.apiUrl);

        if (!urlAutorisee) {
          this.safePdfUrl = null;
          this.circulairePdfUrl = '';
          this.isLoadingPdf = false;
          return;
        }

        this.circulairePdfUrl = doc.url;
        // ✅ bypass justifié : URL validée contre l'origine du backend
        this.safePdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(doc.url);

      } else {
        this.safePdfUrl = null;
        this.circulairePdfUrl = '';
      }
      this.isLoadingPdf = false;
    },
    error: () => {
      this.safePdfUrl = null;
      this.circulairePdfUrl = '';
      this.isLoadingPdf = false;
    }
  });
}

  /** Méthode privée partagée : aperçu local + upload Cloudinary */
private handlePdfUpload(file: File): void {
  const localUrl = URL.createObjectURL(file);

  if (!localUrl.startsWith('blob:')) return;

  this.circulairePdfUrl = localUrl;
  // ✅ bypass justifié : URL générée par createObjectURL depuis un File local
  this.safePdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(localUrl);

  this.isUploading = true;
  this.uploadSuccess = false;
  this.uploadError = '';

  this.documentService.uploadDocument(file, 'CIRCULAIRE_2025').subscribe({
    next: (res) => {
      const urlAutorisee =
        res.url.startsWith('/files/') ||
        res.url.startsWith(environment.apiUrl);

      if (!urlAutorisee) {
        this.uploadError = 'URL du serveur non autorisée.';
        this.isUploading = false;
        return;
      }

      this.circulairePdfUrl = res.url;
      // ✅ bypass justifié : URL validée contre l'origine du backend
      this.safePdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(res.url);
      this.isUploading = false;
      this.uploadSuccess = true;
      setTimeout(() => this.uploadSuccess = false, 4000);
    },
    error: (err) => {
      console.error('Erreur upload PDF :', err);
      this.uploadError = "Erreur lors de l'upload. L'aperçu local reste disponible.";
      this.isUploading = false;
    }
  });
}



  onPdfSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file?.type === 'application/pdf') this.handlePdfUpload(file);
  }

  onDragOver(event: DragEvent): void { event.preventDefault(); }

  onDropPdf(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file?.type === 'application/pdf') this.handlePdfUpload(file);
  }

  zoomIn():   void { if (this.zoomLevel < 200) this.zoomLevel += 10; }
  zoomOut():  void { if (this.zoomLevel > 50)  this.zoomLevel -= 10; }
  printPdf(): void { window.open(this.circulairePdfUrl)?.print(); }

  // ══════════════════════════════════════════════════════
  //  Getters stats
  // ══════════════════════════════════════════════════════
  get totalRegions():    number { return this.regions.length; }
  get totalStructures(): number { return this.regions.reduce((s, r) => s + r.structures.length, 0); }
  get totalEC(): number { return this.regions.reduce((s, r) => s + r.structures.filter(st => st.type === 'ESPACE_COMMERCIAL').length, 0); }
  get totalCT(): number { return this.regions.reduce((s, r) => s + r.structures.filter(st => st.type === 'CENTRE_TECHNIQUE').length, 0); }

  // ══════════════════════════════════════════════════════
  //  Tableau / LocalStorage
  // ══════════════════════════════════════════════════════
  initStructureData(): void {
    for (const r of this.regions)
      for (const s of r.structures) {
        const base = `${r.name}|${s.name}`;
        if (!(base + '|auth' in this.structureData)) {
          this.structureData[base + '|auth'] = 0;
          this.structureData[base + '|rec']  = 0;
          this.structureData[base + '|resp'] = '';
          this.structureData[base + '|obs']  = '';
        }
      }
  }

  loadFromStorage(): void {
    const saved = localStorage.getItem('tt_structure_data_v2');
    if (saved) { try { Object.assign(this.structureData, JSON.parse(saved)); } catch {} }
  }

  updateStats(): void {
    localStorage.setItem('tt_structure_data_v2', JSON.stringify(this.structureData));
  }

  selectRegion(name: string): void {
    this.selectedRegion = this.selectedRegion === name ? '' : name;
  }

  getCurrentStructures(): Structure[] {
    const all = this.regions.find(r => r.name === this.selectedRegion)?.structures ?? [];
    return this.filterType === 'ALL' ? all : all.filter(s => s.type === this.filterType);
  }

  getRest(region: string, structName: string): number {
  const s = this.regions.find(r => r.name === region)
                         ?.structures.find(st => st.name === structName);
  if (!s) return 0;
  return Math.max(0, s.autorises - s.recrutes);
}

getRegionTotal(region: string, type: 'auth' | 'rec'): number {
  return (this.regions.find(r => r.name === region)?.structures ?? [])
    .reduce((sum, s) => sum + (type === 'auth' ? s.autorises : s.recrutes), 0);
}

getTotalAuth(): number {
  return this.regions.reduce((s, r) =>
    s + r.structures.reduce((acc, st) => acc + st.autorises, 0), 0);
}

getTotalRec(): number {
  return this.regions.reduce((s, r) =>
    s + r.structures.reduce((acc, st) => acc + st.recrutes, 0), 0);
}
  getGlobalIndex(ri: number, si: number): number {
    let idx = 1;
    for (let i = 0; i < ri; i++) idx += this.regions[i].structures.length;
    return idx + si;
  }

  typeLabel(type: string): string {
    return type === 'ESPACE_COMMERCIAL' ? 'Espace Commercial' : 'Centre Technologique';
  }

  typeBadgeClass(type: string): string {
    return type === 'ESPACE_COMMERCIAL' ? 'badge-ec' : 'badge-ct';
  }

  // ══════════════════════════════════════════════════════
  //  Export Excel
  // ══════════════════════════════════════════════════════
  exportToExcel(): void {
    const wb = XLSX.utils.book_new();
    const recapData: any[][] = [
      ['Tunisie Telecom — Structures par Région — Campagne 2025'], [],
      ['#', 'Gouvernorat', 'Structure', 'Type', 'Adresse', 'Autorisés', 'Recrutés', 'Restants', 'Statut']
    ];
    let idx = 1;
    for (const r of this.regions) {
      for (let si = 0; si < r.structures.length; si++) {
        const s = r.structures[si];
        const auth = +this.structureData[`${r.name}|${s.name}|auth`] || 0;
        const rec  = +this.structureData[`${r.name}|${s.name}|rec`]  || 0;
        recapData.push([idx++, si === 0 ? r.name : '', s.name, this.typeLabel(s.type), s.adresse,
                        auth, rec, auth - rec, auth - rec > 0 ? 'En cours' : 'Complet']);
      }
    }
    recapData.push(['', '', 'TOTAL', '', '', this.getTotalAuth(), this.getTotalRec(),
                    this.getTotalAuth() - this.getTotalRec(), '']);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(recapData), 'Récapitulatif');

    for (const r of this.regions) {
      const rows: any[][] = [[`${r.name} — Saisonniers 2025`], [],
        ['#', 'Structure', 'Type', 'Adresse', 'Autorisés', 'Recrutés', 'Restants', 'Responsable', 'Observations']
      ];
      for (let i = 0; i < r.structures.length; i++) {
        const s = r.structures[i]; const base = `${r.name}|${s.name}`;
        const auth = +this.structureData[base + '|auth'] || 0;
        const rec  = +this.structureData[base + '|rec']  || 0;
        rows.push([i+1, s.name, this.typeLabel(s.type), s.adresse, auth, rec, auth - rec,
                   this.structureData[base + '|resp'] || '', this.structureData[base + '|obs'] || '']);
      }
      rows.push(['', 'TOTAL', '', '', this.getRegionTotal(r.name,'auth'), this.getRegionTotal(r.name,'rec'),
                 this.getRegionTotal(r.name,'auth') - this.getRegionTotal(r.name,'rec'), '', '']);
      const sheet = r.name.replace("Gouvernorat de l'", '').replace('Gouvernorat de ', '').substring(0, 31);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheet);
    }
    XLSX.writeFile(wb, `structures_TT_${new Date().getFullYear()}.xlsx`);
  }
}
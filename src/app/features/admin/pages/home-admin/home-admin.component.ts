import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { EtatRHService } from 'src/app/service/etat-rh.service';
import { AuthService, Region } from 'src/app/services/auth.service';
import { CampagneService, CampagneRequestDTO } from 'src/app/services/campagne.service';
import { CandidatureService } from 'src/app/services/candidature.service';
import { DocumentCampagneDTO, DocumentCampagneService } from 'src/app/services/document-campagne.service';
import { DocumentService } from 'src/app/services/document.service';
import { ParentAutorise, ParentAutoriseService } from 'src/app/services/parent-autorise.service';
import { PresencePdfExportService } from 'src/app/services/presence-pdf-export.service';
import { StructureImportService } from 'src/app/services/structure-import.service';
import { StructureDTO, StructureService } from 'src/app/structure.service';
import { environment } from 'src/environments/environment';
import * as XLSX from 'xlsx-js-style';

// ─── Interfaces ───────────────────────────────────────────────────

interface RegionAPI {
  id: number;
  nom: string;
}

interface Saisonnier {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  cin: number;
  telephone: string;
  rib: string;
  region: RegionAPI;
  moisTravail: string;
  absences?: number;
  niveauEtude?: string;
  diplome?: string;
  specialiteDiplome?: string;
  nomPrenomParent?: string;
  matriculeParent?: string | number;
}

interface CampagneAPI {
  id: number;
  libelle: string;
  code: string;
  dateDebut: string;
  dateFin: string;
}

interface DocumentAPI {
  id: number;
  type: string;
  url: string;
  nomFichier: string;
}

interface Candidature {
  id: number;
  dateDepot: string;
  statut: string;
  commentaire: string | null;
  saisonnier: Saisonnier;
  campagne: CampagneAPI;
  documents: DocumentAPI[];
}

interface Campagne {
  id: number;
  nom: string;
  code: string;
  dateDebut: string;
  dateFin: string;
  statut: 'active' | 'termine' | 'brouillon' | 'planifie' | 'cloturee';
  statutLabel: string;
  candidatures: number;
  affectations: number;
  verrouille: boolean;
  description?: string;
  budget?: string;
  regionIds?: number[];
}

interface Utilisateur {
  id: number;
  nom: string;
  initiales: string;
  email: string;
  role: string;
  roleClass: 'dg' | 'admin' | 'evaluateur' | 'candidat';
  departement: string;
  derniereConnexion: string;
  statut: 'active' | 'inactive';
  statutLabel: string;
}

interface Structure {
  id: number;
  nom: string;
  type: 'ESPACE_COMMERCIAL' | 'CENTRE_TECHNIQUE' | 'STRUCTURE_CENTRALE';
  region: string;
  adresse: string;
  autorises: number;
  recrutes: number;
  isFirstInGov?: boolean;
}

interface Gouvernorat {
  nom: string;
  count: number;
}

interface MemoDocument {
  fileName: string;
  year: number;
  statut: string;
  currentPage: number;
  totalPages: number;
  zoom: number;
  hasFile: boolean;
  fileUrl?: SafeResourceUrl;
  rawUrl?: string;
}

interface StructuresStats {
  gouvernorats: number;
  total: number;
  espacesCommerciaux: number;
  centresTechnologiques: number;
  saisonnersAutorises: number;
  saisonnersRecrutes: number;
}

// ─── Nouvelles interfaces Présence & Paiement ─────────────────────

export interface PresenceRow {
  id: number;
  nom: string;
  cin: string;
  dureeContrat: number;
  absences: number;
  montantNet: number;
  rib: string;
  statut: 'paye' | 'impaye';
  campagneId?: number;
}

interface PresenceConfig {
  tauxJournalier: number;
  dureeContrat: number;
  campagneId: number | null;
}

interface PresenceTotals {
  totalJours: number;
  totalAbsences: number;
  totalMontant: number;
}

// ─── Component ────────────────────────────────────────────────────

@Component({
  selector: 'app-home-admin',
  templateUrl: './home-admin.component.html',
  styleUrls: ['./home-admin.component.scss']
})
export class HomeAdminComponent implements OnInit {
  @ViewChild('modalRef') modalRef!: ElementRef;
  @ViewChild('parentModalRef') parentModalRef!: ElementRef;

  // ── Navigation ──────────────────────────────────────────────────
  activeSection: 'parents'|'campagnes' | 'candidatures' | 'utilisateurs' | 'memo' | 'structures' | 'presence' | 'etats' = 'campagnes';
  searchQuery = '';
  pageTitle = 'Pilotage des Campagnes';
  pageSubtitle = 'Gérez et suivez toutes vos campagnes de recrutement';

  today: string = new Date().toISOString().split('T')[0];

  // ── Modal Voir Campagne ──────────────────────────────────────────
  showViewModal = false;
  viewingCampagne: Campagne | null = null;

  // ── Modal Modifier Campagne ──────────────────────────────────────
  showEditModal = false;
  editingCampagne: Campagne | null = null;

  // ── Modal flags ──────────────────────────────────────────────────
  showCreateModal = false;
  showMemoUploadModal = false;
  showStructureUploadModal = false;
  showEditStructureModal = false;
  showAbsenceModal = false;

  // ── Global Stats ─────────────────────────────────────────────────
  stats = {
    campagnesCloturee: 0,
    campagnesTotal: 12,
    totalParents: 0,
    joursRestants: 18,
    candidaturesAcceptees: 0,
    candidaturesEnAttente: 0,
    candidaturesRefusees: 0,
    totalCandidatures: 0
  };

  // ── Campagnes ─────────────────────────────────────────────────────
  regions: Region[] = [];
  campagnes: Campagne[] = [];
  newCampagne: Campagne = this.emptyNewCampagne();
  newCampagneAnnee: number = new Date().getFullYear();
  showActiveCampagneWarning = false;
  activeCampagneNom = '';

  // ── Filtres candidatures ─────────────────────────────────────────
  candidatureFilterRegion = '';
  candidatureFilterStructure = '';
  candidatureFilterStatut = '';
  filteredCandidatures: Candidature[] = [];
  candidatureFilterMois = '';

  // ── Upload parents Excel ─────────────────────────────────────────
  parentsExcelFile: File | null = null;
  parentsExcelDragOver = false;
  isUploadingParents = false;
  parentsUploadSuccess = false;

  // ── Nouvelles propriétés pour l'upload Excel campagne ─────────────
  campagneExcelFile: File | null = null;
  campagneExcelDragOver = false;
  regionsDetectees: string[] = [];
  isSavingCampagne = false;
  isLoading = false;

  parentSearch = '';

  // ── Documents à uploader lors de la création ──────────────────
  documentsPendants: Array<{ file: File; nom: string; type: string }> = [];

  presenceFilterRegion = '';
  presenceFilterStructure = '';
  currentYear: number = new Date().getFullYear();

  candidatureStructureMap = new Map<number, any>();

  openAddParentModal() {
    this.isEditParent = false;
    this.parentForm = { id: undefined, nomPrenom: '', matricule: '', autorises: 1, utilise: 0 };
    this.showParentModal = true;
    setTimeout(() => {
      if (this.parentModalRef?.nativeElement) {
        this.trapFocus(this.parentModalRef.nativeElement);
      }
    }, 100);
  }

  editParent(p: any) {
    this.isEditParent = true;
    this.parentForm = { ...p };
    this.showParentModal = true;
    setTimeout(() => {
      if (this.parentModalRef?.nativeElement) {
        this.trapFocus(this.parentModalRef.nativeElement);
      }
    }, 100);
  }

  closeParentModal() {
    this.showParentModal = false;
    if (this.parentModalRef?.nativeElement?._focusTrapHandler) {
      this.parentModalRef.nativeElement.removeEventListener(
        'keydown',
        this.parentModalRef.nativeElement._focusTrapHandler
      );
    }
  }

  parentForm: Partial<ParentAutorise> = {
    nomPrenom: '',
    matricule: '',
    autorises: 1,
    utilise: 0
  };

  onDateDebutChange() {
    if (this.newCampagne.dateFin && this.newCampagne.dateFin <= this.newCampagne.dateDebut) {
      this.newCampagne.dateFin = '';
    }
  }

  saveParent() {
    if (!this.parentForm.nomPrenom || !this.parentForm.matricule) {
      alert('Champs obligatoires ❌');
      return;
    }

    const autorises = Number(this.parentForm.autorises ?? 0);
    const utilise = Number(this.parentForm.utilise ?? 0);
    const email     = this.parentForm.email ?? '';

    if (this.isEditParent) {
      if (this.parentForm.id == null) return;
      this.parentService.updateParent(
        this.parentForm.id,
        this.parentForm.nomPrenom!,
        this.parentForm.matricule!,
	email,
        autorises,
        utilise
      ).subscribe({
        next: () => { this.loadParents(); this.closeParentModal(); },
        error: (err) => alert(err.error)
      });
    } else {
      this.parentService.addParent(
        this.parentForm.nomPrenom!,
        this.parentForm.matricule!,
	email,
        autorises
      ).subscribe({
        next: () => { this.loadParents(); this.closeParentModal(); },
        error: (err) => alert(err.error)
      });
    }
  }

  deleteParent(id: number) {
    if (!confirm('Supprimer ce parent ?')) return;
    this.parentService.deleteParent(id).subscribe(() => {
      this.loadParents();
    });
  }

  // ── Candidatures ──────────────────────────────────────────────────
  candidatures: Candidature[] = [];

  isLoadingStructure = false;
  myRegion!: Region;

  // ── Utilisateurs ──────────────────────────────────────────────────
  utilisateurs: Utilisateur[] = [];

  showDossierModal = false;
  selectedCandidature: any = null;
  selectedStructureId: number | null = null;
  selectedCandidatureStructure: any = null;

  structuresCommerciaux: StructureDTO[] = [];
  structuresTech: StructureDTO[] = [];
  structures: StructureDTO[] = [];

  closeDossier() {
    this.showDossierModal = false;
    this.selectedCandidature = null;
  }

  get structuresEC(): StructureDTO[] {
    return this.structures.filter(s => s.type === 'ESPACE_COMMERCIAL');
  }

  get structuresCT(): StructureDTO[] {
    return this.structures.filter(s => s.type === 'CENTRE_TECHNIQUE');
  }

  get structuresSC(): StructureDTO[] {
    return this.structures.filter(s => s.type === 'STRUCTURE_CENTRALE');
  }

  onStructureChange(): void {
    const found = this.structures.find(s => s.id === this.selectedStructureId);
    this.selectedCandidatureStructure = found ?? null;
  }

  // ── Memo Intidab ──────────────────────────────────────────────────
  memoDocument: MemoDocument = {
    fileName: 'مذكرة_إنتداب_موسمي_2025.pdf',
    year: 2025,
    statut: 'actif',
    currentPage: 1,
    totalPages: 3,
    zoom: 67,
    hasFile: false
  };

  memoSelectedFile: File | null = null;
  memoDragOver = false;
  isLoadingPdf = true;
  isUploading = false;
  uploadSuccess = false;
  uploadError = '';

  // ── Structures par Région ─────────────────────────────────────────
  structuresStats: StructuresStats = {
    gouvernorats: 17,
    total: 87,
    espacesCommerciaux: 54,
    centresTechnologiques: 33,
    saisonnersAutorises: 0,
    saisonnersRecrutes: 0
  };

  etatsRH: any[] = [];

  filteredStructures: Structure[] = [];
  structureTypeFilter = 'tous';
  selectedGouvernorat = '';
  gouvernorats: Gouvernorat[] = [];

  structureSelectedFile: File | null = null;
  structureDragOver = false;
  editingStructure: Structure | null = null;

  // ── Memo : document sélectionné pour visualisation ──────────────
  memoDocumentSelectionne: DocumentCampagneDTO | null = null;
  memoViewerUrl: SafeResourceUrl | null = null;
  isLoadingViewerDoc = false;

  // ── Pagination Parents ──────────────────────────────────────────
  parentPage = 1;
  parentPageSize = 10;

  // ── Présence & Paiement ───────────────────────────────────────────
  presenceRows: PresenceRow[] = [];
  filteredPresenceRows: PresenceRow[] = [];
  presenceFilter: 'tous' | 'payes' | 'impayes' = 'tous';
  presenceSearchQuery = '';
  editingPresenceRow: PresenceRow | null = null;

  presenceConfig: PresenceConfig = {
    tauxJournalier: 0,
    dureeContrat: 30,
    campagneId: null
  };

  presenceStats = {
    totalSaisonniers: 0,
    masseSalariale: 0,
    joursAbsence: 0,
    tauxJournalier: 0
  };

  presenceTotals: PresenceTotals = {
    totalJours: 0,
    totalAbsences: 0,
    totalMontant: 0
  };

  // ── Memo : campagne sélectionnée et ses documents ──────────────
  memoDocumentsCampagne: DocumentCampagneDTO[] = [];
  memoSelectedCampagneId: number | null = null;
  isLoadingDocsCampagne = false;

  // ── Dans la classe, nouvelles propriétés ──────────────────────────
  documentsCampagne: DocumentCampagneDTO[] = [];
  documentFile: File | null = null;
  documentNom = '';
  documentType = 'مذكرة الإنتداب';
  isUploadingDoc = false;

  parents: any[] = [];
  selectedCampagne: any = null;

  showParentModal = false;
  isEditParent = false;

  // S2933: mark as readonly (never reassigned)
  private readonly _parentSearch = '';

  campagneDetailOpen = false;


  // ─── Constructor ──────────────────────────────────────────────────

  constructor(
    private readonly campagneService: CampagneService,       // S2933
    private readonly authService: AuthService,                // S2933
    private readonly candidatureService: CandidatureService,  // S2933
    private readonly sanitizer: DomSanitizer,                 // S2933
    private readonly documentService: DocumentService,        // S2933
    private readonly structureimportService: StructureImportService, // S2933
    private readonly structureService: StructureService,      // S2933
    private readonly router: Router,                          // S2933
    private readonly docCampagneService: DocumentCampagneService,    // S2933
    private readonly parentService: ParentAutoriseService,    // S2933
    private readonly etatRHService: EtatRHService,            // S2933
    private readonly presencePdfService: PresencePdfExportService    // S2933
  ) {}

  nomUtilisateur = '';
  roleUtilisateur = '';

  // ─── Lifecycle ────────────────────────────────────────────────────

  ngOnInit(): void {
    this.updatePageMeta();
    this.loadRegions();
    this.buildGouvernorats();
    this.applyStructureFilter();
    this.loadCirculaireFromServer();
    this.loadStructures();
    
    this.loadEtatsRH();
    this.loadCampagnesPuisCandidatures();

    this.nomUtilisateur = this.authService.getNomComplet();
    this.roleUtilisateur = this.authService.getRole();
  }

  get parentsTotalPages(): number {
    return Math.ceil(this.filteredParents.length / this.parentPageSize);
  }

  get parentsPagines(): any[] {
    const start = (this.parentPage - 1) * this.parentPageSize;
    return this.filteredParents.slice(start, start + this.parentPageSize);
  }

  get parentPageNumbers(): number[] {
    const total = this.parentsTotalPages;
    const current = this.parentPage;
    const delta = 2;

    const range: number[] = [];
    const rangeWithDots: number[] = [];

    for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
      range.push(i);
    }

    if (current - delta > 2) {
      rangeWithDots.push(1, -1);
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (current + delta < total - 1) {
      rangeWithDots.push(-1, total);
    } else if (total > 1) {
      rangeWithDots.push(total);
    }

    return rangeWithDots;
  }

  goToParentPage(page: number): void {
    if (page >= 1 && page <= this.parentsTotalPages) {
      this.parentPage = page;
    }
  }

  loadCampagnesPuisCandidatures(): void {
    this.campagneService.getAllCampagnes().subscribe({
      next: (data) => {
        console.log('🔍 Réponse brute backend:', JSON.stringify(data));

        const statutMap: Record<string, { statut: Campagne['statut'], label: string }> = {
          'BROUILLON': { statut: 'brouillon', label: 'Brouillon' },
          'ACTIVE':    { statut: 'active',    label: 'Active'    },
          'CLOTUREE':  { statut: 'termine',   label: 'Clôturée'  },
        };

        this.campagnes = (data as any[]).map(c => {
          const statutKey = (c.statut || 'BROUILLON').toUpperCase();
          const statutInfo = statutMap[statutKey] ?? { statut: 'brouillon', label: 'Brouillon' };
          return {
            id: c.id,
            nom: c.libelle,
            code: c.code,
            dateDebut: c.dateDebut,
            dateFin: c.dateFin,
            statut: statutInfo.statut,
            statutLabel: statutInfo.label,
            candidatures: c.candidatures || 0,
            affectations: c.affectations || 0,
            verrouille: c.verrouille || false,
            description: c.description || '',
            budget: c.budget || '',
            regionIds: c.regionIds || []
          };
        });

        this.appliquerBudgetCampagne();
        this.loadCandidatures();

        const campagneActive = this.campagnes.find(c => c.statut === 'active');
      if (campagneActive) {
        this.selectedCampagne = campagneActive;
        this.voirParentsCampagne(campagneActive); // updateStats() appelé dedans
      } else {
        this.parents = [];
        this.updateStats();
      }

      },
      error: err => console.error('Erreur chargement campagnes', err)
    });
  }

  loadEtatsRH(): void {
    this.etatRHService.getAllEtats().subscribe({
      next: (data) => this.etatsRH = data,
      error: () => this.etatsRH = []
    });
  }

  validerEtat(id: number): void {
    this.etatRHService.changerStatut(id, 'VALIDE').subscribe(() => {
      this.loadEtatsRH();
      this.showToast('✅ État validé');
    });
  }

  rejeterEtat(id: number): void {
    this.etatRHService.changerStatut(id, 'REJETE').subscribe(() => {
      this.loadEtatsRH();
      this.showToast('❌ État rejeté');
    });
  }

  loadParents() {
    this.parentService.getAllParents().subscribe({
      next: (data) => {
        this.parents = data;
        this.updateStats();
      },
      error: (err) => console.error(err)
    });
  }

  loadDocumentsCampagne(campagneId: number): void {
    this.docCampagneService.getDocumentsByCampagne(campagneId).subscribe({
      next: docs => this.documentsCampagne = docs,
      error: err => console.error('Erreur chargement documents', err)
    });
  }

  uploadDocumentCampagne(): void {
    if (!this.documentFile || !this.presenceConfig.campagneId) {
      alert('Sélectionnez un fichier et une campagne');
      return;
    }
    this.isUploadingDoc = true;

    this.docCampagneService.uploadDocument(
      this.presenceConfig.campagneId,
      this.documentNom || this.documentFile.name,
      this.documentType,
      this.documentFile
    ).subscribe({
      next: doc => {
        this.documentsCampagne.push(doc);
        this.documentFile = null;
        this.documentNom = '';
        this.isUploadingDoc = false;
        this.showToast('✅ Document ajouté avec succès');
      },
      error: err => {
        console.error(err);
        this.isUploadingDoc = false;
        this.showToast('❌ Erreur lors de l\'upload');
      }
    });
  }

  supprimerDocument(doc: DocumentCampagneDTO): void {
    if (!confirm(`Supprimer "${doc.nom}" ?`)) return;
    this.docCampagneService.deleteDocument(doc.id).subscribe({
      next: () => {
        this.documentsCampagne = this.documentsCampagne.filter(d => d.id !== doc.id);
        this.showToast('✅ Document supprimé');
      },
      error: () => this.showToast('❌ Erreur suppression')
    });
  }

  onDocumentFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.documentFile = file;
      if (!this.documentNom) {
        this.documentNom = file.name.replace(/\.[^.]+$/, '');
      }
    }
  }

  selectionnerDocumentMemo(doc: DocumentCampagneDTO): void {
    this.memoDocumentSelectionne = doc;
    this.isLoadingViewerDoc = true;
    this.memoViewerUrl = null;

    fetch(doc.url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    })
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        // ✅ Validation explicite — on accepte uniquement les blob URLs locales
      if (!blobUrl.startsWith('blob:')) {
        throw new Error('URL invalide — type non autorisé');
      }
        // ✅ bypass justifié : URL générée localement par createObjectURL
      this.memoViewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(blobUrl);
      this.isLoadingViewerDoc = false;
      })
      .catch(() => {
        this.isLoadingViewerDoc = false;
        this.showToast('❌ Impossible de charger le document');
      });
  }

  fermerViewerDoc(): void {
    this.memoDocumentSelectionne = null;
    this.memoViewerUrl = null;
  }

  ouvrirLienDoc(url: string): void {
    globalThis.open(url, '_blank'); // S7764: prefer globalThis over window
  }

  // ─── Navigation ───────────────────────────────────────────────────

  setActive(section: 'campagnes' | 'candidatures' | 'utilisateurs' | 'memo' | 'structures' | 'presence' | 'etats'|'parents'): void {
    this.activeSection = section;

    if (section === 'campagnes' || section === 'memo' || section === 'structures') {
      this.campagnesOpen = true;
    }

    this.updatePageMeta();

    switch (section) {
      case 'campagnes':
        this.loadCampagnes();
        this.loadCandidatures();
        break;

      case 'candidatures':
        this.loadCandidatures();
        break;

      case 'memo': {  // S6836: block scope for lexical declaration
        this.loadCirculaireFromServer();
        const campagneActive = this.campagnes.find(c => c.statut === 'active') ?? this.campagnes[0];
        if (campagneActive) {
          this.onMemoCampagneChange(campagneActive.id);
        }
        break;
      }

      case 'structures':
        this.loadStructures();
        break;

      case 'presence':
        this.loadPresenceRows();
        break;

      default:
        break;
    }
  }

  private updatePageMeta(): void {
    const meta: Record<string, { title: string; subtitle: string }> = {
      campagnes: {
        title: 'Pilotage des Campagnes',
        subtitle: 'Créez, activez et gérez vos campagnes de recrutement'
      },
      candidatures: {
        title: 'Liste des Candidatures',
        subtitle: 'Consultez et suivez toutes les candidatures déposées'
      },
      utilisateurs: {
        title: 'Gestion des Utilisateurs',
        subtitle: 'Consultez la liste complète des utilisateurs du système'
      },
      memo: {
        title: 'مذكرة الإنتداب ',
        subtitle: 'مذكرة حول انتداب أعوان متعاقدين لعمل موسمي'
      },
      structures: {
        title: 'Structures par Région',
        subtitle: ''
      },
      presence: {
        title: 'Présence & Paiement',
        subtitle: ''
      },
      parents: {
        title: 'Parents Autorisés',
        subtitle: 'Gérez les parents autorisés à accompagner les saisonniers'
      }

    };
    this.pageTitle = meta[this.activeSection].title;
    this.pageSubtitle = meta[this.activeSection].subtitle;
  }

  // ─── Campagnes ────────────────────────────────────────────────────

  loadRegions(): void {
    this.authService.getRegions().subscribe({
      next: data => this.regions = data,
      error: err => console.error('Erreur chargement régions', err)
    });
  }

  onRegionChange(): void {
    if (this.newCampagne.regionIds?.includes(0)) {
      this.newCampagne.regionIds = this.regions.map(r => r.id);
    }
  }

  loadCampagnes(): void {
    this.campagneService.getAllCampagnes().subscribe({
      next: (data) => {
        this.campagnes = (data as any[]).map(c => {
          const statutMap: Record<string, { statut: Campagne['statut'], label: string }> = {
            'BROUILLON': { statut: 'brouillon', label: 'Brouillon' },
            'ACTIVE':    { statut: 'active',    label: 'Active'    },
            'CLOTUREE':  { statut: 'termine',   label: 'Clôturée'  },
          };

          const statutKey = (c.statut || 'BROUILLON').toUpperCase();
          const statutInfo = statutMap[statutKey] ?? { statut: 'brouillon', label: 'Brouillon' };

          return {
            id: c.id,
            nom: c.libelle,
            code: c.code,
            dateDebut: c.dateDebut,
            dateFin: c.dateFin,
            statut: statutInfo.statut,
            statutLabel: statutInfo.label,
            candidatures: c.candidatures || 0,
            affectations: c.affectations || 0,
            verrouille: c.verrouille || false,
            description: c.description || '',
            budget: c.budget || '',
            regionIds: c.regionIds || []
          };
        });

        if (this.campagnes.length > 0 && !this.presenceConfig.campagneId) {
          this.presenceConfig.campagneId = this.campagnes[0].id;
        }

        this.appliquerBudgetCampagne();
        this.updateCandidaturesParCampagne();
        this.updateStats();
      },
      error: err => console.error('Erreur chargement campagnes', err)
    });
  }

  voirCandidaturesCampagne(campagne: Campagne, event?: Event): void {
    if (event) event.preventDefault();
    if (campagne.candidatures === 0) return;
    this.setActive('candidatures');
    this.searchQuery = campagne.nom;
  }

  openCreateModal(): void {
    this.showCreateModal = true;
    this.newCampagne = this.emptyNewCampagne();
    this.campagneExcelFile = null;
    this.regionsDetectees = [];
    this.isSavingCampagne = false;
    this.documentsPendants = [];
    this.parentsExcelFile = null;
    setTimeout(() => {
      if (this.modalRef?.nativeElement) {
        this.trapFocus(this.modalRef.nativeElement);
      }
    }, 100);
  }

  private trapFocus(modal: HTMLElement): void {
    const focusableSelectors = [
      'input', 'select', 'textarea', 'button',
      'a[href]', '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    const focusable = modal.querySelectorAll<HTMLElement>(focusableSelectors);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    first?.focus();
    modal.removeEventListener('keydown', (modal as any)._focusTrapHandler);

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    (modal as any)._focusTrapHandler = handler;
    modal.addEventListener('keydown', handler);
  }

  closeModal(): void {
    this.showCreateModal = false;
    this.campagneExcelFile = null;
    this.regionsDetectees = [];
    this.isSavingCampagne = false;
    this.documentsPendants = [];
    this.parentsExcelFile = null;
    if (this.modalRef?.nativeElement?._focusTrapHandler) {
      this.modalRef.nativeElement.removeEventListener(
        'keydown',
        this.modalRef.nativeElement._focusTrapHandler
      );
    }
  }

 voirParentsCampagne(campagne: any): void {
  this.selectedCampagne = campagne;

  this.parentService.getParentsByCampagne(campagne.id).subscribe({
    next: (data: ParentAutorise[]) => {
      this.parents = data;
      this.updateStats();
    },
    error: (err: any) => {
      console.error(err);
      this.parents = [];
      this.updateStats();
    }
  });
}

  get filteredParents(): any[] {
    const q = this.parentSearch.toLowerCase().trim();
    if (!q) return this.parents;
    return this.parents.filter(p =>
      p.nomPrenom.toLowerCase().includes(q) ||
      p.matricule.toLowerCase().includes(q)
    );
  }

  getParentPageEnd(): number {
    return Math.min(this.parentPage * this.parentPageSize, this.filteredParents.length);
  }

  // S2301: split into two dedicated methods instead of one boolean param
  saveCampagneAsBrouillon(): void {
    this.saveCampagneInternal(false);
  }

  

  saveCampagneEtActiver(): void {
    this.saveCampagneInternal(true);
  }

  /** @deprecated Use saveCampagneAsBrouillon() or saveCampagneEtActiver() */
  saveCampagne(activer: boolean): void {
    this.saveCampagneInternal(activer);
  }

  private saveCampagneInternal(activer: boolean): void {
    if (!this.newCampagne.nom || !this.newCampagne.dateDebut || !this.newCampagne.dateFin) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (!this.campagneExcelFile) {
      alert('Veuillez sélectionner le fichier Excel des structures');
      return;
    }

    // ✅ Une seule campagne par année
const campagneMemeAnnee = this.campagnes.find(c => 
  c.code.startsWith(`CAM-${this.newCampagneAnnee}-`)
);
if (campagneMemeAnnee) {
  alert(`❌ Une campagne existe déjà pour l'année ${this.newCampagneAnnee} : "${campagneMemeAnnee.nom}"`);
  return;
}

    if (activer) {
      const campagneActiveExistante = this.campagnes.find(c => c.statut === 'active');
      if (campagneActiveExistante) {
        this.showActiveCampagneWarning = true;
        this.activeCampagneNom = campagneActiveExistante.nom;
        return;
      }
    }

    this.isSavingCampagne = true;

    const dto: CampagneRequestDTO = {
      libelle: this.newCampagne.nom,
      code: this.newCampagne.code,
      dateDebut: this.newCampagne.dateDebut,
      dateFin: this.newCampagne.dateFin,
      description: this.newCampagne.description,
      budget: this.newCampagne.budget ? Number(this.newCampagne.budget) : undefined,
      regionIds: []
    };

    this.campagneService.creerCampagneAvecExcel(dto, this.campagneExcelFile!).subscribe({
      next: (campagneCreee) => {
        if (this.parentsExcelFile) {
          this.candidatureService.uploadParentsExcel(this.parentsExcelFile, campagneCreee.id).subscribe({
            next: () => {
              this.showToast('✅ Parents importés avec succès');
              this.uploaderDocumentsPendants(campagneCreee.id, activer);
            },
            error: (err) => {
              console.error(err);
              alert('❌ Erreur lors de l\'import des parents');
              this.isSavingCampagne = false;
            }
          });
        } else {
          this.uploaderDocumentsPendants(campagneCreee.id, activer);
        }
      },
      error: (err) => {
        console.error(err);
        alert('Erreur lors de la création de la campagne');
        this.isSavingCampagne = false;
      }
    });
  }

  onParentsExcelSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.parentsExcelFile = file;
  }

  onParentsExcelDrop(event: DragEvent): void {
    event.preventDefault();
    this.parentsExcelDragOver = false;
    const file = event.dataTransfer?.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      this.parentsExcelFile = file;
    } else {
      alert('Veuillez déposer un fichier Excel (.xlsx ou .xls)');
    }
  }

  private uploaderDocumentsPendants(campagneId: number, activer: boolean): void {
    if (this.documentsPendants.length === 0) {
      this.finaliserCreation(campagneId, activer);
      return;
    }

    const uploads$ = this.documentsPendants.map(doc =>
      this.docCampagneService.uploadDocument(
        campagneId,
        doc.nom,
        doc.type,
        doc.file
      )
    );

    forkJoin(uploads$).subscribe({
      next: () => {
        this.finaliserCreation(campagneId, activer);
      },
      error: (err) => {
        console.error('Erreur upload documents:', err);
        this.showToast('⚠️ Campagne créée mais erreur sur certains documents');
        this.finaliserCreation(campagneId, activer);
      }
    });
  }

  private finaliserCreation(campagneId: number, activer: boolean): void {
    if (activer) {
      this.campagneService.activerCampagne(campagneId).subscribe({
        next: () => {
          this.loadCampagnes();
          this.closeModal();
          this.isSavingCampagne = false;
          this.showToast('✅ Campagne créée et activée avec succès');
        },
        error: () => {
          this.loadCampagnes();
          this.closeModal();
          this.isSavingCampagne = false;
        }
      });
    } else {
      this.loadCampagnes();
      this.closeModal();
      this.isSavingCampagne = false;
      this.showToast('✅ Campagne créée avec succès');
    }
  }

  onMemoCampagneChange(campagneId: number): void {
    this.memoSelectedCampagneId = campagneId;
    this.memoDocumentSelectionne = null;
    this.memoViewerUrl = null;
    if (!campagneId) { this.memoDocumentsCampagne = []; return; }
    this.isLoadingDocsCampagne = true;
    this.docCampagneService.getDocumentsByCampagne(campagneId).subscribe({
      next: docs => {
        this.memoDocumentsCampagne = docs;
        this.isLoadingDocsCampagne = false;
        if (docs.length > 0) {
          this.selectionnerDocumentMemo(docs[0]);
        }
      },
      error: () => { this.memoDocumentsCampagne = []; this.isLoadingDocsCampagne = false; }
    });
  }

  supprimerDocumentMemo(doc: DocumentCampagneDTO): void {
    if (!confirm(`Supprimer "${doc.nom}" ?`)) return;
    this.docCampagneService.deleteDocument(doc.id).subscribe({
      next: () => {
        this.memoDocumentsCampagne = this.memoDocumentsCampagne.filter(d => d.id !== doc.id);
        this.showToast('✅ Document supprimé');
      },
      error: () => this.showToast('❌ Erreur suppression')
    });
  }

  onMemoDocumentUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.memoSelectedCampagneId) return;

    const nom = file.name.replace(/\.[^.]+$/, '');
    this.docCampagneService.uploadDocument(
      this.memoSelectedCampagneId,
      nom,
      'مذكرة الإنتداب',
      file
    ).subscribe({
      next: doc => {
        this.memoDocumentsCampagne.push(doc);
        this.showToast('✅ Document ajouté');
        (event.target as HTMLInputElement).value = '';
      },
      error: () => this.showToast('❌ Erreur upload')
    });
  }

  cloturerEtActiver(): void {
    const actives = this.campagnes.filter(c => c.statut === 'active');
    actives.forEach(camp => {
      this.campagneService.cloturerCampagne(camp.id).subscribe({
        next: () => {
          camp.statut = 'termine';
          camp.statutLabel = 'Clôturée';
          this.stats.campagnesCloturee--;
           // ✅ Si la campagne clôturée était sélectionnée, vider les parents
        if (this.selectedCampagne?.id === camp.id) {
          this.selectedCampagne = camp;
          this.parents = [];
          this.updateStats(); // totalParents = 0 immédiatement
        }
        },
        error: err => console.error(err)
      });
    });

    this.showActiveCampagneWarning = false;
    setTimeout(() => this.saveCampagneInternal(true), 500);
  }

  fermerWarning(): void {
    this.showActiveCampagneWarning = false;
  }

  activerCampagne(): void {
    const brouillon = this.campagnes.find(c => c.statut === 'brouillon' || c.statut === 'planifie');
    if (brouillon) {
      brouillon.statut = 'active';
      brouillon.statutLabel = 'Active';
      this.stats.campagnesCloturee++;
    }
  }

  private emptyNewCampagne(): Campagne {
    const annee = new Date().getFullYear();
    const codeAuto = `CAM-${annee}-${String(Date.now()).slice(-4)}`;
    return {
      id: 0,
      nom: `Campagne de recrutement des saisonniers pour ${annee}`,
      code: codeAuto,
      dateDebut: '', dateFin: '',
      statut: 'brouillon', statutLabel: 'Brouillon',
      candidatures: 0, affectations: 0, verrouille: false,
      description: '', budget: '', regionIds: []
    };
  }

  onAnneeChange(): void {
    this.newCampagne.nom = `Campagne de recrutement des saisonniers pour ${this.newCampagneAnnee}`;
    this.newCampagne.code = `CAM-${this.newCampagneAnnee}-${String(Date.now()).slice(-4)}`;
  }

  get regionsDisponibles(): string[] {
    const set = new Set(this.candidatures.map(c => c.saisonnier.region.nom));
    return Array.from(set).sort((a, b) => a.localeCompare(b)); // S2871
  }

  get structuresDisponibles(): string[] {
    if (!this.candidatureFilterRegion) {
      return [];
    }
    return this.structures
      .filter(s => s.region === this.candidatureFilterRegion)
      .map(s => s.nom);
  }

  get structuresECDisponibles(): StructureDTO[] {
    if (!this.candidatureFilterRegion) return [];
    return this.structures.filter(s =>
      s.region === this.candidatureFilterRegion &&
      s.type === 'ESPACE_COMMERCIAL'
    );
  }

  get structuresCTDisponibles(): StructureDTO[] {
    if (!this.candidatureFilterRegion) return [];
    return this.structures.filter(s =>
      s.region === this.candidatureFilterRegion &&
      s.type === 'CENTRE_TECHNIQUE'
    );
  }

  get structuresSCDisponibles(): StructureDTO[] {
    if (!this.candidatureFilterRegion) return [];
    return this.structures.filter(s =>
      s.region === this.candidatureFilterRegion &&
      s.type === 'STRUCTURE_CENTRALE'
    );
  }

  filterCandidatures(): void {
    let list = [...this.candidatures];

    if (this.candidatureFilterRegion) {
      list = list.filter(c => c.saisonnier?.region?.nom === this.candidatureFilterRegion);
    }

    if (this.candidatureFilterStructure) {
      list = list.filter(c => {
        const st = this.candidatureStructureMap.get(c.id);
        if (!st?.nom) return false;
        return st.nom.trim().toLowerCase() ===
          this.candidatureFilterStructure.trim().toLowerCase();
      });
    }

    if (this.candidatureFilterStatut) {
      list = list.filter(c => c.statut === this.candidatureFilterStatut);
    }

    if (this.candidatureFilterMois) {
      list = list.filter(c => c.saisonnier?.moisTravail === this.candidatureFilterMois);
    }

    this.filteredCandidatures = list;
  }

  resetFiltresCandidatures(): void {
    this.candidatureFilterRegion = '';
    this.candidatureFilterStructure = '';
    this.candidatureFilterStatut = '';
    this.candidatureFilterMois = '';
    this.filterCandidatures();
  }

  onRegionFilterChange(): void {
    this.candidatureFilterStructure = '';
    this.filterCandidatures();
  }

  get presenceRegionsDisponibles(): string[] {
    const set = new Set(
      this.presenceRows
        .map(r => {
          const cand = this.candidatures.find(c => c.id === r.id);
          return cand?.saisonnier?.region?.nom ?? '';
        })
        .filter(Boolean)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b)); // S2871
  }

  get presenceStructuresDisponibles(): string[] {
    if (!this.presenceFilterRegion) return [];
    const set = new Set<string>();
    this.presenceRows.forEach(r => {
      const cand = this.candidatures.find(c => c.id === r.id);
      if (cand?.saisonnier?.region?.nom !== this.presenceFilterRegion) return;
      const st = this.candidatureStructureMap.get(r.id);
      if (st?.nom) set.add(st.nom);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b)); // S2871
  }

  onPresenceRegionChange(): void {
    this.presenceFilterStructure = '';
    this.filterPresence();
  }

  resetFiltresPresence(): void {
    this.presenceFilterRegion = '';
    this.presenceFilterStructure = '';
    this.presenceSearchQuery = '';
    this.filterPresence();
  }

  errors: { [key: string]: string } = {};

  // S3776: split validation into smaller helpers to reduce cognitive complexity
  private validatePersonalFields(s: any): void {
    if (!s.prenom?.trim())           this.errors['prenom'] = 'Le prénom est obligatoire.';
    if (!s.nom?.trim())              this.errors['nom'] = 'Le nom est obligatoire.';
    if (!s.region?.id)               this.errors['region'] = 'La direction est obligatoire.';
    if (!s.moisTravail)              this.errors['moisTravail'] = 'Le mois de travail est obligatoire.';
  }

  private validateContactFields(s: any): void {

  // ✅ Regex email simple — pas de backtracking
  if (!s.email?.trim()) {
    this.errors['email'] = 'L\'email est obligatoire.';
  } else if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(s.email)) {
    this.errors['email'] = 'Email invalide.';
  }

  // ✅ Regex téléphone — inchangée, pas de risque
  if (!s.telephone?.trim()) {
    this.errors['telephone'] = 'Le téléphone est obligatoire.';
  } else if (!/^\d{8}$/.test(s.telephone)) {
    this.errors['telephone'] = 'Le téléphone doit contenir exactement 8 chiffres.';
  }

  // ✅ Regex CIN — inchangée, pas de risque
  if (!s.cin?.trim()) {
    this.errors['cin'] = 'Le CIN est obligatoire.';
  } else if (!/^\d{8}$/.test(s.cin)) {
    this.errors['cin'] = 'Le CIN doit contenir exactement 8 chiffres.';
  }

  if (!s.rib?.trim()) this.errors['rib'] = 'Le RIB est obligatoire.';
}

  private validateDiplomaFields(s: any): void {
    if (!s.niveauEtude)               this.errors['niveauEtude'] = 'Le niveau d\'étude est obligatoire.';
    if (!s.diplome?.trim())           this.errors['diplome'] = 'Le diplôme est obligatoire.';
    if (!s.specialiteDiplome?.trim()) this.errors['specialiteDiplome'] = 'La spécialité est obligatoire.';
  }

  private validateParentFields(s: any): void {
    if (!s.nomPrenomParent?.trim()) this.errors['nomPrenomParent'] = 'Le nom du parent est obligatoire.';
    if (!s.matriculeParent)         this.errors['matriculeParent'] = 'Le matricule parent est obligatoire.';
  }

  validateForm(): boolean {
    this.errors = {};
    const s = this.selectedCandidature.saisonnier;
    const cand = this.selectedCandidature;

    this.validatePersonalFields(s);
    this.validateContactFields(s);
    this.validateDiplomaFields(s);
    this.validateParentFields(s);

    if (!cand.statut) this.errors['statut'] = 'Le statut est obligatoire.';

    return Object.keys(this.errors).length === 0;
  }

  updateCandidature() {
    if (!this.validateForm()) return;

    const cand = this.selectedCandidature;
    const s = cand.saisonnier;
    const formData = new FormData();

    formData.append('nom', s.nom);
    formData.append('prenom', s.prenom);
    formData.append('cin', s.cin);
    formData.append('rib', s.rib);
    formData.append('telephone', s.telephone);
    formData.append('email', s.email);
    formData.append('regionId', s.region.id);
    formData.append('moisTravail', s.moisTravail || '');
    formData.append('statut', cand.statut);
    formData.append('commentaire', cand.commentaire || '');
    formData.append('niveauEtude', s.niveauEtude || '');
    formData.append('diplome', s.diplome || '');
    formData.append('specialiteDiplome', s.specialiteDiplome || '');
    formData.append('nomPrenomParent', s.nomPrenomParent || '');
    formData.append('matriculeParent', String(s.matriculeParent ?? ''));

    this.candidatureService.updateCandidature(cand.id, formData)
      .subscribe({
        next: () => {
          alert('Candidature mise à jour ✅');
          this.loadCandidatures();
          this.closeDossier();
        },
        error: err => console.error(err)
      });
  }

  onlyDigits(event: KeyboardEvent): boolean {
    return /\d/.test(event.key);
  }

  openDossier(cand: any) {
    this.selectedCandidature = structuredClone(cand); // S7784: prefer structuredClone
    console.log('📂 Candidature ouverte:', this.selectedCandidature);

    this.selectedStructureId = cand.saisonnier?.structure?.id || null;
    console.log('🏢 Structure sélectionnée (init):', this.selectedStructureId);

    this.showDossierModal = true;
    const regionId = cand.saisonnier?.region?.id || this.myRegion?.id;
    this.structureService.getStructuresByRegion(regionId).subscribe({
      next: (data: StructureDTO[]) => {
        this.structures = data;
        this.candidatureService.getStructureByCandidature(cand.id).subscribe({
          next: (st: any) => {
            if (st?.id) {
              this.selectedCandidatureStructure = st;
              this.selectedStructureId = st.id;
            }
            this.isLoadingStructure = false;
          },
          error: () => {
            this.selectedStructureId = null;
            this.isLoadingStructure = false;
          }
        });
      },
      error: (err: any) => {
        console.error('Erreur chargement structures:', err);
        this.isLoadingStructure = false;
      }
    });
  }

  // ── Gestion des documents pendants (lors création campagne) ──────

  onDocumentPendantSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.documentsPendants.push({
      file,
      nom: file.name.replace(/\.[^.]+$/, ''),
      type: 'مذكرة الإنتداب'
    });
    (event.target as HTMLInputElement).value = '';
  }

  supprimerDocumentPendant(index: number): void {
    this.documentsPendants.splice(index, 1);
  }

  updateDocumentPendantNom(index: number, nom: string): void {
    this.documentsPendants[index].nom = nom;
  }

  updateDocumentPendantType(index: number, type: string): void {
    this.documentsPendants[index].type = type;
  }

  // ─── Candidatures ─────────────────────────────────────────────────

  loadCandidatures(): void {
    this.candidatureService.getAllCandidatures().subscribe({
      next: data => {
        this.candidatures = data;
        this.candidatures.forEach(c => {
          this.candidatureService.getStructureByCandidature(c.id).subscribe({
            next: (st: any) => {
              if (st?.id) {
                this.candidatureStructureMap.set(c.id, st);
              }
            },
            error: () => {}
          });
        });

        this.updateCandidaturesParCampagne();
        this.filterCandidatures();
        this.loadPresenceRows();
        this.updateStats();
      },
      error: err => console.error('Erreur chargement candidatures', err)
    });
  }

  updateStats(): void {
    const candidatures = this.candidatures || [];

    this.stats.totalCandidatures = candidatures.length;
    this.stats.candidaturesAcceptees = candidatures.filter(c => c.statut === 'ACCEPTEE').length;
    this.stats.candidaturesEnAttente = candidatures.filter(c => c.statut === 'EN_ATTENTE').length;
    this.stats.candidaturesRefusees = candidatures.filter(c => c.statut === 'REFUSEE').length;


    const campagneActive = this.campagnes?.find(c => c.statut === 'active');
    this.stats.totalParents = campagneActive ? (this.parents?.length || 0) : 0;

    if (campagneActive?.dateFin) {
      const aujourd = new Date();
      aujourd.setHours(0, 0, 0, 0);
      const fin = new Date(campagneActive.dateFin);
      fin.setHours(0, 0, 0, 0);
      const diff = fin.getTime() - aujourd.getTime();
      this.stats.joursRestants = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    } else {
      this.stats.joursRestants = 0;
    }

    this.stats.campagnesCloturee = this.campagnes?.filter(c => c.statut === 'termine').length || 0;
  }

  private updateCandidaturesParCampagne(): void {
    const compteur: Record<number, number> = {};
    this.candidatures.forEach(c => {
      const id = c.campagne.id;
      compteur[id] = (compteur[id] || 0) + 1;
    });

    this.campagnes = this.campagnes.map(camp => ({
      ...camp,
      candidatures: compteur[camp.id] || 0
    }));

    this.stats.totalCandidatures = this.candidatures.length;
  }

  // ─── Memo Intidab ─────────────────────────────────────────────────

  loadCirculaireFromServer(): void {
  this.isLoadingPdf = true;
  this.documentService.getDocumentByType('CIRCULAIRE_2025').subscribe({
    next: (doc) => {
      if (doc?.url) {

        // ✅ Validation — URL autorisée depuis environment uniquement
        const urlAutorisee =
          doc.url.startsWith('/files/') ||
          doc.url.startsWith(environment.apiUrl);

        if (!urlAutorisee) {
          this.memoDocument.hasFile = false;
          this.isLoadingPdf = false;
          return;
        }

        this.memoDocument.rawUrl = doc.url;
        this.memoDocument.fileName = doc.url.split('/').pop() || 'مذكرة_إنتداب_موسمي_.pdf';
        // ✅ bypass justifié : URL validée contre l'origine du backend
        this.memoDocument.fileUrl = this.sanitizer.bypassSecurityTrustResourceUrl(doc.url);
        this.memoDocument.hasFile = true;

      } else {
        this.memoDocument.hasFile = false;
      }
      this.isLoadingPdf = false;
    },
    error: () => {
      this.memoDocument.hasFile = false;
      this.isLoadingPdf = false;
    }
  });
}

  private handlePdfUpload(file: File): void {
  const localUrl = URL.createObjectURL(file);

  // ✅ Validation blob URL locale
  if (!localUrl.startsWith('blob:')) {
    this.memoDocument.hasFile = false;
    return;
  }

  this.memoDocument.rawUrl = localUrl;
  this.memoDocument.fileName = file.name;
  // ✅ bypass justifié : URL générée par createObjectURL depuis un File local
  this.memoDocument.fileUrl = this.sanitizer.bypassSecurityTrustResourceUrl(localUrl);
  this.memoDocument.hasFile = true;

  this.isUploading = true;
  this.uploadSuccess = false;
  this.uploadError = '';

  this.documentService.uploadDocument(file, 'CIRCULAIRE_2025').subscribe({
    next: (res) => {

      // ✅ Validation URL serveur via environment
      const urlAutorisee =
        res.url.startsWith('/files/') ||
        res.url.startsWith(environment.apiUrl);

      if (!urlAutorisee) {
        this.uploadError = 'URL du serveur non autorisée.';
        this.isUploading = false;
        return;
      }

      this.memoDocument.rawUrl = res.url;
      // ✅ bypass justifié : URL validée contre l'origine du backend
      this.memoDocument.fileUrl = this.sanitizer.bypassSecurityTrustResourceUrl(res.url);
      this.isUploading = false;
      this.uploadSuccess = true;
      setTimeout(() => this.uploadSuccess = false, 4000);
    },
    error: (err) => {
      console.error('Erreur upload PDF :', err);
      this.uploadError = "Erreur upload. L'aperçu local reste disponible.";
      this.isUploading = false;
    }
  });
}

  openMemoUploadModal(): void {
    this.memoSelectedFile = null;
    this.showMemoUploadModal = true;
  }

  closeMemoModal(): void {
    this.showMemoUploadModal = false;
    this.memoSelectedFile = null;
  }

  onMemoFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file?.type === 'application/pdf') {
      this.memoSelectedFile = file;
      this.handlePdfUpload(file);
      this.closeMemoModal();
    }
  }

  onMemoDrop(event: DragEvent): void {
    event.preventDefault();
    this.memoDragOver = false;
    const file = event.dataTransfer?.files[0];
    if (file?.type === 'application/pdf') {
      this.handlePdfUpload(file);
      this.closeMemoModal();
    } else {
      alert('Veuillez déposer un fichier PDF.');
    }
  }

  saveMemoDocument(): void {
    if (!this.memoSelectedFile) return;
    this.handlePdfUpload(this.memoSelectedFile);
    this.closeMemoModal();
  }

  downloadMemo(): void {
    if (this.memoDocument.rawUrl) {
      const a = document.createElement('a');
      a.href = this.memoDocument.rawUrl;
      a.download = this.memoDocument.fileName;
      a.click();
    } else {
      alert('Aucun document disponible.');
    }
  }

  zoomIn(): void {
    if (this.memoDocument.zoom < 200) this.memoDocument.zoom += 10;
  }

  zoomOut(): void {
    if (this.memoDocument.zoom > 30) this.memoDocument.zoom -= 10;
  }

  printMemo(): void {
    if (this.memoDocument.rawUrl) {
      globalThis.open(this.memoDocument.rawUrl)?.print(); // S7764
    }
  }

  // ─── Structures par Région ────────────────────────────────────────

  loadStructures(): void {
    this.structureService.getStructuresCampagneActive().subscribe({
      next: (data) => {
        console.log('📥 Structures backend:', data);
        this.structures = data.map(s => ({
          ...s,
          isFirstInGov: false
        }));
        console.log('🏢 Structures après mapping:', this.structures);
        this.buildGouvernorats();
        this.applyStructureFilter();
        this.updateStructuresStats();
      },
      error: () => {
        this.structures = [];
        this.buildGouvernorats();
        this.applyStructureFilter();
        this.updateStructuresStats();
      }
    });
  }

  buildGouvernorats(): void {
    const govMap: Record<string, number> = {};
    this.structures.forEach(s => {
      govMap[s.region] = (govMap[s.region] || 0) + 1;
    });
    this.gouvernorats = Object.entries(govMap).map(([nom, count]) => ({ nom, count }));
  }

  applyStructureFilter(): void {
    let list = [...this.structures];

    if (this.structureTypeFilter !== 'tous') {
      list = list.filter(s => s.type === this.structureTypeFilter);
    }

    if (this.selectedGouvernorat) {
      list = list.filter(s => s.region === this.selectedGouvernorat);
    }

    list.sort((a, b) => (a.region ?? '').localeCompare(b.region ?? ''));

    const seenGovs = new Set<string>();
    this.filteredStructures = list.map(s => {
      const isFirstInGov = !seenGovs.has(s.region);
      seenGovs.add(s.region);
      return { ...s, isFirstInGov };
    });
  }

  setStructureFilter(type: string): void {
    this.structureTypeFilter = type;
    this.applyStructureFilter();
  }

  filterByGouvernorat(nom: string): void {
    this.selectedGouvernorat = this.selectedGouvernorat === nom ? '' : nom;
    this.applyStructureFilter();
  }

  exportStructures(): void {
    alert('Export XLSX — à connecter au service backend.');
  }

  get campagneActive(): Campagne | undefined {
  return this.campagnes?.find(c => c.statut === 'active');
}

  

  openStructureUploadModal(): void {
    this.structureSelectedFile = null;
    this.showStructureUploadModal = true;
  }

  closeStructureModal(): void {
    this.showStructureUploadModal = false;
    this.structureSelectedFile = null;
  }

  onStructureFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.structureSelectedFile = input.files[0];
    }
  }

  onStructureDrop(event: DragEvent): void {
    event.preventDefault();
    this.structureDragOver = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.structureSelectedFile = files[0];
    }
  }

  saveStructureFile(): void {
    if (!this.structureSelectedFile) return;

    this.structureimportService.importExcel(this.structureSelectedFile).subscribe({
      next: () => {
        this.closeStructureModal();
        this.loadStructures();
        alert('✅ Structures mises à jour avec succès !');
      },
      error: (err) => {
        console.error(err);
        alert('❌ Erreur lors de l\'import Excel.');
      }
    });
  }

  editStructure(structure: Structure): void {
    this.editingStructure = { ...structure };
    this.showEditStructureModal = true;
  }

  closeEditStructureModal(): void {
    this.showEditStructureModal = false;
    this.editingStructure = null;
  }

  saveEditStructure(): void {
    if (!this.editingStructure) return;

    this.structureService.updateStructure(this.editingStructure.id, {
      nom: this.editingStructure.nom,
      adresse: this.editingStructure.adresse,
      autorises: this.editingStructure.autorises,
      type: this.editingStructure.type
    }).subscribe({
      next: () => {
        const idx = this.structures.findIndex(s => s.id === this.editingStructure!.id);
        if (idx !== -1) {
          this.structures[idx] = {
            ...this.editingStructure!,
            disponible: this.structures[idx].disponible
          };
          this.buildGouvernorats();
          this.applyStructureFilter();
          this.updateStructuresStats();
        }
        this.closeEditStructureModal();
        alert('✅ Structure mise à jour avec succès');
      },
      error: (err) => {
        console.error(err);
        alert('❌ Erreur lors de la mise à jour');
      }
    });
  }

  private updateStructuresStats(): void {
    this.structuresStats.total = this.structures.length;
    this.structuresStats.espacesCommerciaux = this.structures.filter(s => s.type === 'ESPACE_COMMERCIAL').length;
    this.structuresStats.centresTechnologiques = this.structures.filter(s => s.type === 'CENTRE_TECHNIQUE').length;
    this.structuresStats.saisonnersAutorises = this.structures.reduce((sum, s) => sum + s.autorises, 0);
    this.structuresStats.saisonnersRecrutes = this.structures.reduce((sum, s) => sum + s.recrutes, 0);
  }

  // ─── Présence & Paiement ──────────────────────────────────────────

  loadPresenceRows(): void {
    const campagneId = this.presenceConfig.campagneId;
    let candidaturesFiltrees = this.candidatures;

    if (campagneId) {
      candidaturesFiltrees = this.candidatures.filter(c => c.campagne.id === campagneId);
    }

    candidaturesFiltrees = candidaturesFiltrees.filter(c => c.statut === 'ACCEPTEE');

    this.presenceRows = candidaturesFiltrees.map(c => ({
      id: c.id,
      nom: `${c.saisonnier.nom} ${c.saisonnier.prenom}`,
      cin: String(c.saisonnier.cin),
      dureeContrat: this.presenceConfig.dureeContrat,
      absences: c.saisonnier.absences ?? 0,
      montantNet: 0,
      rib: c.saisonnier.rib ?? '',
      statut: 'impaye' as const, // S6590: use `as const` instead of literal type assertion
      campagneId: c.campagne.id
    }));

    this.recalculerPresence();
    this.filterPresence();
  }

  getCampagneBudget(): number {
    const campagneActive = this.campagnes.find(c => c.statut === 'active');
    const campagne = campagneActive ?? this.campagnes.find(c => c.id === this.presenceConfig.campagneId);
    return campagne?.budget ? Number(campagne.budget) : 0;
  }

  recalculerPresence(): void {
    const { tauxJournalier, dureeContrat } = this.presenceConfig;

    this.presenceRows = this.presenceRows.map(row => ({
      ...row,
      dureeContrat,
      montantNet: (dureeContrat - row.absences) * tauxJournalier
    }));

    this.updatePresenceStats();
    this.filterPresence();
  }

  private updatePresenceStats(): void {
    const { tauxJournalier } = this.presenceConfig;
    const totalAbsences = this.presenceRows.reduce((s, r) => s + r.absences, 0);
    const masseSalariale = this.presenceRows.reduce((s, r) => s + r.montantNet, 0);

    this.presenceStats = {
      totalSaisonniers: this.presenceRows.length,
      masseSalariale,
      joursAbsence: totalAbsences,
      tauxJournalier
    };

    this.presenceTotals = {
      totalJours: this.presenceRows.reduce((s, r) => s + r.dureeContrat, 0),
      totalAbsences,
      totalMontant: masseSalariale
    };
  }

  filterPresence(): void {
    let list = [...this.presenceRows];

    if (this.presenceFilterRegion) {
      list = list.filter(r => {
        const cand = this.candidatures.find(c => c.id === r.id);
        return cand?.saisonnier?.region?.nom === this.presenceFilterRegion;
      });
    }

    if (this.presenceFilterStructure) {
      list = list.filter(r => {
        const st = this.candidatureStructureMap.get(r.id);
        return st?.nom?.trim().toLowerCase() ===
          this.presenceFilterStructure.trim().toLowerCase();
      });
    }

    if (this.presenceFilter === 'payes') {
      list = list.filter(r => r.statut === 'paye');
    } else if (this.presenceFilter === 'impayes') {
      list = list.filter(r => r.statut === 'impaye');
    }

    if (this.presenceSearchQuery.trim()) {
      const q = this.presenceSearchQuery.toLowerCase();
      list = list.filter(r =>
        r.nom.toLowerCase().includes(q) || r.cin.toLowerCase().includes(q)
      );
    }

    this.filteredPresenceRows = list;
  }

  setPresenceFilter(filter: 'tous' | 'payes' | 'impayes'): void {
    this.presenceFilter = filter;
    this.filterPresence();
  }

  onPresenceCampagneChange(): void {
    const campagneActive = this.campagnes.find(
      c => c.id === this.presenceConfig.campagneId && c.statut === 'active'
    );

    if (campagneActive?.budget) {
      const budgetParSaisonnier = Number(campagneActive.budget);
      const tauxCalcule = budgetParSaisonnier / this.presenceConfig.dureeContrat;
      this.presenceConfig.tauxJournalier = Math.round(tauxCalcule * 1000) / 1000;
    }

    this.loadPresenceRows();
  }

  private appliquerBudgetCampagne(): void {
    console.log('📋 Campagnes disponibles:',
      this.campagnes.map(c => ({
        id: c.id,
        nom: c.nom,
        statut: c.statut,
        budget: c.budget
      }))
    );

    let campagneActive = this.campagnes.find(c => c.statut === 'active');

    if (!campagneActive) {
      campagneActive = this.campagnes.find(c => c.budget && Number(c.budget) > 0);
      if (campagneActive) {
        console.log('⚠️ Fallback : utilisation de la campagne avec budget:', campagneActive.nom);
      }
    }

    if (!campagneActive) {
      console.warn('⚠️ Aucune campagne active ni avec budget trouvée');
      campagneActive = this.campagnes[0];
      if (!campagneActive) return;
    }

    this.presenceConfig.campagneId = campagneActive.id;

    const budgetMensuel = Number(campagneActive.budget);
    console.log('🎯 Campagne utilisée:', campagneActive.nom, '| statut:', campagneActive.statut);
    console.log('💰 Budget mensuel:', budgetMensuel);

    if (budgetMensuel > 0 && this.presenceConfig.dureeContrat > 0) {
      this.presenceConfig.tauxJournalier =
        Math.round((budgetMensuel / this.presenceConfig.dureeContrat) * 1000) / 1000;
      console.log('✅ Taux journalier calculé:', this.presenceConfig.tauxJournalier);
    }
  }

  onPresenceRowChange(row: PresenceRow): void {
    row.montantNet = (row.dureeContrat - row.absences) * this.presenceConfig.tauxJournalier;
    this.updatePresenceStats();
  }

  recalculerLigne(row: PresenceRow): void {
    row.montantNet = (row.dureeContrat - row.absences) * this.presenceConfig.tauxJournalier;
    this.updatePresenceStats();
  }

  togglePaiementStatut(row: PresenceRow): void {
    row.statut = row.statut === 'paye' ? 'impaye' : 'paye';
    this.filterPresence();
    this.updatePresenceStats();
  }

  marquerPaye(row: PresenceRow): void {
    row.statut = 'paye';
    this.filterPresence();
    this.updatePresenceStats();
  }

  marquerImpaye(row: PresenceRow): void {
    row.statut = 'impaye';
    this.filterPresence();
    this.updatePresenceStats();
  }

  // ── Modal Absences ───────────────────────────────────────────────

  openAbsenceModal(row: PresenceRow): void {
    this.editingPresenceRow = { ...row };
    this.showAbsenceModal = true;
  }

  closeAbsenceModal(): void {
    this.showAbsenceModal = false;
    this.editingPresenceRow = null;
  }

  incrementAbsence(): void {
    if (this.editingPresenceRow && this.editingPresenceRow.absences < this.editingPresenceRow.dureeContrat) {
      this.editingPresenceRow.absences++;
      this.recalculerLigne(this.editingPresenceRow);
    }
  }

  decrementAbsence(): void {
    if (this.editingPresenceRow && this.editingPresenceRow.absences > 0) {
      this.editingPresenceRow.absences--;
      this.recalculerLigne(this.editingPresenceRow);
    }
  }

  saveAbsence(): void {
    if (!this.editingPresenceRow) return;
    const idx = this.presenceRows.findIndex(r => r.id === this.editingPresenceRow!.id);
    if (idx !== -1) {
      this.presenceRows[idx] = { ...this.editingPresenceRow };
      this.recalculerLigne(this.presenceRows[idx]);
      this.filterPresence();
    }
    this.closeAbsenceModal();
  }

  // ── Exports Présence ─────────────────────────────────────────────

  exportPresencePDF(): void {
    const directionNom = this.presenceFilterRegion || '';
    const rhNom = this.nomUtilisateur;
    const campagneNom = this.getCampagneNom();

    const totals = {
      totalJours:    this.filteredPresenceRows.reduce((s, r) => s + r.dureeContrat, 0),
      totalAbsences: this.filteredPresenceRows.reduce((s, r) => s + r.absences, 0),
      totalMontant:  this.filteredPresenceRows.reduce((s, r) => s + r.montantNet, 0),
    };

    this.presencePdfService.export(
      this.filteredPresenceRows,
      {
        tauxJournalier: this.presenceConfig.tauxJournalier,
        dureeContrat: this.presenceConfig.dureeContrat,
        campagneNom,
      },
      totals,
      directionNom,
      rhNom
    );
  }

  exportPresenceExcel(): void {
    const wb = XLSX.utils.book_new();

    const BLUE_DARK = '1E3A5F';
    const BLUE_MED = '2563EB';
    const GREY_BG = 'F1F5F9';
    const WHITE = 'FFFFFF';

    const fontBase = { name: 'Arial', sz: 10 };
    const fontTitle = { name: 'Arial', sz: 14, bold: true, color: { rgb: WHITE } };

    const borderThin = {
      top: { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } },
    };

    const cellTitle = {
      font: fontTitle,
      fill: { fgColor: { rgb: BLUE_DARK } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };

    const cellHeader = {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: WHITE } },
      fill: { fgColor: { rgb: BLUE_MED } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: borderThin,
    };

    const ws: any = {};

    const COLS = 7;
    const startRow = 5;

    ws['A1'] = {
      v: 'Campagne saisonnier - Etat de paiement',
      s: cellTitle
    };

    for (let c = 1; c < COLS; c++) {
      ws[XLSX.utils.encode_cell({ r: 0, c })] = { v: '', s: cellTitle };
    }

    const headers = [
      'N°',
      'Nom et Prénom',
      'CIN',
      'Durée contrat',
      'Nbre de jours d\'absences',
      'Nbre de jours de travail',
      'RIB'
    ];

    headers.forEach((h, c) => {
      ws[XLSX.utils.encode_cell({ r: 3, c })] = { v: h, s: cellHeader };
    });

    this.filteredPresenceRows.forEach((row, i) => {
      const r = startRow - 1 + i;

      const cell = (v: any, center = false) => ({
        v,
        s: {
          font: fontBase,
          fill: { fgColor: { rgb: i % 2 === 0 ? GREY_BG : WHITE } },
          alignment: { horizontal: center ? 'center' : 'left', vertical: 'center' },
          border: borderThin,
        },
      });

      const workedDays = (row.dureeContrat || 0) - (row.absences || 0);

      ws[XLSX.utils.encode_cell({ r, c: 0 })] = cell(i + 1, true);
      ws[XLSX.utils.encode_cell({ r, c: 1 })] = cell(row.nom);
      ws[XLSX.utils.encode_cell({ r, c: 2 })] = cell(row.cin, true);
      ws[XLSX.utils.encode_cell({ r, c: 3 })] = cell(row.dureeContrat, true);
      ws[XLSX.utils.encode_cell({ r, c: 4 })] = cell(row.absences, true);
      ws[XLSX.utils.encode_cell({ r, c: 5 })] = cell(workedDays, true);
      ws[XLSX.utils.encode_cell({ r, c: 6 })] = cell(row.rib || '—', true);
    });

    ws['!sheetViews'] = [{ zoomScale: 120 }];
    ws['!rows'] = [{ hpt: 30 }, { hpt: 25 }];
    ws['!cols'] = [
      { wch: 7 },
      { wch: 35 },
      { wch: 18 },
      { wch: 22 },
      { wch: 22 },
      { wch: 25 },
      { wch: 28 }
    ];
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } }
    ];

    const lastRow = startRow - 1 + this.filteredPresenceRows.length;
    ws['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: lastRow, c: COLS - 1 }
    });

    XLSX.utils.book_append_sheet(wb, ws, 'Présence');
    XLSX.writeFile(wb, `presence_paiement_${this.currentYear}.xlsx`);
  }

  private getCampagneNom(): string {
    const campagne = this.campagnes.find(c => c.id === this.presenceConfig.campagneId);
    return campagne?.nom ?? 'campagne';
  }

  voirDetailSaisonnier(row: PresenceRow): void {
    // TODO: Naviguer vers le détail ou ouvrir un modal
    console.log('Détail saisonnier:', row);
  }

  // ── Méthodes Voir ────────────────────────────────────────────────
  ouvrirVoirCampagne(campagne: Campagne): void {
    this.viewingCampagne = { ...campagne };
    this.viewingCampagneCandidatures = this.candidatures.filter(
      c => c.campagne.id === campagne.id
    );
    this.showViewModal = true;
  }

  fermerVoirModal(): void {
    this.showViewModal = false;
    this.viewingCampagne = null;
    this.viewingCampagneCandidatures = [];
  }

  viewingCampagneCandidatures: Candidature[] = [];

  // ── Méthodes Modifier ────────────────────────────────────────────
  ouvrirModifierCampagne(campagne: Campagne): void {
    this.editingCampagne = { ...campagne };
    this.showEditModal = true;
  }

  fermerEditModal(): void {
    this.showEditModal = false;
    this.editingCampagne = null;
  }

  sauvegarderModificationCampagne(): void {
  if (!this.editingCampagne) return;
  if (!this.editingCampagne.nom || !this.editingCampagne.dateDebut || !this.editingCampagne.dateFin) {
    alert('Veuillez remplir tous les champs obligatoires');
    return;
  }

  const statutBackendMap: Record<string, string> = {
    'active':    'ACTIVE',
    'brouillon': 'BROUILLON',
    'termine':   'CLOTUREE',
  };

  const dto: CampagneRequestDTO = {
    libelle: this.editingCampagne.nom,
    code: this.editingCampagne.code,
    dateDebut: this.editingCampagne.dateDebut,
    dateFin: this.editingCampagne.dateFin,
    description: this.editingCampagne.description,
    regionIds: this.editingCampagne.regionIds || [],
    statut: statutBackendMap[this.editingCampagne.statut] || 'BROUILLON'
  };

  // ✅ Sauvegarder l'ancien statut avant modification
 const ancienStatut = this.campagnes.find(c => c.id === this.editingCampagne!.id)?.statut as Campagne['statut'] | undefined;

  const nouveauStatut = this.editingCampagne.statut;

  this.campagneService.updateCampagne(this.editingCampagne.id, dto).subscribe({
    next: () => {
      const idx = this.campagnes.findIndex(c => c.id === this.editingCampagne!.id);
      if (idx !== -1) {
        this.campagnes[idx] = { ...this.editingCampagne! };
      }

      // ✅ Si la campagne modifiée était sélectionnée
      if (this.selectedCampagne?.id === this.editingCampagne!.id) {
        this.selectedCampagne = { ...this.editingCampagne! };

        if (nouveauStatut === 'active') {
          // Devient active → charger ses parents
          this.voirParentsCampagne(this.selectedCampagne);
        } else if (ancienStatut === 'active' && (nouveauStatut as string) !== 'active') {
          // N'est plus active → vider les parents
          this.parents = [];
          this.updateStats();
        }
      } else {
        // ✅ Si aucune campagne sélectionnée, chercher la nouvelle campagne active
        const campagneActive = this.campagnes.find(c => c.statut === 'active');
        if (campagneActive) {
          this.selectedCampagne = campagneActive;
          this.voirParentsCampagne(campagneActive);
        } else {
          this.parents = [];
          this.updateStats();
        }
      }

      this.fermerEditModal();
      this.loadCampagnes();
    },
    error: (err) => {
      console.error(err);
      alert('Erreur lors de la modification');
    }
  });
}

  changerStatutCampagne(nouveauStatut: string): void {
    if (!this.editingCampagne) return;

    if (nouveauStatut === 'ACTIVE') {
      const campagneActiveExistante = this.campagnes.find(
        c => c.statut === 'active' && c.id !== this.editingCampagne!.id
      );
      if (campagneActiveExistante) {
        alert(`Impossible : la campagne "${campagneActiveExistante.nom}" est déjà active. Clôturez-la d'abord.`);
        return;
      }
    }

    const statutMap: Record<string, { statut: Campagne['statut'], label: string }> = {
      'ACTIVE':    { statut: 'active',    label: 'Active'    },
      'BROUILLON': { statut: 'brouillon', label: 'Brouillon' },
      'CLOTUREE':  { statut: 'termine',   label: 'Clôturée'  },
    };

    const info = statutMap[nouveauStatut];
    if (info && this.editingCampagne) {
      this.editingCampagne.statut = info.statut;
      this.editingCampagne.statutLabel = info.label;
    }
  }

  onCampagneExcelSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.campagneExcelFile = file;
      this.lireRegionsExcel(file);
    }
  }

  onCampagneExcelDrop(event: DragEvent): void {
    event.preventDefault();
    this.campagneExcelDragOver = false;
    const file = event.dataTransfer?.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      this.campagneExcelFile = file;
      this.lireRegionsExcel(file);
    } else {
      alert('Veuillez déposer un fichier Excel (.xlsx ou .xls)');
    }
  }

  // S7756: prefer Blob#arrayBuffer() over FileReader#readAsArrayBuffer
  lireRegionsExcel(file: File): void {
    this.regionsDetectees = [];

    import('xlsx').then(async (XLSXModule) => {
      try {
        const buffer = await file.arrayBuffer(); // S7756
        const data = new Uint8Array(buffer);
        const workbook = XLSXModule.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSXModule.utils.sheet_to_json(sheet, { header: 1 });

        const regionsSet = new Set<string>();
        rows.slice(1).forEach((row: any[]) => {
          if (row[0] && String(row[0]).trim()) {
            regionsSet.add(String(row[0]).trim());
          }
        });
        this.regionsDetectees = Array.from(regionsSet);
      } catch {
        this.regionsDetectees = [];
      }
    }).catch(() => {
      this.regionsDetectees = [];
    });
  }

  campagnesOpen = false;

  toggleCampagnes(): void {
    this.campagnesOpen = !this.campagnesOpen;
  }

  toggleCampagneDetail() {
  this.campagneDetailOpen = !this.campagneDetailOpen;
}
  // ── Lien de candidature ──────────────────────────────────────────

  getCandidatureUrl(campagne: Campagne): string {
    const base = globalThis.location.origin; // S7764
    return `${base}/espace-saisonnier/${campagne.code}`;
  }

  copierLien(campagne: Campagne): void {
    if (this.isCampagneExpiree(campagne)) {
      this.showToast('⛔ Cette campagne est expirée !');
      return;
    }

    const url = this.getCandidatureUrl(campagne);
    navigator.clipboard.writeText(url).then(() => {
      this.showToast('✅ Lien copié !');
    });
  }

  ouvrirLien(campagne: Campagne): void {
    if (this.isCampagneExpiree(campagne)) {
      this.showToast('⛔ Cette campagne est expirée !');
      return;
    }

    globalThis.open(this.getCandidatureUrl(campagne), '_blank'); // S7764
  }

  isCampagneExpiree(campagne: Campagne): boolean {
    const now = new Date();
    const dateFin = new Date(campagne.dateFin);
    return now > dateFin;
  }

  // ── Toast notification ──────────────────────────────────────────
  toastMessage = '';
  showToastFlag = false;

  showToast(msg: string): void {
    this.toastMessage = msg;
    this.showToastFlag = true;
    setTimeout(() => this.showToastFlag = false, 3000);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/home-ge']);
  }

  sidebarOpen = false;

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent) {
    if (this.sidebarOpen) this.closeSidebar();
    if (this.showCreateModal) this.closeModal();
    if (this.showParentModal) this.closeParentModal();
    if (this.showAbsenceModal) this.closeAbsenceModal();
    if (this.showEditStructureModal) this.closeEditStructureModal();
    if (this.showActiveCampagneWarning) this.fermerWarning();
  }

  onModalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeModal();
    } else {
      event.stopPropagation();
    }
  }

  onWarningModalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.fermerWarning();
    } else {
      event.stopPropagation();
    }
  }

  onParentModalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeParentModal();
    } else {
      event.stopPropagation();
    }
  }

  onAbsenceModalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeAbsenceModal();
    } else {
      event.stopPropagation();
    }
  }

  onEditStructureModalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeEditStructureModal();
    } else {
      event.stopPropagation();
    }
  }
}

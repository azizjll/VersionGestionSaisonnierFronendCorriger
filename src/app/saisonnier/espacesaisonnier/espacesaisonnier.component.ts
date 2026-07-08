// ================================================================
//  MODIFICATIONS à apporter dans espacesaisonnier.component.ts
//  pour ajouter :
//    1. Popup "candidature" automatique si non connecté
//    2. Popup "connexion requise" sur chaque section de la sidebar
// ================================================================

import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService, Region } from 'src/app/services/auth.service';
import { Campagne, CampagneService } from 'src/app/services/campagne.service';
import { CandidatureService } from 'src/app/services/candidature.service';
import { DocumentCampagneDTO, DocumentCampagneService } from 'src/app/services/document-campagne.service';
import { StructureDTO, StructureService } from 'src/app/structure.service';
import Swal from 'sweetalert2';

// ── Interfaces (inchangées) ──────────────────────────────────
export interface Candidature {
  id: number;
  campagne: string;
  entreprise: string;
  localisation: string;
  datePostulation: string;
  dateDebut: string;
  dateFin: string;
  statut: 'ACCEPTEE' | 'EN_ATTENTE' | 'REFUSEE' | 'EN_COURS';
  poste: string;
  salaire?: string;
  logo?: string;
  message?: string;
  // ── champs éditables ──
  prenom?: string;
  nom?: string;
  email?: string;
  telephone?: string;
  cin?: string;
  rib?: string;
  niveauEtude?: string;
  diplomeNom?: string;
  specialite?: string;
  moisTravail?: string;
  nomPrenomParent?: string;
  matriculeParent?: string;
  regionId?: number;

  structureId?: number;
structureNom?: string;
}

export interface Document {
  id: number;
  nom: string;
  type: string;
  dateAjout: string;
  statut: 'VALIDE' | 'EN_ATTENTE' | 'EXPIRE';
  taille: string;
}

// ── Labels lisibles pour la modal "connexion requise" ────────
const SECTION_LABELS: Record<string, string> = {
  candidatures:  'Mes Candidatures',
  documents:     'Mes Documents',
  notifications: 'Mes Notifications',
  profil:        'Mon Profil',
};

@Component({
  selector: 'app-espacesaisonnier',
  templateUrl: './espacesaisonnier.component.html',
  styleUrls: ['./espacesaisonnier.component.scss'],
  animations: [
    trigger('fadeInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(24px)' }),
        animate('420ms cubic-bezier(0.22, 1, 0.36, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
    trigger('listStagger', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(16px)' }),
          stagger(80, animate('360ms cubic-bezier(0.22, 1, 0.36, 1)', style({ opacity: 1, transform: 'translateY(0)' }))),
        ], { optional: true }),
      ]),
    ]),
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-20px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateX(0)' })),
      ]),
    ]),
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        animate('260ms cubic-bezier(0.22, 1, 0.36, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
      transition(':leave', [
        animate('160ms ease-in', style({ opacity: 0 })),
      ]),
    ]),
  ],
})
export class EspacesaisonnierComponent implements OnInit {

activeTab: 'candidatures' | 'documents' | 'profil' | 'notifications' | '' = '';
  filterStatut = 'TOUS';
  searchQuery = '';
  showDetailModal = false;
  selectedCandidature: Candidature | null = null;
  notificationCount = 3;
  saisonnier: any = {};
  campagneIdSelectionnee!: number;
  activeCampagne: Campagne | null = null;
  campagneCode: string | null = null;
  showGuide = false;
  showCandidatureModal = false;  campagnes: Campagne[] = [];
  regions: Region[] = [];
  structures: any[] = [];
  formSubmitted = false;
  compareStructures = (a: any, b: any) => Number(a) === Number(b);

  documentsCampagne: DocumentCampagneDTO[] = [];
loadingDocsCampagne = false;

  form: any = {
  nom: '',
  prenom: '',
  cin: '',
  rib: '',
  telephone: '',
  email: '',
  nomPrenomParent: '',
  matriculeParent: '',
  specialiteDiplome: '',
  niveauEtude: null,    // ← null
  diplomeNom: null,     // ← null
  moisTravail: null,    // ← null
  regionId: null,       // ← null
  structureId: null,    // ← null
};


  cinFile!: File;
  diplome!: File;
  contrat!: File;
  cinFileName = '';
  diplomeFileName = '';
  contratFileName = '';
  ribFile!: File;
ribFileName = '';

documents: any[] = [];
isLoadingDocuments = false;



  isLoadingProfil = false;


  iltizamDoc: DocumentCampagneDTO | null = null;

  iltizamScrolled = false;
iltizamAcceptedForm = false;



  // ── ✅ NOUVEAU : modal "connexion requise" ────────────────
  showLoginRequired = false;
  lockedSectionLabel = '';

  // ── ✅ NOUVEAU : est-ce que l'utilisateur est connecté ? ──
  get isLoggedIn(): boolean {
  return !!this.authService.getToken() 
      && this.authService.getRole() === 'SAISONNIER';
}

// ── Nouvelles propriétés ──
isLoadingParent = false;
parentNonTrouve = false;

// ── Nouvelle méthode ──
onMatriculeParentChange(matricule: string): void {
  this.parentNonTrouve = false;
  this.form.nomPrenomParent = '';

  if (!matricule || matricule.trim() === '') return;

  this.isLoadingParent = true;

  this.candidatureService.getParentByMatricule(matricule.trim()).subscribe({
    next: (parent) => {
  console.log('Parent reçu:', parent);

  const data = parent.message;
  
  // Vérifier si le parent est dépassé (quota atteint)
  if (data.depasse) {
    this.form.nomPrenomParent = '';
    this.form.email = '';
    this.isLoadingParent = false;
    this.parentNonTrouve = true;
    return;
  }

  this.form.nomPrenomParent = data.nomPrenom; // ← était `${parent.prenom} ${parent.nom}`
  this.form.email = data.email;
  this.isLoadingParent = false;
  this.parentNonTrouve = false;
},
    error: () => {
      this.form.nomPrenomParent = '';
      this.form.email = '';
      this.isLoadingParent = false;
      this.parentNonTrouve = true;
    }
  });
}




  

  // ─────────────────────────────────────────────────────────
  // Données mock (inchangées)
  // ─────────────────────────────────────────────────────────
  candidatures: Candidature[] = [
  ];

 

  notifications = [
    { id: 1, message: 'Votre candidature "Récolte Fraises 2025" a été acceptée !', date: 'Il y a 2h', lu: false, type: 'success' },
    { id: 2, message: 'Document "Attestation hébergement" en cours de vérification', date: 'Il y a 1 jour', lu: false, type: 'info' },
    { id: 3, message: 'Rappel : Confirmation requise avant le 20/03/2025', date: 'Il y a 2 jours', lu: false, type: 'warning' },
    { id: 4, message: 'Nouvelle campagne disponible dans votre région', date: 'Il y a 3 jours', lu: true, type: 'info' },
  ];

  constructor(
    private candidatureService: CandidatureService,
    private campagneService: CampagneService,
    private authService: AuthService,
    private structureService: StructureService,
    private router: Router,                      // ← ✅ NOUVEAU : injecter Router
    private documentCampagneService: DocumentCampagneService,
    private route: ActivatedRoute
  ) {}

ngOnInit(): void {
  this.campagneCode = this.route.snapshot.paramMap.get('code');

  if (this.isLoggedIn) {
    // Utilisateur authentifié : pas besoin de code dans l'URL,
    // on utilise les endpoints protégés (déjà sécurisés par JWT)
    this.activeTab = 'candidatures';
    this.loadSaisonnierProfile();
    this.loadMesCandidatures();
    this.loadMesDocuments();
    this.loadMonProfil();
    this.loadRegions();

    this.campagneService.getCampagnesActives().subscribe(data => {
      if (data && data.length > 0) {
        this.activeCampagne = data[0];
        this.campagneIdSelectionnee = data[0].id;
        this.loadDocumentsCampagne(data[0].id);
      }
    });
    return;
  }

  // Utilisateur anonyme : le code est obligatoire, pas de fallback possible
  if (!this.campagneCode) {
    console.error('Code de campagne manquant dans l\'URL');
    this.showGuide = true; // ou redirection vers "lien invalide"
    return;
  }

  this.showGuide = true;

  // Récupère les infos publiques de la campagne (sans code/budget)
  this.campagneService.getCampagneParCode(this.campagneCode).subscribe({
    next: (campagne) => {
      this.activeCampagne = campagne as any;
    },
    error: (err) => {
      console.error('Erreur campagne:', err);
      if (err.status === 404) {
        this.router.navigate(['/campagne-expiree']);
      }
    },
  });

  this.loadStructuresParCodeCampagne(this.campagneCode);
  this.loadRegions();
}

loadStructuresParCodeCampagne(code: string): void {
  this.structureService.getStructuresParCodeCampagne(code).subscribe({
    next: (data) => { this.structures = data; },
    error: (err) => {
      console.error('Erreur structures:', err);
      if (err.status === 404) {
        // lien invalide ou campagne clôturée
        this.showGuide = true;
      }
    },
  });
}


// ── Nouvelle méthode ────────────────────────────────────────
loadMesDocuments(): void {
  this.isLoadingDocuments = true;
  this.candidatureService.getDocumentsByToken().subscribe({
    next: (data) => {
      this.documents = data.map(doc => ({
        id:       doc.id,
        nom:      doc.nomFichier,
        type:     doc.type,         // CIN, DIPLOME, CONTRAT, RIB
        url:      doc.url,
        dateAjout: doc.dateDepot ?? '—',
        statut:   'VALIDE',
        taille:   '—'
      }));
      this.isLoadingDocuments = false;
    },
    error: (err) => {
      console.error('Erreur chargement documents:', err);
      this.isLoadingDocuments = false;
    }
  });
}



loadDocumentsCampagne(campagneId: number): void {
  this.loadingDocsCampagne = true;
  this.documentCampagneService.getDocumentsByCampagne(campagneId).subscribe({
    next: (data) => {
      this.documentsCampagne = data;
      this.loadingDocsCampagne = false;

      // ✅ Extraire le doc إلتزام pour la sidebar
      this.iltizamDoc = data.find(d => 
        d.type === 'إلتزام' || d.nom.includes('إلتزام')
      ) ?? null;
    },
    error: (err) => {
      console.error('Erreur docs campagne:', err);
      this.loadingDocsCampagne = false;
    }
  });
}

// Méthode à ajouter
telechargerIltizam(): void {
  if (this.iltizamDoc) {
    window.open(this.iltizamDoc.url, '_blank');
  }
}

telechargerDocument(doc: DocumentCampagneDTO): void {
  window.open(doc.url, '_blank');
}

getDocTypIcon(type: string): string {
  const icons: Record<string, string> = {
    'CONTRAT':     'M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
    'NOTICE':      'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6',
    'FORMULAIRE':  'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 5a2 2 0 002 2h2a2 2 0 002-2',
  };
  return icons[type] ?? 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6';
}








  // ─────────────────────────────────────────────────────────
  // ✅ NOUVEAU : Charger le profil depuis le token JWT
  // ─────────────────────────────────────────────────────────
 loadSaisonnierProfile(): void {
  // Garde juste les initiales depuis le token en attendant l'API
  const nomComplet = this.authService.getNomComplet().split(' ');
  this.saisonnier = {
    prenom: nomComplet[0] || '',
    nom: nomComplet.slice(1).join(' ') || '',
  };
}
// ── Nouvelle méthode ─────────────────────────────────────────
loadMonProfil(): void {
  this.isLoadingProfil = true;
  this.candidatureService.getMonProfil().subscribe({
    next: (data) => {
      this.saisonnier = {
        ...data,
        // helpers d'affichage
        nomComplet:  `${data.prenom} ${data.nom}`,
        regionNom:   data.region?.nom ?? '—',
      };
      this.isLoadingProfil = false;
    },
    error: (err) => {
      console.error('Erreur chargement profil:', err);
      this.isLoadingProfil = false;
    }
  });
}

  // ─────────────────────────────────────────────────────────
  // ✅ NOUVEAU : setTab avec guard d'authentification
  // ─────────────────────────────────────────────────────────
  setTab(tab: 'candidatures' | 'documents' | 'profil' | 'notifications'): void {
    if (!this.isLoggedIn) {
      this.lockedSectionLabel = SECTION_LABELS[tab] || tab;
      this.showLoginRequired = true;
      return;
    }
    this.activeTab = tab;
  }

  // ─────────────────────────────────────────────────────────
  // ✅ NOUVEAU : actions modal "connexion requise"
  // ─────────────────────────────────────────────────────────
  closeLoginRequired(): void {
    this.showLoginRequired = false;
  }

  goToLogin(): void {
    this.closeLoginRequired();
    this.router.navigate(['/saisonnier/login']);
  }

  // ─────────────────────────────────────────────────────────
  // Structures / Régions (inchangé)
  // ─────────────────────────────────────────────────────────
loadStructuresCampagneActive(): void {
  if (!this.campagneCode) return;

  this.structureService.getStructuresParCodeCampagne(this.campagneCode).subscribe({
    next: (data) => { this.structures = data; },
    error: (err) => console.error('Erreur structures:', err),
  });
}

loadStructuresByRegion(regionId: number): void {
  if (!this.campagneCode) return;

  this.structureService.getStructuresParCodeCampagne(this.campagneCode).subscribe({
    next: (data) => {
      const regionNom = this.regions.find(r => r.id == regionId)?.nom;
      this.structures = data.filter(s => s.region === regionNom);
    },
    error: (err) => console.error('Erreur:', err),
  });
}

  loadCampagnes(): void {
    this.campagneService.getToutesCampagnes().subscribe({
      next: (data) => this.campagnes = data,
      error: (err) => console.error('Erreur campagnes', err),
    });
  }

  loadRegions(): void {
    this.authService.getRegions().subscribe({
      next: (data) => { this.regions = data; },
      error: (err) => console.error('Erreur régions', err),
    });
  }

  // ─────────────────────────────────────────────────────────
  // Candidature
  // ─────────────────────────────────────────────────────────
  deposerCandidature(campagneId: number): void {
  this.campagneIdSelectionnee = campagneId;
  this.iltizamScrolled = false;       // reset à chaque ouverture
  this.iltizamAcceptedForm = false;   // reset
  this.showCandidatureModal = true;
 
  
}



onIltizamScroll(event: Event): void {
  const el = event.target as HTMLElement;
  // Considéré comme "lu" quand on approche du bas (dans les 40px)
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
    this.iltizamScrolled = true;
  }
}

ouvrirFormulairePublic(): void {
  if (this.activeCampagne) {
    this.deposerCandidature(this.activeCampagne.id);
  }
}


  closeGuide(): void {
  this.showGuide = false;
}

openCandidatureFromGuide(): void {
  this.showGuide = false;

  // Vérifier si l'إلتزام a déjà été accepté
  const accepted = sessionStorage.getItem('iltizamAccepted');
  
  if (!accepted) {
    // Rediriger vers la page إلتزام d'abord
    this.router.navigate(['/saisonnier/iltizam']);
    return;
  }

  // Sinon ouvrir directement le formulaire
  if (this.activeCampagne) {
    this.deposerCandidature(this.activeCampagne.id);
    this.showCandidatureModal = true;
  }
}
  // ─────────────────────────────────────────────────────────
  // Getters (inchangés)
  // ─────────────────────────────────────────────────────────
  get filteredCandidatures(): Candidature[] {
    return this.candidatures.filter(c => {
      const matchStatut = this.filterStatut === 'TOUS' || c.statut === this.filterStatut;
      const matchSearch = !this.searchQuery ||
        c.campagne.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        c.entreprise.toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchStatut && matchSearch;
    });
  }

  get statsData() {
    return {
      total:     this.candidatures.length,
      acceptees: this.candidatures.filter(c => c.statut === 'ACCEPTEE').length,
      enAttente: this.candidatures.filter(c => c.statut === 'EN_ATTENTE').length,
      enCours:   this.candidatures.filter(c => c.statut === 'EN_COURS').length,
      refusees:  this.candidatures.filter(c => c.statut === 'REFUSEE').length,
    };
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

  get toutesCompletes(): boolean {
    return this.structures.length > 0 && this.structures.every(s => !s.disponible);
  }

  get iltizamAccepted(): boolean {
  return sessionStorage.getItem('iltizamAccepted') === 'true';
}

  // ─────────────────────────────────────────────────────────
  // Helpers (inchangés)
  // ─────────────────────────────────────────────────────────
  setFilter(statut: string): void { this.filterStatut = statut; }

 openDetail(candidature: Candidature): void {

  console.log('👉 candidature:', candidature);

  // ✅ 1. Pré-remplir DIRECTEMENT (comme profil)
  this.selectedCandidature = {
    ...candidature,
    structureId: candidature.structureId
      ? Number(candidature.structureId)
      : undefined
  };

  this.showDetailModal = true;
  this.setTab('profil');

  // ✅ 2. Charger structures après
  if (candidature.regionId && this.campagneCode) {
  this.structureService.getStructuresParCodeCampagne(this.campagneCode).subscribe({
    next: (data) => {
      const regionNom = this.regions.find(r => r.id == candidature.regionId)?.nom;

      this.structures = data
        .filter(s => s.region === regionNom)
        .map(s => ({
          ...s,
          id: Number(s.id) // 🔥 IMPORTANT
        }));

      console.log('✅ structures chargées:', this.structures);
      console.log('🎯 structureId actuel:', this.selectedCandidature?.structureId);
    },
    error: (err) => console.error('Erreur structures:', err), // manquait dans l'original
    });
  }

}
  closeDetail(): void {
    this.showDetailModal = false;
    this.selectedCandidature = null;
  }

  getStatutLabel(statut: string): string {
    const labels: Record<string, string> = {
      ACCEPTEE: 'Acceptée',
      EN_ATTENTE: 'En attente',
      REFUSEE: 'Refusée',
      EN_COURS: 'En cours',
    };
    return labels[statut] || statut;
  }

  getStatutClass(statut: string): string {
    const classes: Record<string, string> = {
      ACCEPTEE: 'statut-acceptee',
      EN_ATTENTE: 'statut-attente',
      REFUSEE: 'statut-refusee',
      EN_COURS: 'statut-encours',
    };
    return classes[statut] || '';
  }

  getDocStatutClass(statut: string): string {
    const classes: Record<string, string> = {
      VALIDE: 'doc-valide',
      EN_ATTENTE: 'doc-attente',
      EXPIRE: 'doc-expire',
    };
    return classes[statut] || '';
  }

  markAllRead(): void {
    this.notifications.forEach(n => (n.lu = true));
    this.notificationCount = 0;
  }

  getInitials(): string {
  const p = this.saisonnier?.prenom ?? '';
  const n = this.saisonnier?.nom ?? '';
  if (!p && !n) return '?';
  return `${p[0] ?? ''}${n[0] ?? ''}`.toUpperCase();
}

  closeModal(): void {
  this.showCandidatureModal = false;
  }

 onFileChange(event: any, type: string): void {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  // Types autorisés : PDF et images
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'image/webp',
    'image/gif'
  ];

  if (!allowedTypes.includes(file.type)) {
    Swal.fire({
      icon: 'error',
      title: 'Format non autorisé',
      text: 'Veuillez sélectionner uniquement un fichier PDF ou une image.'
    });

    // Réinitialiser le champ
    event.target.value = '';
    return;
  }

  if (type === 'cin') {
    this.cinFile = file;
    this.cinFileName = file.name;
  }

  if (type === 'diplome') {
    this.diplome = file;
    this.diplomeFileName = file.name;
  }

  if (type === 'contrat') {
    this.contrat = file;
    this.contratFileName = file.name;
  }

  if (type === 'rib') {
    this.ribFile = file;
    this.ribFileName = file.name;
  }
}

  submitCandidature(candidatureForm: NgForm): void {

  this.formSubmitted = true;
  candidatureForm.form.markAllAsTouched();

   if (!this.iltizamScrolled || !this.iltizamAcceptedForm) {
    Swal.fire({
      icon: 'warning',
      title: 'Engagement requis',
      text: 'Veuillez lire l\'engagement en entier et cocher la case d\'acceptation.'
    });
    return;
  }

  if (candidatureForm.invalid) {
    Swal.fire({
      icon: 'warning',
      title: 'Formulaire incomplet',
      text: 'Veuillez corriger les erreurs.'
    });
    return;
  }

  if (!this.cinFile || !this.diplome || !this.ribFile) {
    Swal.fire({
      icon: 'warning',
      title: 'Documents manquants',
      text: 'Joignez tous les fichiers PDF (CIN, Diplôme,  RIB).'
    });
    return;
  }

  const formData = new FormData();
  Object.entries(this.form).forEach(([k, v]) => {
  if (v !== null && v !== undefined) {
    formData.append(k, String(v)); // String() préserve le 0 de tête
  }
});
  formData.append('campagneId', this.campagneIdSelectionnee.toString());
  formData.append('cinFile', this.cinFile);
  formData.append('diplome', this.diplome);
  formData.append('ribFile', this.ribFile);


  Swal.fire({
    title: 'Envoi en cours...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  this.candidatureService.deposerCandidature(formData).subscribe({

    next: (res) => {
      Swal.fire({
        icon: 'success',
        title: '✅ Candidature envoyée !',
        html: res.message,
        confirmButtonText: 'Compris !',
        confirmButtonColor: '#3b82f6',
      });
      this.closeModal();
    },

    error: (err) => {
      console.error(err);

      let message = "Erreur lors de l'envoi.";

      // 🔥 CAS 1 : message backend
      if (err.error && err.error.message) {
        message = err.error.message;
      }

      // 🔥 CAS 2 : 403
      else if (err.status === 403) {
        message = "Accès refusé (403)";
      }

      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: message
      });
    }
  });
}



saveCandidatureDetail(): void {
  if (!this.selectedCandidature) return;

  const formData = new FormData();
  formData.append('prenom',           this.selectedCandidature['prenom']          ?? '');
  formData.append('nom',              this.selectedCandidature['nom']              ?? '');
  formData.append('cin',              this.selectedCandidature['cin']              ?? '');
  formData.append('rib',              this.selectedCandidature['rib']              ?? '');
  formData.append('telephone',        this.selectedCandidature['telephone']        ?? '');
  formData.append('email',            this.selectedCandidature['email']            ?? '');
  formData.append('niveauEtude',      this.selectedCandidature['niveauEtude']      ?? '');
  formData.append('diplomeNom',       this.selectedCandidature['diplomeNom']       ?? '');
  formData.append('specialite',       this.selectedCandidature['specialite']       ?? '');
  formData.append('moisTravail',      this.selectedCandidature['moisTravail']      ?? '');
  formData.append('nomPrenomParent',  this.selectedCandidature['nomPrenomParent']  ?? '');
  formData.append('matriculeParent',  this.selectedCandidature['matriculeParent']  ?? '');
  formData.append('statut', this.selectedCandidature.statut ?? '');
  formData.append('structureId', this.selectedCandidature['structureId']?.toString() ?? '');


    const regionId = this.selectedCandidature['regionId'] ?? '';
  formData.append('regionId', regionId.toString());

  Swal.fire({
    title: 'Mise à jour...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  this.candidatureService.updateCandidature(this.selectedCandidature.id, formData).subscribe({
    next: () => {
      Swal.fire({ icon: 'success', title: 'Modifications enregistrées', timer: 1500, showConfirmButton: false });
      this.loadMesCandidatures();
      this.closeDetail();
    },
    error: (err) => {
      Swal.fire({ icon: 'error', title: 'Erreur', text: err.error?.message ?? 'Erreur lors de la modification' });
    }
  });
}


get canEditCandidature(): boolean {
  return this.selectedCandidature?.statut !== 'ACCEPTEE';
}

onStructureDetailChange(structureId: number): void {
  const structure = this.structures.find(s => s.id === structureId);
  if (structure && this.selectedCandidature) {
    this.selectedCandidature['structureNom'] = structure.nom;
  }
}

  loadMesCandidatures(): void {
  this.candidatureService.getMonHistorique().subscribe({
    next: (data) => {
      this.candidatures = data.map(c => ({
        id:              c.id,
        campagne:        c.campagne?.libelle ?? 'Campagne inconnue',
        entreprise:      c.campagne?.libelle ?? '—',
        localisation:    c.saisonnier?.region?.nom ?? '—',
        datePostulation: c.dateDepot,
        dateDebut:       c.campagne?.dateDebut ?? '—',
        dateFin:         c.campagne?.dateFin ?? '—',
        statut:          c.statut,
        poste:           c.saisonnier?.diplome ?? '—',
        message:         c.commentaire ?? undefined,
        // ── champs éditables ──
        prenom:          c.saisonnier?.prenom             ?? '',
        nom:             c.saisonnier?.nom                ?? '',
        email:           c.saisonnier?.email              ?? '',
        telephone:       c.saisonnier?.telephone          ?? '',
        cin:             c.saisonnier?.cin                ?? '',
        rib:             c.saisonnier?.rib                ?? '',
        niveauEtude:     c.saisonnier?.niveauEtude        ?? '',
        diplomeNom:      c.saisonnier?.diplomeNom         ?? '',
        specialite:      c.saisonnier?.specialiteDiplome  ?? '',
        moisTravail:     c.saisonnier?.moisTravail        ?? '',
        nomPrenomParent: c.saisonnier?.nomPrenomParent    ?? '',
        matriculeParent: c.saisonnier?.matriculeParent    ?? '',
          regionId: c.saisonnier?.region?.id ?? '',
          structureId: c.saisonnier?.structure?.id
  ? Number(c.saisonnier.structure.id)
  : undefined,

structureNom: c.saisonnier?.structure?.nom ?? '—',

      }));
    },
    error: (err) => console.error('Erreur historique:', err)
  });
}

// ── Helper pour icône selon type de document ────────────────
getDocIcon(type: string): string {
  const icons: Record<string, string> = {
    'CIN':     'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1',
    'DIPLOME': 'M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z',
    'CONTRAT': 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    'RIB':     'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  };
  return icons[type] ?? 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6';
}

// ── Téléchargement direct ────────────────────────────────────
telechargerDoc(url: string, nom: string): void {
  fetch(url)
    .then(res => res.blob())
    .then(blob => {
      const extension = nom.includes('.') ? '' : this.getExtensionFromBlob(blob);
      const nomFinal = nom.endsWith(extension) ? nom : nom + extension;
      const blobUrl = URL.createObjectURL(blob);

      if (blob.type === 'application/pdf') {
        // PDF → ouvrir dans nouvel onglet
        window.open(blobUrl, '_blank');
      } else {
        // Autres types → télécharger
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = nomFinal;
        a.click();
        URL.revokeObjectURL(blobUrl);
      }
    });
}

private getExtensionFromBlob(blob: Blob): string {
  const mimeMap: Record<string, string> = {
    'application/pdf':                                                          '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/msword':                                                       '.doc',
    'image/jpeg':                                                               '.jpg',
    'image/png':                                                                '.png',
  };
  return mimeMap[blob.type] ?? '';
}
}

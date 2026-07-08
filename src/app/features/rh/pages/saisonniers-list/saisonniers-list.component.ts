import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AffectationService } from 'src/app/services/affectation.service';
import { AuthService, Region } from 'src/app/services/auth.service';
import { CandidatureService } from 'src/app/services/candidature.service';
import { PdfExportService } from 'src/app/services/pdf-export.service';
import { StructureDTO, StructureService } from 'src/app/structure.service';
import Swal from 'sweetalert2';

export interface Structure {
  id: number;
  nom: string;
  type: 'ESPACE_COMMERCIAL' | 'CENTRE_TECHNIQUE';
   regionId: number;
  adresse?: string;
  affectations?: any[];
}

@Component({
  selector: 'app-saisonniers-list',
  templateUrl: './saisonniers-list.component.html',
  styleUrls: ['./saisonniers-list.component.scss']
})
export class SaisonniersListComponent implements OnInit {

  showModal = false;
  activeTab: 'collaborateur' | 'dossier' = 'collaborateur';

  campagneId!: number;

  candidatures: any[] = []; // stocke les candidatures filtrées
  selectedCandidature: any = null; // pour popup dossier
  showDossierModal = false;
  formSubmitted = false;


  cinFileName: string = '';
diplomeFileName: string = '';
contratFileName: string = '';
ribFile!: File;
ribFileName = '';

parentInfo: any = null;
quotaDepasse = false;
messageAdmin = '';
loadingParent = false;

// ── nouvelles propriétés ──
structureMap: Record<number, string> = {};
structuresDisponibles: string[] = [];
activeStructureFilter: string = 'ALL';

activeMoisFilter: string = 'ALL';







  form: any = {
    nom: '',
    prenom: '',
    cin: '',
    rib: '',
    telephone: '',
    email: '',
    niveauEtude: '',
    diplomeNom: '',
    moisTravail: '',
    regionId: ''
  };

  cinFile!: File;
  diplome!: File;
  contrat!: File;
  

  regions: Region[] = []; // toutes les régions
  myRegion!: Region;      // région du RH connecté

  selectedCandidatureStructure: any = null;  // structure actuelle du candidat
isLoadingStructure = false;

  structuresCommerciaux: StructureDTO[] = [];
structuresTech: StructureDTO[] = [];
structures: StructureDTO[] = [];

  selectedCandidatureForAffect: any = null;
  showAffectModal = false;
  selectedStructureId: number | null = null;

  get structuresEC(): StructureDTO[] {
  return this.structures.filter(s => s.type === 'ESPACE_COMMERCIAL');
}

get structuresCT(): StructureDTO[] {
  return this.structures.filter(s => s.type === 'CENTRE_TECHNIQUE');
}

// ← getter pour éviter arrow function dans le template
get toutesCompletes(): boolean {
  return this.structures.length > 0 && this.structures.every(s => !s.disponible);
}

  constructor(
    private readonly route: ActivatedRoute,
    private readonly candidatureService: CandidatureService,
    private readonly authService: AuthService,
    private readonly structureService: StructureService,
    private readonly affectationService: AffectationService,
    private readonly pdfExport: PdfExportService
  ) {}

  ngOnInit(): void {
    this.campagneId = Number(this.route.snapshot.queryParamMap.get('campagneId'));
    console.log('campagneId reçu :', this.campagneId);

    // Récupérer la région du RH connecté
    this.authService.getMyRegion().subscribe({
      next: region => {
        this.myRegion = region;

        // Récupérer toutes les régions
        this.authService.getRegions().subscribe({
          next: allRegions => {
            // Mettre la région du RH en tête
            this.regions = [
              this.myRegion,
              ...allRegions.filter(r => r.id !== this.myRegion.id)
            ];

            // Pré-remplir le formulaire avec la région du RH
            this.form.regionId = this.myRegion.id;

            // Charger les candidatures filtrées par région du RH
            this.loadCandidatures(this.myRegion.id);
          },
          error: err => console.error("Erreur récupération régions", err)
        });
      },
      error: err => console.error("Erreur récupération région RH", err)
    });
  }

  // Charger candidatures par campagne et région
  loadCandidatures(regionId: number) {
  console.log('[loadCandidatures] called with regionId:', regionId, '| campagneId:', this.campagneId);

    console.log('[loadCandidatures] URL appelée: /api/candidatures?campagne=' + this.campagneId + '&region=' + regionId);


  this.candidatureService.getCandidaturesByCampagneAndRegion(this.campagneId, regionId)
    .subscribe({
      next: (res: any) => {
        console.log('[loadCandidatures] candidatures received:', res?.length, res);
        this.candidatures = res;

        const requests = res.map((c: any) =>
          this.candidatureService.getStructureByCandidature(c.id).toPromise()
            .then((st: any) => {
              console.log(`[loadCandidatures] structure for candidature ${c.id}:`, st);
              this.structureMap[c.id] = st?.nom ?? '—';
            })
            .catch((err) => {
              console.warn(`[loadCandidatures] failed to load structure for candidature ${c.id}:`, err);
              this.structureMap[c.id] = '—';
            })
        );

        Promise.all(requests).then(() => {
          console.log('[loadCandidatures] structureMap built:', this.structureMap);

          const noms = res
            .map((c: any) => this.structureMap[c.id])
            .filter((n: string) => !!n && n !== '—');
          this.structuresDisponibles = [...new Set<string>(noms)];

          console.log('[loadCandidatures] structuresDisponibles:', this.structuresDisponibles);
        });
      },
      error: err => console.error('[loadCandidatures] error fetching candidatures:', err)
    });
}


// ── getter filteredCandidatures mis à jour ──
get filteredCandidatures() {
  return this.candidatures.filter(c => {

    const matchStatut =
      this.activeFilter === 'ALL' ||
      c.statut === this.activeFilter;

    const matchStructure =
      this.activeStructureFilter === 'ALL' ||
      this.structureMap[c.id] === this.activeStructureFilter;

    // 🆕 filtre mois avec logique d'inclusion
    const moisTravail = c.saisonnier.moisTravail;
    let matchMois = true;

    if (this.activeMoisFilter === 'JUILLET') {
      matchMois = moisTravail === 'JUILLET' || moisTravail === 'JUILLET_AOUT';
    } else if (this.activeMoisFilter === 'AOUT') {
      matchMois = moisTravail === 'AOUT' || moisTravail === 'JUILLET_AOUT';
    } else if (this.activeMoisFilter === 'JUILLET_AOUT') {
      matchMois = moisTravail === 'JUILLET_AOUT';
    }
    // si activeMoisFilter === 'ALL', matchMois reste true

    const q = this.searchQuery.toLowerCase().trim();

    const matchSearch =
      !q ||
      c.saisonnier.nom.toLowerCase().includes(q) ||
      c.saisonnier.prenom.toLowerCase().includes(q) ||
      (c.saisonnier.email || '').toLowerCase().includes(q);

    return matchStatut && matchStructure && matchMois && matchSearch;
  });
}



setStructureFilter(nom: string): void {
  this.activeStructureFilter = nom;
}

  loadStructuresByRegion(regionId: number) {
  if (!regionId) return;

  this.structureService.getStructuresCampagneActive().subscribe({
    next: (data: StructureDTO[]) => {
      // Filtrer par région après réception
      this.structures = data.filter(s => s.region === this.myRegion.nom);
    },
    error: err => console.error("Erreur chargement structures", err)
  });
}

  openDossier(cand: any): void {
  this.selectedCandidature = { ...cand, saisonnier: { ...cand.saisonnier } };
  this.selectedCandidatureStructure = null;
  this.selectedStructureId = null;
  this.showDossierModal = true;
  this.isLoadingStructure = true;

  // ── Étape 1 : charger les structures de la région du candidat
  const regionId = cand.saisonnier?.region?.id || this.myRegion?.id;
  this.structureService.getStructuresByRegion(regionId).subscribe({
    next: (data: StructureDTO[]) => {
      this.structures = data;

      // ── Étape 2 : récupérer la structure actuelle du candidat
      this.candidatureService.getStructureByCandidature(cand.id).subscribe({
        next: (st: any) => {
          if (st?.id) {
            this.selectedCandidatureStructure = st;
            this.selectedStructureId = st.id;  // ← pré-sélectionner dans le select
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

 closeDossier(): void {
  this.showDossierModal = false;
  this.selectedCandidature = null;
  this.selectedCandidatureStructure = null;
  this.selectedStructureId = null;
}

// ── Handler changement de structure dans le select ───────────
onStructureChange(): void {
  const found = this.structures.find(s => s.id === this.selectedStructureId);
  this.selectedCandidatureStructure = found ?? null;
}
openModal(): void {
  this.showModal = true;
  this.activeTab = 'collaborateur';
  this.formSubmitted = false;
  // Pré-remplir la région du RH et charger ses structures
  this.form.regionId = this.myRegion?.id || '';
  if (this.form.regionId) {
    this.loadStructuresByRegion(this.form.regionId);
  }
}

// ── Remplacer closeModal() ──
closeModal(): void {
  this.showModal = false;
  this.formSubmitted = false;
}

  setTab(tab: 'collaborateur' | 'dossier') {
    this.activeTab = tab;
  }

onFileChange(event: any, type: string) {
  const file = event.target.files[0];
  if (!file) return;

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

submit(saisonnierForm: NgForm): void {

  this.formSubmitted = true;
  saisonnierForm.form.markAllAsTouched();

  if (saisonnierForm.invalid) {
    Swal.fire({
      icon: 'warning',
      title: 'Formulaire incomplet',
      text: 'Veuillez corriger les erreurs signalées avant d\'envoyer.'
    });
    return;
  }

  if (!this.cinFile || !this.diplome || !this.ribFile) {

    Swal.fire({
      icon: 'warning',
      title: 'Documents manquants',
      text: 'Veuillez joindre tous les fichiers PDF obligatoires (CIN, Diplôme, Contrat).'
    });
    return;
  }

  const formData = new FormData();
  formData.append('nom', this.form.nom);
  formData.append('prenom', this.form.prenom);
  formData.append('cin', this.form.cin.toString());
  formData.append('rib', this.form.rib);
  formData.append('telephone', this.form.telephone);
  formData.append('email', this.form.email);
  formData.append('nomPrenomParent', this.form.nomPrenomParent);
  formData.append('matriculeParent', this.form.matriculeParent);
  formData.append('niveauEtude', this.form.niveauEtude);
  formData.append('diplomeNom', this.form.diplomeNom);
  formData.append('specialiteDiplome', this.form.specialiteDiplome);
  formData.append('regionId', this.form.regionId.toString());
  formData.append('structureId', this.form.structureId.toString());
  formData.append('campagneId', this.campagneId.toString());
  formData.append('cinFile', this.cinFile);
  formData.append('diplome', this.diplome);
  formData.append('ribFile', this.ribFile);
  formData.append('moisTravail', this.form.moisTravail);
  formData.append('demandeAdminAutorisee', this.quotaDepasse ? 'true' : 'false');
formData.append('messageDemandeAdmin', this.form.commentaire ?? '');  // 🆕 même valeur


  Swal.fire({
    title: 'Envoi en cours...',
    text: 'Veuillez patienter',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  this.candidatureService.deposerCandidature(formData).subscribe({
    next: () => {
      Swal.fire({
        icon: 'success',
        title: 'Succès',
        text: 'Candidature envoyée avec succès',
        timer: 2000,
        showConfirmButton: false
      });
      this.closeModal();
      this.loadCandidatures(this.myRegion.id);
    },
    error: err => {
  const msg = err?.error?.message;
  if (msg === 'QUOTA_DEPASSE') {
    this.quotaDepasse = true;
    Swal.fire({
      icon: 'warning',
      title: 'Quota dépassé',
      text: 'Ce matricule a atteint le nombre maximum d\'utilisations. Une demande d\'autorisation sera envoyée à l\'administrateur.'
    });
  } else {
    Swal.fire({ icon: 'error', title: 'Erreur', text: msg || 'Erreur serveur' });
  }
}
  });
}


onMatriculeChange(matricule: string): void {
  this.parentInfo = null;
  this.quotaDepasse = false;
  this.form.nomPrenomParent = '';

  if (!matricule || matricule.trim().length === 0) return;

  this.loadingParent = true;

  this.candidatureService.getParentByMatricule(matricule.trim()).subscribe({
    next: (response) => {
      const data = response.message;
      this.parentInfo = data;
      this.form.nomPrenomParent = data.nomPrenom; // 🔥 auto-fill
      this.quotaDepasse = data.depasse;
      this.loadingParent = false;
    },
    error: () => {
      this.parentInfo = null;
      this.form.nomPrenomParent = '';
      this.quotaDepasse = false;
      this.loadingParent = false;
    }
  });
}

// méthode
exportPDF(): void {
  const decoded = (this.authService as any)['decodeToken']?.() ?? {};

  // 🆕 construire le map structure par candidature
  const structureMap: Record<number, string> = {};
  const requests = this.filteredCandidatures.map(c =>
    this.candidatureService.getStructureByCandidature(c.id).toPromise()
      .then((st: any) => {
        structureMap[c.id] = st?.nom ?? '—';
      })
      .catch(() => {
        structureMap[c.id] = '—';
      })
  );

  // attendre toutes les réponses puis générer le PDF
  Promise.all(requests).then(() => {
    this.pdfExport.exportCandidatures(
      this.filteredCandidatures,
      decoded?.nom    ?? '',
      decoded?.prenom ?? '',
      this.myRegion?.nom ?? '',
      structureMap   // 🆕
    );
  });
}
  updateCandidature(): void {
  const formData = new FormData();
  formData.append('nom',        this.selectedCandidature.saisonnier.nom);
  formData.append('prenom',     this.selectedCandidature.saisonnier.prenom);
  formData.append('cin',        this.selectedCandidature.saisonnier.cin);
  formData.append('rib',        this.selectedCandidature.saisonnier.rib);
  formData.append('telephone',  this.selectedCandidature.saisonnier.telephone);
  formData.append('email',      this.selectedCandidature.saisonnier.email);
  formData.append('regionId',   this.selectedCandidature.saisonnier.region.id);
  formData.append('statut',     this.selectedCandidature.statut);
  formData.append('commentaire', this.selectedCandidature.commentaire || '');
  formData.append('moisTravail', this.selectedCandidature.saisonnier.moisTravail || '');

   // 🆕 nouveaux champs
  formData.append('nomPrenomParent',   this.selectedCandidature.saisonnier.nomPrenomParent  || '');
  formData.append('matriculeParent',   this.selectedCandidature.saisonnier.matriculeParent  || '');
  formData.append('niveauEtude',       this.selectedCandidature.saisonnier.niveauEtude      || '');
  formData.append('diplome',           this.selectedCandidature.saisonnier.diplome          || '');
  formData.append('specialiteDiplome', this.selectedCandidature.saisonnier.specialiteDiplome || '');

if (this.selectedStructureId) {
  formData.append('structureId', this.selectedStructureId.toString());
}

  Swal.fire({
    title: 'Mise à jour...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  this.candidatureService.updateCandidature(this.selectedCandidature.id, formData)
    .subscribe({
      next: () => {

        // ── Si la structure a changé, faire la réaffectation ──
        if (this.selectedStructureId &&
            this.selectedStructureId !== this.selectedCandidatureStructure?.id) {

          this.affectationService.affecterSaisonnier(
            this.selectedCandidature.saisonnier.id,
            this.selectedStructureId,
            this.campagneId
          ).subscribe({
            next: () => {
              Swal.fire({
                icon: 'success',
                title: 'Modification réussie',
                text: 'Candidature et structure mises à jour',
                timer: 1800,
                showConfirmButton: false
              });
              this.closeDossier();
              this.loadCandidatures(this.myRegion.id);
            },
            error: () => {
              Swal.fire({
                icon: 'warning',
                title: 'Partiellement mis à jour',
                text: 'Candidature sauvegardée mais erreur sur la structure',
                timer: 2500,
                showConfirmButton: false
              });
              this.closeDossier();
              this.loadCandidatures(this.myRegion.id);
            }
          });

        } else {
          // Pas de changement de structure
          Swal.fire({
            icon: 'success',
            title: 'Modification réussie',
            timer: 1500,
            showConfirmButton: false
          });
          this.closeDossier();
          this.loadCandidatures(this.myRegion.id);
        }
      },
      error: (err: any) => {
        console.error(err);
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: 'Erreur lors de la modification'
        });
      }
    });
}


envoyerDemandeAutorisation(): void {
  // Commentaire obligatoire
  if (!this.selectedCandidature.commentaire?.trim()) {
    Swal.fire({
      icon: 'warning',
      title: 'Commentaire requis',
      text: 'Veuillez ajouter un commentaire justificatif avant d\'envoyer.'
    });
    return;
  }

  Swal.fire({
    title: 'Envoi en cours...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  const payload = {
    candidatureId:  this.selectedCandidature.id,
    commentaire:    this.selectedCandidature.commentaire,
    directionNom:   this.selectedCandidature.saisonnier.region.nom
  };

  this.candidatureService.envoyerDemandeJuilletAout(payload).subscribe({
    next: () => {
      Swal.fire({
        icon: 'success',
        title: 'Demande envoyée',
        text: 'Les administrateurs ont été notifiés par email.',
        timer: 2500,
        showConfirmButton: false
      });
      this.closeDossier();
      this.loadCandidatures(this.myRegion.id);
    },
    error: () => {
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: 'Impossible d\'envoyer la demande.'
      });
    }
  });
}

  // ==========================
  // Affectation
  // ==========================
  openAffectationModal(cand: any) {
    this.selectedCandidatureForAffect = cand;
    this.showAffectModal = true;
    this.selectedStructureId = null;

this.affectationService.getStructuresByRegion(this.myRegion.id).subscribe({
  next: (data: any[]) => {
    this.structuresCommerciaux = data.filter(s => s.type === 'ESPACE_COMMERCIAL');
    this.structuresTech = data.filter(s => s.type === 'CENTRE_TECHNIQUE');
    this.structures = [...this.structuresCommerciaux, ...this.structuresTech];
  },
  error: err => console.error(err)
});
  }

  affecter() {
    if (!this.selectedStructureId || !this.selectedCandidatureForAffect) return;

    this.affectationService.affecterSaisonnier(
      this.selectedCandidatureForAffect.saisonnier.id,
      this.selectedStructureId,
      this.campagneId
    ).subscribe({
      next: () => {
        alert("✅ Affectation réalisée");
        this.showAffectModal = false;
      },
      error: err => console.error(err)
    });
  }

  // Ajouter ces propriétés et méthodes dans SaisonniersListComponent

activeFilter: string = 'ALL';
searchQuery:  string = '';

// ── Getter filtré ─────────────────────────────────


// ── Filtrer par statut ────────────────────────────
setFilter(status: string): void {
  this.activeFilter = status;
}

// ── Compter par statut ────────────────────────────
countByStatus(status: string): number {
  return this.candidatures.filter(c => c.statut === status).length;
}

// ── Label lisible du statut ───────────────────────
statusLabel(statut: string): string {
  const map: Record<string, string> = {
    'EN_ATTENTE': 'En attente',
    'ACCEPTEE':   'Acceptée',
    'REFUSEE':    'Refusée',
    'A_CORRIGER': 'À corriger',
  };
  return map[statut] || statut;
}

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

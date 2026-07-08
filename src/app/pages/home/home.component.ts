import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, Region } from 'src/app/services/auth.service';
import { Campagne, CampagneService } from 'src/app/services/campagne.service';
import { CandidatureService } from 'src/app/services/candidature.service';
import { StructureDTO, StructureService } from 'src/app/structure.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  campagnes: Campagne[] = [];
  regions: Region[] = [];
  structures: StructureDTO[] = [];
  showCandidatureModal = false;
  campagneIdSelectionnee!: number;
  formSubmitted = false; // ← pour afficher les erreurs fichiers

  cinFileName: string = '';
  diplomeFileName: string = '';
  contratFileName: string = '';

  form: any = {
    nom: '',
    prenom: '',
    cin: '',
    rib: '',
    telephone: '',
    email: '',
    regionId: '',
    structureId: '',
    nomPrenomParent: '',
    matriculeParent: '',
    niveauEtude: '',
    diplomeNom: '',
    specialiteDiplome: ''
  };

  cinFile!: File;
  diplome!: File;
  contrat!: File;

  constructor(
    private campagneService: CampagneService,
    private candidatureService: CandidatureService,
    private authService: AuthService,
    private structureService: StructureService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCampagnes();
    this.loadRegions();
  }

  loadCampagnes(): void {
    this.campagneService.getToutesCampagnes().subscribe({
      next: (data) => this.campagnes = data,
      error: (err) => console.error('Erreur lors du chargement des campagnes', err)
    });
  }

  get structuresEC(): StructureDTO[] {
    return this.structures.filter(s => s.type === 'ESPACE_COMMERCIAL');
  }

  get structuresCT(): StructureDTO[] {
    return this.structures.filter(s => s.type === 'CENTRE_TECHNIQUE');
  }

  get toutesCompletes(): boolean {
    return this.structures.length > 0 && this.structures.every(s => !s.disponible);
  }

  loadStructuresByRegion(regionId: number): void {
    this.structures = [];
    this.form.structureId = '';
    if (!regionId) return;

    this.structureService.getStructuresByRegion(regionId).subscribe({
      next: (data: StructureDTO[]) => this.structures = data,
      error: (err) => console.error('Erreur chargement structures', err)
    });
  }

  loadRegions(): void {
    this.authService.getRegions().subscribe({
      next: (data) => this.regions = data,
      error: (err) => console.error('Erreur chargement régions', err)
    });
  }

  deposerCandidature(campagneId: number): void {
    this.campagneIdSelectionnee = campagneId;
    this.showCandidatureModal = true;
    this.formSubmitted = false; // reset à chaque ouverture
  }

  closeModal(): void {
    this.showCandidatureModal = false;
    this.formSubmitted = false;
  }

  onFileChange(event: any, type: string): void {
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
  }

  submitCandidature(candidatureForm: NgForm): void {

    this.formSubmitted = true;
    candidatureForm.form.markAllAsTouched();

    // Vérification formulaire
    if (candidatureForm.invalid) {
      Swal.fire({
        icon: 'warning',
        title: 'Formulaire incomplet',
        text: 'Veuillez corriger les erreurs signalées avant d\'envoyer.'
      });
      return;
    }

    // Vérification fichiers
    if (!this.cinFile || !this.diplome || !this.contrat) {
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
    formData.append('cin', this.form.cin);
    formData.append('rib', this.form.rib);
    formData.append('telephone', this.form.telephone);
    formData.append('email', this.form.email);
    formData.append('nomPrenomParent', this.form.nomPrenomParent);
    formData.append('matriculeParent', this.form.matriculeParent);
    formData.append('niveauEtude', this.form.niveauEtude);
    formData.append('diplomeNom', this.form.diplomeNom);
    formData.append('specialiteDiplome', this.form.specialiteDiplome);
    formData.append('regionId', this.form.regionId);
    formData.append('structureId', this.form.structureId);
    formData.append('campagneId', this.campagneIdSelectionnee.toString());
    formData.append('cinFile', this.cinFile);
    formData.append('diplome', this.diplome);
    formData.append('contrat', this.contrat);

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
          title: 'Candidature envoyée',
          text: 'Votre demande a été soumise avec succès',
          timer: 2000,
          showConfirmButton: false
        });
        this.closeModal();
      },
      error: err => {
        console.error(err);
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: "Erreur lors de l'envoi de la candidature"
        });
      }
    });
  }

  ouvrirPageSaisonniers(campagneId: number): void {
    this.router.navigate(['/entreprise/saisonniers'], { queryParams: { campagneId } });
  }

  isRH(): boolean {
    const token = localStorage.getItem('token');
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.roles?.includes('ROLE_RH_REGIONAL');
    } catch (e) {
      return false;
    }
  }
}
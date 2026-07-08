import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CampagneService } from 'src/app/services/campagne.service';
import { DocumentCampagneDTO, DocumentCampagneService } from 'src/app/services/document-campagne.service';

@Component({
  selector: 'app-iltizam',
  templateUrl: './iltizam.component.html',
  styleUrls: ['./iltizam.component.scss'],
})
export class IltizamComponent implements OnInit {

  hasRead = false;
  accepted = false;
  iltizamDoc: DocumentCampagneDTO | null = null;
  loading = true;

  constructor(
    private router: Router,
    private campagneService: CampagneService,
    private documentCampagneService: DocumentCampagneService,
  ) {}

  ngOnInit(): void {
    // Si déjà accepté dans cette session, rediriger directement
    if (sessionStorage.getItem('iltizamAccepted') === 'true') {
      this.router.navigate(['/saisonnier/espace']);

      return;
    }

    // Charger le document إلتزام depuis la campagne active
    this.campagneService.getCampagnesActives().subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.documentCampagneService.getDocumentsByCampagne(data[0].id).subscribe({
            next: (docs) => {
              this.iltizamDoc = docs.find(d =>
                d.type === 'إلتزام' ||
                d.nom?.includes('إلتزام') ||
                d.nom?.toLowerCase().includes('iltizam')
              ) ?? null;
              this.loading = false;
            },
            error: () => { this.loading = false; }
          });
        } else {
          this.loading = false;
        }
      },
      error: () => { this.loading = false; }
    });
  }

  // Appelé quand l'utilisateur clique "Consulter le document"
  ouvrirDocument(): void {
    if (this.iltizamDoc?.url) {
      window.open(this.iltizamDoc.url, '_blank');
    }
    // Marquer comme lu après ouverture
    this.hasRead = true;
  }

  // Confirmer l'acceptation et retourner vers l'espac
  confirmerEtRetourner(): void {
    if (!this.accepted) return;
    sessionStorage.setItem('iltizamAccepted', 'true');
    this.router.navigate(['/espace-saisonnier']);
  }

  retourEspace(): void {
    this.router.navigate(['/saisonnier/espace']);
  }
}
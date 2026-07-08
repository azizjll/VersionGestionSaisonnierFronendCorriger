// liste-saisonnier.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Candidature, CandidatureService } from 'src/app/services/candidature.service';
import { SaisonnierService } from 'src/app/services/saisonnier.service';

@Component({
  selector: 'app-liste-saisonnier',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './liste-saisonnier.component.html',
  styleUrls: ['./liste-saisonnier.component.scss']
})
export class ListeSaisonnierComponent implements OnInit {
  candidatures: Candidature[] = [];
  filtered: Candidature[] = [];
  loading = true;
  saveLoading: Record<number, boolean> = {};
  saveSuccess: Record<number, boolean> = {};

  joursDemandes: Record<number, number> = {};

  constructor(
    private readonly candidatureService: CandidatureService,
    private readonly saisonnierService: SaisonnierService
  ) {}

  ngOnInit() {
  this.candidatureService.getCandidaturesParStructure().subscribe({
    next: (data) => {
      // ✅ Garder uniquement les ACCEPTE
      const acceptees = data.filter(c => c.statut === 'ACCEPTEE');
      
      this.candidatures = acceptees;
      this.filtered = acceptees;
      
      acceptees.forEach(c => {
        this.joursDemandes[c.id] = c.saisonnier?.absences ?? 0;
      });
      this.loading = false;
    },
    error: () => { this.loading = false; }
  });
}

  onJoursChange(id: number, val: number) {
    this.joursDemandes[id] = Math.max(0, val);
  }

  // ✅ Sauvegarder les absences d'un saisonnier
  sauvegarderAbsences(candidature: Candidature) {
    const saisonnierID = candidature.saisonnier?.id;
    if (!saisonnierID) return;

    const absences = this.joursDemandes[candidature.id];
    this.saveLoading[candidature.id] = true;

    this.saisonnierService.updateAbsences(saisonnierID, absences).subscribe({
      next: () => {
        this.saveLoading[candidature.id] = false;
        this.saveSuccess[candidature.id] = true;
        setTimeout(() => this.saveSuccess[candidature.id] = false, 2000);
      },
      error: () => {
        this.saveLoading[candidature.id] = false;
      }
    });
  }
}
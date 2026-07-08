import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface Region    { id: number; nom: string; }
interface Structure { id: number; nom: string; }

interface Utilisateur {
  id?: number;
  nom: string;
  prenom: string;
  email: string;
  matricule: number;
  telephone?: string;
  role: string;
  enabled: boolean;
  region?: Region;
  structure?: Structure;
}

interface ImportResult {
  message: string;
  created: number;
  skipped: number;
  deleted: number;
  errors: string[];
}

@Component({
  selector: 'app-users-list',
  templateUrl: './users-list.component.html',
  styleUrls: ['./users-list.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class UsersListComponent implements OnInit {

  // ── Données ────────────────────────────────────────────────────
  allUsers:  Utilisateur[] = [];
  rsUsers:   Utilisateur[] = [];

  roles: string[] = ['SUPERADMIN', 'ADMIN', 'RH_REGIONAL', 'RESPONSABLE_STRUCTURE'];

  // ── Import 1 ──────────────────────────────────────────────────
  selectedFile1:   File | null = null;
  isDragging1      = false;
  importing1       = false;
  importResult1:   ImportResult | null = null;

  // ── Import 2 ──────────────────────────────────────────────────
  selectedFile2:   File | null = null;
  isDragging2      = false;
  importing2       = false;
  importResult2:   ImportResult | null = null;

  // ── Recherche / filtre — tableau 1 ────────────────────────────
  searchQuery1 = '';
  filterRole1  = '';

  // ── Recherche / filtre — tableau 2 ────────────────────────────
  searchQuery2 = '';

  // ── Pagination — tableau 1 ────────────────────────────────────
  page1     = 1;
  pageSize1 = 10;

  // ── Pagination — tableau 2 ────────────────────────────────────
  page2     = 1;
  pageSize2 = 10;

  private readonly apiBase = 'http://localhost:8080';

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void { this.loadUsers(); }

  // ── Chargement ─────────────────────────────────────────────────
  loadUsers(): void {
    const headers = this.authHeaders();

    this.http.get<Utilisateur[]>(`${this.apiBase}/superadmin/users`, { headers }).subscribe({
      next: (data) => {
        this.allUsers = data.filter(u => u.role !== 'RESPONSABLE_STRUCTURE');
      }
    });

    this.http.get<Utilisateur[]>(
      `${this.apiBase}/superadmin/users/responsables-structure-actifs`, { headers }
    ).subscribe({
      next: (data) => { this.rsUsers = data; },
      error: (err) => console.error('Erreur chargement RS actifs', err)
    });
  }

  // ── Drag & Drop ────────────────────────────────────────────────
 // ✅ Après
onDragOver(e: DragEvent, n: 1|2): void {
  e.preventDefault();
  if (n === 1) {
    this.isDragging1 = true;
  } else {
    this.isDragging2 = true;
  }
}

onDragLeave(n: 1|2): void {
  if (n === 1) {
    this.isDragging1 = false;
  } else {
    this.isDragging2 = false;
  }
}

onDrop(e: DragEvent, n: 1|2): void {
  e.preventDefault();
  if (n === 1) {
    this.isDragging1 = false;
  } else {
    this.isDragging2 = false;
  }
  const file = e.dataTransfer?.files?.[0];
  if (file) this.setFile(file, n);
}
  onFileSelected(e: Event, n: 1|2): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.setFile(file, n);
  }
  setFile(file: File, n: 1|2): void {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('Veuillez sélectionner un fichier .xlsx ou .xls'); return;
    }
    if (n === 1) { this.selectedFile1 = file; this.importResult1 = null; }
    else         { this.selectedFile2 = file; this.importResult2 = null; }
  }
  removeFile(e: MouseEvent, n: 1|2): void {
    e.stopPropagation();
    if (n === 1) { this.selectedFile1 = null; this.importResult1 = null; }
    else         { this.selectedFile2 = null; this.importResult2 = null; }
  }

  // ── Import 1 ──────────────────────────────────────────────────
  importFile1(): void {
    if (!this.selectedFile1) return;
    this.importing1 = true;
    const fd = new FormData();
    fd.append('file', this.selectedFile1);
    const headers = this.authHeaders();

    this.http.post<ImportResult>(`${this.apiBase}/superadmin/import-users`, fd, { headers })
      .subscribe({
        next: (r) => { this.importResult1 = r; this.importing1 = false; this.loadUsers(); },
        error: (err) => {
          this.importResult1 = { message: 'Erreur serveur', created: 0, skipped: 0, deleted: 0,
            errors: [err.error?.error || 'Une erreur est survenue.'] };
          this.importing1 = false;
        }
      });
  }

  // ── Import 2 ──────────────────────────────────────────────────
  importFile2(): void {
    if (!this.selectedFile2) return;
    this.importing2 = true;
    const fd = new FormData();
    fd.append('file', this.selectedFile2);
    const headers = this.authHeaders();

    this.http.post<ImportResult>(`${this.apiBase}/superadmin/import-responsables-structure`, fd, { headers })
      .subscribe({
        next: (r) => { this.importResult2 = r; this.importing2 = false; this.loadUsers(); },
        error: (err) => {
          this.importResult2 = { message: err.error?.error || 'Erreur serveur', created: 0, skipped: 0, deleted: 0,
            errors: [err.error?.error || 'Une erreur est survenue.'] };
          this.importing2 = false;
        }
      });
  }

  // ── Filtrage ──────────────────────────────────────────────────
  filteredUsers1(): Utilisateur[] {
    const q = this.searchQuery1.toLowerCase();
    return this.allUsers.filter(u => {
      const matchSearch = !q ||
        u.nom.toLowerCase().includes(q) ||
        u.prenom.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.matricule?.toString().includes(q);
      const matchRole = !this.filterRole1 || u.role === this.filterRole1;
      return matchSearch && matchRole;
    });
  }

  filteredUsers2(): Utilisateur[] {
    const q = this.searchQuery2.toLowerCase();
    return this.rsUsers.filter(u =>
      !q ||
      u.nom.toLowerCase().includes(q) ||
      u.prenom.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.matricule?.toString().includes(q) ||
      u.structure?.nom.toLowerCase().includes(q)
    );
  }

  // ── Pagination ────────────────────────────────────────────────
  pagedUsers1(): Utilisateur[] {
    const start = (this.page1 - 1) * this.pageSize1;
    return this.filteredUsers1().slice(start, start + this.pageSize1);
  }
  totalPages1(): number { return Math.ceil(this.filteredUsers1().length / this.pageSize1) || 1; }
  pagesArray1(): number[] { return Array.from({ length: this.totalPages1() }, (_, i) => i + 1); }
  goToPage1(p: number): void { if (p >= 1 && p <= this.totalPages1()) this.page1 = p; }
  onSearch1(): void { this.page1 = 1; }

  pagedUsers2(): Utilisateur[] {
    const start = (this.page2 - 1) * this.pageSize2;
    return this.filteredUsers2().slice(start, start + this.pageSize2);
  }
  totalPages2(): number { return Math.ceil(this.filteredUsers2().length / this.pageSize2) || 1; }
  pagesArray2(): number[] { return Array.from({ length: this.totalPages2() }, (_, i) => i + 1); }
  goToPage2(p: number): void { if (p >= 1 && p <= this.totalPages2()) this.page2 = p; }
  onSearch2(): void { this.page2 = 1; }

  // ── Helpers ───────────────────────────────────────────────────
  private getToken(): string {
    return localStorage.getItem('token') || '';
  }

  public authHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / 1048576).toFixed(1)} Mo`;
  }
  getInitials(u: Utilisateur): string {
    return `${u.prenom?.[0] ?? ''}${u.nom?.[0] ?? ''}`.toUpperCase();
  }
  getCountByRole(role: string): number {
    return [...this.allUsers, ...this.rsUsers].filter(u => u.role === role).length;
  }
  getTotalUsers(): number { return this.allUsers.length + this.rsUsers.length; }
  getRoleLabel(role: string): string {
    const map: Record<string, string> = {
      SUPERADMIN: 'Super Admin', ADMIN: 'Administrateur RH',
      RH_REGIONAL: 'Responsable RH', RESPONSABLE_STRUCTURE: 'Responsable Structure'
    };
    return map[role] ?? role;
  }
  getRoleClass(role: string): string {
    const map: Record<string, string> = {
      SUPERADMIN: 'role-super', ADMIN: 'role-admin',
      RH_REGIONAL: 'role-rh', RESPONSABLE_STRUCTURE: 'role-structure'
    };
    return map[role] ?? 'role-default';
  }
  downloadTemplate(): void { console.log('Télécharger le modèle Excel'); }
}

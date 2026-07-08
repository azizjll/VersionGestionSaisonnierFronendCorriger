import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class EtatRHService {

  private base = 'http://localhost:8080';

  constructor(private http: HttpClient) {}

  // ── Helper : headers avec JWT ─────────────────────────────────
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token'); // ← votre clé localStorage
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  // ── RH_REGIONAL ──────────────────────────────────────────────

  uploadEtat(file: File): Observable<any> {
    const form = new FormData();
    form.append('file', file);
    // Pour FormData : Authorization seulement, PAS de Content-Type
    return this.http.post(`${this.base}/api/rh/etat/upload`, form, {
      headers: this.getAuthHeaders()
    });
  }

  getMonEtat(): Observable<any> {
    return this.http.get(`${this.base}/api/rh/etat/mon-etat`, {
      headers: this.getAuthHeaders()
    });
  }

  // ── ADMIN ─────────────────────────────────────────────────────

  getAllEtats(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/api/admin/etats`, {
      headers: this.getAuthHeaders()
    });
  }

  changerStatut(id: number, statut: 'VALIDE' | 'REJETE'): Observable<any> {
    return this.http.patch(
      `${this.base}/api/admin/etats/${id}/statut`,
      null,
      {
        headers: this.getAuthHeaders(),
        params: { statut }
      }
    );
  }
}

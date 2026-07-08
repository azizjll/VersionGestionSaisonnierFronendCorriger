import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AuditLog {
  id: number;
  utilisateurEmail: string;
  action: string;
  entite: string;
  entiteId: number;
  donneesAvant?: string;
  donneesApres?: string;
  adresseIp: string;
  statut: string;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class AuditLogService {

  private baseUrl = 'http://localhost:8080/api/audit';

  constructor(private http: HttpClient) {}

  private getHeaders(): { headers: HttpHeaders } {
    const token = localStorage.getItem('token');
    return {
      headers: new HttpHeaders({ Authorization: `Bearer ${token}` })
    };
  }

  getTousLesLogs(): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(this.baseUrl, this.getHeaders());
  }

  getLogsParUtilisateur(email: string): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(
      `${this.baseUrl}/utilisateur/${email}`, this.getHeaders());
  }

  getLogsParEntite(entite: string, id: number): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(
      `${this.baseUrl}/entite/${entite}/${id}`, this.getHeaders());
  }
}
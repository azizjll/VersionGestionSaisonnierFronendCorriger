import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface CampagneRequestDTO {
  libelle: string;
  code?: string;
  dateDebut: string;
  dateFin: string;
  description?: string;
  budget?: number ;
  regionIds: number[];
  statut?: string;
}

export interface Campagne {
  id: number;
  libelle: string;
  code: string;
  dateDebut: string;
  dateFin: string;
  statut: string;
  description?: string;
  budget?: number;
}

export interface CampagnePubliqueDTO {
  id: number;
  libelle: string;
  dateDebut: string;
  dateFin: string;
}

@Injectable({
  providedIn: 'root'
})
export class CampagneService {

  private baseUrl = 'http://localhost:8080/api/campagnes';

  private getAuthHeaders(): { headers: HttpHeaders } {
  return { headers: this.authService['authHeaders']() }; // utilise la méthode privée authHeaders()
}

  constructor(private http: HttpClient,private authService: AuthService) {}

  // CREATE
  creerCampagne(dto: CampagneRequestDTO): Observable<Campagne> {
  return this.http.post<Campagne>(this.baseUrl, dto, this.getAuthHeaders());
}

// Ajouter cette méthode dans campagne.service.ts
creerCampagneAvecExcel(dto: CampagneRequestDTO, fichierExcel: File): Observable<Campagne> {
  const formData = new FormData();
  formData.append('campagne', new Blob([JSON.stringify(dto)], { type: 'application/json' }));
  formData.append('fichier', fichierExcel);
  return this.http.post<Campagne>(`${this.baseUrl}/avec-excel`, formData, this.getAuthHeaders());
}

  // READ
getCampagneParCode(code: string): Observable<CampagnePubliqueDTO> {
  return this.http.get<CampagnePubliqueDTO>(
  `${this.baseUrl}/${code}/publique`
  );
}

  getToutesCampagnes(): Observable<Campagne[]> {
    return this.http.get<Campagne[]>(this.baseUrl, this.getAuthHeaders());
  }

  getCampagneParId(id: number): Observable<Campagne> {
    return this.http.get<Campagne>(`${this.baseUrl}/${id}`, this.getAuthHeaders());
}

  getCampagnesActives(): Observable<Campagne[]> {
    return this.http.get<Campagne[]>(`${this.baseUrl}/actives`, this.getAuthHeaders());
}
  // UPDATE
  updateCampagne(id: number, dto: CampagneRequestDTO): Observable<Campagne> {
    return this.http.put<Campagne>(`${this.baseUrl}/${id}`, dto, this.getAuthHeaders());
}

  // DELETE
  deleteCampagne(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, this.getAuthHeaders());
}

  // BUSINESS
  activerCampagne(id: number): Observable<Campagne> {
  return this.http.put<Campagne>(`${this.baseUrl}/${id}/activer`, {}, this.getAuthHeaders());
}

  cloturerCampagne(id: number): Observable<Campagne> {
    return this.http.put<Campagne>(`${this.baseUrl}/${id}/cloturer`, {}, this.getAuthHeaders());
}

  getMesCampagnes(): Observable<Campagne[]> {
  return this.http.get<Campagne[]>(`${this.baseUrl}/mes-campagnes`, this.getAuthHeaders());
}
getAllCampagnes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}`, this.getAuthHeaders());
}

}

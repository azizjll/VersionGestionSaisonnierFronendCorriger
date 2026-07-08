import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

// Une seule interface — plus de Structure
export interface StructureDTO {
  id: number;
  nom: string;
  type: 'ESPACE_COMMERCIAL' | 'CENTRE_TECHNIQUE' | 'STRUCTURE_CENTRALE';
  region: string;
  adresse: string;
  autorises: number;
  recrutes: number;
  disponible: boolean;
}

@Injectable({ providedIn: 'root' })
export class StructureService {
  private baseUrl = '/api/structures';

  constructor(private http: HttpClient) {}

  // ── helper privé ─────────────────────────────────────────────
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');

    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  getStructuresByRegion(
    regionId: number,
    campagneId?: number
  ): Observable<StructureDTO[]> {

    const params = campagneId ? `?campagneId=${campagneId}` : '';

    return this.http.get<StructureDTO[]>(
      `${this.baseUrl}/region/${regionId}${params}`,
      {
        headers: this.getHeaders()
      }
    );
  }

  updateStructure(
    id: number,
    dto: Partial<StructureDTO>
  ): Observable<any> {

    return this.http.put(
      `${this.baseUrl}/${id}`,
      dto,
      {
        headers: this.getHeaders(),
        responseType: 'text'
      }
    );
  }

  getStructuresCampagneActive(): Observable<StructureDTO[]> {
    return this.http.get<StructureDTO[]>(
      `${this.baseUrl}/campagne-active`,
      {
        headers: this.getHeaders()
      }
    );
  }
  getStructuresParCodeCampagne(code: string): Observable<StructureDTO[]> {
    return this.http.get<StructureDTO[]>(
      `${this.baseUrl}/campagne/${code}/publique`
    );
  }
  getStructuresCampagneActivePublique(): Observable<StructureDTO[]> {
    return this.http.get<StructureDTO[]>(
      `${this.baseUrl}/campagne-active/publique`,
      {
        headers: this.getHeaders()
      }
    );
  }
}

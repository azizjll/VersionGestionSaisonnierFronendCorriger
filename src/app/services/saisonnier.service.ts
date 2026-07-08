// saisonnier.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SaisonnierDTO {
  id: number;
  nom: string;
  prenom: string;
  cin: number;
  rib: string;
  statut?: string;
  moisTravail?: string;
  absences?: number;
}

@Injectable({
  providedIn: 'root'
})
export class SaisonnierService {

  private readonly API = 'http://localhost:8080/api/saisonniers';

  constructor(private http: HttpClient) {}

  /**
   * Headers avec JWT
   */
  private getAuthHeaders() {
    const token = localStorage.getItem('token');

    return {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  }

  /**
   * Tous les saisonniers
   */
  getAll(): Observable<SaisonnierDTO[]> {
    return this.http.get<SaisonnierDTO[]>(
      this.API,
      this.getAuthHeaders()
    );
  }

  /**
   * Saisonnier par ID
   */
  getById(id: number): Observable<SaisonnierDTO> {
    return this.http.get<SaisonnierDTO>(
      `${this.API}/${id}`,
      this.getAuthHeaders()
    );
  }

  /**
   * Saisonniers par campagne et région
   */
  getByCampagneAndRegion(
    campagneId: number,
    regionId: number
  ): Observable<SaisonnierDTO[]> {

    return this.http.get<SaisonnierDTO[]>(
      `${this.API}/by-campagne-region?campagneId=${campagneId}&regionId=${regionId}`,
      this.getAuthHeaders()
    );
  }

  /**
   * Saisonniers par campagne et structure
   */
  getByCampagneAndStructure(
    campagneId: number,
    structureId: number
  ): Observable<SaisonnierDTO[]> {

    return this.http.get<SaisonnierDTO[]>(
      `${this.API}/by-campagne-structure?campagneId=${campagneId}&structureId=${structureId}`,
      this.getAuthHeaders()
    );
  }

  /**
   * Modifier absences
   */
  updateAbsences(
    id: number,
    absences: number
  ): Observable<SaisonnierDTO> {

    return this.http.patch<SaisonnierDTO>(
      `${this.API}/${id}/absences`,
      { absences },
      this.getAuthHeaders()
    );
  }

}

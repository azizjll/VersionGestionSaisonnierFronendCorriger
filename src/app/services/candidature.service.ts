import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Candidature {
  id: number;
  campagne: any;
  commentaire: string | null;
  dateDepot: string;
  documents: any[];
  saisonnier: any;
  statut: string;
}

@Injectable({
  providedIn: 'root'
})
export class CandidatureService {

  private baseUrl = 'http://localhost:8080/api/candidatures';

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
   * Déposer une candidature
   */
  deposerCandidature(formData: FormData): Observable<any> {
    return this.http.post<any>(
      `${this.baseUrl}/depot`,
      formData,
      this.getAuthHeaders()
    );
  }

  /**
   * Filtrer candidatures
   */
  getCandidaturesByCampagneAndRegion(
    campagneId: number,
    regionId: number
  ): Observable<Candidature[]> {

    return this.http.get<Candidature[]>(
      `${this.baseUrl}/filtrer?campagneId=${campagneId}&regionId=${regionId}`,
      this.getAuthHeaders()
    );
  }

  /**
   * Toutes les candidatures
   */
  getAllCandidatures(): Observable<Candidature[]> {
    return this.http.get<Candidature[]>(
      `${this.baseUrl}/all`,
      this.getAuthHeaders()
    );
  }

  /**
   * Modifier candidature
   */
  updateCandidature(id: number, formData: FormData) {
    return this.http.put(
      `${this.baseUrl}/update/${id}`,
      formData,
      this.getAuthHeaders()
    );
  }

  /**
   * Envoyer demande autorisation
   */
  envoyerDemandeJuilletAout(payload: {
    candidatureId: number;
    commentaire: string;
    directionNom: string;
  }): Observable<any> {

    return this.http.post(
      `${this.baseUrl}/demande-autorisation`,
      payload,
      this.getAuthHeaders()
    );
  }

  /**
   * Parent par matricule
   */
  getParentByMatricule(matricule: string): Observable<any> {
    return this.http.get<any>(
      `${this.baseUrl}/parent-by-matricule?matricule=${matricule}`,
      this.getAuthHeaders()
    );
  }

  /**
   * Documents saisonnier
   */
  getDocumentsBySaisonnier(saisonnierId: number) {
    return this.http.get<any[]>(
      `${this.baseUrl}/documents?saisonnierId=${saisonnierId}`,
      this.getAuthHeaders()
    );
  }

  /**
   * Saisonnier par ID
   */
  getSaisonnierById(id: number) {
    return this.http.get<any>(
      `${this.baseUrl}/saisonnier/${id}`,
      this.getAuthHeaders()
    );
  }

  /**
   * Historique utilisateur
   */
  getMonHistorique(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.baseUrl}/mon-historique`,
      this.getAuthHeaders()
    );
  }

  /**
   * Upload fichier Excel
   */
 uploadParentsExcel(file: File, campagneId: number): Observable<string> {
  const formData = new FormData();
  formData.append('fichier', file, file.name);          // ← 'fichier' pas 'file'
  formData.append('campagneId', campagneId.toString());

  return this.http.post<string>(
    `${this.baseUrl}/upload-parents`,
    formData,
    {
      ...this.getAuthHeaders(),
      responseType: 'text' as 'json'
    }
  );
}

  /**
   * Documents utilisateur connecté
   */
  getDocumentsByToken(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.baseUrl}/mes-documents`,
      this.getAuthHeaders()
    );
  }

  /**
   * Profil utilisateur connecté
   */
  getMonProfil(): Observable<any> {
    return this.http.get<any>(
      `${this.baseUrl}/mon-profil`,
      this.getAuthHeaders()
    );
  }

  /**
   * Structure candidature
   */
  getStructureByCandidature(candidatureId: number): Observable<any> {
    return this.http.get<any>(
      `${this.baseUrl}/${candidatureId}/structure`,
      this.getAuthHeaders()
    );
  }

  // candidature.service.ts
getCandidaturesParStructure(): Observable<Candidature[]> {
  return this.http.get<Candidature[]>(
    `${this.baseUrl}/par-structure`,
    this.getAuthHeaders()
  );
}

}
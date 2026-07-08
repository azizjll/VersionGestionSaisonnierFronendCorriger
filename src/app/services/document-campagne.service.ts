import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DocumentCampagneDTO {
  id: number;
  nom: string;
  type: string;
  url: string;
  campagneId?: number;
}

@Injectable({ providedIn: 'root' })
export class DocumentCampagneService {

  private readonly base = 'http://localhost:8080/api/admin/documents-campagne';

  constructor(private http: HttpClient) {}

  /**
   * Upload un document (PDF, image…) lié à une campagne.
   * Correspond à POST /api/admin/documents-campagne/upload
   */
  uploadDocument(
    campagneId: number,
    nom: string,
    type: string,
    file: File
  ): Observable<DocumentCampagneDTO> {
    const form = new FormData();
    form.append('campagneId', campagneId.toString());
    form.append('nom', nom);
    form.append('type', type);
    form.append('file', file);
    return this.http.post<DocumentCampagneDTO>(`${this.base}/upload`, form);
  }

  /**
   * Récupère tous les documents d'une campagne.
   * À ajouter côté backend : GET /api/admin/documents-campagne/{campagneId}
   */
  getDocumentsByCampagne(campagneId: number): Observable<DocumentCampagneDTO[]> {
    return this.http.get<DocumentCampagneDTO[]>(`${this.base}/${campagneId}`);
  }

  /**
   * Supprime un document par id.
   * À ajouter côté backend : DELETE /api/admin/documents-campagne/{id}
   */
  deleteDocument(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
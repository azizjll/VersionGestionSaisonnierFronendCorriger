import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Document {
  id: number;
  nomFichier: string;
  type: string;
  url: string;
  
}

@Injectable({
  providedIn: 'root'
})
export class DocumentService {

  private baseUrl = 'http://localhost:8080/api/documents';

  constructor(private http: HttpClient) {}

  // Upload un fichier PDF vers le serveur
  uploadDocument(file: File, type: string): Observable<Document> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    return this.http.post<Document>(`${this.baseUrl}/upload`, formData);
  }

  // Récupérer le dernier document par type
  getDocumentByType(type: string): Observable<Document> {
    return this.http.get<Document>(`${this.baseUrl}/type/${type}`);
  }
}
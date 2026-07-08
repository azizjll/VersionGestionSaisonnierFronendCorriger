import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ParentAutorise {
  id: number;
  nomPrenom: string;
  matricule: string;
  email: string;
  autorises: number;
  utilise: number;
}

@Injectable({
  providedIn: 'root'
})
export class ParentAutoriseService {

  private apiUrl = 'http://localhost:8080/api/parents';

  constructor(private http: HttpClient) {}

  // 🔐 Headers avec token
  private authHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  private getToken(): string {
    return localStorage.getItem('token') || '';
  }

  // 📋 GET by campagne
  getParentsByCampagne(campagneId: number): Observable<ParentAutorise[]> {
    return this.http.get<ParentAutorise[]>(
      `${this.apiUrl}/by-campagne/${campagneId}`,
      { headers: this.authHeaders() }
    );
  }

  // 📋 GET ALL
  getAllParents(): Observable<ParentAutorise[]> {
    return this.http.get<ParentAutorise[]>(
      this.apiUrl,
      { headers: this.authHeaders() }
    );
  }

  // 🔍 GET BY ID
  getParentById(id: number): Observable<ParentAutorise> {
    return this.http.get<ParentAutorise>(
      `${this.apiUrl}/${id}`,
      { headers: this.authHeaders() }
    );
  }

  // ➕ ADD
  addParent(nomPrenom: string, matricule: string,email: string, autorises: number): Observable<any> {
    return this.http.post(
      `${this.apiUrl}?nomPrenom=${nomPrenom}&matricule=${matricule}&email=${email}&autorises=${autorises}`,
      {},
      { headers: this.authHeaders() }
    );
  }

  // ✏️ UPDATE
  updateParent(id: number, nomPrenom: string, matricule: string,email: string,autorises: number, utilise: number): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/${id}?nomPrenom=${nomPrenom}&matricule=${matricule}&email=${email}&autorises=${autorises}&utilise=${utilise}`,
      {},
      { headers: this.authHeaders() }
    );
  }

  // ❌ DELETE
  deleteParent(id: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/${id}`,
      { headers: this.authHeaders() }
    );
  }
}

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';

export interface SignupRequest {
  nom: string;
  prenom: string;
  email: string;
  password: string;
  cin?: string;
  telephone?: string;
  role?: string;
  regionId?: number;
}

export interface SigninRequest {
  email: string;
  password: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface NewPasswordRequest {
  token: string;
  newPassword: string;
}

export interface Region {
  id: number;
  nom: string;
}

export interface SigninAdminRequest {
  matricule: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private baseUrl = 'http://localhost:8080/auth'; // changer si besoin

  constructor(private http: HttpClient) { }

  signup(request: SignupRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/signup`, request);
  }

  verifyToken(token: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/verify`, { params: { token } });
  }

  signin(request: SigninRequest): Observable<{ token: string }> {
  return this.http.post<{ token: string }>(`${this.baseUrl}/signin`, request);
}

signinAdmin(request: SigninAdminRequest): Observable<{ token: string }> {
  return this.http.post<{ token: string }>(`${this.baseUrl}/signin-admin`, request);
}

  forgotPassword(request: PasswordResetRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/forgot-password`, request);
  }

  resetPassword(request: NewPasswordRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/reset-password`, request);
  }

   // Récupérer les régions
  getRegions(): Observable<Region[]> {
    return this.http.get<Region[]>(`${this.baseUrl}/regions`);
  }

  // Récupérer les rôles
  getRoles(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/roles`);
  }

  // Sauvegarder le token
setToken(token: string): void {
  localStorage.setItem('token', token);
  console.log('Token stocké :', localStorage.getItem('token')); // vérification
}

// Récupérer le token
getToken(): string | null {
  return localStorage.getItem('token');
}

// Supprimer le token
logout(): void {
  localStorage.removeItem('token');
}

// Construire headers avec Bearer
// Changer private en public
public authHeaders(): HttpHeaders {
  const token = this.getToken();
  return new HttpHeaders({
    Authorization: `Bearer ${token}`
  });
}

// Récupérer la région du RH connecté
getMyRegion(): Observable<Region> {
  const headers = this.authHeaders(); // ton header avec token
  return this.http.get<Region>(`${this.baseUrl}/my-region`, { headers });
}

// Ajouter ces méthodes dans auth.service.ts

// Décoder le token JWT (sans librairie externe)
private decodeToken(): any {
  const token = this.getToken();
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

// Récupérer le nom complet
getNomComplet(): string {
  const decoded = this.decodeToken();
  if (!decoded) return 'Utilisateur';
  
  const prenom = decoded.prenom || '';
  const nom    = decoded.nom    || '';
  
  return `${prenom} ${nom}`.trim() || decoded.sub || 'Utilisateur';
}

getRole(): string {
  const decoded = this.decodeToken();
  if (!decoded) return '';
  
  // Nettoyer le préfixe ROLE_
  const role = decoded.role || (decoded.roles?.[0]) || '';
  return role.replace('ROLE_', '');
  // Résultat : "ADMIN", "RH_REGIONAL", "SAISONNIER"
}

// Logout + redirection
logoutAndRedirect(router: Router): void {
  localStorage.removeItem('token');
  router.navigate(['http://localhost:8080/admin/login']);
}

// auth.service.ts

getUserRole(): string | null {
  const token = localStorage.getItem('token');
  if (!token) return null;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role || payload.roles?.[0] || null;
  } catch {
    return null;
  }
}
}
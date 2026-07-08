import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CampagneService } from '../services/campagne.service';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class RhGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private campagneService: CampagneService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean> {
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/home-ge']);
      return of(false);
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const role: string = payload.role || payload.roles?.[0] || '';

      if (role !== 'RH_REGIONAL') {
        this.router.navigate(['/home-ge']);
        return of(false);
      }

      // ── Juste valider, NE PAS rediriger ──────────────────────
      return this.campagneService.getCampagnesActives().pipe(
        map(campagnes => {
          if (campagnes && campagnes.length > 0) {
            return true; // ← laisser passer, sans navigate()
          }
          this.router.navigate(['/home-ge'], {
            queryParams: { error: 'entreprise-inactive' }
          });
          return false;
        }),
        catchError(() => {
          this.router.navigate(['/home-ge']);
          return of(false);
        })
      );

    } catch {
      this.router.navigate(['/home-ge']);
      return of(false);
    }
  }
}
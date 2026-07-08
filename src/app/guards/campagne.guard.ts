import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { CampagneService } from '../services/campagne.service';

@Injectable({
  providedIn: 'root'
})
export class CampagneGuard implements CanActivate {

  constructor(
    private readonly router: Router,
    private readonly campagneService: CampagneService
  ) {}

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {

    const code = route.paramMap.get('code');

    if (!code) {
      this.router.navigate(['/campagne-expiree']);
      return of(false);
    }

    return this.campagneService.getCampagneParCode(code).pipe(
      map(campagne => {
        const now = Date.now();
        const fin = new Date(campagne.dateFin + 'T23:59:59').getTime();

        if (now > fin) {
          this.router.navigate(['/campagne-expiree']);
          return false;
        }

        return true;
      }),
      catchError(() => {
        // 404 = code invalide ou campagne non ACTIVE (déjà vérifié côté backend)
        this.router.navigate(['/campagne-expiree']);
        return of(false);
      })
    );
  }
}

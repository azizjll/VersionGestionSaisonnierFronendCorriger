// src/app/security/auth.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    const token = this.authService.getToken();

    if (token) {
      return true; // ✅ Token présent → accès autorisé
    }

    // ❌ Pas de token → redirection vers login
    this.router.navigate(['/admin/login'], {
      queryParams: { returnUrl: state.url } // garde l'URL demandée
    });
    return false;
  }
}
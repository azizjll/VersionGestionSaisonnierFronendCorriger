import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {

  constructor(
    private  readonly authService: AuthService,
    private readonly router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const role = this.authService.getRole();

    // ✅ Lire le rôle requis depuis la config de la route
    const requiredRoles: string = route.data['roles'];

     if (requiredRoles?.includes(role)) {
  return true;
}
    // ❌ Redirection selon le rôle réel
    switch (role) {
      case 'SAISONNIER':   this.router.navigate(['/espace-saisonnier']);      break;
      case 'RH_REGIONAL':  this.router.navigate(['/rhregioanl/saisonniers']); break;
      case 'SUPERADMIN':   this.router.navigate(['/superadmin/user_list']);   break;
      case 'ADMIN':        this.router.navigate(['/admin']);                  break;
      case 'RESPONSABLE_STRUCTURE': this.router.navigate(['/responsable/candidatures']); break;

      default:             this.router.navigate(['/home-ge']);
    }

    return false;
  }
}
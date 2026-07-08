import { Component, OnInit, HostListener } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
})
export class NavbarComponent implements OnInit {
  isScrolled = false;
  isMenuOpen = false;
  isLoggedIn = false;
  nomUtilisateur = '';
  roleUtilisateur = '';

  navLinks = [
    { name: 'Espace Saisonnier', path: '/espace-saisonnier' },
    
  ];

  constructor(private router: Router) {
    // Re-vérifier à chaque navigation (ex: après login)
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe(() => this.checkAuth());
  }

  ngOnInit() {
    this.checkAuth();
  }

  checkAuth() {
    const token = localStorage.getItem('token');

    if (!token) {
      this.isLoggedIn = false;
      return;
    }

    try {
      // ✅ Décoder le payload JWT (partie du milieu)
      const payload = JSON.parse(atob(token.split('.')[1]));

      // ✅ Les champs viennent directement du JWT
      // payload = { sub, roles, nom, prenom, role, iat, exp }
      this.isLoggedIn      = true;
      this.roleUtilisateur = payload.role;                          // "SAISONNIER"
      this.nomUtilisateur  = payload.prenom + ' ' + payload.nom;   // "azizjellali cdcc"

    } catch (e) {
      // Token corrompu
      this.isLoggedIn      = false;
      this.roleUtilisateur = '';
      this.nomUtilisateur  = '';
      localStorage.removeItem('token');
    }
  }

  logout() {
    const role = this.roleUtilisateur;

    localStorage.clear();

    this.isLoggedIn      = false;
    this.nomUtilisateur  = '';
    this.roleUtilisateur = '';

    if (role === 'RH_REGIONAL') {
      this.router.navigate(['/home-ge']);
    } else if (role === 'SAISONNIER') {
      window.location.reload();
    }
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  @HostListener('window:scroll')
  onScroll() {
    this.isScrolled = window.scrollY > 50;
  }
}
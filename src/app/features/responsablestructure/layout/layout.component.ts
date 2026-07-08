import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  standalone: true,
  imports: [CommonModule, RouterModule],
  styleUrls: ['./layout.component.scss']
})
export class LayoutComponent {
  navItems = [
    { label: 'Candidatures', icon: 'users', route: 'candidatures', badge: 0 },
  ];

  constructor(private readonly authService: AuthService, private readonly router: Router) {}

  logout(): void {
    this.authService.logout();          // supprime le token
    this.router.navigate(['/home-ge']); // redirige
  }
}
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-layout-superadmin',
  templateUrl: './layout-superadmin.component.html',
  styleUrls: ['./layout-superadmin.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class LayoutSuperadminComponent {
  sidebarCollapsed = false;

  constructor(private readonly authService: AuthService, private readonly router: Router) {}

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  logout(): void {
    this.authService.logout(); // supprime le token
    this.router.navigate(['/home-ge']);
  }
}
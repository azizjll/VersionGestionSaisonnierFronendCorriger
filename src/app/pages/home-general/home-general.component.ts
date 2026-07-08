import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, SigninAdminRequest } from '../../services/auth.service';
import { CampagneService } from 'src/app/services/campagne.service';

type ModalStep = 'email' | 'code' | 'password' | null;

@Component({
  selector: 'app-home-general',
  templateUrl: './home-general.component.html',
  styleUrls: ['./home-general.component.scss']
})
export class HomeGeneralComponent {

  matricule = '';
  password = '';
  errorMessage = '';
  isLoading = false;

  // Mot de passe oublié
  modalStep: ModalStep = null;
  fpEmail = '';
  fpCode = '';
  fpNewPassword = '';
  fpConfirmPassword = '';
  fpError = '';
  fpSuccess = '';
  fpLoading = false;

  showRoleChooser = false;

  showPassword = false;



  constructor(
    private router: Router,
    private authService: AuthService,
    private campagneService: CampagneService
  ) {}

  // ─── Connexion ────────────────────────────────────────────────────────────

  login(): void {
    if (!this.matricule || !this.password) {
      this.errorMessage = 'Veuillez remplir tous les champs.';
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';

    const request: SigninAdminRequest = { matricule: this.matricule, password: this.password };

    

    this.authService.signinAdmin(request).subscribe({
      next: (res) => {
        this.authService.setToken(res.token);
        this.redirectByRole(this.authService.getRole());
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Matricule ou mot de passe incorrect.';
      }
    });
  }
  togglePassword(): void {
  this.showPassword = !this.showPassword;
}

  private redirectByRole(role: string): void {
  this.isLoading = false;
  switch (role) {
    case 'SUPERADMIN':
      this.showRoleChooser = true;
      break;
    case 'ADMIN':
      this.router.navigate(['/admin']);
      break;
    case 'RH_REGIONAL':
      this.campagneService.getCampagnesActives().subscribe({
        next: (campagnes) => {
          if (campagnes?.length > 0) {
            this.router.navigate(['/rhregioanl/saisonniers'], { queryParams: { campagneId: campagnes[0].id } });
          } else {
            this.errorMessage = "Aucune campagne active. Contactez l'administrateur.";
          }
        },
        error: () => { this.errorMessage = 'Impossible de vérifier les campagnes.'; }
      });
      break;

    // ✅ Nouveau rôle ajouté ici
    case 'RESPONSABLE_STRUCTURE':
      this.router.navigate(['/responsable/candidatures']);
      break;

    default:
      this.errorMessage = 'Rôle non autorisé.';
      this.authService.logout();
  }
}


  goToAdminRH(): void {
  this.showRoleChooser = false;
  this.router.navigate(['/admin']);
}

goToSuperAdmin(): void {
  this.showRoleChooser = false;
  this.router.navigate(['/superadmin/user_list']);
}

closeRoleChooser(): void {
  this.showRoleChooser = false;
  this.authService.logout(); // optionnel : déconnecter si l'utilisateur ferme
}

  // ─── Modal mot de passe oublié ────────────────────────────────────────────

  openForgotPassword(): void {
    this.modalStep = 'email';
    this.fpEmail = '';
    this.fpCode = '';
    this.fpNewPassword = '';
    this.fpConfirmPassword = '';
    this.fpError = '';
    this.fpSuccess = '';
  }

  closeModal(): void {
    this.modalStep = null;
  }

  // Étape 1 : envoyer le code par email
  sendResetCode(): void {
    if (!this.fpEmail) { this.fpError = 'Veuillez entrer votre email.'; return; }
    this.fpLoading = true;
    this.fpError = '';

    this.authService.forgotPassword({ email: this.fpEmail }).subscribe({
      next: () => {
        this.fpLoading = false;
        this.modalStep = 'code';
      },
      error: (err) => {
        this.fpLoading = false;
        this.fpError = err.error?.message || 'Email introuvable.';
      }
    });
  }

  // Étape 2 : vérifier le code
  verifyCode(): void {
    if (!this.fpCode) { this.fpError = 'Veuillez entrer le code reçu.'; return; }
    // On passe directement à l'étape password (la vraie vérification se fait au reset)
    this.fpError = '';
    this.modalStep = 'password';
  }

  // Étape 3 : définir le nouveau mot de passe
  resetPassword(): void {
    if (!this.fpNewPassword || !this.fpConfirmPassword) {
      this.fpError = 'Veuillez remplir les deux champs.'; return;
    }
    if (this.fpNewPassword !== this.fpConfirmPassword) {
      this.fpError = 'Les mots de passe ne correspondent pas.'; return;
    }
    this.fpLoading = true;
    this.fpError = '';

    this.authService.resetPassword({ token: this.fpCode, newPassword: this.fpNewPassword }).subscribe({
      next: () => {
        this.fpLoading = false;
        this.fpSuccess = 'Mot de passe réinitialisé avec succès !';
        setTimeout(() => this.closeModal(), 2000);
      },
      error: (err) => {
        this.fpLoading = false;
        this.fpError = err.error?.message || 'Code invalide ou expiré.';
      }
    });
  }

  goSaisonnier() { this.router.navigate(['/admin/login']); }
  goRH()         { this.router.navigate(['/admin/login'], { queryParams: { context: 'rh' } }); }
}
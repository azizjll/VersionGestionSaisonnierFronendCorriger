import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  animate,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { AuthService } from 'src/app/services/auth.service';
import Swal from 'sweetalert2';

export type AuthView = 'login' | 'forgot' | 'reset';

@Component({
  selector: 'app-login-saisonnier',
  templateUrl: './login-saisonnier.component.html',
  styleUrls: ['./login-saisonnier.component.scss'],
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(16px)' }),
        animate('320ms cubic-bezier(0.22, 1, 0.36, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-8px)' })),
      ]),
    ]),
  ],
})
export class LoginSaisonnierComponent implements OnInit {

  // ── Vue active ─────────────────────────────────────────────
  currentView: AuthView = 'login';

  // ── État global ─────────────────────────────────────────────
  isLoading = false;

  // ── Login ───────────────────────────────────────────────────
  loginData = { email: '', password: '' };
  showPassword = false;
  loginError = '';
  emailFocused = false;
  pwFocused = false;

  // ── Forgot password ─────────────────────────────────────────
  forgotEmail = '';
  forgotSuccess = false;
  forgotEmailFocused = false;

  // ── Reset password ──────────────────────────────────────────
  resetToken = '';
  resetData = { newPassword: '', confirmPassword: '' };
  showNewPw = false;
  showConfirmPw = false;
  newPwFocused = false;
  confirmPwFocused = false;
  resetSuccess = false;

  // ── Modal connexion requise ──────────────────────────────────
  showLoginRequired = false;
  lockedSection = '';

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    // Si un token reset est dans l'URL → afficher l'écran reset
    this.route.queryParams.subscribe(params => {
      if (params['token']) {
        this.resetToken = params['token'];
        this.currentView = 'reset';
      }
    });
  }

  // ──────────────────────────────────────────────────────────
  // LOGIN
  // ──────────────────────────────────────────────────────────
  onLogin(form: NgForm): void {
    if (form.invalid) {
      form.form.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.loginError = '';

    this.authService.signin({ email: this.loginData.email, password: this.loginData.password })
      .subscribe({
        next: (res) => {
          this.authService.setToken(res.token);
          this.isLoading = false;
          this.router.navigate(['/espace-saisonnier']);
        },
        error: (err) => {
          this.isLoading = false;
          this.loginError =
            err?.error?.message ||
            'Email ou mot de passe incorrect. Veuillez réessayer.';
        },
      });
  }

  // ──────────────────────────────────────────────────────────
  // MOT DE PASSE OUBLIÉ
  // ──────────────────────────────────────────────────────────
  onForgotPassword(form: NgForm): void {
    if (form.invalid) {
      form.form.markAllAsTouched();
      return;
    }

    this.isLoading = true;

    this.authService.forgotPassword({ email: this.forgotEmail })
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.forgotSuccess = true;
        },
        error: () => {
          this.isLoading = false;
          Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: 'Une erreur est survenue. Vérifiez l\'adresse email.',
            confirmButtonColor: '#2563eb',
          });
        },
      });
  }

  // ──────────────────────────────────────────────────────────
  // NOUVEAU MOT DE PASSE
  // ──────────────────────────────────────────────────────────
  onResetPassword(form: NgForm): void {
    if (form.invalid) {
      form.form.markAllAsTouched();
      return;
    }

    if (this.resetData.newPassword !== this.resetData.confirmPassword) return;

    this.isLoading = true;

    this.authService.resetPassword({
      token: this.resetToken,
      newPassword: this.resetData.newPassword,
    }).subscribe({
      next: () => {
        this.isLoading = false;
        this.resetSuccess = true;
      },
      error: () => {
        this.isLoading = false;
        Swal.fire({
          icon: 'error',
          title: 'Lien expiré',
          text: 'Ce lien de réinitialisation est invalide ou expiré.',
          confirmButtonColor: '#2563eb',
        });
      },
    });
  }

  // ──────────────────────────────────────────────────────────
  // MODAL CONNEXION REQUISE (appelé depuis EspaceSaisonnier)
  // ──────────────────────────────────────────────────────────
  openLoginRequired(section: string): void {
    this.lockedSection = section;
    this.showLoginRequired = true;
  }

  closeLoginRequired(): void {
    this.showLoginRequired = false;
  }

  goToLogin(): void {
    this.closeLoginRequired();
    this.router.navigate(['/saisonnier/login']);
  }

  // ──────────────────────────────────────────────────────────
  // INDICATEUR FORCE MOT DE PASSE
  // ──────────────────────────────────────────────────────────
  get pwStrength(): number {
    const pw = this.resetData.newPassword;
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8)  score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  }

  get strengthLabel(): string {
    return ['', 'Faible', 'Moyen', 'Bon', 'Fort'][this.pwStrength];
  }

  get strengthClass(): string {
    return ['', 'weak', 'fair', 'good', 'strong'][this.pwStrength];
  }
}
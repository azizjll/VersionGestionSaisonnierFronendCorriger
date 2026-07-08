import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { SaisonniersListComponent } from './features/rh/pages/saisonniers-list/saisonniers-list.component';
import { SaisonnierAddComponent } from './features/rh/pages/saisonnier-add/saisonnier-add.component';
import { RhLayoutComponent } from './features/rh/layout/rh-layout/rh-layout.component';
import { HomeAdminComponent } from './features/admin/pages/home-admin/home-admin.component';
import { HomeGeneralComponent } from './pages/home-general/home-general.component';
import { EspacesaisonnierComponent } from './saisonnier/espacesaisonnier/espacesaisonnier.component';
import { DocumentsComponent } from './features/rh/pages/documents/documents.component';
import { PresencePaiementComponent } from './features/rh/pages/presence-paiement/presence-paiement.component';
import { RhGuard } from './security/rh.guard';
import { LoginSaisonnierComponent } from './features/saisonnier/login-saisonnier/login-saisonnier.component';
import { CampagneGuard } from './guards/campagne.guard';
import { CampagneExpireeComponent } from './pages/campagne-expiree/campagne-expiree.component';
import { IltizamComponent } from './pages/iltizam/iltizam.component';
import { RoleGuard } from './guards/role.guard';
import { LayoutSuperadminComponent } from './features/superadmin/layout-superadmin/layout-superadmin.component';
import { UsersListComponent } from './features/superadmin/users-list/users-list.component';
import { LayoutComponent } from './features/responsablestructure/layout/layout.component';
import { ListeSaisonnierComponent } from './features/responsablestructure/liste-saisonnier/liste-saisonnier.component';
import { DashboardSuperadminComponent } from './features/superadmin/dashboard-superadmin/dashboard-superadmin.component';

const routes: Routes = [

 {
  path: 'responsable',
  component: LayoutComponent,
  canActivate: [RoleGuard],
  data: { roles: ['RESPONSABLE_STRUCTURE'] },  // ✅ ajouter
  children: [
    { path: 'candidatures', component: ListeSaisonnierComponent },
    { path: '', redirectTo: 'candidatures', pathMatch: 'full' }
  ]
},

  { path: 'login', component: LoginComponent },

  


  {
    path: 'rhregioanl',
    component: RhLayoutComponent,canActivate: [RhGuard],
    children: [
      { path: 'saisonniers', component: SaisonniersListComponent },
      { path: 'saisonniers/add', component: SaisonnierAddComponent },
      { path: 'documents', component: DocumentsComponent },
      {path: 'Presence&paiement', component: PresencePaiementComponent},
      { path: '', redirectTo: 'saisonniers', pathMatch: 'full' }
    ]
  },
  {
  path: 'superadmin',
  component: LayoutSuperadminComponent,
  canActivate: [RoleGuard],
  data: { roles: ['SUPERADMIN'] },  // ✅
  children: [
    { path: 'user_list', component: UsersListComponent },
    { path: 'dashboard', component: DashboardSuperadminComponent }
  ]
},
  {path: 'home-ge', component: HomeGeneralComponent},

  { path: 'saisonnier/login', component: LoginSaisonnierComponent },
{ path: 'saisonnier/reset-password', component: LoginSaisonnierComponent },

  
  {
  path: 'admin',
  component: HomeAdminComponent,
  canActivate: [RoleGuard],
  data: { roles: ['ADMIN', 'SUPERADMIN'] }  // ← tableau
},

  {
  path: 'saisonnier/iltizam',
  component: IltizamComponent,
 
},
{
  path: 'espace-saisonnier/:code',
  component: EspacesaisonnierComponent,
  canActivate: [CampagneGuard]
},
 // ✅ Route sans code : utilisateur déjà authentifié (déclarée AVANT celle avec :code)
  {
    path: 'espace-saisonnier',
    component: EspacesaisonnierComponent
  },

 { path: 'campagne-expiree', component: CampagneExpireeComponent },

  { path: '', redirectTo: '/home-ge', pathMatch: 'full' }
  
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }

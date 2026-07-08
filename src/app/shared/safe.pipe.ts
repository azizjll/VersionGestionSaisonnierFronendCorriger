import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from 'src/environments/environment';

@Pipe({ name: 'safe' })
export class SafePipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(url: string): SafeResourceUrl | null {
    if (!url) return null;

    // ✅ Validation — URLs autorisées uniquement
    const urlAutorisee =
      url.startsWith('blob:') ||
      url.startsWith('/files/') ||
      url.startsWith(environment.apiUrl);

    if (!urlAutorisee) {
      console.warn('SafePipe: URL non autorisée bloquée :', url);
      return null;
    }

    // ✅ bypass justifié : URL validée contre l'origine du backend
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
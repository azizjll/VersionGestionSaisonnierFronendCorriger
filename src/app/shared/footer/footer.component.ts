import { Component, HostListener } from '@angular/core';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent {
  lastScrollTop = 0;
  isHidden = false;

  @HostListener('window:scroll', [])
  onScroll() {
    const currentScroll = window.scrollY;

    if (currentScroll > this.lastScrollTop && currentScroll > 50) {
      // scroll down → cacher footer
      this.isHidden = true;
    } else {
      // scroll up → montrer footer
      this.isHidden = false;
    }

    this.lastScrollTop = currentScroll;
  }
}
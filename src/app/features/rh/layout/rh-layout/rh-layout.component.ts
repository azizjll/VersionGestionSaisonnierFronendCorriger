import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-rh-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './rh-layout.component.html',
  styleUrls: ['./rh-layout.component.scss']
})
export class RhLayoutComponent {

}

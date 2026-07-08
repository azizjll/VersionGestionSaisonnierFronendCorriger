import { Component } from '@angular/core';

@Component({
  selector: 'app-saisonnier-add',
  templateUrl: './saisonnier-add.component.html',
  styleUrls: ['./saisonnier-add.component.scss']
})
export class SaisonnierAddComponent {

  showModal = false;
  closeModal() {
  this.showModal = false;
}

}

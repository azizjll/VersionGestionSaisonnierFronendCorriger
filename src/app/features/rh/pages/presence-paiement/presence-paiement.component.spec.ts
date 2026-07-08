import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PresencePaiementComponent } from './presence-paiement.component';

describe('PresencePaiementComponent', () => {
  let component: PresencePaiementComponent;
  let fixture: ComponentFixture<PresencePaiementComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PresencePaiementComponent]
    });
    fixture = TestBed.createComponent(PresencePaiementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

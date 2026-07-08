import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SaisonniersListComponent } from './saisonniers-list.component';

describe('SaisonniersListComponent', () => {
  let component: SaisonniersListComponent;
  let fixture: ComponentFixture<SaisonniersListComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [SaisonniersListComponent]
    });
    fixture = TestBed.createComponent(SaisonniersListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

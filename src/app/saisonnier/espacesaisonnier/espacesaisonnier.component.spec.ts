import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EspacesaisonnierComponent } from './espacesaisonnier.component';

describe('EspacesaisonnierComponent', () => {
  let component: EspacesaisonnierComponent;
  let fixture: ComponentFixture<EspacesaisonnierComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [EspacesaisonnierComponent]
    });
    fixture = TestBed.createComponent(EspacesaisonnierComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

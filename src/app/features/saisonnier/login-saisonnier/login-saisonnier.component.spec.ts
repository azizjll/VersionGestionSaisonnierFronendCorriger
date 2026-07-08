import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginSaisonnierComponent } from './login-saisonnier.component';

describe('LoginSaisonnierComponent', () => {
  let component: LoginSaisonnierComponent;
  let fixture: ComponentFixture<LoginSaisonnierComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [LoginSaisonnierComponent]
    });
    fixture = TestBed.createComponent(LoginSaisonnierComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

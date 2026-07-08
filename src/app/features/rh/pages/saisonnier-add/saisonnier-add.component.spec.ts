import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SaisonnierAddComponent } from './saisonnier-add.component';

describe('SaisonnierAddComponent', () => {
  let component: SaisonnierAddComponent;
  let fixture: ComponentFixture<SaisonnierAddComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [SaisonnierAddComponent]
    });
    fixture = TestBed.createComponent(SaisonnierAddComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

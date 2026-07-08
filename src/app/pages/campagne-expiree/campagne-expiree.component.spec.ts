import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CampagneExpireeComponent } from './campagne-expiree.component';

describe('CampagneExpireeComponent', () => {
  let component: CampagneExpireeComponent;
  let fixture: ComponentFixture<CampagneExpireeComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CampagneExpireeComponent]
    });
    fixture = TestBed.createComponent(CampagneExpireeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

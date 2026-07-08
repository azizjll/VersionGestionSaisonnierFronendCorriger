import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LayoutSuperadminComponent } from './layout-superadmin.component';

describe('LayoutSuperadminComponent', () => {
  let component: LayoutSuperadminComponent;
  let fixture: ComponentFixture<LayoutSuperadminComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [LayoutSuperadminComponent]
    });
    fixture = TestBed.createComponent(LayoutSuperadminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

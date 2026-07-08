import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IltizamComponent } from './iltizam.component';

describe('IltizamComponent', () => {
  let component: IltizamComponent;
  let fixture: ComponentFixture<IltizamComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [IltizamComponent]
    });
    fixture = TestBed.createComponent(IltizamComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

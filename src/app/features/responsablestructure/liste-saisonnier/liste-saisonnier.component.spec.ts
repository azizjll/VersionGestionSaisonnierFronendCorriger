import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListeSaisonnierComponent } from './liste-saisonnier.component';

describe('ListeSaisonnierComponent', () => {
  let component: ListeSaisonnierComponent;
  let fixture: ComponentFixture<ListeSaisonnierComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ListeSaisonnierComponent]
    });
    fixture = TestBed.createComponent(ListeSaisonnierComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

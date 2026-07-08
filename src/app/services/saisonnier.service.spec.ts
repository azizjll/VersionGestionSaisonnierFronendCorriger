import { TestBed } from '@angular/core/testing';

import { SaisonnierService } from './saisonnier.service';

describe('SaisonnierService', () => {
  let service: SaisonnierService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SaisonnierService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

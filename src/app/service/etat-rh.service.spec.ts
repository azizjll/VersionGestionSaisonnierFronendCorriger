import { TestBed } from '@angular/core/testing';

import { EtatRhService } from './etat-rh.service';

describe('EtatRhService', () => {
  let service: EtatRhService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EtatRhService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

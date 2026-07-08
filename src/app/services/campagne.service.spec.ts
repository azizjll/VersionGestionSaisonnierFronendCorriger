import { TestBed } from '@angular/core/testing';

import { CampagneService } from './campagne.service';

describe('CampagneService', () => {
  let service: CampagneService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CampagneService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

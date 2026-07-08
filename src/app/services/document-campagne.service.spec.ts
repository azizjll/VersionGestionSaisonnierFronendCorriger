import { TestBed } from '@angular/core/testing';

import { DocumentCampagneService } from './document-campagne.service';

describe('DocumentCampagneService', () => {
  let service: DocumentCampagneService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DocumentCampagneService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

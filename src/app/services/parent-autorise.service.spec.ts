import { TestBed } from '@angular/core/testing';

import { ParentAutoriseService } from './parent-autorise.service';

describe('ParentAutoriseService', () => {
  let service: ParentAutoriseService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ParentAutoriseService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

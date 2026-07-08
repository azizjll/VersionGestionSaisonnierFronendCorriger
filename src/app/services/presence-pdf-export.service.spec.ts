import { TestBed } from '@angular/core/testing';

import { PresencePdfExportService } from './presence-pdf-export.service';

describe('PresencePdfExportService', () => {
  let service: PresencePdfExportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PresencePdfExportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

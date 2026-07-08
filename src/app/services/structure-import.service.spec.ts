import { TestBed } from '@angular/core/testing';

import { StructureImportService } from './structure-import.service';

describe('StructureImportService', () => {
  let service: StructureImportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StructureImportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

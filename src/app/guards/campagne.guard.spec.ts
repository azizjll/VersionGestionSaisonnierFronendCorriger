import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { campagneGuard } from './campagne.guard';

describe('campagneGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => campagneGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});

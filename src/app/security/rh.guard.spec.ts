import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { rhGuard } from './rh.guard';

describe('rhGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => rhGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});

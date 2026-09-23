import { Service } from 'typedi';

import { AppDataSource } from '../data-source';
import type { HealthResponse } from '../types/health';

/** Liveness probe: reports whether the process is up and Mongo is reachable. */
@Service()
export class HealthService {
  check(): HealthResponse {
    return {
      status: 'ok',
      database: AppDataSource.isInitialized ? 'connected' : 'disconnected',
    };
  }
}

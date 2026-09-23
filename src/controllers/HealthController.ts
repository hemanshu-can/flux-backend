import { Controller, Get } from 'routing-controllers';
import { Service } from 'typedi';

import { HealthService } from '../services/HealthService';
import type { HealthResponse } from '../types/health';

/**
 * Health endpoint under /api/v1/health.
 *
 * GET /api/v1/health -> process and database status
 */
@Controller('/api/v1/health')
@Service()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check(): HealthResponse {
    return this.healthService.check();
  }
}

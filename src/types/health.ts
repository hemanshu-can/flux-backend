/**
 * Contract for the liveness endpoint on HealthController
 * (GET under /api/v1/health).
 */

/** Body of GET /api/v1/health. */
export interface HealthResponse {
  status: 'ok';
  database: 'connected' | 'disconnected';
}

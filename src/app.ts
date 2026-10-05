import 'reflect-metadata';
import express from 'express';
import { useContainer, useExpressServer } from 'routing-controllers';
import { Container } from 'typedi';
import { ChatbotController } from './controllers/ChatbotController';
import { CustomerController } from './controllers/CustomerController';
import { EmployeeController } from './controllers/EmployeeController';
import { HealthController } from './controllers/HealthController';
import { ItemController } from './controllers/ItemController';
import { OrderController } from './controllers/OrderController';
import { OutsourcingPartnerController } from './controllers/OutsourcingPartnerController';
import { QuotationController } from './controllers/QuotationController';

// Let routing-controllers resolve controller dependencies (e.g. ItemService) via the typedi container.
useContainer(Container);

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  useExpressServer(app, {
    controllers: [
      OrderController,
      EmployeeController,
      CustomerController,
      ItemController,
      QuotationController,
      OutsourcingPartnerController,
      HealthController,
      ChatbotController,
    ],
    defaultErrorHandler: true,
    // The flux frontend is served from a different origin (the Vite dev server on
    // :5173) and the client sends no credentials or cookies, so every origin is
    // allowed. Narrow this to an explicit allowlist before exposing the backend
    // outside local development.
    cors: { origin: '*' },
    development: process.env.NODE_ENV === 'development',
  });

  return app;
}

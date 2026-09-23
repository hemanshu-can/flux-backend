import 'reflect-metadata';
import 'dotenv/config';

import { AppDataSource } from './src/data-source';
import { createApp } from './src/app';

const port = Number(process.env.PORT) || 3000;

async function bootstrap(): Promise<void> {
  try {
    await AppDataSource.initialize();
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error(`Failed to connect to MongoDB: ${(error as Error).message}`);
    process.exit(1);
  }

  createApp().listen(port, () => {
    console.log(`Flux backend listening on http://localhost:${port}`);
  });
}

void bootstrap();

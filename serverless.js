import { Handler } from 'aws-lambda';
import serverlessExpress from '@vendia/serverless-express';
import { createApp } from './main';

let server: Handler;

async function bootstrap() {
  const app = await createApp();
  await app.init();
  return serverlessExpress({ app: app.getHttpAdapter().getInstance() });
}

export const handler: Handler = async (event, context) => {
  server = server ?? (await bootstrap());
  return server(event, context);
};

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: 'http://localhost:3000', // frontend URL
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // if you are sending cookies or auth headers
  });
  // enable class-validator globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips properties not in DTO
      forbidNonWhitelisted: true, // throws error on unknown props
      transform: true, // transforms payloads to DTO instances
    }),
  );
  await app.listen(process.env.PORT ?? 8080);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();

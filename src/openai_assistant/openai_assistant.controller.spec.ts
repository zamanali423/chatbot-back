import { Test, TestingModule } from '@nestjs/testing';
import { OpenaiAssistantController } from './openai_assistant.controller';

describe('OpenaiAssistantController', () => {
  let controller: OpenaiAssistantController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OpenaiAssistantController],
    }).compile();

    controller = module.get<OpenaiAssistantController>(OpenaiAssistantController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

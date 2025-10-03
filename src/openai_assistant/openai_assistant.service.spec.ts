import { Test, TestingModule } from '@nestjs/testing';
import { OpenaiAssistantService } from './openai_assistant.service';

describe('OpenaiAssistantService', () => {
  let service: OpenaiAssistantService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OpenaiAssistantService],
    }).compile();

    service = module.get<OpenaiAssistantService>(OpenaiAssistantService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

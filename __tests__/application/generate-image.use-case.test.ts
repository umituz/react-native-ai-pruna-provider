/**
 * Generate Image Use Case Tests
 * Application service tests with mocks
 */

import { GenerateImageUseCase } from '../../src/application/use-cases/generate-image.use-case';

// Mock infrastructure
jest.mock('../../src/infrastructure/api/http-client');
jest.mock('../../src/infrastructure/logging/pruna-logger');

describe('GenerateImageUseCase', () => {
  let useCase: GenerateImageUseCase;

  beforeEach(() => {
    useCase = new GenerateImageUseCase();
  });

  it('should generate image successfully', async () => {
    const mockHttpClient = {
      request: jest.fn().mockResolvedValue({
        data: { generation_url: 'https://example.com/image.jpg' },
        status: 200,
        statusText: 'OK',
      }),
    };

    // Mock http client
    jest.doMock('../../src/infrastructure/api/http-client', () => ({
      httpClient: mockHttpClient,
    }));

    const result = await useCase.execute(
      {
        prompt: 'A beautiful sunset',
        aspectRatio: '16:9',
      },
      'test-api-key'
    );

    expect(result.imageUrl).toBe('https://example.com/image.jpg');
    expect(result.requestId).toBeDefined();
  });

  it('should validate prompt before generation', async () => {
    await expect(
      useCase.execute(
        {
          prompt: '',
        },
        'test-api-key'
      )
    ).rejects.toThrow('Validation failed');
  });

  it('should handle API errors', async () => {
    const mockHttpClient = {
      request: jest.fn().mockRejectedValue(new Error('API Error')),
    };

    jest.doMock('../../src/infrastructure/api/http-client', () => ({
      httpClient: mockHttpClient,
    }));

    await expect(
      useCase.execute(
        {
          prompt: 'Test',
        },
        'test-api-key'
      )
    ).rejects.toThrow('API Error');
  });
});

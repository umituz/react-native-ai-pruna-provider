/**
 * Validation Service Tests
 * Domain service tests are simple and focused
 */

import { ValidationService } from '../../src/domain/services/validation.domain-service';

describe('ValidationService', () => {
  describe('validatePrompt', () => {
    it('should accept valid prompt', () => {
      const result = ValidationService.validatePrompt('A beautiful sunset');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty prompt', () => {
      const result = ValidationService.validatePrompt('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject non-string prompt', () => {
      const result = ValidationService.validatePrompt(123);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('string');
    });

    it('should reject too long prompt', () => {
      const longPrompt = 'x'.repeat(2001);
      const result = ValidationService.validatePrompt(longPrompt);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('2000');
    });
  });

  describe('validateApiKey', () => {
    it('should accept valid API key', () => {
      const result = ValidationService.validateApiKey('valid-api-key-123');
      expect(result.isValid).toBe(true);
    });

    it('should reject short API key', () => {
      const result = ValidationService.validateApiKey('short');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('10 characters');
    });
  });

  describe('validateModel', () => {
    it('should accept valid model', () => {
      const result = ValidationService.validateModel('p-image');
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid model', () => {
      const result = ValidationService.validateModel('invalid-model');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateTimeout', () => {
    it('should accept valid timeout', () => {
      const result = ValidationService.validateTimeout(30000, 3600000);
      expect(result.isValid).toBe(true);
    });

    it('should reject negative timeout', () => {
      const result = ValidationService.validateTimeout(-1000, 3600000);
      expect(result.isValid).toBe(false);
    });

    it('should reject timeout exceeding max', () => {
      const result = ValidationService.validateTimeout(4000000, 3600000);
      expect(result.isValid).toBe(false);
    });
  });
});

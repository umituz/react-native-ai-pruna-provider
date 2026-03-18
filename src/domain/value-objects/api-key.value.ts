/**
 * ApiKey Value Object
 * Encapsulates API key validation and storage
 */

export class ApiKey {
  private static readonly MIN_LENGTH = 10;

  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(value: string): ApiKey {
    if (!value || value.trim().length < ApiKey.MIN_LENGTH) {
      throw new Error(`API key must be at least ${ApiKey.MIN_LENGTH} characters`);
    }
    return new ApiKey(value.trim());
  }

  toString(): string {
    return this.value;
  }

  mask(): string {
    if (this.value.length <= 8) return '********';
    return `${this.value.substring(0, 4)}...${this.value.substring(this.value.length - 4)}`;
  }
}

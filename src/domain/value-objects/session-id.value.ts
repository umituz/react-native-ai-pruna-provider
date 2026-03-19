/**
 * SessionId Value Object
 * Represents a unique session identifier for logging
 */

export class SessionId {
  private static counter = 0;

  private readonly value: string;

  constructor() {
    this.value = `session_${++SessionId.counter}_${Date.now()}`;
  }

  toString(): string {
    return this.value;
  }
}

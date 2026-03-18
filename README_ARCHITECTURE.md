# Pruna AI Provider - Architecture Documentation

## Overview

This package implements a **Domain-Driven Design (DDD)** architecture for Pruna AI integration in React Native applications. The codebase is organized into four distinct layers with clear separation of concerns.

## Architecture Layers

### 1. Domain Layer
**Purpose**: Business logic and enterprise rules

```typescript
domain/
├── value-objects/        # Immutable values with validation
│   ├── session-id.value.ts
│   ├── api-key.value.ts
│   └── model-id.value.ts
├── services/            # Domain business logic
│   ├── validation.domain-service.ts
│   └── error-mapper.domain-service.ts
└── repositories/        # Repository interfaces
```

**Key Principles**:
- No dependencies on outer layers
- Contains only business logic
- Framework-independent
- Testable in isolation

### 2. Application Layer
**Purpose**: Use case orchestration

```typescript
application/
├── use-cases/          # Business operations
│   ├── generate-image.use-case.ts
│   ├── generate-video.use-case.ts
│   └── generate-image-edit.use-case.ts
├── services/           # Application services
│   └── pruna-service.ts
└── dto/               # Data transfer objects
    └── pruna.dto.ts
```

**Key Principles**:
- Orchestrates domain objects
- Implements business workflows
- Transaction management
- Caching strategies

### 3. Infrastructure Layer
**Purpose**: External concerns and technical details

```typescript
infrastructure/
├── api/               # HTTP clients
│   └── http-client.ts
├── logging/           # Logging implementation
│   └── pruna-logger.ts
└── storage/           # File storage
    └── file-storage.ts
```

**Key Principles**:
- Implements interfaces defined in domain
- Handles external APIs
- Manages persistence
- Provides technical services

### 4. Presentation Layer
**Purpose**: UI integration and user interaction

```typescript
presentation/
└── hooks/            # React hooks
    └── use-pruna-generation.new.ts
```

**Key Principles**:
- Thin layer, minimal logic
- State management
- UI event handling
- User experience

## Design Patterns Used

### 1. Value Objects
Immutable objects that represent domain concepts:

```typescript
const apiKey = ApiKey.create('your-key');
const modelId = ModelId.create('p-image');
const sessionId = new SessionId();
```

### 2. Use Case Pattern
Encapsulates business operations:

```typescript
const result = await generateImageUseCase.execute(input, apiKey);
```

### 3. Domain Service Pattern
Stateless services that operate on domain objects:

```typescript
const validation = ValidationService.validatePrompt(prompt);
```

### 4. Repository Pattern
Abstracts data access (defined in domain, implemented in infrastructure):

```typescript
interface PrunaRepository {
  generateImage(input: ImageInput): Promise<ImageResult>;
}
```

### 5. Dependency Injection
Dependencies are injected, not hardcoded:

```typescript
class GenerateImageUseCase {
  constructor(
    private repository: PrunaRepository,
    private logger: PrunaLogger
  ) {}
}
```

## Key Benefits

### 1. Maintainability
- Small files (max 150 lines)
- Single responsibility per class
- Clear separation of concerns
- Easy to locate code

### 2. Testability
- Domain logic tested without external dependencies
- Use cases tested with mocked infrastructure
- Fast unit tests
- High test coverage possible

### 3. Flexibility
- Easy to swap implementations
- Add features without modifying existing code
- Change infrastructure without affecting domain
- Multiple UI frameworks supported

### 4. Scalability
- Add new use cases without touching existing ones
- Extend domain with new value objects
- Integrate with multiple backends
- Support multiple clients

## File Size Constraints

Every file is limited to **150 lines maximum**:

- Forces single responsibility
- Improves code navigation
- Reduces merge conflicts
- Eases code review

## Error Handling Strategy

### Domain Layer
```typescript
// ErrorMapperService maps raw errors to domain errors
const domainError = ErrorMapperService.mapError(rawError);
if (domainError.retryable) {
  // Retry logic
}
```

### Application Layer
```typescript
try {
  return await useCase.execute(input);
} catch (error) {
  // Domain error already mapped
  throw error;
}
```

### Presentation Layer
```typescript
catch (error) {
  setState({
    error: mapToUiError(error),
    status: 'error'
  });
}
```

## Logging Strategy

### Centralized Logger
```typescript
const sessionId = logger.createSession();
logger.info(sessionId, 'tag', 'message', { data });
logger.endSession(sessionId);
```

### Automatic Context
- Session-scoped logging
- Automatic elapsed time tracking
- DEV mode console output
- Production-ready structured logs

## Data Flow

### Image Generation Flow

```
User Input (UI)
    ↓
usePrunaGeneration Hook
    ↓
PrunaService (Application)
    ↓
GenerateImageUseCase
    ↓
ValidationService (Domain)
    ↓
HttpClient (Infrastructure)
    ↓
Pruna API
    ↓
Response → Transform → UI
```

## Best Practices

### 1. Always Use Value Objects
```typescript
// ❌ Bad
function generate(model: string, apiKey: string) { }

// ✅ Good
function generate(model: ModelId, apiKey: ApiKey) { }
```

### 2. Validate Early
```typescript
// In use case
const validation = ValidationService.validatePrompt(input.prompt);
if (!validation.isValid) {
  throw new Error(validation.error);
}
```

### 3. Use Dependency Injection
```typescript
// ❌ Bad
import { httpClient } from './http-client';

// ✅ Good
class UseCase {
  constructor(private http: HttpClient) {}
}
```

### 4. Keep Files Small
```typescript
// ❌ Bad - 500 lines
class PrunaProvider {
  // 20 methods...
}

// ✅ Good - multiple focused files
// pruna-provider.ts (50 lines)
// generate-image.use-case.ts (80 lines)
// generate-video.use-case.ts (85 lines)
```

## Performance Considerations

### 1. Singleton Pattern
Infrastructure services use singletons:
```typescript
export const httpClient = new HttpClient();
export const logger = PrunaLogger.getInstance();
```

### 2. Lazy Initialization
Use cases instantiated on demand:
```typescript
export const generateImageUseCase = new GenerateImageUseCase();
```

### 3. Parallel Operations
File uploads in parallel:
```typescript
const urls = await Promise.all(
  images.map(img => fileStorageService.uploadFile(img, apiKey, sessionId))
);
```

## Migration Path

### Phase 1: Add New Architecture
- Keep old code
- Add new domain layer
- Add new application layer

### Phase 2: Refactor Infrastructure
- Implement new HTTP client
- Implement new logger
- Update storage service

### Phase 3: Migrate Use Cases
- Create new use cases
- Test thoroughly
- Keep old API for compatibility

### Phase 4: Update UI
- Refactor hooks
- Update components
- Deprecate old API

### Phase 5: Clean Up
- Remove old code
- Update documentation
- Final migration guide

## Conclusion

This DDD architecture provides:
- **Clean Code**: Small, focused files
- **No Duplication**: DRY principle applied
- **Easy Testing**: Unit tests for all layers
- **Type Safety**: Full TypeScript support
- **Performance**: Optimized for production
- **Scalability**: Ready for growth
- **Maintainability**: Easy to understand and modify

Perfect for long-term projects with changing requirements and multiple team members.

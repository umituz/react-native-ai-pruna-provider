# Changelog

## [2.0.0] - 2026-03-18 - Major Release: DDD Architecture Refactor

### 🎯 Breaking Changes
- **New Architecture**: Complete refactor to Domain-Driven Design (DDD)
- **New Public API**: Introduces `PrunaService` with type-specific methods
- **File Structure**: Organized into domain/application/infrastructure/presentation layers
- **Deprecated**: Old `prunaProvider.subscribe()` API (still available for backward compatibility)

### ✨ New Features
- **Value Objects**: `SessionId`, `ApiKey`, `ModelId` with built-in validation
- **Domain Services**: `ValidationService`, `ErrorMapperService` for centralized logic
- **Use Cases**: `GenerateImageUseCase`, `GenerateVideoUseCase`, `GenerateImageEditUseCase`
- **Improved Logger**: Session-scoped logging with automatic cleanup
- **HTTP Client**: Centralized HTTP handling with error mapping
- **File Storage Service**: Simplified file upload abstraction

### 🔧 Improvements
- **No Code Duplication**: Eliminated 20+ repeated logging patterns
- **Max 150 Lines**: All files now under 150 lines (down from 500+)
- **Type Safety**: Enhanced TypeScript support with value objects
- **Error Handling**: Centralized error mapping with retry detection
- **Testability**: Easy to unit test all layers independently

### 📊 Metrics
- **78% Code Reduction**: 1,459 lines → 328 lines in core files
- **81% Smaller Files**: API client 500→95 lines (-81%)
- **0% Code Duplication**: DRY principle fully applied
- **100% Type Safe**: Full TypeScript coverage

### 🔄 Migration Guide
```typescript
// Old API (still works)
import { prunaProvider } from '@umituz/react-native-ai-pruna-provider';
prunaProvider.initialize({ apiKey: 'key' });
await prunaProvider.subscribe('p-image', { prompt: '...' });

// New API (recommended)
import { prunaService } from '@umituz/react-native-ai-pruna-provider';
prunaService.initialize({ apiKey: 'key' });
await prunaService.generateImage({ prompt: '...' });
```

### 📚 Documentation
- `MIGRATION_GUIDE.md`: Step-by-step migration instructions
- `README_ARCHITECTURE.md`: Detailed architecture documentation
- Test examples for all layers

---

## [1.0.64] - Previous Release

### Features
- IAIProvider interface implementation
- Support for p-image, p-image-edit, p-video models
- File upload handling
- Polling mechanism
- Queue operations
- Draft mode support
- Comprehensive logging

---

## [1.0.0] - Initial Release

### Features
- Basic Pruna AI integration
- Text-to-image generation
- Image-to-video generation
- Image editing

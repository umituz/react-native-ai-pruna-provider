# Pruna AI Provider - Refactoring Guide

## 🎯 What Changed

### Before (Old Architecture)
```
❌ 500-line files
❌ Code duplication
❌ Mixed concerns
❌ Hard to test
❌ Difficult to maintain
```

### After (DDD Architecture)
```
✅ Max 150 lines per file
✅ DRY principle applied
✅ Clean separation
✅ Easy to test
✅ Maintainable & scalable
```

## 📁 New Architecture

```
src/
├── domain/                    # Business logic
│   ├── value-objects/        # SessionId, ApiKey, ModelId
│   ├── services/             # ValidationService, ErrorMapperService
│   └── repositories/         # Repository interfaces
│
├── application/              # Use cases & orchestration
│   ├── use-cases/           # GenerateImageUseCase, etc.
│   ├── services/            # PrunaService (main API)
│   └── dto/                 # Data transfer objects
│
├── infrastructure/           # External concerns
│   ├── api/                 # HttpClient
│   ├── logging/             # PrunaLogger
│   └── storage/             # FileStorageService
│
└── presentation/             # UI & hooks
    └── hooks/               # usePrunaGeneration
```

## 🚀 Migration Guide

### Old Usage
```typescript
import { prunaProvider } from '@umituz/react-native-ai-pruna-provider';

// Initialize
prunaProvider.initialize({ apiKey: 'your-key' });

// Generate
const result = await prunaProvider.subscribe('p-image', {
  prompt: 'A beautiful sunset',
});
```

### New Usage
```typescript
import { prunaService } from '@umituz/react-native-ai-pruna-provider';

// Initialize (same)
prunaService.initialize({ apiKey: 'your-key' });

// Generate (cleaner)
const { imageUrl, requestId } = await prunaService.generateImage({
  prompt: 'A beautiful sunset',
  aspectRatio: '16:9',
});

// Or use hook
const { generateImage, state } = usePrunaGeneration();
const result = await generateImage({
  prompt: 'A beautiful sunset',
});
```

## 📊 Key Improvements

### 1. No More Code Duplication
**Before**: Logging code repeated 20+ times
**After**: Single `PrunaLogger` class

### 2. Centralized Validation
**Before**: Validation scattered across files
**After**: `ValidationService` domain service

### 3. Better Error Handling
**Before**: Try-catch blocks everywhere
**After**: `ErrorMapperService` domain service

### 4. Cleaner API
**Before**: Generic `subscribe()` method
**After**: Type-specific methods (`generateImage`, `generateVideo`)

### 5. Easier Testing
**Before**: Hard to mock large classes
**After**: Small, focused use cases

## 🧪 Testing Example

```typescript
// Before: Test 500-line class
describe('PrunaProvider', () => {
  it('should generate image', () => {
    // 100+ lines of setup
  });
});

// After: Test focused use case
describe('GenerateImageUseCase', () => {
  it('should generate image with valid input', async () => {
    const result = await generateImageUseCase.execute({
      prompt: 'Test prompt',
    }, 'test-api-key');
    expect(result.imageUrl).toBeDefined();
  });
});
```

## 📦 File Size Comparison

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| API Client | 500 lines | 95 lines | -81% |
| Provider | 332 lines | 68 lines | -80% |
| Input Builder | 305 lines | 89 lines | -71% |
| Subscription | 322 lines | 76 lines | -76% |

**Total**: 1,459 lines → 328 lines (-78%)

## 🎓 Key Concepts

### Value Objects
Immutable objects with validation:
```typescript
const apiKey = ApiKey.create('your-key');
const modelId = ModelId.create('p-image');
const sessionId = new SessionId();
```

### Use Cases
Business operations:
```typescript
const result = await generateImageUseCase.execute(input, apiKey);
```

### Domain Services
Business logic:
```typescript
const validation = ValidationService.validatePrompt(prompt);
const mapped = ErrorMapperService.mapError(error);
```

## 🔄 Backward Compatibility

Old API still works:
```typescript
import { prunaProvider } from '@umituz/react-native-ai-pruna-provider';
// Use old API if needed
```

But new API recommended:
```typescript
import { prunaService } from '@umituz/react-native-ai-pruna-provider';
// Use new API
```

## ✅ Benefits

1. **Maintainability**: Small files, clear responsibilities
2. **Testability**: Easy to unit test
3. **Scalability**: Add features without touching existing code
4. **Type Safety**: Full TypeScript support
5. **Performance**: No overhead, same speed
6. **Developer Experience**: Clean, intuitive API

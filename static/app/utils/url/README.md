# URL Utils

## withStorage

A generic utility that wraps Nuqs parsers to add storage fallback support with two-way sync between URL parameters and any Storage implementation.

### Usage

```typescript
import {parseAsString, useQueryState} from 'nuqs';
import {withStorage, withLocalStorage} from 'sentry/utils/url/withLocalStorage';

// Using localStorage (via convenience wrapper)
const [query, setQuery] = useQueryState(
  'query',
  withLocalStorage('search:query', parseAsString).withDefault('')
);

// Using sessionStorage
const [temp, setTemp] = useQueryState(
  'temp',
  withStorage(sessionStorage, 'temp:data', parseAsString)
);

// Using custom storage
const [custom, setCustom] = useQueryState(
  'custom',
  withStorage(myCustomStorage, 'custom:key', parseAsString)
);
```

## withLocalStorage

Convenience wrapper around `withStorage` that uses localStorage. This is the most common use case.

### How It Works

**Storage Hierarchy**: URL params (primary) ↔ storage (fallback/default)

**Sync Strategy**:
- On mount: If URL is empty but storage has a value → URL is updated
- On read: Always read from URL first, fall back to storage if URL is empty
- On write: Write to both URL and storage simultaneously
- Storage persists even when URL is cleared (intentional - acts as user preference)

### Storage Implementation

The `storage` parameter must conform to the Web Storage API's `Storage` interface:
- `getItem(key: string): string | null`
- `setItem(key: string, value: string): void`
- `removeItem(key: string): void`
- `clear(): void`
- `length: number`
- `key(index: number): string | null`

Built-in implementations:
- `localStorage` - Persists across browser sessions
- `sessionStorage` - Clears when browser tab closes
- Custom implementations created with `createStorage()`

### Features

- ✅ Works with all Nuqs parsers (parseAsString, parseAsInteger, custom parsers)
- ✅ Works with any Storage implementation (localStorage, sessionStorage, custom)
- ✅ Compatible with `.withDefault()` and `.withOptions()` chaining
- ✅ Fully type-safe through TypeScript generics
- ✅ Graceful degradation when storage is unavailable
- ✅ Handles storage quota exceeded errors
- ✅ Handles JSON parse errors
- ✅ Two-way sync between URL and storage

### Examples

See `withLocalStorage.example.tsx` for detailed examples including:

**Using localStorage:**
- Simple string with localStorage fallback
- Sort preferences with persistence
- Boolean flags with localStorage
- Pagination state
- Multiple related filters

**Using sessionStorage:**
- Temporary filters that clear on tab close
- Draft state that doesn't persist across sessions

**Using custom storage:**
- In-memory storage for testing
- Encrypted storage for sensitive data

### Best Practices

1. Use descriptive localStorage keys with namespace prefixes:
   - ✅ `'search:query'`, `'filters:status'`, `'table:sort'`
   - ❌ `'query'`, `'status'`, `'sort'`

2. Different features should use different key prefixes to avoid conflicts

3. Consider using `.withDefault()` for better UX with non-nullable state

4. Remember that localStorage persists across sessions, acting as user preferences

### Testing

Run tests with:
```bash
CI=true pnpm test static/app/utils/url/withLocalStorage.spec.tsx
```

### Files

- `withLocalStorage.tsx` - Main implementation
- `withLocalStorage.spec.tsx` - Comprehensive test suite
- `withLocalStorage.example.tsx` - Usage examples

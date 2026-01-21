# URL Utils

## withLocalStorage

A utility that wraps Nuqs parsers to add localStorage fallback support with two-way sync between URL parameters and localStorage.

### Usage

```typescript
import {parseAsString, useQueryState} from 'nuqs';
import {withLocalStorage} from 'sentry/utils/url/withLocalStorage';

const [query, setQuery] = useQueryState(
  'query',
  withLocalStorage('search:query', parseAsString).withDefault('')
);
```

### How It Works

**Storage Hierarchy**: URL params (primary) ↔ localStorage (fallback/default)

**Sync Strategy**:
- On mount: If URL is empty but localStorage has a value → URL is updated
- On read: Always read from URL first, fall back to localStorage if URL is empty
- On write: Write to both URL and localStorage simultaneously
- localStorage persists even when URL is cleared (intentional - acts as user preference)

### Features

- ✅ Works with all Nuqs parsers (parseAsString, parseAsInteger, custom parsers)
- ✅ Compatible with `.withDefault()` and `.withOptions()` chaining
- ✅ Fully type-safe through TypeScript generics
- ✅ Graceful degradation when localStorage is unavailable
- ✅ Handles localStorage quota exceeded errors
- ✅ Handles JSON parse errors
- ✅ Two-way sync between URL and localStorage

### Examples

See `withLocalStorage.example.tsx` for detailed examples including:
- Simple string with localStorage fallback
- Sort preferences with persistence
- Boolean flags with localStorage
- Pagination state
- Multiple related filters

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

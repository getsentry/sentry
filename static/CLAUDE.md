# Sentry Frontend Development Guide for Claude

## Frontend Tech Stack

- **Language**: TypeScript
- **Framework**: React 19
- **Build Tool**: Rspack (Webpack alternative)
- **State Management**: Reflux, React Query (TanStack Query)
- **Styling**: Emotion (CSS-in-JS), Less
- **Testing**: Jest, React Testing Library

## Frontend Project Structure

```
static/
├── app/              # React application
│   ├── components/   # Reusable React components
│   ├── views/        # Page components
│   ├── stores/       # State management
│   └── utils/        # Utility functions
└── fonts/            # Font files
```

## Key Commands

### Development Setup

```bash
# Start the development server
pnpm run dev

# Start only the UI development server with hot reload
pnpm run dev-ui
```

### Testing

```bash
# Run JavaScript tests
pnpm test

# Run specific test file(s)
CI=true pnpm test components/avatar.spec.tsx [...other files]
```

### Code Quality

```bash
# JavaScript/TypeScript linting
pnpm run lint:js

# Linting for specific file(s)
pnpm run lint:js components/avatar.tsx [...other files]

# Fix linting issues
pnpm run fix
```

## AI Assistant Quick Decision Trees

### "User wants to modify frontend component"

1. Component location: `static/app/components/` (reusable) or `static/app/views/` (page-specific)
2. ALWAYS use TypeScript
3. ALWAYS write test in same directory with `.spec.tsx`
4. Style with Emotion, NOT inline styles or CSS files
5. State: Use hooks (`useState`), NOT Reflux for new code

## Critical Patterns (Copy-Paste Ready)

### React Component Pattern

```tsx
// static/app/components/myComponent.tsx
import {useState} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

interface MyComponentProps {
  title: string;
  onSubmit: (value: string) => void;
}

function MyComponent({title, onSubmit}: MyComponentProps) {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    onSubmit(value);
  };

  return (
    <Container>
      <Title>{title}</Title>
      <Input value={value} onChange={e => setValue(e.target.value)} />
      <Button onClick={handleSubmit}>Submit</Button>
    </Container>
  );
}

const Container = styled('div')`
  padding: ${space(2)};
`;

const Title = styled('h2')`
  margin-bottom: ${space(1)};
`;

export default MyComponent;
```

## Frontend Development

### Component Guidelines

1. Use TypeScript for all new components
2. Place components in `static/app/components/`
3. Use Emotion for styling
4. Write tests alongside components (`.spec.tsx` files)
5. Use React hooks for state management

### Routing

- Routes defined in `static/app/routes.tsx`
- Use React Router v6 patterns
- Lazy load route components when possible

### Frontend Rules

1. NO new Reflux stores
2. NO class components
3. NO CSS files (use Emotion)
4. ALWAYS use TypeScript
5. ALWAYS colocate tests
6. Lazy load routes: `React.lazy(() => import('...'))`

## Testing Best Practices

### JavaScript Tests

- Use React Testing Library
- Mock API calls with MSW or jest mocks
- Test user interactions, not implementation
- Snapshot testing for complex UI

## Common Patterns

### Frontend API Calls

```typescript
import {Client} from 'sentry/api';

const api = new Client();
const data = await api.requestPromise('/organizations/');
```

## Anti-Patterns (NEVER DO)

### Frontend

```tsx
import {Client, Client} from 'sentry/api';

// WRONG: Class component
class MyComponent extends React.Component {} // NO!

// RIGHT: Function component
function MyComponent() {}

// WRONG: Direct API call
fetch('/api/0/organizations/'); // NO!

// RIGHT: Use API client
const api = new Client();
api.requestPromise('/organizations/');

// WRONG: Inline styles
<div style={{padding: 16}} />; // NO!

// RIGHT: Emotion styled
const Container = styled('div')`
  padding: ${space(2)};
`;
```

## Debugging Tips

5. Frontend debugging: React DevTools

## Important Configuration Files

- `package.json`: Node.js dependencies and scripts
- `rspack.config.ts`: Frontend build configuration
- `tsconfig.json`: TypeScript configuration
- `eslint.config.mjs`: ESLint configuration
- `stylelint.config.js`: CSS/styling linting

## File Location Map

### Frontend

- **Components**: `static/app/components/{component}/`
- **Views**: `static/app/views/{area}/{page}.tsx`
- **Stores**: `static/app/stores/{store}Store.tsx`
- **Actions**: `static/app/actionCreators/{resource}.tsx`
- **Utils**: `static/app/utils/{utility}.tsx`
- **Types**: `static/app/types/{area}.tsx`
- **API Client**: `static/app/api.tsx`

### Tests

- **JavaScript**: Same directory as component with `.spec.tsx`

## Common Gotchas

5. **Frontend**: Component names must be unique globally

## Notes for AI Assistants

- Frontend uses a mix of modern React and some legacy patterns
- Follow the anti-patterns section to avoid common mistakes

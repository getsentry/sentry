# Sentry Frontend Development Guide for Claude

## Overview

This guide contains frontend-specific development rules and patterns for the Sentry React application. The main Sentry frontend is a TypeScript React application built with modern tools and patterns.

## Tech Stack

- **Language**: TypeScript
- **Framework**: React 19
- **Build Tool**: Rspack (Webpack alternative)
- **State Management**: Reflux, React Query (TanStack Query)
- **Styling**: Emotion (CSS-in-JS), Less
- **Testing**: Jest, React Testing Library
- **Package Manager**: pnpm
- **Node Version**: 22 (managed by Volta)

## Project Structure

```
static/
├── app/              # React application
    ├── components/   # Reusable React components
    ├── views/        # Page components
    ├── stores/       # State management
    ├── utils/        # Utility functions
    ├── types/        # TypeScript type definitions
    └── api.tsx       # API client
```

## Key Commands

### Development

```bash
# Start the development server
pnpm run dev

# Start only the UI development server with hot reload
pnpm run dev-ui

# Run JavaScript tests
pnpm test

# Run specific test file
CI=true pnpm test components/avatar.spec.tsx

# JavaScript/TypeScript linting
pnpm run lint:js

# Fix linting issues
pnpm run fix
```

## AI Assistant Decision Tree

### "User wants to modify frontend component"

1. Component location: `static/app/components/` (reusable) or `static/app/views/` (page-specific)
2. ALWAYS use TypeScript
3. ALWAYS write test in same directory with `.spec.tsx`
4. Style with Emotion, NOT inline styles or CSS files
5. State: Use hooks (`useState`), NOT Reflux for new code

## Critical Patterns (Copy-Paste Ready)

### React Component Pattern

```typescript
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

```typescript
// WRONG: Class component
class MyComponent extends React.Component  // NO!

// RIGHT: Function component
function MyComponent() {}

// WRONG: Direct API call
fetch('/api/0/organizations/')  // NO!

// RIGHT: Use API client
import {Client} from 'sentry/api';
const api = new Client();
api.requestPromise('/organizations/');

// WRONG: Inline styles
<div style={{padding: 16}}>  // NO!

// RIGHT: Emotion styled
const Container = styled('div')`
  padding: ${space(2)};
`;
```

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

## Important Configuration Files

- `package.json`: Node.js dependencies and scripts
- `rspack.config.ts`: Frontend build configuration
- `tsconfig.json`: TypeScript configuration
- `eslint.config.mjs`: ESLint configuration
- `stylelint.config.js`: CSS/styling linting

## Common Gotchas

1. **Frontend**: Component names must be unique globally
2. **Tests**: Use React Testing Library, not Enzyme
3. **Styling**: Use Emotion, never inline styles or CSS files
4. **State**: Use React hooks, not Reflux for new components
5. **Routing**: Lazy load components for better performance

## Debugging Tips

1. Use React DevTools for component debugging
2. Check browser console for TypeScript errors
3. Use `pnpm run lint:js` to catch linting issues
4. Run `pnpm test` for component test failures

## Performance Considerations

1. Lazy load route components: `React.lazy(() => import('...'))`
2. Use React.memo for expensive components
3. Implement proper loading states
4. Optimize bundle size with code splitting
5. Use React Query for efficient API state management

## Notes for AI Assistants

- Always use TypeScript for new components
- Follow the component pattern shown above
- Place tests in the same directory as components
- Use Emotion for all styling needs
- Prefer function components with hooks over class components
- Component names must be unique across the entire application
- Always colocate tests with components using `.spec.tsx` extension

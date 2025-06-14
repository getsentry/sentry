# Sentry Development Guide for Claude

## Overview

Sentry is a developer-first error tracking and performance monitoring platform. This repository contains the main Sentry application, which is a large-scale Django application with a React frontend.

## Tech Stack

### Backend

- **Language**: Python 3.13+
- **Framework**: Django 5.2+
- **API**: Django REST Framework with drf-spectacular for OpenAPI docs
- **Task Queue**: Celery 5.5.2
- **Databases**: PostgreSQL (primary), Redis, ClickHouse (via Snuba)
- **Message Queue**: Kafka, RabbitMQ
- **Cloud Services**: Google Cloud Platform (Bigtable, Pub/Sub, Storage, KMS)

### Frontend

- **Language**: TypeScript
- **Framework**: React 19.1.0
- **Build Tool**: Rspack (Webpack alternative)
- **State Management**: Reflux, React Query (TanStack Query)
- **Styling**: Emotion (CSS-in-JS), Less
- **Testing**: Jest, React Testing Library

### Infrastructure

- **Container**: Docker (via devservices)
- **Package Management**: pnpm (Node.js), pip (Python)
- **Node Version**: 22.11.0 (managed by Volta)

## Project Structure

```
sentry/
├── src/
│   ├── sentry/           # Main Django application
│   │   ├── api/          # REST API endpoints
│   │   ├── models/       # Django models
│   │   ├── tasks/        # Celery tasks
│   │   ├── integrations/ # Third-party integrations
│   │   ├── issues/       # Issue tracking logic
│   │   └── web/          # Web views and middleware
│   ├── sentry_plugins/   # Plugin system
│   └── social_auth/      # Social authentication
├── static/
│   ├── app/              # React application
│   │   ├── components/   # Reusable React components
│   │   ├── views/        # Page components
│   │   ├── stores/       # State management
│   │   └── utils/        # Utility functions
│   └── fonts/            # Font files
├── tests/                # Test suite
├── fixtures/             # Test fixtures
├── devenv/               # Development environment config
├── migrations/           # Database migrations
└── config/               # Configuration files
```

## Key Commands

### Development Setup

```bash
# Install dependencies and setup development environment
make develop

# Or use the newer devenv command
devenv sync

# Start the development server
pnpm run dev

# Start only the UI development server with hot reload
pnpm run dev-ui
```

### Testing

```bash
# Run Python tests
pytest

# Run JavaScript tests
pnpm test

# Run specific test file
pytest tests/sentry/api/test_base.py
pnpm test components/avatar.spec.tsx
```

### Code Quality

```bash
# Python linting
flake8
black --check
isort --check

# JavaScript/TypeScript linting
pnpm run lint:js

# Fix linting issues
pnpm run fix
```

### Database Operations

```bash
# Run migrations
sentry django migrate

# Create new migration
sentry django makemigrations

# Reset database
make reset-db
```

## Development Services

Sentry uses `devservices` to manage local development dependencies:

- **PostgreSQL**: Primary database
- **Redis**: Caching and queuing
- **Snuba**: ClickHouse-based event storage
- **Relay**: Event ingestion service
- **Symbolicator**: Debug symbol processing
- **Taskbroker**: Asynchronous task processing
- **Spotlight**: Local debugging tool

## API Development

### Adding New Endpoints

1. Create endpoint in `src/sentry/api/endpoints/`
2. Add URL pattern in `src/sentry/api/urls.py`
3. Document with drf-spectacular decorators
4. Add tests in `tests/sentry/api/endpoints/`

### API Documentation

- OpenAPI spec generation: `make build-api-docs`
- API ownership tracked in `src/sentry/apidocs/api_ownership_allowlist_dont_modify.py`

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

## Testing Best Practices

### Python Tests

- Use pytest fixtures
- Mock external services
- Test database isolation with transactions
- Use factories for test data

### JavaScript Tests

- Use React Testing Library
- Mock API calls with MSW or jest mocks
- Test user interactions, not implementation
- Snapshot testing for complex UI

## Common Patterns

### Feature Flags

```python
from sentry import features

if features.has('organizations:new-feature', organization):
    # New feature code
```

### Permissions

```python
from sentry.api.permissions import SentryPermission

class MyPermission(SentryPermission):
    scope_map = {
        'GET': ['org:read'],
        'POST': ['org:write'],
    }
```

### Frontend API Calls

```typescript
import {Client} from 'sentry/api';

const api = new Client();
const data = await api.requestPromise('/organizations/');
```

## Performance Considerations

1. Use database indexing appropriately
2. Implement pagination for list endpoints
3. Cache expensive computations with Redis
4. Use Celery for background tasks
5. Optimize queries with `select_related` and `prefetch_related`

## Security Guidelines

1. Always validate user input
2. Use Django's CSRF protection
3. Implement proper permission checks
4. Sanitize data before rendering
5. Follow OWASP guidelines

## Debugging Tips

1. Use `sentry devserver` for full stack debugging
2. Access Django shell: `sentry django shell`
3. View Celery tasks: monitor RabbitMQ management UI
4. Database queries: use Django Debug Toolbar
5. Frontend debugging: React DevTools

## Important Configuration Files

- `pyproject.toml`: Python project configuration
- `package.json`: Node.js dependencies and scripts
- `rspack.config.ts`: Frontend build configuration
- `setup.cfg`: Python package metadata
- `.github/`: CI/CD workflows
- `devservices/config.yml`: Local service configuration

## Contributing Guidelines

1. Follow existing code style
2. Write comprehensive tests
3. Update documentation
4. Add feature flags for experimental features
5. Consider backwards compatibility
6. Performance test significant changes

## Useful Resources

- Main Documentation: https://docs.sentry.io/
- Internal Contributing Guide: https://docs.sentry.io/internal/contributing/
- GitHub Discussions: https://github.com/getsentry/sentry/discussions
- Discord: https://discord.gg/PXa5Apfe7K

## Notes for AI Assistants

- This is a large, complex codebase with many interconnected systems
- Always consider the impact of changes on performance and scalability
- Many features are gated behind feature flags for gradual rollout
- The codebase follows Django patterns but with significant customization
- Frontend uses a mix of modern React and some legacy patterns
- Database migrations require special care due to the scale of deployment

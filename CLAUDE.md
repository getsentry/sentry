# Sentry Development Guide for Claude

## Overview

Sentry is a developer-first error tracking and performance monitoring platform. This repository contains the main Sentry application, which is a large-scale Django application with a React frontend.

## Tech Stack

### Backend

- **Language**: Python 3.13+
- **Framework**: Django 5.2+
- **API**: Django REST Framework with drf-spectacular for OpenAPI docs
- **Task Queue**: Celery 5.5+
- **Databases**: PostgreSQL (primary), Redis, ClickHouse (via Snuba)
- **Message Queue**: Kafka, RabbitMQ
- **Cloud Services**: Google Cloud Platform (Bigtable, Pub/Sub, Storage, KMS)

### Frontend

- **Language**: TypeScript
- **Framework**: React 19
- **Build Tool**: Rspack (Webpack alternative)
- **State Management**: Reflux, React Query (TanStack Query)
- **Styling**: Emotion (CSS-in-JS), Less
- **Testing**: Jest, React Testing Library

### Infrastructure

- **Container**: Docker (via devservices)
- **Package Management**: pnpm (Node.js), pip (Python)
- **Node Version**: 22 (managed by Volta)

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
# Preferred: Run pre-commit hooks on specific files
pre-commit run --files src/sentry/path/to/file.py

# Run all pre-commit hooks
pre-commit run --all-files

# Individual linting tools (use pre-commit instead when possible)
black --check  # Run black first
isort --check
flake8

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

## AI Assistant Quick Decision Trees

### "User wants to add an API endpoint"

1. Check if endpoint already exists: `grep -r "endpoint_name" src/sentry/api/`
2. Inherit from appropriate base:
   - Organization-scoped: `OrganizationEndpoint`
   - Project-scoped: `ProjectEndpoint`
   - Region silo: `RegionSiloEndpoint`
3. File locations:
   - Endpoint: `src/sentry/api/endpoints/{resource}.py`
   - URL: `src/sentry/api/urls.py`
   - Test: `tests/sentry/api/endpoints/test_{resource}.py`
   - Serializer: `src/sentry/api/serializers/models/{model}.py`

### "User wants to modify frontend component"

1. Component location: `static/app/components/` (reusable) or `static/app/views/` (page-specific)
2. ALWAYS use TypeScript
3. ALWAYS write test in same directory with `.spec.tsx`
4. Style with Emotion, NOT inline styles or CSS files
5. State: Use hooks (`useState`), NOT Reflux for new code

### "User wants to add a Celery task"

1. Location: `src/sentry/tasks/{category}.py`
2. Use `@instrumented_task` decorator
3. Set appropriate `queue` and `max_retries`
4. Test location: `tests/sentry/tasks/test_{category}.py`

## Critical Patterns (Copy-Paste Ready)

### API Endpoint Pattern

```python
# src/sentry/api/endpoints/organization_details.py
from rest_framework.request import Request
from rest_framework.response import Response
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization import DetailedOrganizationSerializer

@region_silo_endpoint
class OrganizationDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }

    def get(self, request: Request, organization) -> Response:
        """Get organization details."""
        return Response(
            serialize(
                organization,
                request.user,
                DetailedOrganizationSerializer()
            )
        )

# Add to src/sentry/api/urls.py:
# path('organizations/<slug:organization_slug>/', OrganizationDetailsEndpoint.as_view()),
```

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

### Celery Task Pattern

```python
# src/sentry/tasks/email.py
from sentry.tasks.base import instrumented_task

@instrumented_task(
    name="sentry.tasks.send_email",
    queue="email",
    max_retries=3,
    default_retry_delay=60,
)
def send_email(user_id: int, subject: str, body: str) -> None:
    from sentry.models import User

    try:
        user = User.objects.get(id=user_id)
        # Send email logic
    except User.DoesNotExist:
        # Don't retry if user doesn't exist
        return
```

## API Development

### Adding New Endpoints

1. Create endpoint in `src/sentry/api/endpoints/`
2. Add URL pattern in `src/sentry/api/urls.py`
3. Document with drf-spectacular decorators
4. Add tests in `tests/sentry/api/endpoints/`

### API Documentation

- OpenAPI spec generation: `make build-api-docs`
- API ownership tracked in `src/sentry/apidocs/api_ownership_allowlist_dont_modify.py`

### API Design Rules

1. Route: `/api/0/organizations/{org}/projects/{project}/`
2. Use `snake_case` for URL params
3. Use `camelCase` for request/response bodies
4. Return strings for numeric IDs
5. Implement pagination with `cursor`
6. Use `GET` for read, `POST` for create, `PUT` for update

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

### Test Pattern

```python
# tests/sentry/api/endpoints/test_organization_details.py
from sentry.testutils.cases import APITestCase

class OrganizationDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-details"

    def test_get_organization(self):
        org = self.create_organization(owner=self.user)
        self.login_as(self.user)

        response = self.get_success_response(org.slug)
        assert response.data["id"] == str(org.id)
```

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

### Logging Pattern

```python
import logging
from sentry import analytics

logger = logging.getLogger(__name__)

# Structured logging
logger.info(
    "user.action.complete",
    extra={
        "user_id": user.id,
        "action": "login",
        "ip_address": request.META.get("REMOTE_ADDR"),
    }
)

# Analytics event
analytics.record(
    "feature.used",
    user_id=user.id,
    organization_id=org.id,
    feature="new-dashboard",
)
```

## Architecture Rules

### Silo Mode

- **Control Silo**: User auth, billing, organization management
- **Region Silo**: Project data, events, issues
- Check model's silo in `src/sentry/models/outbox.py`
- Use `@region_silo_endpoint` or `@control_silo_endpoint`

### Database Guidelines

1. NEVER join across silos
2. Use `outbox` for cross-silo updates
3. Migrations must be backwards compatible
4. Add indexes for queries on 1M+ row tables
5. Use `db_index=True` or `db_index_together`

## Anti-Patterns (NEVER DO)

### Backend

```python
# WRONG: Direct model import in API
from sentry.models import Organization  # NO!

# RIGHT: Use endpoint bases
from sentry.api.bases.organization import OrganizationEndpoint

# WRONG: Synchronous external calls
response = requests.get(url)  # NO!

# RIGHT: Use Celery task
from sentry.tasks import fetch_external_data
fetch_external_data.delay(url)

# WRONG: N+1 queries
for org in organizations:
    org.projects.all()  # NO!

# RIGHT: Use prefetch_related
organizations.prefetch_related('projects')

# WRONG: Use hasattr() for unions
x: str | None = "hello"
if hasattr(x, "replace"):
    x = x.replace("e", "a")

# RIGHT: Use isinstance()
x: str | None = "hello"
if isinstance(x, str):
    x = x.replace("e", "a")

```

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

### Quick Debugging

```python
# Print SQL queries
from django.db import connection
print(connection.queries)

# Debug Celery task
from sentry.tasks import my_task
my_task.apply(args=[...]).get()  # Run synchronously

# Check feature flag
from sentry import features
features.has('organizations:feature', org)

# Current silo mode
from sentry.silo import SiloMode
from sentry.services.hybrid_cloud import silo_mode_delegation
print(silo_mode_delegation.get_current_mode())
```

## Important Configuration Files

- `pyproject.toml`: Python project configuration
- `package.json`: Node.js dependencies and scripts
- `rspack.config.ts`: Frontend build configuration
- `setup.cfg`: Python package metadata
- `.github/`: CI/CD workflows
- `devservices/config.yml`: Local service configuration
- `.pre-commit-config.yaml`: Pre-commit hooks configuration
- `tsconfig.json`: TypeScript configuration
- `eslint.config.mjs`: ESLint configuration
- `stylelint.config.js`: CSS/styling linting
- `codecov.yml`: Code coverage configuration

## File Location Map

### Backend

- **Models**: `src/sentry/models/{model}.py`
- **API Endpoints**: `src/sentry/api/endpoints/{resource}.py`
- **Serializers**: `src/sentry/api/serializers/models/{model}.py`
- **Tasks**: `src/sentry/tasks/{category}.py`
- **Integrations**: `src/sentry/integrations/{provider}/`
- **Permissions**: `src/sentry/api/permissions.py`
- **Feature Flags**: `src/sentry/features/permanent.py` or `temporary.py`
- **Utils**: `src/sentry/utils/{category}.py`

### Frontend

- **Components**: `static/app/components/{component}/`
- **Views**: `static/app/views/{area}/{page}.tsx`
- **Stores**: `static/app/stores/{store}Store.tsx`
- **Actions**: `static/app/actionCreators/{resource}.tsx`
- **Utils**: `static/app/utils/{utility}.tsx`
- **Types**: `static/app/types/{area}.tsx`
- **API Client**: `static/app/api.tsx`

### Tests

- **Python**: `tests/` mirrors `src/` structure
- **JavaScript**: Same directory as component with `.spec.tsx`
- **Fixtures**: `fixtures/{type}/`
- **Factories**: `tests/sentry/testutils/factories.py`

## Integration Development

### Adding Integration

1. Create dir: `src/sentry/integrations/{name}/`
2. Required files:
   - `__init__.py`
   - `integration.py` (inherit from `Integration`)
   - `client.py` (API client)
   - `webhooks/` (if needed)
3. Register in `src/sentry/integrations/registry.py`
4. Add feature flag in `temporary.py`

### Integration Pattern

```python
# src/sentry/integrations/example/integration.py
from sentry.integrations import Integration, IntegrationProvider

class ExampleIntegration(Integration):
    def get_client(self):
        from .client import ExampleClient
        return ExampleClient(self.metadata['access_token'])

class ExampleIntegrationProvider(IntegrationProvider):
    key = "example"
    name = "Example"
    features = ["issue-basic", "alert-rule"]

    def build_integration(self, state):
        # OAuth flow handling
        pass
```

## Contributing Guidelines

1. Follow existing code style
2. Write comprehensive tests
3. Update documentation
4. Add feature flags for experimental features
5. Consider backwards compatibility
6. Performance test significant changes

## Common Gotchas

1. **Hybrid Cloud**: Check silo mode before cross-silo queries
2. **Feature Flags**: Always add for new features
3. **Migrations**: Test rollback, never drop columns immediately
4. **Celery**: Always handle task failures/retries
5. **Frontend**: Component names must be unique globally
6. **API**: Serializers can be expensive, use `@attach_scenarios`
7. **Tests**: Use `self.create_*` helpers, not direct model creation
8. **Permissions**: Check both RBAC and scopes

## Useful Resources

- Development Setup Guide: https://develop.sentry.dev/getting-started/
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
- ALWAYS use pre-commit for linting instead of individual tools
- Check silo mode before making cross-silo queries
- Use decision trees above for common user requests
- Follow the anti-patterns section to avoid common mistakes

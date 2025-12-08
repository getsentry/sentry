# Sentry Development Guide for AI Agents

> **IMPORTANT**: AGENTS.md files are the source of truth for AI agent instructions. Always update the relevant AGENTS.md file when adding or modifying agent guidance. do not add to CLAUDE.md or cursor rules

## Overview

Sentry is a developer-first error tracking and performance monitoring platform. This repository contains the main Sentry application, which is a large-scale Django application with a React frontend.

## Tech Stack

### Frontend

See the frontend guide at the bottom of this file for frontend dev instructions.

### Backend

- **Language**: Python 3.13+
- **Framework**: Django 5.2+
- **API**: Django REST Framework with drf-spectacular for OpenAPI docs
- **Task Queue**: Celery 5.5+
- **Databases**: PostgreSQL (primary), Redis, ClickHouse (via Snuba)
- **Message Queue**: Kafka, RabbitMQ
- **Stream Processing**: Arroyo (Kafka consumer/producer framework)
- **Cloud Services**: Google Cloud Platform (Bigtable, Pub/Sub, Storage, KMS)

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
├── static/               # Frontend application
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

# Start dev dependencies
devservices up

# Start the development server
devservices serve
```

### Testing

```bash
# Run Python tests
pytest

# Run specific test file
pytest tests/sentry/api/test_base.py
```

### Code Quality and Style

```bash
# Preferred: Run pre-commit hooks on specific files
pre-commit run --files src/sentry/path/to/file.py

# Run all pre-commit hooks
pre-commit run --all-files

# Individual linting tools (use pre-commit instead when possible)
black --check  # Run black first
isort --check
flake8
```

### Database Operations

```bash
# Run migrations
sentry django migrate

# Create new migration
sentry django makemigrations

# Update migration after rebase conflict (handles renaming, dependencies, lockfile)
./bin/update-migration <migration_name_or_number> <app_label>
# Example: ./bin/update-migration 0101_workflow_when_condition_group_unique workflow_engine

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

📖 Full devservices documentation: https://develop.sentry.dev/development-infrastructure/devservices.md

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

### "User wants to add a Celery task"

1. Location: `src/sentry/tasks/{category}.py`
2. Use `@instrumented_task` decorator
3. Set appropriate `queue` and `max_retries`
4. Test location: `tests/sentry/tasks/test_{category}.py`

## On Commenting

Comments should not repeat what the code is saying. Instead, reserve comments
for explaining **why** something is being done, or to provide context that is not
obvious from the code itself.

Bad:

```py
# Increment the retry count by 1
retries += 1
```

Good:

```py
# Some APIs occasionally return 500s on valid requests. We retry up to 3 times
# before surfacing an error.
retries += 1
```

When to Comment

- To explain why a particular approach or workaround was chosen.
- To clarify intent when the code could be misread or misunderstood.
- To provide context from external systems, specs, or requirements.
- To document assumptions, edge cases, or limitations.

When Not to Comment

- Don't narrate what the code is doing — the code already says that.
- Don't duplicate function or variable names in plain English.
- Don't leave stale comments that contradict the code.

Avoid comments that reference removed or obsolete code paths (e.g. "No longer
uses X format"). If compatibility code or legacy behavior is deleted, comments
about it should also be deleted. The comment should describe the code that
exists now, not what used to be there. Historic details belong in commit
messages or documentation, not in-line comments.

## Critical Patterns (Copy-Paste Ready)

### API Endpoint Pattern

```python
# src/sentry/core/endpoints/organization_details.py
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

    def get(self, request: Request, organization: Organization) -> Response:
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

## Testing Best Practices

### Python Tests

- Use pytest fixtures
- Mock external services
- Test database isolation with transactions
- Use factories for test data
- For Kafka/Arroyo components: Use `LocalProducer` with `MemoryMessageStorage` instead of mocks

### Test Pattern

```python
# tests/sentry/core/endpoints/test_organization_details.py
from sentry.testutils.cases import APITestCase

class OrganizationDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-details"

    def test_get_organization(self):
        org = self.create_organization(owner=self.user)
        self.login_as(self.user)

        response = self.get_success_response(org.slug)
        assert response.data["id"] == str(org.id)
```

Notes:

- Tests should ALWAYS be procuderal with NO branching logic. It is very rare
  that you will need an if statement as part of a Frontend Jest test or backend
  pytest.

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

### Options System

Sentry uses a centralized options system where all options are registered in `src/sentry/options/defaults.py` with required default values.

```python
# CORRECT: options.get() without default - registered default is used
from sentry import options

batch_size = options.get("deletions.group-hash-metadata.batch-size")

# WRONG: Redundant default value
batch_size = options.get("deletions.group-hash-metadata.batch-size", 1000)
```

**Important**: Never suggest adding a default value to `options.get()` calls. All options are registered via `register()` in `defaults.py` which requires a default value. The options system will always return the registered default if no value is set, making a second default parameter redundant and potentially inconsistent.

### Logging Pattern

```python
import logging
from sentry import analytics
from sentry.analytics.events.feature_used import FeatureUsedEvent  # does not exist, only for demonstration purposes

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
    FeatureUsedEvent(
        user_id=user.id,
        organization_id=org.id,
        feature="new-dashboard",
    )
)
```

### Arroyo Stream Processing

```python
# Using Arroyo for Kafka producers with dependency injection for testing
from arroyo.backends.abstract import Producer
from arroyo.backends.kafka import KafkaProducer, KafkaPayload
from arroyo.backends.local.backend import LocalBroker
from arroyo.backends.local.storages.memory import MemoryMessageStorage

# Production producer
def create_kafka_producer(config):
    return KafkaProducer(build_kafka_configuration(default_config=config))

# Test producer using Arroyo's LocalProducer
def create_test_producer_factory():
    storage = MemoryMessageStorage()
    broker = LocalBroker(storage)
    return lambda config: broker.get_producer(), storage

# Dependency injection pattern for testable Kafka producers
class MultiProducer:
    def __init__(self, topic: Topic, producer_factory: Callable[[Mapping[str, object]], Producer[KafkaPayload]] | None = None):
        self.producer_factory = producer_factory or self._default_producer_factory
        # ... setup code

    def _default_producer_factory(self, config) -> KafkaProducer:
        return KafkaProducer(build_kafka_configuration(default_config=config))
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

#### Composite Index Strategy: Match Your Query Patterns

**Critical Rule**: When writing a query that filters on multiple columns simultaneously, you MUST verify that a composite index exists covering those columns in the filter order.

**How to Identify When You Need a Composite Index:**

1. **Look for Multi-Column Filters**: Any query using multiple columns in `.filter()` or `WHERE` clause
2. **Check Index Coverage**: Verify the model's `Meta.indexes` includes those columns
3. **Consider Query Order**: Index column order should match the most selective filters first

**Common Patterns Requiring Composite Indexes:**

```python
# NEEDS COMPOSITE INDEX: Filtering on foreign_key_id AND id
Model.objects.filter(
    foreign_key_id__in=ids,  # First column
    id__gt=last_id           # Second column
)[:batch_size]
# Required: Index(fields=["foreign_key", "id"])

# NEEDS COMPOSITE INDEX: Status + timestamp range queries
Model.objects.filter(
    status="open",           # First column
    created_at__gte=start    # Second column
)
# Required: Index(fields=["status", "created_at"])

# NEEDS COMPOSITE INDEX: Org + project + type lookups
Model.objects.filter(
    organization_id=org_id,  # First column
    project_id=proj_id,      # Second column
    type=event_type          # Third column
)
# Required: Index(fields=["organization", "project", "type"])
```

**How to Check if Index Exists:**

1. Read the model file: Check the `Meta` class for `indexes = [...]`
2. Single foreign key gets auto-index, but **NOT** when combined with other filters
3. If you filter on FK + another column, you need explicit composite index

**Red Flags to Watch For:**

- Query uses `column1__in=[...]` AND `column2__gt/lt/gte/lte`
- Query filters on FK relationship PLUS primary key or timestamp
- Pagination queries combining filters with cursor-based `id__gt`
- Large IN clauses combined with range filters

**When in Doubt:**

1. Check production query performance in Sentry issues (slow query alerts)
2. Run `EXPLAIN ANALYZE` on similar queries against production-sized data
3. Add the composite index if table has 1M+ rows and query runs in loops/batches

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

# WRONG: Importing inside function bodies.
# RIGHT: Import at the top of python modules. ONLY import in a function body if
# to avoid a circular import (very rare)
def my_function():
    from sentry.models.project import Project # NO!
    ...
```

## Exception Handling

- Avoid blanket exception handling (`except Exception:` or bare `except:`)
- Only catch specific exceptions when you have a meaningful way to handle them
- We have global exception handlers in tasks and endpoints that automatically log errors and report them to Sentry
- Let exceptions bubble up unless you need to:
  - Add context to the error
  - Perform cleanup operations
  - Convert one exception type to another with additional information
  - Recover from expected error conditions

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

## Secure Code Practices

### Preventing Indirect Object References (IDOR)

**Indirect Object Reference** vulnerabilities occur when an attacker can access resources they shouldn't by manipulating IDs passed in requests. This is one of the most critical security issues in multi-tenant applications like Sentry.

#### Core Principle: Always Scope Queries by Organization/Project

When querying resources, ALWAYS include `organization_id` and/or `project_id` in your query filters. Never trust user-supplied IDs alone.

```python
# WRONG: Vulnerable to IDOR - user can access any resource by guessing IDs
resource = Resource.objects.get(id=request.data["resource_id"])

# RIGHT: Properly scoped to organization
resource = Resource.objects.get(
    id=request.data["resource_id"],
    organization_id=organization.id
)

# RIGHT: Properly scoped to project
resource = Resource.objects.get(
    id=request.data["resource_id"],
    project_id=project.id
)
```

#### Project ID Handling: Use `self.get_projects()`

When project IDs are passed in the request (query string or body), NEVER directly access or trust `request.data["project_id"]` or `request.GET["project_id"]`. Instead, use the endpoint's `self.get_projects()` method which performs proper permission checks.

```python
# WRONG: Direct access bypasses permission checks
project_ids = request.data.get("project_id")
projects = Project.objects.filter(id__in=project_ids)

# RIGHT: Use self.get_projects() which validates permissions
projects = self.get_projects(
    request=request,
    organization=organization,
    project_ids=request.data.get("project_id")
)
```

## Debugging Tips

1. Use `devservices serve` for full stack debugging
2. Access Django shell: `sentry django shell`
3. View Celery tasks: monitor RabbitMQ management UI
4. Database queries: use Django Debug Toolbar

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
- `setup.cfg`: Python package metadata
- `.github/`: CI/CD workflows
- `devservices/config.yml`: Local service configuration
- `.pre-commit-config.yaml`: Pre-commit hooks configuration
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

### Tests

- **Python**: `tests/` mirrors `src/` structure
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
5. **API**: Serializers can be expensive, use `@attach_scenarios`
6. **Tests**: Use `self.create_*` helpers, not direct model creation
7. **Permissions**: Check both RBAC and scopes

## Useful Resources

- Development Setup Guide: https://develop.sentry.dev/getting-started/
- Devservices Documentation: https://develop.sentry.dev/development-infrastructure/devservices
- Main Documentation: https://docs.sentry.io/
- Internal Contributing Guide: https://docs.sentry.io/internal/contributing/
- GitHub Discussions: https://github.com/getsentry/sentry/discussions
- Discord: https://discord.gg/PXa5Apfe7K

## Notes for AI Assistants

- This is a large, complex codebase with many interconnected systems
- Always consider the impact of changes on performance and scalability
- Many features are gated behind feature flags for gradual rollout
- The codebase follows Django patterns but with significant customization
- Database migrations require special care due to the scale of deployment
- ALWAYS use pre-commit for linting instead of individual tools
- Check silo mode before making cross-silo queries
- Use decision trees above for common user requests
- Follow the anti-patterns section to avoid common mistakes

## Python Development

### Python Environment

**ALWAYS activate the virtualenv before any Python operation**: Before running any Python command (e.g. `python -c`), Python package (e.g. `pytest`, `mypy`), or Python script, you MUST first activate the virtualenv with `source .venv/bin/activate`. This applies to ALL Python operations without exception.

### Python Typing

#### Recommended Practices

For function signatures, always use abstract types (e.g. `Sequence` over `list`) for input parameters and use specific return types (e.g. `list` over `Sequence`).

```python
# Good: Abstract input types, specific return types
def process_items(items: Sequence[Item]) -> list[ProcessedItem]:
    return [process(item) for item in items]

# Avoid: Specific input types, abstract return types
def process_items(items: list[Item]) -> Sequence[ProcessedItem]:
    return [process(item) for item in items]
```

Always import a type from the module `collections.abc` rather than the `typing` module if it is available (e.g. `from collections.abc import Sequence` rather than `from typing import Sequence`).

### Python Tests

#### Running Tests

Always run pytest with these parameters: `pytest -svv --reuse-db` since it is faster to execute.

#### How to Determine Where to Add New Test Cases

When fixing errors or adding functionality, you MUST add test cases to existing test files rather than creating new test files. Follow this pattern to locate the correct test file:

- Code location: `src/sentry/foo/bar.py`
- Test location: `tests/sentry/foo/test_bar.py`

Notice that we prefix `tests/` to the path and prefix `test_` to the module name.

**Exception**: Tests ensuring Snuba compatibility MUST be placed in `tests/snuba/`. The tests in this folder will also run in Snuba's CI.

#### Use Factories Instead of Directly Calling `Model.objects.create`

In Sentry Python tests, you MUST use factory methods in this priority order:

1. Fixture methods (e.g., `self.create_model`) from base classes like `sentry.testutils.fixtures.Fixtures`
2. Factory methods from `sentry.testutils.factories.Factories` when fixtures aren't available

NEVER directly call `Model.objects.create` - this violates our testing standards and bypasses shared test setup logic.

For example, a diff that uses a fixture instead of directly calling `Model.objects.create` would look like:

```diff
    -        direct_project = Project.objects.create(
    -            organization=self.organization,
    -            name="Directly Created",
    -            slug="directly-created"
    -        )
    +        direct_project = self.create_project(
    +            organization=self.organization,
    +            name="Directly Created",
    +            slug="directly-created" # Note: Ensure factory args match
    +        )
```

#### Use `pytest` Instead of `unittest`

In Sentry Python tests, always use `pytest` instead of `unittest`. This promotes consistency, reduces boilerplate, and leverages shared test setup logic defined in the factories.

For example, a diff that uses `pytest` instead of `unittest` would look like:

```diff
    -        self.assertRaises(ValueError, EffectiveGrantStatus.from_cache, None)
    +        with pytest.raises(ValueError):
    +            EffectiveGrantStatus.from_cache(None)
```

### Rule Enforcement

These rules are MANDATORY for all Python development in the Sentry codebase. Violations will:

- Cause CI failures
- Require code review rejection
- Must be fixed before merging the pull request

Agents MUST follow these rules without exception to maintain code quality and consistency across the project.

# Sentry Frontend Development Guide

## Frontend Tech Stack

- **Language**: TypeScript
- **Framework**: React 19
- **Build Tool**: Rspack (Webpack alternative)
- **Package management**: pnpm
- **State Management**: Reflux, React Query (TanStack Query)
- **Styling**: Emotion (CSS-in-JS), Less
- **Testing**: Jest, React Testing Library

## Commands

#### Development Setup

```bash
# Start the development server
pnpm run dev

# Start only the UI development server with hot reload
pnpm run dev-ui
```

#### Testing

```bash
# Run JavaScript tests
pnpm test

# Run specific test file(s)
CI=true pnpm test components/avatar.spec.tsx [...other files]
```

#### Code Quality

```bash
# JavaScript/TypeScript linting
pnpm run lint:js

# Linting for specific file(s)
pnpm run lint:js components/avatar.tsx [...other files]

# Fix linting issues
pnpm run fix
```

## Development

### General Frontend Rules

1. NO new Reflux stores
2. NO class components
3. NO CSS files (use [core components](./app/components/core/) or Emotion in edge cases)
4. ALWAYS use TypeScript
5. ALWAYS colocate tests
6. Lazy load routes: `React.lazy(() => import('...'))`

### Important Files and Directories

- `package.json`: Node.js dependencies and scripts
- `rspack.config.ts`: Frontend build configuration
- `tsconfig.json`: TypeScript configuration
- `eslint.config.mjs`: ESLint configuration
- `stylelint.config.js`: CSS/styling linting
- **Components**: `static/app/components/{component}/`
- **Views**: `static/app/views/{area}/{page}.tsx`
- **Stores**: `static/app/stores/{store}Store.tsx`
- **Actions**: `static/app/actionCreators/{resource}.tsx`
- **Utils**: `static/app/utils/{utility}.tsx`
- **Types**: `static/app/types/{area}.tsx`
- **API Client**: `static/app/api.tsx`

### Routing

- Routes defined in `static/app/routes.tsx`
- Use React Router v6 patterns
- Lazy load route components when possible

### Frontend API Calls

```typescript
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';

const appSizeQuery: UseApiQueryResult<ResponseType, RequestError> = useApiQuery<ResponseType>(
  [`/projects/${organization.slug}/pull-requests/size-analysis/${selectedBuildId}/`],
  {
    staleTime: <int>, // Optional, amount of time before data is considered stale (in ms)
    enabled: <enabled criteria>, // Optional, whether the query is enabled
  }
);
```

## Design system

### General practices

- Use [core components](./app/components/core/) whenever possible. Use Emotion (styled components) only in edge cases.
- Use Text, Heading, Flex, Grid, Stack, Container and other core typography/layout components whenever possible.
- Add stories whenever possible (\*.stories.tsx).
- Icons should be part of our icon set at static/app/icons and never inlined
- Images should be placed inside static/app/images and imported via loader

### Core components

Always use Core components whenever available. Avoid using Emotion (styled components) unless absolutely necessary.

#### Layout

##### Grid

Use <Grid> from `@sentry/scraps/layout` for elements that require grid layout as opposed to styled components with `display: grid`

```tsx
import {Grid} from '@sentry/scraps/layout';

// ❌ Do not use styled and create a new styled component
const Component = styled('div')`
  display: flex;
  flex-directon: column;
`;

// ✅ Use the Grid layout primitive
<Grid direction="column"></Grid>;
```

##### Flex

Use <Flex> from `@sentry/scraps/layout` for elements that require flex layout as opposed to styled components with `display: flex`.

```tsx
import {Flex} from '@sentry/scraps/layout';

// ❌ Do not use styled and create a new styled component
const Component = styled('div')`
  display: flex;
  flex-directon: column;
`;

// ✅ Use the Flex layout primitive
<Flex direction="column"></Flex>;
```

##### Container

Use using <Container> from `@sentry/scraps/layout` over simple elements that require a border or border radius.

```tsx
import {Container} from '@sentry/scraps/layout';

// ❌ Do not use styled and create a new styled component
const Component = styled('div')`
  padding: space(2);
  border: 1px solid ${p => p.theme.tokens.border.primary};
`;

// ✅ Use the Container primitive
<Container padding="md" border="primary"></Container>;
```

##### General Guidelines

Use responsive props instead of styled media queries for Flex, Grid and Container.

```tsx
import {Flex} from '@sentry/scraps/layout';

// ❌ Do not use styled and create a new styled component
const Component = styled('div')`
  display: flex;
  flex-directon: column;

  @media screen and (min-width: ${p => p.theme.breakpoints.md}) {
    flex-direction: row;
  }
`;

// ✅ Use the responsive prop signature
<Flex direction={{xs: 'column', md: 'row'}}></Flex>;
```

Prefer the use of gap or padding over margin.

```tsx
import {Flex} from '@sentry/scraps/layout';

// ❌ Do not use styled and create a new styled component
const Component = styled('div')`
  display: flex;
  flex-directon: column;
  gap: ${p => p.theme.spacing.lg};
`;

// ✅ Use the responsive prop signature
<Flex gap="lg">
  <Child1 />
  <Child2 />
</Flex>;
```

#### Typography

##### Heading

Use <Heading> from `@sentry/scraps/text` for headings instead of styled components that style heading typography.

```tsx
import {Heading} from '@sentry/scraps/text';

// ❌ Do not use styled and create a new styled component
const Title = styled('h2')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: bold;
`;

// ✅ Use the Heading typography primitive
<Heading as="h2">Heading</Heading>;
```

Do not use or style h1, h2, h3, h4, h5, h6 intrinsic elements. Prefer using <Heading as="h1...h6">title</Heading> component instead

```tsx
import {Heading} from '@sentry/scraps/text';

// ❌ Do not use styled and create a new styled component
const Title = styled('h4')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizes.small};
`;

// ❌ Do not use intrinsic heading elements directly
function Component(){
  return <h4>Title<h4>
}

// ✅ Use the Heading typography primitive
<Heading as="h4">Title</Heading>;

// ✅ Use the Heading typography primitive
function Component(){
  return <Heading as="h4">Title</Heading>
}
```

##### Text

Use <Text> from `@sentry/scraps/text` for text styling instead of styled components that handle typography features like color, overflow, font-size, font-weight.

```tsx
import {Text} from '@sentry/scraps/text';

// ❌ Do not use styled and create a new styled component
const Label = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizes.small};
`;

// ✅ Use the Text typography primitive
<Text variant="muted" size="sm">
  Text
</Text>;
```

Do not use or style intrinsic elements like. Prefer using <Text as="p | span | div">text...</Text> component instead

```tsx
import {Text} from '@sentry/scraps/text';

// ❌ Do not style intrinsic elements directly
const Paragraph = styled('p')`
  color: ${p => p.theme.subText};
  line-height: 1.5;
`;

const Label = styled('span')`
  font-weight: bold;
  text-transform: uppercase;
`;

// ❌ Do not use raw intrinsic elements
function Content() {
  return (
    <div>
      <p>This is a paragraph of content</p>
      <span>Status: Active</span>
      <div>Container content</div>
    </div>
  );
}

// ✅ Use Text component with semantic HTML via 'as' prop
function Content() {
  return (
    <div>
      <Text as="p" variant="muted" density="comfortable">
        This is a paragraph of content
      </Text>
      <Text as="span" bold uppercase>
        Status: Active
      </Text>
      <Text as="div">Container content</Text>
    </div>
  );
}
```

##### Splitting layout and typography

- Split Layout from Typography by directly using Flex, Grid, Stack or Container and Text or Heading components

```tsx
// ❌ Do not couple typography with layout
const Component = styled('div')`
  display: flex;
  flex-directon: column;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.lg};
`;

// ✅ Use the Layout primitives and Text component
<Flex direction="column">
  <Text muted size="lg">...</Text>
<Flex>
```

#### Assets

##### Image

Use the core component <Image/> from `@sentry/scraps/image` instead of intrinsic <img />.

```tsx
// ❌ Do not use raw intrinsic elements or static paths
function Component() {
  return (
    <img src="/path/to/image.jpg" />
  );
}

// ✅ Use Image component and src loader
import {Image} from '@sentry/scraps/image';
import image from 'sentry-images/example.jpg';

function Component() {
  return (
    <Image src={imagePath} alt="Descriptive Alt Attribute">
  );
}
```

##### Avatars

Use the core avatar components (<UserAvatar/>, <TeamAvatar/>, <ProjectAvatar/>, <OrganizationAvatar/>, <SentryAppAvatar/>, <DocIntegrationAvatar/>) from `static/app/components/core/avatar` for avatars.

```tsx
// ✅ Use Avatar component and useUser
import {UserAvatar} from '@sentry/scraps/avatar/userAvatar';
import {useUser} from 'sentry/utils/useUser';

<UserAvatar user={user}>

// ❌ Do not use raw intrinsic elements or static paths
function Component() {
  return (
    <img
      src="/path/to/image.jpg"
      style={{
        border,
        width: 20,
        height: 20,
        borderRadius: '50%',
        objectFit: 'cover',
        display: 'inline-block',
      }}
    />
  );
}
```

For lists of avatars, use <AvatarList>.

##### Disclosure

Use the core disclosure component instead of building

```tsx
// ✅ Use Disclosure component
<Disclosure>
  <Disclosure.Title>Title</Disclosure.Title>
  <Disclosure.Content>Content that is toggled based on expanded state</Disclosure.Content>
</Disclosure>;

// ❌ Do not reimplement disclosure pattern manually
function Component() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div>
      <Button
        onClick={() => setIsExpanded(!isExpanded)}
        icon={<IconChevron direction={isExpanded ? 'down' : 'right'} />}
      >
        Title
      </Button>
      {isExpanded && (
        <Container>Content that is toggled based on expanded state</Container>
      )}
    </div>
  );
}
```

### Images and Icons

Place all icons in the static/app/icons folder. Never inline SVGs or add them to any other folder. Optimize SVGs using svgo or svgomg

```tsx
// ❌ Never inline SVGs
function Component(){
  return (
    <Button icon={
      <svg viewbox="0 0 16 16>"}>
        // ❌ paths have excessive precision, optimize them with SVGO
        <circle cx="8.00134" cy="8.4314" r="5.751412" />
        <circle cx="8.00134" cy="8.4314" r="12.751412" />
        <line x1="8.41334" y1="5.255361" x2="8" y2="8.255421" />
      </svg>
    </Button>
  )
}

// ❌ Never place SVGs outside of icons folder.
import {CustomIcon} from "./customIcon"

// ✅ Import icon from our icon set
import {IconExclamation} from "sentry/icons"
```

```tsx
// ❌ All images belong inside static/app/images

// ✅ Images are imported from sentry-images alias
import image from 'sentry-images/example.png';

import image from './image.png';

function Component() {
  return <Image src={image} />;
}

// ❌ All images need to be imported usign the webpack loader!
function Component() {
  return <Image src="/path/to/image.png" />;
}

function Component() {
  return <Image src={image} />;
}
```

## React Testing Guidelines

### Running Tests

Always run React tests with the CI flag to use non-interactive mode:

```bash
CI=true pnpm test <file_path>
```

### Imports

**Always** import from `sentry-test/reactTestingLibrary`, not directly from `@testing-library/react`:

```tsx
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
```

### Testing Philosophy

- **User-centric testing**: Write tests that resemble how users interact with the app.
- **Avoid implementation details**: Focus on behavior, not internal component structure.
- **Do not share state between tests**: Behavior should not be influenced by other tests in the test suite.

### Query Priority (in order of preference)

1. **`getByRole`** - Primary selector for most elements

   ```tsx
   screen.getByRole('button', {name: 'Save'});
   screen.getByRole('textbox', {name: 'Search'});
   ```

2. **`getByLabelText`/`getByPlaceholderText`** - For form elements

   ```tsx
   screen.getByLabelText('Email Address');
   screen.getByPlaceholderText('Enter Search Term');
   ```

3. **`getByText`** - For non-interactive elements

   ```tsx
   screen.getByText('Error Message');
   ```

4. **`getByTestId`** - Last resort only
   ```tsx
   screen.getByTestId('custom-component');
   ```

### Best Practices

#### Avoid mocking hooks, functions, or components

Do not use `jest.mocked()`.

```tsx
// ❌ Don't mock hooks
jest.mocked(useDataFetchingHook)

// ✅ Set the response data
MockApiClient.addMockResponse({
    url: '/data/',
    body: DataFixture(),
})

// ❌ Don't mock contexts
jest.mocked(useOrganization)

// ✅ Use the provided organization config on render()
render(<Component />, {organization: OrganizationFixture({...})})

// ❌ Don't mock router hooks
jest.mocked(useLocation)

// ✅ Use the provided router config
render(<TestComponent />, {
  initialRouterConfig: {
    location: {
      pathname: "/foo/",
    },
  },
});

// ❌ Don't mock page filters hook
jest.mocked(usePageFilters)

// ✅ Update the corresponding data store with your data
PageFiltersStore.onInitializeUrlState(
    PageFiltersFixture({ projects: [1]}),
)
```

#### Use fixtures

Sentry fixtures are located in tests/js/fixtures/ while GetSentry fixtures are located in tests/js/getsentry-test/fixtures/.

```tsx

// ❌ Don't import type and initialize it
import type {Project} from 'sentry/types/project';
const project: Project = {...}

// ✅ Import a fixture instead
import {ProjectFixture} from 'sentry-fixture/project';

const project = ProjectFixture(partialProject)

```

#### Use `screen` instead of destructuring

```tsx
// ❌ Don't do this
const {getByRole} = render(<Component />);

// ✅ Do this
render(<Component />);
const button = screen.getByRole('button');
```

#### Query selection guidelines

- Use `getBy...` for elements that should exist
- Use `queryBy...` ONLY when checking for non-existence
- Use `await findBy...` when waiting for elements to appear

```tsx
// ❌ Wrong
expect(screen.queryByRole('alert')).toBeInTheDocument();

// ✅ Correct
expect(screen.getByRole('alert')).toBeInTheDocument();
expect(screen.queryByRole('button')).not.toBeInTheDocument();
```

#### Async testing

```tsx
// ❌ Don't use waitFor for appearance
await waitFor(() => {
  expect(screen.getByRole('alert')).toBeInTheDocument();
});

// ✅ Use findBy for appearance
expect(await screen.findByRole('alert')).toBeInTheDocument();

// ✅ Use waitForElementToBeRemoved for disappearance
await waitForElementToBeRemoved(() => screen.getByRole('alert'));
```

#### User interactions

```tsx
// ❌ Don't use fireEvent
fireEvent.change(input, {target: {value: 'text'}});

// ✅ Use userEvent
await userEvent.click(input);
await userEvent.keyboard('text');
```

#### Testing routing

```tsx
const {router} = render(<TestComponent />, {
  initialRouterConfig: {
    location: {
      pathname: '/foo/',
      query: {page: '1'},
    },
  },
});
// Uses passes in config to set initial location
expect(router.location.pathname).toBe('/foo');
expect(router.location.query.page).toBe('1');
// Clicking links goes to the correct location
await userEvent.click(screen.getByRole('link', {name: 'Go to /bar/'}));
// Can check current route on the returned router
expect(router.location.pathname).toBe('/bar/');
// Can test manual route changes with router.navigate
router.navigate('/new/path/');
router.navigate(-1); // Simulates clicking the back button
```

If the component uses `useParams()`, the `route` property can be used:

```tsx
function TestComponent() {
  const {id} = useParams();
  return <div>{id}</div>;
}
const {router} = render(<TestComponent />, {
  initialRouterConfig: {
    location: {
      pathname: '/foo/123/',
    },
    route: '/foo/:id/',
  },
});
expect(screen.getByText('123')).toBeInTheDocument();
```

#### Testing components that make network requests

```tsx
// Simple GET request
MockApiClient.addMockResponse({
  url: '/projects/',
  body: [{id: 1, name: 'my project'}],
});

// POST request
MockApiClient.addMockResponse({
  url: '/projects/',
  method: 'POST',
  body: {id: 1, name: 'my project'},
});

// Complex matching with query params and request body
MockApiClient.addMockResponse({
  url: '/projects/',
  method: 'POST',
  body: {id: 2, name: 'other'},
  match: [
    MockApiClient.matchQuery({param: '1'}),
    MockApiClient.matchData({name: 'other'}),
  ],
});

// Error responses
MockApiClient.addMockResponse({
  url: '/projects/',
  body: {
    detail: 'Internal Error',
  },
  statusCode: 500,
});
```

##### Always Await Async Assertions

Network requests are asynchronous. Always use `findBy` queries or properly await assertions:

```tsx
// ❌ Wrong - will fail intermittently
expect(screen.getByText('Loaded Data')).toBeInTheDocument();

// ✅ Correct - waits for element to appear
expect(await screen.findByText('Loaded Data')).toBeInTheDocument();
```

##### Handle Refetches in Mutations

When testing mutations that trigger data refetches, update mocks before the refetch occurs:

```tsx
it('adds item and updates list', async () => {
  // Initial empty state
  MockApiClient.addMockResponse({
    url: '/items/',
    body: [],
  });

  const createRequest = MockApiClient.addMockResponse({
    url: '/items/',
    method: 'POST',
    body: {id: 1, name: 'New Item'},
  });

  render(<ItemList />);

  await userEvent.click(screen.getByRole('button', {name: 'Add Item'}));

  // CRITICAL: Override mock before refetch happens
  MockApiClient.addMockResponse({
    url: '/items/',
    body: [{id: 1, name: 'New Item'}],
  });

  await waitFor(() => expect(createRequest).toHaveBeenCalled());
  expect(await screen.findByText('New Item')).toBeInTheDocument();
});
```

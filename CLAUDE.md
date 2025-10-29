Please also reference the following documents as needed:

@.claude/memories/backend-integrations.md description: "" globs: "src/sentry/integrations/**/*.py,tests/sentry/integrations/**/*.py"
@.claude/memories/backend-overview.md description: "Backend development patterns and best practices" globs: "src/**/*.py,tests/**/*.py,**/test_*.py"
@.claude/memories/backend-tests.md description: "" globs: "tests/**/*.py,**/test_*.py"
@.claude/memories/frontend-overview.md description: "" globs: "static/**/*.ts,static/**/*.tsx,static/**/*.js,static/**/*.jsx,static/**/*.css,static/**/*.less"
@.claude/memories/python-development.md description: "" globs: "src/**/*.py,tests/**/*.py,**/test_*.py"
@.claude/memories/typescript-tests.md description: "" globs: "**/*.spec.tsx,**/*.spec.ts,**/*.test.tsx,**/*.test.ts"
# Sentry Development Guide

## Overview

Sentry is a developer-first error tracking and performance monitoring platform. This repository contains the main Sentry application, which is a large-scale Django application with a React frontend.

## Tech Stack

### Frontend

- **Language**: TypeScript
- **Framework**: React 19
- **Build Tool**: Rspack (Webpack alternative)
- **State Management**: Reflux, React Query (TanStack Query)
- **Styling**: Emotion (CSS-in-JS), Less
- **Testing**: Jest, React Testing Library

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
├── static/               # Frontend application (see static/CLAUDE.md)
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

## Important Configuration Files

- `pyproject.toml`: Python project configuration
- `setup.cfg`: Python package metadata
- `.github/`: CI/CD workflows
- `devservices/config.yml`: Local service configuration
- `.pre-commit-config.yaml`: Pre-commit hooks configuration
- `codecov.yml`: Code coverage configuration

## Contributing Guidelines

1. Follow existing code style
2. Write comprehensive tests
3. Update documentation
4. Add feature flags for experimental features
5. Consider backwards compatibility
6. Performance test significant changes

## Useful Resources

- Development Setup Guide: https://develop.sentry.dev/getting-started/
- Devservices Documentation: https://develop.sentry.dev/development-infrastructure/devservices
- Main Documentation: https://docs.sentry.io/
- Internal Contributing Guide: https://docs.sentry.io/internal/contributing/
- GitHub Discussions: https://github.com/getsentry/sentry/discussions
- Discord: https://discord.gg/PXa5Apfe7K

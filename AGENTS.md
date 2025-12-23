# Sentry Development Guide for AI Agents

> **IMPORTANT**: AGENTS.md files are the source of truth for AI agent instructions. Always update the relevant AGENTS.md file when adding or modifying agent guidance. Do not add to CLAUDE.md or Cursor rules.

## Overview

Sentry is a developer-first error tracking and performance monitoring platform. This repository contains the main Sentry application, which is a large-scale Django application with a React frontend.

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
├── tests/                # Backend test suite
├── fixtures/             # Test fixtures
├── devenv/               # Development environment config
├── migrations/           # Database migrations
└── config/               # Configuration files
```

> For detailed development patterns, see nested AGENTS.md files:
>
> - **Backend patterns**: `src/AGENTS.md`
> - **Backend testing patterns**: `tests/AGENTS.md`
> - **Frontend patterns**: `static/AGENTS.md`

## Backend

For backend development patterns, commands, security guidelines, and architecture, see `src/AGENTS.md`.
For backend testing patterns and best practices, see `tests/AGENTS.md`.

## Frontend

For frontend development patterns, commands, design system guidelines, and React testing best practices, see `static/AGENTS.md`.

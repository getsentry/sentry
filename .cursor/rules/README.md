# Sentry Monorepo - Cursor Rules

This directory contains AI collaboration rules specifically tailored for the Sentry monorepo - a high-scale Django backend with React frontend that processes millions of error events daily.

## 🎯 Quick Start

### Development Workflow

```bash
# Frontend changes (fastest)
pnpm dev-ui                  # Dev server at https://dev.getsentry.net:7999

# Backend changes
sentry run web              # Backend at localhost:9001

# Full stack (when necessary)
sentry devserver            # Traditional full development
```

### Essential Services

```bash
# Start required services
sentry devservices up       # Kafka, Redis, PostgreSQL, ClickHouse

# Database setup
sentry upgrade              # Run migrations
sentry createuser          # Create superuser
```

## 📚 Documentation Structure

### Core Architecture

- **[cursor.mdc](cursor.mdc)** - Main navigation and development workflow
- **[architecture.mdc](architecture.mdc)** - Django/React system design
- **[coding-guidelines.mdc](coding-guidelines.mdc)** - Django, React, TypeScript standards
- **[common-patterns.mdc](common-patterns.mdc)** - Sentry-specific patterns

### Domain Knowledge

- **[business-logic.mdc](business-logic.mdc)** - Error tracking, AI features, organization management
- **[monitoring.mdc](monitoring.mdc)** - Sentry self-monitoring and observability
- **[project-context.mdc](project-context.mdc)** - Sentry-specific constraints and context

### Development Process

- **[guidelines.mdc](guidelines.mdc)** - LLM persona and Sentry expertise
- **[feature-development.mdc](feature-development.mdc)** - PRFAQ → PRD → Implementation workflow

## 🏗️ Sentry Technology Stack

### Backend

- **Django 4.2+** with Django REST Framework
- **PostgreSQL** for primary data storage
- **Redis** for caching and session management
- **Celery** for background task processing
- **Kafka** for event streaming and ingestion

### Frontend

- **React 18** with hooks and functional components
- **TypeScript** for type safety
- **MobX** for reactive state management
- **Emotion** for CSS-in-JS styling
- **Rspack** for fast bundling

### Domain Features

- **Error Tracking** - Event ingestion, processing, and storage
- **Issue Management** - Grouping, assignment, and resolution
- **AI Integration** - Seer AI for automated analysis and fixes
- **Performance Monitoring** - Transaction tracing and metrics
- **Organization Management** - Multi-tenancy and access control

## 🎯 Key Development Patterns

### Fastest Development Workflow

1. **Frontend-only changes**: Use `pnpm dev-ui` (fastest feedback loop)
2. **Backend-only changes**: Use `sentry run web` with production frontend
3. **Full stack**: Use `sentry devserver` only when necessary

### Performance Considerations

- System handles millions of events daily
- Sub-second response times required
- High availability (99.9% uptime)
- Efficient database queries and caching

### Security & Privacy

- Data scrubbing for sensitive information
- Organization-level access control
- Comprehensive audit logging
- GDPR and privacy compliance

## 📊 Business Context

### Mission-Critical Platform

- Used by thousands of organizations worldwide
- Processes millions of error events daily
- Requires high availability and data integrity
- Trusted for sensitive application monitoring

### AI-Powered Features

- **Seer AI** for automated issue analysis
- **Code fix suggestions** with safety validation
- **Issue prioritization** using machine learning
- **Anomaly detection** for unusual patterns

### Developer Experience Focus

- Comprehensive debugging tools
- Intuitive issue investigation
- Efficient resolution workflows
- Performance optimization tools

---

## 💡 Getting Started

1. **Read [cursor.mdc](cursor.mdc)** for navigation and overview
2. **Review [architecture.mdc](architecture.mdc)** for system design
3. **Check [coding-guidelines.mdc](coding-guidelines.mdc)** for standards
4. **Explore [common-patterns.mdc](common-patterns.mdc)** for implementation patterns

For new features, use the templates in `.cursor/project/features/001-template/`.

The rules reflect the actual Sentry development workflow and technology stack, ensuring accurate and efficient AI collaboration for this high-scale error tracking platform.

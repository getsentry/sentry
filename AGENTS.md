# Sentry Development Patterns for AI Agents

This document contains system-wide architectural patterns and development workflows that complement the comprehensive guides in `CLAUDE.md` and `static/CLAUDE.md`.

## 🚨 Content Guidelines for AI Agents

**This file should contain ONLY:**

- ✅ **WHY** patterns exist (architectural principles, reasoning)
- ✅ **WHEN** to apply patterns (decision frameworks, strategy hierarchies)
- ✅ **WHAT** the high-level approach is (testing philosophy, cross-system considerations)

**This file should NEVER contain:**

- ❌ **HOW** to implement patterns (concrete syntax, specific commands)
- ❌ Code examples with imports/syntax
- ❌ Execution commands with parameters
- ❌ Language-specific technical details

**👉 For concrete syntax and implementation details, see `.cursor/rules/` files.**

## Development Environment

### Python Environment Setup

**Critical Requirement:** Always activate the virtualenv before running any Python commands. This ensures consistency across all development and testing activities.

## Project Structure Patterns

### Test File Location Strategy

**Decision Framework:** When fixing an error, prioritize finding existing test files over creating new ones. This maintains test organization and reduces fragmentation.

**Exception Handling:** Consider cross-system impact when placing tests - some changes require testing in multiple CI environments.

## Testing Philosophy & Architecture

### Core Testing Principles

- **User-centric testing:** Write tests that resemble how users interact with the app
- **Avoid implementation details:** Focus on behavior, not internal component structure
- **No shared state between tests:** Behavior should not be influenced by other tests in the test suite

### Python Testing Patterns

#### Use Factories Over Direct Model Creation

**Architectural Principle:** Leverage shared test infrastructure rather than direct ORM calls. This promotes consistency, reduces boilerplate, and enables shared test setup logic across the codebase.

**Priority Order:** Use factory methods > fixture methods > never use direct model creation.

#### Prefer pytest Over unittest

**Framework Decision:** Standardize on pytest for consistency and to leverage shared test setup logic across the entire test suite.

### React Testing Patterns

#### Avoid Mocking System Components

**Testing Philosophy:** Avoid mocking internal system components (hooks, functions, components). Instead, configure the system's state and data to achieve the desired test scenario.

**Strategy Hierarchy:**

- **API calls:** Configure response data
- **Contexts:** Use configuration parameters
- **Routing:** Use initialization config
- **Page filters:** Update data stores directly

#### Use Sentry Fixtures

**Resource Organization:** Leverage pre-built fixtures instead of manual object creation. Fixtures are organized by system (Sentry vs GetSentry) and provide complete, realistic data structures.

#### Handle Network Request Testing

**Async Testing Strategy:** Components making network requests require careful timing consideration:

- **Assertion Timing:** Always await async assertions to avoid intermittent failures
- **State Management:** Consider refetch behavior during mutations - override mocks before refetches occur

## Integration with Existing Documentation

This file focuses on architectural patterns and workflows. For comprehensive system understanding, also reference:

- `/CLAUDE.md` - Backend architecture, API patterns, deployment
- `/static/CLAUDE.md` - Frontend architecture, component patterns, styling
- `.cursor/rules/python.mdc` - Python coding standards, testing patterns, virtualenv setup
- `.cursor/rules/typescript_tests.mdc` - React Testing Library patterns, Sentry fixtures, async testing

**Note:** The `.cursor/rules/` files contain immediately actionable syntax patterns, while this file provides broader architectural context and decision-making frameworks.

# PRFAQ: Frontend AI Knowledge System

## Problem Statement

When developers, product managers, or anyone else are working with Cursor on Sentry’s frontend, Cursor doesn’t have enough context about our frontend architecture, component patterns, design system, or best practices. This lack of context means:

- **Inconsistent implementations** that don’t follow Sentry’s established frontend patterns
- **Poor integration** with our component library and design system
- **Slower development cycles** because AI suggestions miss important context
- **Brand guideline violations** and inconsistent user experience

Currently, Cursor’s AI assistance is based on basic rules and limited context, and it misses out on the rich ecosystem of:

- Frontend architecture patterns in `static/app/`
- The structure of our component library and design system
- Storybook documentation in `static/app/stories/`
- Platform-specific getting started docs
- Brand guidelines and design tokens
- Performance and accessibility best practices

## Solution Overview

**Frontend AI Knowledge System** — A system to give Cursor and AI models deep, structured context about Sentry’s frontend architecture, components, and patterns, using three main approaches:

### 1. Enhanced Cursor Rules

- **UI Architecture Guide** (`ui-architecture.mdc`): Explains frontend structure, routing, state management
- **Design System Guide** (`design-system.mdc`): Documents components, tokens, brand guidelines
- **Frontend Patterns Guide** (`frontend-patterns.mdc`): Captures common patterns and best practices, and explicitly directs new team members to follow these best practices, reuse existing components instead of building new ones, and leverage local testing tools like the local frontend dev server.

### 2. Unified Documentation Integration

- **External Documentation Links**: Reference develop.sentry.dev and brand.getsentry.com
- **Stories Enhancement**: Improve `static/app/stories/` for AI consumption
- **Code Discovery Patterns**: Make it easier for AI to find and understand components and patterns

### 3. AI-Optimized Frontend Structure

- **Component Documentation Standards**: Consistent, AI-readable docs for components
- **Pattern Recognition Aids**: Clear examples and usage patterns
- **Integration Examples**: Real implementation examples for common use cases

## Customer Quotes

**Senior Frontend Engineer**: _"Now, AI suggestions actually use our Badge, Button, and Panel components with the right styling, instead of generic React code."_

**Product Designer**: _"The AI respects our brand guidelines automatically. Generated components follow our spacing, colors, and typography without manual correction."_

**New Team Member**: _"The AI helped me understand Sentry’s frontend patterns quickly. It directed me to follow best practices, reuse existing components, and even pointed me to the local frontend dev server for testing. I was able to contribute production-ready code much faster."_

**Engineering Manager**: _"Code reviews for AI-assisted features now focus on business logic instead of UI consistency. Our design system adoption improved significantly."_

## Goals

### Qualitative Goals

- Cursor understands Sentry’s frontend architecture and component patterns
- Generated code follows our design system and brand guidelines
- AI suggestions integrate seamlessly with our component library
- New features maintain consistent user experience and performance standards
- New team members are onboarded faster by being guided to follow best practices, reuse existing solutions, and use local testing tools

### Quantitative Goals

- **90%** of AI-generated components pass visual design review on first attempt
- **50%** reduction in time spent polishing AI-generated UI code
- **100%** coverage of core UI patterns in the AI knowledge system
- **Zero** brand guideline violations in AI-assisted features
- **75%** of AI suggestions use existing components instead of creating new ones
- **100%** of new team members report that AI rules helped them follow best practices and use local dev tools

## User Experience

When someone uses Cursor to work on a Sentry frontend feature:

1. **Context Recognition** — Cursor immediately understands where you are in the app structure
2. **Component Discovery** — Cursor suggests the right existing components from our library
3. **Pattern Application** — Cursor applies established patterns for routing, state, error handling
4. **Design Consistency** — Cursor respects brand guidelines for spacing, colors, typography
5. **Performance Optimization** — Cursor includes proper lazy loading, memoization, error boundaries
6. **Onboarding Guidance** — For new team members, Cursor proactively directs them to follow best practices, reuse existing components, and use local testing tools like the frontend dev server

Example interaction:

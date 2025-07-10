# PRFAQ: Frontend AI Knowledge System

## Problem Statement

AI agents and models working on the Sentry monorepo lack comprehensive context about frontend architecture, component patterns, design system, and best practices. This leads to:

- **Inconsistent implementations** that don't follow established Sentry patterns
- **Poor integration** with existing components and design system
- **Inefficient development cycles** due to lack of contextual understanding
- **Brand guideline violations** and inconsistent user experience

Currently, AI assistance relies on limited context from basic cursor rules, missing the rich ecosystem of:

- Frontend architecture patterns in `static/app/`
- Component library structure and design system
- Storybook documentation in `static/app/stories/`
- Platform-specific getting started documentation
- Brand guidelines and design tokens
- Performance and accessibility patterns

## Solution Overview

**Frontend AI Knowledge System** - A comprehensive system to provide AI models with deep context about Sentry's frontend architecture, components, and patterns through three integrated approaches:

### 1. Enhanced Cursor Rules

- **UI Architecture Guide** (`ui-architecture.mdc`) - Frontend structure, routing, state management
- **Design System Guide** (`design-system.mdc`) - Components, tokens, brand guidelines
- **Frontend Patterns Guide** (`frontend-patterns.mdc`) - Common patterns, best practices

### 2. Unified Documentation Integration

- **External Documentation Links** - Reference develop.sentry.dev and brand.getsentry.com
- **Stories Enhancement** - Improve `static/app/stories/` for AI consumption
- **Code Discovery Patterns** - AI-friendly component and pattern discovery

### 3. AI-Optimized Frontend Structure

- **Component Documentation Standards** - Consistent AI-readable component docs
- **Pattern Recognition Aids** - Clear examples and usage patterns
- **Integration Examples** - Real implementation examples for common use cases

## Customer Quotes

**Senior Frontend Engineer**: _"AI suggestions now understand our component library and design system. Instead of generic React components, I get suggestions that use our actual Badge, Button, and Panel components with proper styling."_

**Product Designer**: _"The AI respects our brand guidelines automatically. Generated components follow our spacing, colors, and typography without manual correction."_

**New Team Member**: _"The AI helped me understand Sentry's frontend patterns quickly. It suggested the right store patterns, error boundaries, and performance optimizations from day one."_

**Engineering Manager**: _"Code reviews for AI-assisted features now focus on business logic instead of UI consistency. Our design system adoption improved significantly."_

## Goals

### Qualitative Goals

- AI understands Sentry's frontend architecture and component patterns
- Generated code follows established design system and brand guidelines
- AI suggestions integrate seamlessly with existing component library
- New features maintain consistent user experience and performance standards

### Quantitative Goals

- **90%** of AI-generated components pass visual design review on first attempt
- **50%** reduction in time spent polishing AI-generated UI code
- **100%** coverage of core UI patterns in AI knowledge system
- **Zero** brand guideline violations in AI-assisted features
- **75%** of AI suggestions use existing components vs. creating new ones

## User Experience

When an AI agent works on a Sentry frontend feature:

1. **Context Recognition** - AI immediately understands current location in app structure
2. **Component Discovery** - AI suggests appropriate existing components from our library
3. **Pattern Application** - AI applies established patterns for routing, state, error handling
4. **Design Consistency** - AI respects brand guidelines for spacing, colors, typography
5. **Performance Optimization** - AI includes proper lazy loading, memoization, error boundaries

Example interaction:

```
Human: "Add a new issues filter dropdown"
AI: "I'll create this using the existing DropdownButton and SearchableDropDown components from our design system, following the established filter pattern used in IssueListHeader. I'll integrate with the IssueStore for state management and include proper loading states and error boundaries."
```

## FAQ

**Q: How much of the existing stories system should be enhanced?**
A: Focus on the most commonly used components first (Button, Panel, Badge, etc.) and establish patterns that can be applied to other stories systematically.

**Q: Should we reference all develop.sentry.dev documentation?**
A: Start with frontend-specific guides and architecture docs. Add more based on AI usage patterns and feedback.

**Q: How do we maintain accuracy as the frontend evolves?**
A: Implement automated validation checks and establish update workflows tied to component library changes.

**Q: What's the best way to integrate brand guidelines?**
A: Extract key design tokens and patterns into AI-readable format while linking to full brand.getsentry.com for comprehensive reference.

**Q: How do we measure AI understanding improvement?**
A: Track component reuse rates, design review feedback, and time-to-merge for AI-assisted features.

## Open Questions

1. **Documentation Scope**: Which develop.sentry.dev sections provide highest value for AI context?
2. **Maintenance Strategy**: How do we keep AI knowledge current with rapid frontend evolution?
3. **Integration Method**: Should brand guidelines be embedded or referenced externally?
4. **Discovery Mechanism**: How should AI discover and understand component relationships?
5. **Performance Impact**: What's the optimal balance between context richness and processing efficiency?
6. **Validation Approach**: How do we automatically verify AI suggestions follow our patterns?

## Success Criteria

This project succeeds when:

- AI agents generate UI code indistinguishable from human-written Sentry frontend code
- New features seamlessly integrate with existing design system and architecture
- Frontend development velocity increases through improved AI assistance
- Design system adoption and consistency improves across the application
- Brand guidelines are consistently followed in all AI-assisted development

## Next Steps

1. **Analysis Phase** - Audit existing documentation and identify key patterns
2. **Foundation Phase** - Create core cursor rules for UI architecture and design system
3. **Integration Phase** - Enhance stories system and add discovery patterns
4. **Validation Phase** - Test AI understanding and iterate based on results
5. **Rollout Phase** - Deploy knowledge system and train team on new capabilities

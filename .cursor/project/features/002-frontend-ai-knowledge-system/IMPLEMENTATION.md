# IMPLEMENTATION: Frontend AI Knowledge System

## Overview

This implementation adds comprehensive AI knowledge system for Sentry's frontend, enabling Cursor and other AI tools to understand our React/TypeScript architecture, component patterns, design system, and development workflows.

**Problem Solved**: AI assistants lack context about Sentry's frontend patterns, leading to inconsistent implementations and slower development cycles.

**Solution Delivered**: Three-tier documentation system providing deep frontend context to AI models.

## Technical Implementation

### Phase 1: Core Architecture Documentation

#### 1.1 Create `ui-architecture.mdc`

**File**: `.cursor/rules/ui-architecture.mdc`

````markdown
# Sentry Frontend UI Architecture

## Application Structure

### Core Directories

- `static/app/routes.tsx` - Main routing configuration
- `static/app/components/` - Reusable UI components
- `static/app/stores/` - MobX state management
- `static/app/views/` - Page-level components
- `static/app/utils/` - Shared utilities and helpers
- `static/app/styles/` - Global styles and themes

### React 18 + TypeScript Patterns

```typescript
// Standard component pattern
interface ComponentProps {
  data: DataType;
  onAction: (id: string) => void;
}

const Component: React.FC<ComponentProps> = ({data, onAction}) => {
  // Use React.memo for performance optimization
  return <div>{/* Implementation */}</div>;
};

export default React.memo(Component);
```
````

### MobX Store Patterns

```typescript
// Store pattern for state management
class ExampleStore {
  @observable data: DataType[] = [];
  @observable loading = false;

  @action
  async fetchData() {
    this.loading = true;
    try {
      this.data = await api.getData();
    } finally {
      this.loading = false;
    }
  }
}
```

### Local Development Setup

```bash
# Start frontend development server
yarn dev:ui
# Access at: http://localhost:9000

# Run component stories
yarn storybook
# Access at: http://localhost:9001
```

### Error Boundaries and Performance

- Always wrap route components in ErrorBoundary
- Use React.Suspense for code splitting
- Implement proper loading states with Skeleton components
- Use React.memo and useMemo for optimization

### New Team Member Guidance

- Follow existing component patterns in `static/app/components/`
- Use local dev server (yarn dev:ui) for testing
- Check existing stories before creating new components
- Follow TypeScript strict mode requirements

````

#### 1.2 Create `design-system.mdc`

**File**: `.cursor/rules/design-system.mdc`

```markdown
# Sentry Design System Guide

## Core Components

### Button Component
**Location**: `static/app/components/button.tsx`

```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger';
  size: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
}

// Usage Patterns:
// Primary: Save, Create, Submit (main actions)
// Secondary: Cancel, Reset (supporting actions)
// Danger: Delete, Remove (destructive actions)
````

### Panel Component

**Location**: `static/app/components/panels/panel.tsx`

```typescript
// Main container for content sections
<Panel>
  <PanelHeader>Title</PanelHeader>
  <PanelBody>Content</PanelBody>
</Panel>
```

### Design Tokens

```typescript
// Extract from brand.getsentry.com
const SENTRY_TOKENS = {
  colors: {
    primary: '#6C5CE7',
    success: '#00D924',
    warning: '#FFC107',
    error: '#E03E2F',
    gray100: '#FAFBFC',
    gray500: '#80808D',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  typography: {
    h1: '32px',
    h2: '24px',
    body: '14px',
    caption: '12px',
  },
};
```

### Component Selection Guide

- **Lists**: Use `PanelTable` for data tables
- **Forms**: Use `Form`, `FormField`, `TextInput` components
- **Status**: Use `Badge` for status indicators
- **Navigation**: Use `NavTabs` for section navigation
- **Actions**: Use `DropdownButton` for multiple actions

### Accessibility Standards

- All interactive elements need proper ARIA labels
- Maintain 4.5:1 color contrast ratio
- Support keyboard navigation
- Include proper focus indicators

````

#### 1.3 Create `frontend-patterns.mdc`

**File**: `.cursor/rules/frontend-patterns.mdc`

```markdown
# Sentry Frontend Patterns

## List Management Patterns

### Data Table Pattern
```typescript
// Standard pattern for entity lists (Issues, Organizations, etc.)
const EntityList: React.FC = () => {
  const [data, setData] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);

  return (
    <Panel>
      <PanelHeader>
        <SearchBar onSearch={handleSearch} />
        <FilterButtons filters={filters} />
      </PanelHeader>
      <PanelTable
        headers={['Name', 'Status', 'Actions']}
        data={data}
        loading={loading}
        renderRow={(item) => <EntityRow key={item.id} item={item} />}
      />
    </Panel>
  );
};
````

### Form Patterns

```typescript
// Standard form with validation
const EntityForm: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<FormErrors>({});

  return (
    <Form onSubmit={handleSubmit}>
      <FormField label="Name" error={errors.name} required>
        <TextInput
          value={formData.name}
          onChange={(value) => setFormData({...formData, name: value})}
        />
      </FormField>
      <FormActions>
        <Button variant="primary" type="submit">Save</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </FormActions>
    </Form>
  );
};
```

### Modal and Drawer Patterns

```typescript
// Use for secondary workflows
<Modal isOpen={isOpen} onClose={onClose} title="Edit Entity">
  <EntityForm onSave={handleSave} onCancel={onClose} />
</Modal>

// Use for contextual information
<Drawer isOpen={isOpen} onClose={onClose}>
  <EntityDetails entity={selectedEntity} />
</Drawer>
```

### Loading and Empty States

```typescript
// Loading state with skeleton
{loading ? (
  <SkeletonTable rows={5} />
) : data.length > 0 ? (
  <DataTable data={data} />
) : (
  <EmptyState
    icon="icon-search"
    title="No results found"
    subtitle="Try adjusting your search criteria"
  />
)}
```

````

### Phase 2: Stories System Enhancement

#### 2.1 Enhanced Component Stories

**File**: `static/app/stories/components/button.stories.tsx`

```typescript
/**
 * Button - Primary interface element for user actions
 *
 * @usage Primary buttons for main CTAs (Save, Create, Submit)
 * @usage Secondary buttons for supporting actions (Cancel, Reset)
 * @usage Danger buttons for destructive actions (Delete, Remove)
 *
 * @accessibility Include aria-label for icon-only buttons
 * @performance Uses React.memo for optimization
 * @testing Use data-test-id for reliable testing selectors
 */

import Button from 'sentry/components/button';

export default {
  title: 'Components/Button',
  component: Button,
  parameters: {
    docs: {
      description: {
        component: 'Primary interface element following Sentry design system'
      }
    }
  }
};

export const Primary = () => (
  <Button variant="primary" onClick={() => alert('Primary action')}>
    Save Changes
  </Button>
);

export const Secondary = () => (
  <Button variant="secondary" onClick={() => alert('Secondary action')}>
    Cancel
  </Button>
);

export const Danger = () => (
  <Button variant="danger" onClick={() => alert('Destructive action')}>
    Delete Item
  </Button>
);

// Real-world usage examples
export const FormActions = () => (
  <div style={{display: 'flex', gap: '8px'}}>
    <Button variant="primary" type="submit">
      Save Project
    </Button>
    <Button variant="secondary" onClick={() => {}}>
      Cancel
    </Button>
  </div>
);

export const AsyncAction = () => {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      variant="primary"
      loading={loading}
      onClick={async () => {
        setLoading(true);
        await new Promise(resolve => setTimeout(resolve, 2000));
        setLoading(false);
      }}
    >
      Save with Loading
    </Button>
  );
};
````

#### 2.2 Component Discovery System

**File**: `static/app/stories/foundations/component-catalog.stories.tsx`

```typescript
/**
 * Component Catalog - Quick reference for AI and developers
 *
 * @category Layout Components: Panel, Grid, Flex
 * @category Form Components: Form, FormField, TextInput, Select
 * @category Data Components: PanelTable, Charts, Badge
 * @category Navigation: NavTabs, Breadcrumbs, Pagination
 * @category Feedback: Alert, Toast, Modal, Drawer
 */

export const ComponentCategories = () => (
  <div>
    <h2>Layout Components</h2>
    <p>Panel, Grid, Flex - Use for page structure and content organization</p>

    <h2>Form Components</h2>
    <p>Form, FormField, TextInput, Select - Use for user input and data collection</p>

    <h2>Data Components</h2>
    <p>PanelTable, Charts, Badge - Use for displaying information and status</p>

    <h2>Navigation Components</h2>
    <p>NavTabs, Breadcrumbs, Pagination - Use for user navigation and orientation</p>
  </div>
);
```

### Phase 3: External Documentation Integration

#### 3.1 Developer Documentation References

**File**: `.cursor/rules/llms/external-docs.mdc`

```markdown
# External Documentation References

## develop.sentry.dev/frontend/

### Key Pages for AI Context:

1. **Frontend Architecture**: https://develop.sentry.dev/frontend/
   - Explains overall frontend structure and conventions
   - Required reading for understanding Sentry patterns

2. **Component Development**: https://develop.sentry.dev/frontend/components/
   - Guidelines for creating new components
   - Testing and accessibility requirements

3. **Performance Guidelines**: https://develop.sentry.dev/frontend/performance/
   - Code splitting and optimization patterns
   - Bundle size and loading performance standards

4. **Testing Strategy**: https://develop.sentry.dev/frontend/testing/
   - Jest and React Testing Library patterns
   - Integration and end-to-end testing approaches

## brand.getsentry.com

### Design Token Reference:

- Color system and semantic usage
- Typography scale and hierarchy
- Spacing system and layout principles
- Icon library and usage guidelines

### Usage in AI Context:

When suggesting UI changes, reference these guidelines for:

- Color choices (primary, success, warning, error)
- Spacing decisions (4px, 8px, 16px, 24px, 32px)
- Typography hierarchy (h1: 32px, h2: 24px, body: 14px)
- Component styling consistency
```

## File Structure Changes

```
.cursor/
├── rules/
│   ├── ui-architecture.mdc          # ✨ NEW: Frontend architecture patterns
│   ├── design-system.mdc            # ✨ NEW: Component and design guidance
│   ├── frontend-patterns.mdc        # ✨ NEW: Common UI patterns
│   └── llms/
│       └── external-docs.mdc        # ✨ NEW: External documentation links

static/app/stories/
├── foundations/
│   └── component-catalog.stories.tsx # ✨ ENHANCED: Component discovery
├── components/
│   ├── button.stories.tsx           # ✨ ENHANCED: Detailed usage examples
│   ├── panel.stories.tsx            # ✨ ENHANCED: Layout patterns
│   └── form.stories.tsx             # ✨ ENHANCED: Form patterns
└── patterns/
    ├── list-management.stories.tsx   # ✨ NEW: List patterns
    ├── form-patterns.stories.tsx     # ✨ NEW: Form patterns
    └── navigation.stories.tsx        # ✨ NEW: Navigation patterns
```

## Testing Strategy

### 1. AI Context Validation

**Test Prompts**:

```
"Create a form for editing a Sentry project with name, platform, and team fields"
Expected: Uses Form, FormField, TextInput, Select components

"Create a list view for displaying Sentry issues with filtering"
Expected: Uses Panel, PanelTable, SearchBar, FilterButtons

"Add a save button to this form"
Expected: Uses Button variant="primary" with proper styling
```

### 2. Component Discovery Testing

```typescript
// Test that AI can find and use existing components
describe('AI Component Suggestions', () => {
  test('suggests existing Button component over custom button', () => {
    const prompt = 'Add a primary action button';
    const suggestion = getAISuggestion(prompt);
    expect(suggestion).toContain('Button variant="primary"');
    expect(suggestion).not.toContain('<button');
  });

  test('suggests Panel for content containers', () => {
    const prompt = 'Create a container for project settings';
    const suggestion = getAISuggestion(prompt);
    expect(suggestion).toContain('<Panel>');
  });
});
```

### 3. Brand Compliance Testing

```typescript
// Automated checks for design token usage
describe('Design Token Compliance', () => {
  test('uses approved color tokens', () => {
    const suggestions = getAISuggestions();
    suggestions.forEach(suggestion => {
      const colors = extractColors(suggestion);
      colors.forEach(color => {
        expect(APPROVED_COLORS).toContain(color);
      });
    });
  });
});
```

## Deployment Plan

### Phase 1: Foundation (Week 1-2)

- [ ] Create `.cursor/rules/ui-architecture.mdc`
- [ ] Document MobX patterns and routing structure
- [ ] Add local development setup documentation
- [ ] Create onboarding guidance for new team members

### Phase 2: Design System (Week 3-4)

- [ ] Create `.cursor/rules/design-system.mdc`
- [ ] Extract design tokens from brand guidelines
- [ ] Document top 20 components with usage patterns
- [ ] Enhance Button, Panel, Form stories with AI context

### Phase 3: Patterns (Week 5-6)

- [ ] Create `.cursor/rules/frontend-patterns.mdc`
- [ ] Document list management patterns
- [ ] Create form validation and modal patterns
- [ ] Add component relationship mappings

### Phase 4: Integration (Week 7-8)

- [ ] Add external documentation references
- [ ] Test AI understanding with validation prompts
- [ ] Create feedback collection mechanism
- [ ] Refine documentation based on usage

## Success Metrics

### Technical Validation

- [ ] Component reuse rate in AI suggestions: >75%
- [ ] Brand guideline compliance: 100%
- [ ] TypeScript compilation success: 100%
- [ ] Accessibility audit pass rate: >90%
- [ ] New team member onboarding success: >100% report AI rules helped

### Quality Assurance

- [ ] AI-generated components pass visual review: >90%
- [ ] Time reduction in UI polish: >50%
- [ ] Core UI pattern coverage: 100%
- [ ] Brand violations: 0

## Risk Mitigation

### Documentation Maintenance

**Implementation**:

- Tie documentation updates to component library changes via GitHub Actions
- Create automated validation checks for component examples
- Assign documentation ownership to component maintainers

### AI Context Overload

**Implementation**:

- Prioritize 20 most commonly used components first
- Use progressive disclosure with summary sections
- Implement context relevance scoring based on current file context

### Team Adoption

**Implementation**:

- Create onboarding sessions for AI-assisted development
- Provide feedback channels for documentation improvements
- Establish code review guidelines for AI-assisted features

## Monitoring and Analytics

### Usage Tracking

```typescript
// Track AI suggestion acceptance rates
analytics.track('ai_suggestion_accepted', {
  component_type: 'Button',
  pattern_type: 'form_action',
  context: 'project_settings',
});

// Track component reuse vs. custom creation
analytics.track('component_usage', {
  reused_existing: true,
  component_name: 'Panel',
  suggestion_source: 'ai_cursor',
});
```

### Success Metrics Dashboard

- Component reuse rates over time
- Brand compliance scores
- Development velocity improvements
- New team member onboarding speed

## Next Steps

1. **Team Review** - Present implementation plan to frontend and design teams
2. **Prototype Validation** - Create sample `.mdc` files and test with AI
3. **Phased Rollout** - Implement in phases with continuous feedback
4. **Success Measurement** - Establish baseline metrics and tracking
5. **Iteration** - Refine based on usage patterns and team feedback

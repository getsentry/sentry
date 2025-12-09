# Sentry Settings Architecture Documentation

**Last Updated:** 2025-12-09
**Purpose:** Technical reference for settings redesign project

## Table of Contents

1. [Overview](#overview)
2. [Route Structure](#route-structure)
3. [Component Architecture](#component-architecture)
4. [Auxiliary Features](#auxiliary-features)
5. [Backend Integration](#backend-integration)
6. [Migration Considerations](#migration-considerations)
7. [Architecture Flowchart](#architecture-flowchart)

---

## Overview

The Sentry settings system is organized into three main sections:

- **Account Settings** (`/settings/account/`) - User-specific settings
- **Organization Settings** (`/settings/:orgId/`) - Organization-level settings
- **Project Settings** (`/settings/:orgId/projects/:projectId/`) - Project-specific settings

All settings routes are wrapped by the `SettingsWrapper` component and use a consistent layout and navigation pattern.

### Key Files

| Component            | Location                                                                | Purpose                                 |
| -------------------- | ----------------------------------------------------------------------- | --------------------------------------- |
| **Routes**           | `static/app/router/routes.tsx`                                          | Main route definitions                  |
| **Settings Wrapper** | `static/app/views/settings/components/settingsWrapper.tsx`              | Root wrapper for all settings           |
| **Settings Layout**  | `static/app/views/settings/components/settingsLayout.tsx`               | Layout with header, breadcrumbs, search |
| **Account Layout**   | `static/app/views/settings/account/accountSettingsLayout.tsx`           | Account settings wrapper                |
| **Org Layout**       | `static/app/views/settings/organization/organizationSettingsLayout.tsx` | Organization settings wrapper           |
| **Project Layout**   | `static/app/views/settings/project/projectSettingsLayout.tsx`           | Project settings wrapper                |

---

## Route Structure

### Route Hierarchy in `routes.tsx`

```
settingsRoutes (path: /settings/)
├── SettingsWrapper (component)
├── settingsIndex (index route)
├── accountSettingsRoutes (path: account/)
│   ├── AccountSettingsLayout (component)
│   └── children: [details, notifications, security, emails, etc.]
└── :orgId/ (organization route)
    ├── orgSettingsRoutes
    │   ├── OrganizationSettingsLayout (component)
    │   └── children: [general, teams, members, integrations, etc.]
    ├── projectSettingsRoutes (path: projects/:projectId/)
    │   ├── ProjectSettingsLayout (component)
    │   └── children: [general, alerts, keys, filters, etc.]
    ├── subscriptionSettingsRoutes (hook-based)
    └── legacySettingsRedirects (redirects)
```

### Account Settings Routes

**Base Path:** `/settings/account/`

Routes defined in `accountSettingsChildren` (routes.tsx:337-504):

- `/details/` - Account Details
- `/notifications/` - Notification Settings
  - `/:fineTuneType/` - Fine Tune Alerts
- `/security/` - Security Settings
- `/emails/` - Email Addresses
- `/subscriptions/` - Marketing Subscriptions
- `/authorizations/` - Authorized Applications
- `/identities/` - Third-party Identities
- `/api/` - API Configuration
  - `/auth-tokens/` - Personal Tokens
  - `/applications/` - OAuth Applications
- `/close-account/` - Close Account

### Organization Settings Routes

**Base Path:** `/settings/:orgId/`

Routes defined in `orgSettingsChildren` (routes.tsx:805-1269):

- `/` - General Settings
- `/stats/` - Stats & Usage
- `/projects/` - Projects Management
- `/teams/` - Teams Management
  - `/:teamId/` - Team Details
  - `/:teamId/settings/` - Team Settings
- `/members/` - Member Management
  - `/new/` - Invite Members
  - `/:memberId/` - Member Details
- `/security-and-privacy/` - Security & Privacy
- `/auth/` - SSO Configuration
- `/api-keys/` - API Keys (feature gated)
- `/audit-log/` - Audit Log
- `/data-forwarding/` - Data Forwarding (beta)
- `/relay/` - Relay Configuration
- `/repos/` - Repository Integration
- `/integrations/` - Integrations
  - `/:integrationId/` - Integration Details
  - `/:providerKey/:integrationId/` - Provider-specific
- `/early-features/` - Early Feature Access
- `/dynamic-sampling/` - Dynamic Sampling (alpha)
- `/feature-flags/` - Feature Flag Integration
- `/seer/` - Seer Automation Settings
- `/auth-tokens/` - Organization Tokens
- `/developer-settings/` - Custom Integrations

### Project Settings Routes

**Base Path:** `/settings/:orgId/projects/:projectId/`

Routes defined in `projectSettingsChildren` (routes.tsx:513-797):

**Project Section:**

- `/` - General Settings
- `/teams/` - Project Teams
- `/alerts/` - Alert Settings
  - `/rules/` - Alert Rules
  - `/metric-rules/` - Metric Alert Rules
- `/tags/` - Tags & Context
- `/environments/` - Environments
  - `/:environment/` - Environment Details
- `/ownership/` - Ownership Rules
- `/data-forwarding/` - Data Forwarding
- `/seer/` - Seer Settings
- `/user-feedback/` - User Feedback
- `/toolbar/` - Dev Toolbar (beta)

**Processing Section:**

- `/filters/` - Inbound Filters
- `/security-and-privacy/` - Security & Privacy
- `/issue-grouping/` - Issue Grouping
- `/debug-symbols/` - Debug Files
- `/proguard/` - ProGuard Mappings
- `/source-maps/` - Source Maps
- `/performance/` - Performance Settings
- `/replays/` - Replay Settings
- `/playstation/` - PlayStation Settings

**SDK Setup Section:**

- `/keys/` - Client Keys (DSN)
  - `/:keyId/` - Key Details
- `/loader-script/` - Loader Script
- `/release-tracking/` - Release Tracking
- `/security-headers/` - Security Headers
  - `/csp/` - Content Security Policy
  - `/expect-ct/` - Expect-CT
  - `/hpkp/` - HTTP Public Key Pinning

**Legacy Integrations:**

- `/plugins/` - Legacy Integrations
- `/plugins/:pluginId/` - Plugin Details
- `/hooks/` - Service Hooks
  - `/:hookId/` - Hook Details

### Legacy Redirects

The `legacySettingsRedirects` object handles old URL patterns:

```javascript
// Old: /settings/:orgId/:projectId/
// New: /settings/:orgId/projects/:projectId/
{
  path: ':projectId/',
  redirectTo: 'projects/:projectId/',
}
```

These redirects ensure backward compatibility when changing URL structures.

---

## Component Architecture

### Component Hierarchy

```
SettingsWrapper
└── BreadcrumbProvider
    └── SettingsLayout
        ├── SettingsHeader
        │   ├── SettingsBreadcrumb (with navigation)
        │   └── SettingsSearch (cmd+k integration)
        └── Content
            └── [Account|Organization|Project]SettingsLayout
                └── Actual Settings Page Component
```

### Key Components

#### SettingsWrapper

**Location:** `static/app/views/settings/components/settingsWrapper.tsx`

- Root wrapper for all settings routes
- Provides breadcrumb context via `BreadcrumbProvider`
- Handles scroll-to-top behavior
- Simple flex container with styling

**Key Features:**

- Scroll management with `useScrollToTop`
- Breadcrumb context for all child components
- Consistent styling and layout

#### SettingsLayout

**Location:** `static/app/views/settings/components/settingsLayout.tsx`

The main layout component that provides:

1. **Header Section:**
   - `SettingsBreadcrumb` - Navigation breadcrumbs
   - `SettingsSearch` - Search functionality (cmd+k)

2. **Content Section:**
   - Max-width container (1440px)
   - Flexible content area
   - Responsive padding

**Important Styling Notes:**

- Uses flex layout for vertical stretching
- Max width of 1440px (formerly `theme.settings.containerWidth`)
- Responsive padding (16px mobile, 32px desktop)
- Prevents overflow issues with `min-width: 0`

#### SettingsBreadcrumb System

**Location:** `static/app/views/settings/components/settingsBreadcrumb/`

Complex breadcrumb system with multiple components:

| Component                | Purpose                          |
| ------------------------ | -------------------------------- |
| `index.tsx`              | Main breadcrumb orchestrator     |
| `crumb.tsx`              | Individual breadcrumb item       |
| `breadcrumbTitle.tsx`    | Dynamic title rendering          |
| `breadcrumbDropdown.tsx` | Dropdown for switching contexts  |
| `organizationCrumb.tsx`  | Organization-specific breadcrumb |
| `projectCrumb.tsx`       | Project-specific breadcrumb      |
| `teamCrumb.tsx`          | Team-specific breadcrumb         |
| `context.tsx`            | Breadcrumb context provider      |
| `divider.tsx`            | Visual separator                 |

**Features:**

- Context-aware navigation (org, project, team)
- Dropdown for switching between resources
- Dynamic breadcrumb generation based on route
- Integration with React Router

#### SettingsSearch

**Location:** `static/app/views/settings/components/settingsSearch/`

Search component with:

- Entry point identifier: `"settings_search"`
- Minimum search length: 1 character
- Maximum results: 10
- Keyboard shortcut: `/` key

Uses the generic `Search` component with multiple data sources:

- `FormSource` - Searches form fields
- `RouteSource` - Searches navigation routes
- `ApiSource` - Searches API data
- `OrganizationsSource` - Searches organizations
- `CommandSource` - Searches commands

---

## Auxiliary Features

### 1. Settings Search (Command Palette Integration)

#### Search Component

**Location:** `static/app/components/search/index.tsx`

The settings search integrates with Sentry's global search system:

**Entry Points:**

- `settings_search` - Settings page search bar
- `command_palette` - Global command palette (cmd+k)
- `sidebar_help` - Sidebar help search

**Data Sources:**

##### FormSource

**Location:** `static/app/components/search/sources/formSource.tsx`

- Searches through all form fields defined in `static/app/data/forms/`
- Uses webpack's `require.context` to dynamically import form configurations
- Each form config exports:
  - `route` - The settings page URL
  - `formGroups` or `fields` - Field definitions
- Search keys: `title`, `description`
- Result includes anchor links to specific fields: `{route}#{fieldName}`

**Example Form Config:**

```typescript
// static/app/data/forms/accountDetails.tsx
export const route = '/settings/account/details/';

const formGroups: JsonFormObject[] = [
  {
    title: 'Account Details',
    fields: [
      {
        name: 'name',
        type: 'string',
        label: 'Name',
        help: 'Your full name',
      },
    ],
  },
];
```

##### RouteSource

**Location:** `static/app/components/search/sources/routeSource.tsx`

- Searches through navigation configurations
- Sources:
  - `getUserOrgNavigationConfiguration()` - Org settings nav
  - `projectSettingsNavigation()` - Project settings nav
  - Hook-based navigation configs
- Filters items based on feature flags and permissions
- Search keys: `title`, `description`

**Navigation Item Structure:**

```typescript
{
  path: '/settings/:orgId/members/',
  title: 'Members',
  description: 'Manage user membership for an organization',
  id: 'members',
  show: ({access}) => access?.has('org:read'),
  recordAnalytics: true,
}
```

#### Search Analytics

All search interactions are tracked:

- `settings_search.open` - Search opened
- `settings_search.query` - Search query entered
- `settings_search.select` - Result selected

Tracked properties:

- `query` - Search term
- `result_type` - Type of result (field, route, etc.)
- `source_type` - Source of result (form, route, etc.)

### 2. Navigation Configuration System

#### Organization Settings Navigation

**Location:** `static/app/views/settings/organization/userOrgNavigationConfiguration.tsx`

Defines three navigation sections:

1. **Account Section** (`settings-account`)
   - Account Details
   - Security
   - Notifications
   - Email Addresses
   - Subscriptions
   - Authorized Applications
   - Identities
   - Close Account

2. **Organization Section** (`settings-organization`)
   - General Settings
   - Stats & Usage
   - Projects
   - Teams
   - Members
   - Security & Privacy
   - Auth (SSO)
   - API Keys (feature gated)
   - Audit Log
   - Data Forwarding (beta, feature gated)
   - Relay
   - Repositories
   - Integrations
   - Early Features
   - Dynamic Sampling (alpha)
   - Feature Flags
   - Seer Automation

3. **Developer Settings** (`settings-developer`)
   - Organization Tokens
   - Personal Tokens
   - Custom Integrations
   - Applications

**Navigation Item Properties:**

```typescript
{
  path: string;              // Route path
  title: string;             // Display title
  description?: string;      // Search description
  id?: string;              // Unique identifier
  index?: boolean;          // Index route flag
  show?: (context) => boolean;  // Visibility condition
  badge?: () => ReactNode;  // Badge (new, beta, alpha)
  recordAnalytics?: boolean;  // Track navigation
}
```

#### Project Settings Navigation

**Location:** `static/app/views/settings/project/navigationConfiguration.tsx`

Function-based configuration accepting:

- `project` - Project object
- `organization` - Organization object
- `debugFilesNeedsReview` - Debug files status

Defines four sections:

1. **Project** (`settings-project`) - General settings, teams, alerts
2. **Processing** (`settings-processing`) - Filters, grouping, debug files
3. **SDK Setup** (`settings-sdk`) - Keys, releases, security headers
4. **Legacy Integrations** (`settings-legacy-integrations`) - Plugins

**Conditional Visibility Examples:**

```typescript
{
  path: '/filters/',
  title: 'Inbound Filters',
  show: () => !isSelfHostedErrorsOnly,
}

{
  path: '/toolbar/',
  title: 'Dev Toolbar',
  show: () => !!organization?.features?.includes('sentry-toolbar-ui'),
  badge: () => 'beta',
}
```

### 3. URL Normalization and Customer Domains

**Location:** `static/app/utils/url/normalizeUrl.tsx`

Handles URL normalization for customer domain deployments:

**Normalization Patterns:**

```javascript
// Remove organization slug from URLs
/\/organizations\/(?!new)[^/]+\/(.*)/ → '/$1'

// Normalize organization settings root
/\/settings\/(?!account|billing|projects|teams|stats)[^/]+\/?$/ → '/settings/organization/'

// Move org-specific settings to generic path
/^\/?settings\/(?!account|billing|projects|teams|stats)[^/]+\/(.*)/ → '/settings/$1'
```

**Impact on Redesign:**

- URL structure must remain compatible with these patterns
- Customer domain users see different URLs than multi-tenant users
- Link generation must use `normalizeUrl()` for proper routing

### 4. Form Configuration System

**Location:** `static/app/data/forms/`

Centralized form definitions for settings pages:

**Form Files:**

- `accountDetails.tsx` - Account information
- `accountPreferences.tsx` - User preferences
- `accountPassword.tsx` - Password change
- `accountNotificationSettings.tsx` - Notification preferences
- `accountEmails.tsx` - Email management
- `organizationGeneralSettings.tsx` - Org settings
- `organizationSecurityAndPrivacyGroups.tsx` - Security settings
- `projectGeneralSettings.tsx` - Project settings
- `projectSecurityAndPrivacyGroups.tsx` - Project security
- `projectIssueGrouping.tsx` - Grouping configuration
- `projectAlerts.tsx` - Alert configuration
- `inboundFilters.tsx` - Filter settings
- `userFeedback.tsx` - Feedback settings
- `cspReports.tsx` - CSP reporting
- `teamSettingsFields.tsx` - Team settings
- `apiApplication.tsx` - OAuth app config
- `sentryApplication.tsx` - Sentry app config

**Form Structure:**

```typescript
// Export route for search integration
export const route = '/settings/account/details/';

// Form groups define sections
const formGroups: JsonFormObject[] = [
  {
    title: 'Account Details',
    fields: [
      {
        name: 'name',
        type: 'string',
        required: true,
        label: 'Name',
        placeholder: 'e.g. John Doe',
        help: 'Your full name',
        // Conditional visibility
        visible: ({user}) => user.email !== user.username,
        // Conditional disabled state
        disabled: ({user}) => user.isManaged,
      },
    ],
  },
];
```

**Field Types:**

- `string` - Text input
- `email` - Email input
- `select` - Dropdown
- `boolean` - Checkbox
- `number` - Number input
- `textarea` - Multi-line text
- `choice` - Radio buttons
- Custom field types via function definitions

### 5. Redirects and Backward Compatibility

**Location:** `static/app/router/routes.tsx` (legacySettingsRedirects)

Current redirect patterns:

```javascript
{
  path: ':projectId/',
  redirectTo: 'projects/:projectId/',
},
{
  path: ':projectId/alerts/',
  redirectTo: 'projects/:projectId/alerts/',
},
{
  path: ':projectId/alerts/rules/',
  redirectTo: 'projects/:projectId/alerts/rules/',
},
{
  path: ':projectId/alerts/rules/:ruleId/',
  redirectTo: 'projects/:projectId/alerts/rules/:ruleId/',
},
```

**Redirect Strategy:**

- Old project routes under `/settings/:orgId/:projectId/`
- Redirect to `/settings/:orgId/projects/:projectId/`
- Maintains backward compatibility for bookmarks and external links

**Additional System Redirects:**

```javascript
// Root account redirect
{
  path: '/account/',
  redirectTo: '/settings/account/details/',
}
```

### 6. Deep Linking and Anchor Navigation

**Form Field Anchors:**

Settings forms support direct linking to specific fields via URL hash:

```
/settings/account/details/#name
/settings/:orgId/security-and-privacy/#dataScrubber
```

Implementation:

- FormSource generates URLs with `hash: `#${encodeURIComponent(field.name)}`
- Search results link directly to specific form fields
- Improves discoverability of specific settings

**Usage Example:**

```typescript
// FormSource result generation
{
  to: {
    pathname: item.route,
    hash: `#${encodeURIComponent(item.field.name)}`
  }
}
```

---

## Backend Integration

### API Patterns

Settings pages interact with the backend through well-defined API endpoints:

#### Account Settings

**Endpoint:** `/users/me/`

- Methods: GET, PUT
- Returns: `User` object
- Updates: User profile, preferences, security settings

**Example Usage:**

```typescript
const USER_ENDPOINT = '/users/me/';

const {
  data: user,
  isPending,
  isError,
  refetch,
} = useApiQuery<User>([USER_ENDPOINT], {staleTime: 0});

// Update with PUT
const formProps = {
  apiEndpoint: USER_ENDPOINT,
  apiMethod: 'PUT',
  saveOnBlur: true,
  allowUndo: true,
};
```

#### Organization Settings

**Endpoint:** `/organizations/:orgSlug/`

- Methods: GET, PUT
- Returns: `Organization` object
- Updates: Org name, slug, settings, features

**Special Handling:**

```typescript
// Slug changes require redirect
if (updated.slug !== prevData.slug) {
  changeOrganizationSlug(prevData, updated);
  navigate(`/settings/${updated.slug}/`);
}

// Regular updates use updateOrganization action
updateOrganization(updated);
```

#### Project Settings

**Endpoint:** `/projects/:orgSlug/:projectSlug/`

- Methods: GET, PUT, DELETE
- Returns: `Project` object
- Updates: Project configuration, processing settings

#### Team Settings

**Endpoint:** `/teams/:orgSlug/:teamSlug/`

- Methods: GET, PUT, POST, DELETE
- Returns: `Team` object

### Data Flow Patterns

#### 1. React Query Pattern (Modern)

```typescript
// Fetch data
const {data, isPending, isError, refetch} = useApiQuery<DataType>(['/endpoint/'], {
  staleTime: 0,
});

// Update data
const handleSubmitSuccess = (newData: DataType) => {
  setApiQueryData(queryClient, ['/endpoint/'], newData);
  updateStore(newData); // Update legacy stores if needed
};
```

#### 2. Store-based Pattern (Legacy)

Some settings still use legacy stores:

- `ConfigStore` - Global configuration
- `OrganizationStore` - Current organization
- `ProjectsStore` - Projects list

**Example:**

```typescript
// Update triggers store update
updateOrganization(updatedOrg);
// Components listening to OrganizationStore will re-render
```

### Form Component Integration

Settings forms use `JsonForm` component with API integration:

```typescript
<Form
  apiEndpoint="/endpoint/"
  apiMethod="PUT"
  saveOnBlur={true}
  allowUndo={true}
  onSubmitSuccess={handleSuccess}
>
  <JsonForm
    forms={formGroups}
    // Field configurations
  />
</Form>
```

**Form Props:**

- `apiEndpoint` - API URL
- `apiMethod` - HTTP method (GET, POST, PUT, DELETE)
- `saveOnBlur` - Auto-save on field blur
- `allowUndo` - Enable undo for changes
- `onSubmitSuccess` - Success callback
- `onSubmitError` - Error callback
- `initialData` - Initial form values

### API Endpoint Mapping

| Setting Type         | Endpoint Pattern                                | Model                |
| -------------------- | ----------------------------------------------- | -------------------- |
| User Account         | `/users/me/`                                    | User                 |
| User Emails          | `/users/me/emails/`                             | UserEmail            |
| User Notifications   | `/users/me/notifications/`                      | NotificationSettings |
| User Identities      | `/users/me/identities/`                         | UserIdentity         |
| User Auth Tokens     | `/api-tokens/`                                  | ApiToken             |
| Organization         | `/organizations/:orgSlug/`                      | Organization         |
| Org Members          | `/organizations/:orgSlug/members/`              | OrganizationMember   |
| Org Teams            | `/organizations/:orgSlug/teams/`                | Team                 |
| Org Integrations     | `/organizations/:orgSlug/integrations/`         | Integration          |
| Org Repos            | `/organizations/:orgSlug/repos/`                | Repository           |
| Org API Keys         | `/organizations/:orgSlug/api-keys/`             | ApiKey               |
| Org Audit Log        | `/organizations/:orgSlug/audit-logs/`           | AuditLogEntry        |
| Project              | `/projects/:orgSlug/:projectSlug/`              | Project              |
| Project Keys         | `/projects/:orgSlug/:projectSlug/keys/`         | ProjectKey           |
| Project Teams        | `/projects/:orgSlug/:projectSlug/teams/`        | ProjectTeam          |
| Project Filters      | `/projects/:orgSlug/:projectSlug/filters/`      | FilterConfig         |
| Project Ownership    | `/projects/:orgSlug/:projectSlug/ownership/`    | ProjectOwnership     |
| Project Tags         | `/projects/:orgSlug/:projectSlug/tags/`         | TagKey               |
| Project Environments | `/projects/:orgSlug/:projectSlug/environments/` | Environment          |

### Permissions and Access Control

Settings pages check permissions via:

1. **Organization Access:**

```typescript
const organization = useOrganization();
const hasAccess = organization.access.includes('org:write');
```

2. **Feature Flags:**

```typescript
const organization = useOrganization();
const hasFeature = organization.features.includes('feature-name');
```

3. **Navigation Config:**

```typescript
{
  path: '/api-keys/',
  show: ({access, features}) =>
    features?.has('api-keys') && access?.has('org:admin')
}
```

4. **Component-level:**

```typescript
<OrganizationPermissionAlert />
// Shows alert if user lacks required permissions
```

### Data Persistence Strategy

1. **Optimistic Updates:**
   - Form updates are saved immediately on blur
   - UI updates before API response
   - Rollback on error

2. **Undo Functionality:**
   - `allowUndo` prop enables undo button
   - Temporary storage of previous values
   - Revert API call on undo

3. **Cache Management:**
   - React Query manages API cache
   - `staleTime: 0` forces refetch
   - Manual cache updates via `setApiQueryData`

---

## Migration Considerations

When redesigning the settings pages, the following dependencies must be migrated or maintained:

### 1. Search Integration (Critical)

**Current Implementation:**

- FormSource dynamically loads forms from `static/app/data/forms/`
- Each form config exports a `route` and field definitions
- Search results link to `{route}#{fieldName}` for deep linking

**Migration Requirements:**

- **Option A:** Keep form configs in `data/forms/` with same structure
- **Option B:** Create new search index/manifest for settings
- **Option C:** Build search data at compile time

**Recommendation:** Option A (minimal disruption) or Option B (cleaner architecture)

**Impact:**

- FormSource requires `require.context` for dynamic imports
- Changing directory structure breaks search
- Deep links must remain functional

### 2. Navigation Configuration

**Current Implementation:**

- Navigation defined in configuration objects
- Used by RouteSource for search
- Feature flags control visibility
- Used by breadcrumbs for context

**Migration Requirements:**

- Maintain navigation configuration structure OR
- Update RouteSource to use new navigation system
- Preserve feature flag and permission checks
- Update breadcrumb system

**Considerations:**

- Navigation config used in multiple places
- Some navigation items have badges (new, beta, alpha)
- Analytics tracking on specific navigation items
- Hook-based navigation for extensibility

### 3. URL Structure and Redirects

**Current URL Patterns:**

```
/settings/account/{section}/
/settings/:orgId/
/settings/:orgId/{section}/
/settings/:orgId/projects/:projectId/
/settings/:orgId/projects/:projectId/{section}/
```

**Migration Considerations:**

**If Changing URLs:**

1. Add new routes alongside old routes
2. Create redirect rules in `legacySettingsRedirects`
3. Update `normalizeUrl` patterns if needed
4. Test customer domain compatibility
5. Update all internal links
6. Consider gradual rollout with feature flag

**If Keeping URLs:**

- Minimal routing changes needed
- Component swapping strategy
- Easier migration path

**Affected Systems:**

- Bookmarks and external links
- Documentation links
- Email notification links
- Integration webhooks
- Customer domain routing
- Search result links

### 4. Breadcrumb System

**Current System:**

- Context-aware (org, project, team)
- Dynamic title resolution
- Dropdown for switching contexts
- Route-based generation

**Migration Requirements:**

- Maintain breadcrumb context provider
- Update breadcrumb components for new layout
- Preserve switching functionality
- Test with all route types

**Key Files:**

- `settingsBreadcrumb/context.tsx` - Context provider
- `settingsBreadcrumb/index.tsx` - Main component
- `organizationCrumb.tsx`, `projectCrumb.tsx`, `teamCrumb.tsx`

### 5. Form System Integration

**Current System:**

- JsonForm component with API integration
- Form configs in `data/forms/`
- Field-level permissions and visibility
- Auto-save on blur
- Undo functionality

**Migration Options:**

**Option A: Keep JsonForm System**

- Minimal code changes
- Preserve search integration
- Update styling only
- Fast migration

**Option B: New Form System**

- Modern form library (React Hook Form, Formik)
- Better TypeScript support
- Rebuild search integration
- Requires field inventory
- Longer migration time

**Recommendation:** Evaluate per-section

- Start with Option A for quick wins
- Gradually move to Option B for new sections

### 6. API Endpoint Compatibility

**Considerations:**

- API endpoints are stable
- Response formats are established
- Permission checks are backend-enforced
- Some endpoints support partial updates

**Migration Strategy:**

- No API changes needed initially
- Frontend can be redesigned independently
- Consider API improvements in parallel
- Maintain backward compatibility

**Future Enhancements:**

- Batch updates for related settings
- GraphQL endpoint for settings
- Real-time updates via websockets
- Optimistic update improvements

### 7. Feature Flags and Permissions

**Current Implementation:**

- Navigation items have `show()` conditions
- Feature flags checked in components
- Permissions checked per-action
- Some settings are region-specific

**Migration Requirements:**

- Preserve all feature flag checks
- Maintain permission structure
- Test with various permission levels
- Verify region-specific features

**Testing Requirements:**

- Test with different user roles
- Test with different feature flags
- Test self-hosted vs SaaS
- Test customer domain behavior

### 8. Analytics and Tracking

**Current Events:**

- Navigation clicks (for items with `recordAnalytics: true`)
- Search queries and selections
- Form submissions
- Setting changes

**Migration Requirements:**

- Maintain existing event names
- Preserve event properties
- Add new events for new features
- Update analytics documentation

**Key Analytics:**

```typescript
trackAnalytics('settings_search.select', {
  query: searchTerm,
  result_type: 'field',
  source_type: 'form',
});

trackAnalytics('organization_settings.codecov_access_updated', {
  organization,
  has_access: updated.codecovAccess,
});
```

### 9. Mobile and Responsive Behavior

**Current Implementation:**

- Responsive padding in SettingsLayout
- Mobile-optimized breadcrumbs
- Touch-friendly form inputs
- Collapsible sections

**Migration Considerations:**

- Test on mobile devices
- Ensure touch targets are adequate
- Optimize for smaller screens
- Consider mobile-first design

### 10. Accessibility (a11y)

**Current Implementation:**

- ARIA labels on search input
- Keyboard navigation in breadcrumbs
- Form field labels
- Focus management

**Migration Requirements:**

- Maintain WCAG 2.1 AA compliance
- Test with screen readers
- Keyboard navigation support
- Focus indicators
- Color contrast requirements

---

## Architecture Flowchart

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser Request                        │
│                   /settings/account/details/                 │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     Router (routes.tsx)                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ settingsRoutes: /settings/                             │ │
│  │  ├─ index → settingsIndex                              │ │
│  │  ├─ accountSettingsRoutes: account/                    │ │
│  │  └─ :orgId/ → orgSettingsRoutes + projectSettingsRoutes│ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   SettingsWrapper Component                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ • BreadcrumbProvider (context)                         │ │
│  │ • useScrollToTop hook                                  │ │
│  │ • Styled container                                     │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    SettingsLayout Component                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Header Section:                                        │ │
│  │  ├─ SettingsBreadcrumb                                 │ │
│  │  │   ├─ useBreadcrumbContext()                         │ │
│  │  │   ├─ BreadcrumbDropdown (org/project switcher)     │ │
│  │  │   └─ Dynamic crumbs (org, project, team)           │ │
│  │  └─ SettingsSearch                                     │ │
│  │      ├─ Search Component (entryPoint: settings_search)│ │
│  │      ├─ Hotkey: "/" to focus                          │ │
│  │      └─ Data Sources:                                  │ │
│  │          ├─ FormSource (data/forms/*)                  │ │
│  │          ├─ RouteSource (navigation configs)           │ │
│  │          ├─ ApiSource                                  │ │
│  │          ├─ OrganizationsSource                        │ │
│  │          └─ CommandSource                              │ │
│  │                                                         │ │
│  │ Content Section:                                       │ │
│  │  └─ MaxWidthContainer (1440px)                         │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│          Account/Org/ProjectSettingsLayout Component         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ • Wraps SettingsLayout                                 │ │
│  │ • Provides section-specific context                    │ │
│  │ • Same layout for all sections                         │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   Settings Page Component                    │
│                   (e.g., AccountDetails)                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Data Fetching:                                         │ │
│  │  └─ useApiQuery('/users/me/')                          │ │
│  │                                                         │ │
│  │ Page Structure:                                        │ │
│  │  ├─ SentryDocumentTitle                                │ │
│  │  ├─ SettingsPageHeader                                 │ │
│  │  └─ Form Component                                     │ │
│  │      ├─ apiEndpoint: '/users/me/'                      │ │
│  │      ├─ apiMethod: 'PUT'                               │ │
│  │      ├─ saveOnBlur: true                               │ │
│  │      ├─ allowUndo: true                                │ │
│  │      └─ JsonForm                                       │ │
│  │          └─ forms (from data/forms/accountDetails)     │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Form Configuration                        │
│                data/forms/accountDetails.tsx                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ export const route = '/settings/account/details/';     │ │
│  │                                                         │ │
│  │ const formGroups = [{                                  │ │
│  │   title: 'Account Details',                            │ │
│  │   fields: [                                            │ │
│  │     {                                                  │ │
│  │       name: 'name',                                    │ │
│  │       type: 'string',                                  │ │
│  │       label: 'Name',                                   │ │
│  │       help: 'Your full name',                          │ │
│  │     },                                                 │ │
│  │   ]                                                    │ │
│  │ }];                                                    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

                     Parallel Systems

┌─────────────────────────────────────────────────────────────┐
│                   Search System Flow                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ User types in SettingsSearch                           │ │
│  │         │                                               │ │
│  │         ▼                                               │ │
│  │ Search Component (min 1 char)                          │ │
│  │         │                                               │ │
│  │         ▼                                               │ │
│  │ SearchSources (parallel queries)                       │ │
│  │         ├─────────┬─────────┬──────────┐               │ │
│  │         ▼         ▼         ▼          ▼               │ │
│  │    FormSource RouteSource ApiSource CommandSource     │ │
│  │         │         │         │          │               │ │
│  │         ├─────────┴─────────┴──────────┘               │ │
│  │         ▼                                               │ │
│  │    Fuzzy Search (Fuse.js)                              │ │
│  │         │                                               │ │
│  │         ▼                                               │ │
│  │    Results List (max 10)                               │ │
│  │         │                                               │ │
│  │         ▼                                               │ │
│  │    User selects result                                 │ │
│  │         │                                               │ │
│  │         ▼                                               │ │
│  │    Analytics: settings_search.select                   │ │
│  │         │                                               │ │
│  │         ▼                                               │ │
│  │    Navigate to route (with #anchor if field)           │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  Navigation Config System                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ getUserOrgNavigationConfiguration()                    │ │
│  │         │                                               │ │
│  │         ▼                                               │ │
│  │ Returns NavigationSection[]                            │ │
│  │  ├─ settings-account                                   │ │
│  │  ├─ settings-organization                              │ │
│  │  └─ settings-developer                                 │ │
│  │         │                                               │ │
│  │         ▼                                               │ │
│  │ Used by RouteSource for search                         │ │
│  │         │                                               │ │
│  │         ▼                                               │ │
│  │ Used by SettingsBreadcrumb for navigation              │ │
│  │         │                                               │ │
│  │         ▼                                               │ │
│  │ Feature flags & permissions filter items               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Backend API Flow                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Form Field Changed                                     │ │
│  │         │                                               │ │
│  │         ▼                                               │ │
│  │ Form Component (saveOnBlur: true)                      │ │
│  │         │                                               │ │
│  │         ▼                                               │ │
│  │ PUT /users/me/ (optimistic update)                     │ │
│  │         │                                               │ │
│  │         ├─────────┬──────────┐                         │ │
│  │         ▼         ▼          ▼                         │ │
│  │    Success    Error      onSubmitSuccess               │ │
│  │         │         │          │                         │ │
│  │         │         ▼          ▼                         │ │
│  │         │    Rollback   updateUser()                   │ │
│  │         │                   │                          │ │
│  │         │                   ▼                          │ │
│  │         │          Update ConfigStore                  │ │
│  │         │                   │                          │ │
│  │         │                   ▼                          │ │
│  │         │          setApiQueryData()                   │ │
│  │         │                   │                          │ │
│  │         └───────────────────┘                          │ │
│  │                     │                                   │ │
│  │                     ▼                                   │ │
│  │            UI Updated (re-render)                      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 2 Checklist

For the next phase of backend analysis, investigate:

### Backend Data Storage

- [ ] Map settings to database models
- [ ] Identify settings stored in:
  - [ ] PostgreSQL tables
  - [ ] Redis cache
  - [ ] ClickHouse (analytics settings)
- [ ] Document model relationships
- [ ] Identify option flags vs database fields

### API Endpoint Analysis

- [ ] List all settings-related API endpoints
- [ ] Document request/response schemas
- [ ] Identify endpoints that need updates
- [ ] Check permission decorators
- [ ] Review serializers used
- [ ] Test API compatibility

### Settings Options System

- [ ] Review `src/sentry/options/defaults.py`
- [ ] Map options to UI settings
- [ ] Understand option scopes (global, org, project)
- [ ] Document option types and validators

### Database Models

Key models to investigate:

- [ ] `User` model (`src/sentry/models/user.py`)
- [ ] `Organization` model (`src/sentry/models/organization.py`)
- [ ] `Project` model (`src/sentry/models/project.py`)
- [ ] `Team` model (`src/sentry/models/team.py`)
- [ ] `UserOption` model (user preferences)
- [ ] `OrganizationOption` model (org settings)
- [ ] `ProjectOption` model (project settings)

### Migration Impact Analysis

- [ ] Identify settings that can be moved/renamed
- [ ] Identify settings with complex validation
- [ ] Check for settings with external dependencies
- [ ] Review settings with feature flag requirements
- [ ] Document settings that affect billing

---

## Notes and Observations

### Strengths of Current System

1. **Consistent Layout:** All settings use the same wrapper and layout components
2. **Search Integration:** Comprehensive search across routes and form fields
3. **Modular Forms:** Centralized form definitions in `data/forms/`
4. **Feature Flags:** Granular control over settings visibility
5. **Deep Linking:** Direct links to specific form fields via hash
6. **Breadcrumbs:** Context-aware navigation with switching capability
7. **Auto-save:** Forms save automatically on blur
8. **Undo:** Users can revert changes easily

### Pain Points

1. **Navigation Discovery:** Hard to understand the full settings tree
2. **Form Field Organization:** Some forms are very long
3. **Search UX:** Results don't indicate which section they're in
4. **Mobile Experience:** Some settings are hard to use on mobile
5. **Permissions:** Not always clear why a setting is hidden
6. **Documentation:** Settings lack inline documentation in some cases
7. **Breadcrumb Complexity:** System is complex with many files

### Opportunities for Redesign

1. **Visual Grouping:** Better visual hierarchy for related settings
2. **Progressive Disclosure:** Hide advanced settings by default
3. **Contextual Help:** Inline documentation and examples
4. **Settings Search:** Improve search UI and result presentation
5. **Mobile-first:** Design for mobile from the start
6. **Onboarding:** Highlight important settings for new users
7. **Quick Actions:** Common actions accessible from settings list
8. **Settings Hub:** Overview page showing important settings status
9. **Guided Setup:** Wizards for complex multi-step configurations
10. **Comparison Views:** Compare settings across projects/orgs

---

## References

### Key Files for Redesign

**Routing:**

- `static/app/router/routes.tsx` - Main route definitions

**Components:**

- `static/app/views/settings/components/settingsWrapper.tsx`
- `static/app/views/settings/components/settingsLayout.tsx`
- `static/app/views/settings/components/settingsBreadcrumb/`
- `static/app/views/settings/components/settingsSearch/`

**Navigation:**

- `static/app/views/settings/organization/userOrgNavigationConfiguration.tsx`
- `static/app/views/settings/project/navigationConfiguration.tsx`

**Forms:**

- `static/app/data/forms/` (all form configurations)
- `static/app/components/forms/` (form components)

**Search:**

- `static/app/components/search/index.tsx`
- `static/app/components/search/sources/formSource.tsx`
- `static/app/components/search/sources/routeSource.tsx`

**Utils:**

- `static/app/utils/url/normalizeUrl.tsx`
- `static/app/utils/replaceRouterParams.tsx`

### Related Documentation

- [Sentry Development Guide](https://develop.sentry.dev/)
- [Devservices Documentation](https://develop.sentry.dev/development-infrastructure/devservices)
- [Frontend Development Guide](./AGENTS.md#sentry-frontend-development-guide)

---

**End of Document**

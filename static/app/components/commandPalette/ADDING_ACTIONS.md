# Adding Command Palette Actions

The command palette (Cmd+K / Ctrl+K) supports feature-specific actions that appear contextually — registered when your component mounts, removed when it unmounts.

## Quick Start

```tsx
import {useCommandPaletteActionsRegister} from 'sentry/components/commandPalette/context';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';

function MyFeaturePage() {
  useCommandPaletteActionsRegister([
    {
      display: {label: t('Go to My Feature Settings'), icon: <IconSettings />},
      to: `/organizations/${org.slug}/settings/my-feature/`,
    },
  ]);

  return <div>...</div>;
}
```

That's it. Actions are automatically removed when the component unmounts.

---

## Action Types

### Navigation — `to`

Navigates to a route when selected.

```tsx
{
  display: {label: t('All Projects')},
  to: `/organizations/${org.slug}/projects/`,
}
```

### Callback — `onAction`

Executes a function when selected. Use this for opening modals, toggling UI state, etc.

```tsx
{
  display: {label: t('Invite Team Members'), icon: <IconUser />},
  keywords: [t('add member'), t('invite')],
  onAction: () => openInviteMembersModal(),
}
```

### Group — `actions`

Shows a nested list when selected. Useful for grouping related actions under a heading. Max two levels deep.

```tsx
{
  display: {label: t('Crons'), icon: <IconTimer />},
  actions: [
    {
      display: {label: t('All Monitors')},
      to: `/organizations/${org.slug}/insights/crons/`,
    },
    {
      display: {label: t('Create Monitor'), icon: <IconAdd />},
      to: `/organizations/${org.slug}/insights/crons/create/`,
    },
  ],
}
```

### Async — `resource`

Fetches results dynamically as the user types. The `resource` function receives the current query string and returns TanStack Query options. Results are displayed as they load.

```tsx
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {queryOptions} from 'sentry/utils/queryClient';
import type {CMDKQueryOptions} from 'sentry/components/commandPalette/types';

{
  display: {
    label: t('Search Releases'),
    details: t('Type a version to search'),
    icon: <IconSearch />,
  },
  actions: [], // shown before async results load
  resource: (query): CMDKQueryOptions =>
    queryOptions({
      ...apiOptions.as<Release[]>()('/organizations/$organizationIdOrSlug/releases/', {
        path: {organizationIdOrSlug: org.slug},
        query: {query, per_page: 5},
        staleTime: 30_000,
      }),
      enabled: query.length > 1,
      select: data =>
        data.json.map(release => ({
          display: {label: release.version},
          to: `/organizations/${org.slug}/releases/${release.version}/`,
        })),
    }),
}
```

> Async results can only return `to`, `onAction`, or nested groups — they cannot chain another `resource`.

---

## Display Options

```ts
display: {
  label: string;    // required — primary text
  details?: string; // secondary/description text
  icon?: ReactNode; // icon from sentry/icons
}
keywords?: string[]; // extra search terms (not shown to user)
```

---

## Where to Register

| Scope                        | Where                                |
| ---------------------------- | ------------------------------------ |
| Always available (org-level) | `useGlobalCommandPaletteActions.tsx` |
| Only while a page is open    | Inside the page component itself     |

For page-specific actions, call `useCommandPaletteActionsRegister` directly in your view component. No wiring needed — the provider is already set up at the app root.

### Respecting feature flags

```tsx
const hasMyFeature = organization.features.includes('my-feature');

useCommandPaletteActionsRegister(
  hasMyFeature ? [{display: {label: t('My Feature')}, to: `${prefix}/my-feature/`}] : []
);
```

---

## Tips

- **Use `t()`** for all labels and keywords — they're user-visible strings.
- **Use `keywords`** to catch synonyms (`keywords: [t('alerts'), t('notifications')]`).
- **Filter undefined** when conditionally including actions:
  ```tsx
  [someCondition ? {display: {label: t('...')}, to: '...'} : undefined].filter(
    action => action !== undefined
  );
  ```
- **Memoize** action arrays if they depend on expensive hooks to avoid re-registering every render.
- **Avoid deep nesting** — the palette supports two levels max.

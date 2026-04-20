# Seer Utils — Agent Guide

Utilities for Seer/Autofix settings. Covers the project-level preferences API, coding agent integrations, and stopping point logic.

## API Endpoints

| Endpoint                                            | Method | Purpose                                                 |
| --------------------------------------------------- | ------ | ------------------------------------------------------- |
| `/organizations/{slug}/integrations/coding-agents/` | GET    | List available coding agent integrations                |
| `/projects/{org}/{project}/`                        | PUT    | Set `autofixAutomationTuning: 'off' \| 'medium'`        |
| `/projects/{org}/{project}/seer/preferences/`       | GET    | Fetch project Seer preferences                          |
| `/projects/{org}/{project}/seer/preferences/`       | POST   | Update stopping point, handoff config, and repositories |

## React Query Keys

```typescript
organizationIntegrationsCodingAgents(org);
// → ['/organizations/{slug}/integrations/coding-agents/']

makeProjectSeerPreferencesQueryKey(orgSlug, projectSlug);
// → ['/projects/{slug}/{projectSlug}/seer/preferences/']

bulkAutofixAutomationSettingsInfiniteOptions(org);
// → ['/organizations/{slug}/autofix/automation-settings/', ...]
```

After any mutation, invalidate the preferences key and the bulk settings key.

## Core Types

```typescript
interface ProjectSeerPreferences {
  repositories: SeerRepoDefinition[];
  automated_run_stopping_point?: 'root_cause' | 'solution' | 'code_changes' | 'open_pr';
  automation_handoff?: {
    handoff_point: 'root_cause'; // always this value
    integration_id: number;
    target: CodingAgentProvider; // mapped from provider via PROVIDER_TO_HANDOFF_TARGET
    auto_create_pr?: boolean;
  };
}

type CodingAgentIntegration = {
  id: string | null;
  name: string;
  provider: 'cursor' | 'claude_code' | 'github_copilot';
};

// UI-level stopping point values (not sent directly to the API)
type UserFacingStoppingPoint = 'off' | 'root_cause' | 'plan' | 'create_pr';
```

`PROVIDER_TO_HANDOFF_TARGET` maps `provider` strings to `CodingAgentProvider` enum values (e.g. `'cursor'` → `CodingAgentProvider.CURSOR_BACKGROUND_AGENT`).

## Stopping Point: UI Values → API Values

The UI exposes four values that map to two separate API fields:

| UI value       | `autofixAutomationTuning` | `automated_run_stopping_point` |
| -------------- | ------------------------- | ------------------------------ |
| `'off'`        | `'off'`                   | _(unchanged — see note below)_ |
| `'root_cause'` | `'medium'`                | `'root_cause'`                 |
| `'plan'`       | `'medium'`                | `'code_changes'`               |
| `'create_pr'`  | `'medium'`                | `'open_pr'`                    |

**Important:** When setting `'off'`, do not update `automated_run_stopping_point` or `automation_handoff`. The tuning value short-circuits execution before those fields are read, so leaving them stale preserves the user's previous configuration when they re-enable.

## Preferred Agent: How It's Stored

- **Seer selected:** `automation_handoff` is absent/undefined. `autofixAutomationTuning: 'medium'`.
- **External agent selected:** `automation_handoff` is set with `target`, `integration_id`, and `auto_create_pr`. `autofixAutomationTuning: 'medium'`.

When switching to an external agent, carry over `auto_create_pr` from the current state. Check both the stopping point and the existing handoff flag, to correctly handle switching between two external agents:

```typescript
auto_create_pr: preference?.automated_run_stopping_point === 'open_pr' ||
  Boolean(preference?.automation_handoff?.auto_create_pr);
```

## Auto-Create PR: Two Storage Locations

The "auto create PR" concept is stored differently depending on the agent:

- **Seer agent:** stored as `automated_run_stopping_point: 'open_pr'` (no handoff object)
- **External agent:** stored as `automated_run_stopping_point: 'open_pr'` AND `automation_handoff.auto_create_pr: true`

Both are functionally equivalent from the user's perspective.

## Optimistic Updates

Mutations should optimistically update two places:

1. `ProjectsStore.onUpdateSuccess({id, autofixAutomationTuning})` — keeps the projects store in sync
2. The preferences query cache via `setApiQueryData` — prevents stale reads between mutations

Roll back both on error using the values captured in `onMutate`.

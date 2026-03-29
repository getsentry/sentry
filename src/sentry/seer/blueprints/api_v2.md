# Seer Configuration API

Host: https://sentry.io/api/0

**Authors.**

@ryan953

**How to read this document.**

This document is structured by resource with each resource having actions that
can be performed against it. Every action that either accepts a request or
returns a response _will_ document the full interchange format. Clients may opt
to restrict response data or provide a subset of the request data. The API may
or may not accept partial payloads.

## Seer Onboarding Check [/organizations/<organization_id_or_slug>/seer/onboarding-check/]

Checks whether an organization has completed Seer onboarding/configuration. Validates SCM integrations (GitHub/GitHub Enterprise), code review settings, and autofix status.

- Endpoint: `OrganizationSeerOnboardingCheck`
- Source: `src/sentry/seer/endpoints/organization_seer_onboarding_check.py`
- Silo: Region

### Check Onboarding Status [GET]

- Response 200

  **Attributes**

  | Column                     | Type    | Description                                                                                                   |
  | -------------------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
  | hasSupportedScmIntegration | boolean | Whether the org has an active GitHub or GitHub Enterprise integration                                         |
  | isAutofixEnabled           | boolean | Whether autofix is enabled (tuning not `off`) for any active project in the org                               |
  | isCodeReviewEnabled        | boolean | Whether code review is enabled for any active repository in the org                                           |
  | isSeerConfigured           | boolean | `true` when `hasSupportedScmIntegration` AND (`isCodeReviewEnabled` OR `isAutofixEnabled`)                    |
  | needsConfigReminder        | boolean | Whether the org is in the forced config reminder list (via `seer.organizations.force-config-reminder` option) |

  ```json
  {
    "hasSupportedScmIntegration": true,
    "isCodeReviewEnabled": true,
    "isAutofixEnabled": true,
    "needsConfigReminder": false,
    "isSeerConfigured": true
  }
  ```

## Coding Agent Integrations [/organizations/<organization_id_or_slug>/integrations/coding-agents/]

Lists available coding agent integrations and launches coding agents for autofix runs.

- Endpoint: `OrganizationCodingAgentsEndpoint`
- Source: `src/sentry/integrations/api/endpoints/organization_coding_agents.py`
- Silo: Region

### List Coding Agents [GET]

Returns all available coding agent integrations for the organization. Includes org-installed integrations (e.g. Cursor) and user-authenticated providers (e.g. GitHub Copilot, gated behind `organizations:integrations-github-copilot-agent` feature flag).

- Response 200

  **Attributes (per integration)**

  | Column            | Type           | Description                                                    |
  | ----------------- | -------------- | -------------------------------------------------------------- |
  | id                | string \| null | Integration ID. `null` for user-authenticated providers.       |
  | name              | string         | Display name of the integration                                |
  | provider          | string         | Provider key (e.g. `cursor`, `github_copilot`)                 |
  | requires_identity | boolean        | (optional) Whether the provider requires per-user OAuth tokens |
  | has_identity      | boolean        | (optional) Whether the current user has linked their identity  |

  ```json
  {
    "integrations": [
      {
        "id": "12345",
        "name": "Cursor",
        "provider": "cursor"
      },
      {
        "id": null,
        "name": "GitHub Copilot",
        "provider": "github_copilot",
        "requires_identity": true,
        "has_identity": false
      }
    ]
  }
  ```

### Launch Coding Agent [POST]

Launches a coding agent for an existing autofix run. Requires either `integration_id` (for org-installed integrations) or `provider` (for user-authenticated providers), but not both.

- Request (application/json)

  **Attributes**

  | Column         | Type   | Required | Description                                                           |
  | -------------- | ------ | -------- | --------------------------------------------------------------------- |
  | run_id         | int    | Yes      | The autofix run ID (min: 1)                                           |
  | integration_id | int    | No\*     | Integration ID for org-installed integrations (e.g. Cursor)           |
  | provider       | string | No\*     | Provider key for user-authenticated providers (e.g. `github_copilot`) |
  | trigger_source | string | No       | One of: `root_cause`, `solution`. Default: `solution`                 |
  | instruction    | string | No       | Custom instruction for the coding agent (max 4096 chars)              |

  \* Exactly one of `integration_id` or `provider` must be provided.

  ```json
  {
    "run_id": 42,
    "integration_id": 12345,
    "trigger_source": "solution",
    "instruction": "Fix the null pointer exception in the auth handler"
  }
  ```

- Response 200

  **Attributes**

  | Column         | Type                | Description                             |
  | -------------- | ------------------- | --------------------------------------- |
  | success        | boolean             | Whether at least one agent was launched |
  | launched_count | int                 | Number of successfully launched agents  |
  | failed_count   | int                 | Number of failed launches               |
  | failures       | list[LaunchFailure] | (optional) Details of failed launches   |

  **LaunchFailure Attributes**

  | Column                 | Type   | Description                                        |
  | ---------------------- | ------ | -------------------------------------------------- |
  | repo_name              | string | Repository that failed to launch                   |
  | error_message          | string | Human-readable error message                       |
  | failure_type           | string | (optional) Classification of the failure           |
  | github_installation_id | string | (optional) GitHub App installation ID, if relevant |

  ```json
  {
    "success": true,
    "launched_count": 2,
    "failed_count": 1,
    "failures": [
      {
        "repo_name": "getsentry/sentry",
        "error_message": "GitHub App not installed",
        "failure_type": "installation_missing",
        "github_installation_id": "98765"
      }
    ]
  }
  ```

## Organization Projects [/organizations/<organization_id_or_slug>/projects/]

General-purpose Sentry endpoint for listing projects in an organization. Used by `useProjects()` to populate the project list in the Seer automation settings page.

- Endpoint: `OrganizationProjectsEndpoint`
- Source: `src/sentry/api/endpoints/organization_projects.py`
- Silo: Region
- **Note**: This is a general Sentry endpoint, not Seer-specific. Only the Seer-relevant fields are documented here.

### List Projects [GET]

Returns a paginated list of projects. The response is the full `Project` object. The Seer-relevant fields are:

| Column                  | Type    | Description                                                                           |
| ----------------------- | ------- | ------------------------------------------------------------------------------------- |
| autofixAutomationTuning | string  | (optional) One of: `off`, `medium` (deprecated: `super_low`, `low`, `high`, `always`) |
| seerScannerAutomation   | boolean | (optional) Whether Seer scanner automation is enabled                                 |

## Project Details [/projects/<organization_id_or_slug>/<project_id_or_slug>/]

General-purpose Sentry endpoint for reading and updating a single project. Used by `useDetailedProject()` for GET and `useUpdateProject()` for PUT.

- Endpoint: `ProjectDetailsEndpoint`
- Source: `src/sentry/api/endpoints/project_details.py`
- Silo: Region
- **Note**: This is a general Sentry endpoint, not Seer-specific. Only the Seer-relevant fields are documented here.

### Get Project [GET]

Returns the full `Project` object. Seer-relevant fields are the same as listed under Organization Projects above.

### Update Project [PUT]

Accepts a partial `Project` object. Seer-relevant writable fields:

- Request (application/json)

  | Column                  | Type    | Required | Description                                                                |
  | ----------------------- | ------- | -------- | -------------------------------------------------------------------------- |
  | autofixAutomationTuning | string  | No       | One of: `off`, `medium` (deprecated: `super_low`, `low`, `high`, `always`) |
  | seerScannerAutomation   | boolean | No       | Whether Seer scanner automation is enabled                                 |

- Response 200

  Returns the full updated `Project` object.

## Organization Repositories [/organizations/<organization_id_or_slug>/repos/]

Lists version control repositories connected to an organization. Used by Seer's repo configuration table.

- Endpoint: `OrganizationRepositoriesEndpoint`
- Source: `src/sentry/integrations/api/endpoints/organization_repositories.py`
- Silo: Region

### List Repositories [GET]

Returns a paginated list of repositories for the organization.

- Parameters
  - query (optional, string) - Filter by repository name (case-insensitive contains match).
  - status (optional, string) - Filter by status: `active` (default), `deleted`, `unmigratable`.
  - integration_id (optional, string) - Filter by integration ID.
  - expand (optional, string[]) - Include related data. Supported values: `settings`.

- Response 200

  **Attributes (per repository)**

  | Column        | Type                       | Description                                          |
  | ------------- | -------------------------- | ---------------------------------------------------- |
  | id            | string                     | Repository ID                                        |
  | name          | string                     | Repository name (e.g. `getsentry/sentry`)            |
  | url           | string \| null             | Repository URL                                       |
  | provider      | object                     | `{ "id": string, "name": string }` provider info     |
  | status        | string                     | Repository status display name                       |
  | dateCreated   | datetime                   | When the repository was added                        |
  | integrationId | string \| null             | Associated integration ID                            |
  | externalSlug  | string \| null             | Provider-specific slug                               |
  | externalId    | string \| null             | Provider-specific external ID                        |
  | settings      | RepositorySettings \| null | (only with `expand=settings`) Seer-specific settings |

  **RepositorySettings Attributes**

  | Column             | Type     | Description                                                           |
  | ------------------ | -------- | --------------------------------------------------------------------- |
  | enabledCodeReview  | boolean  | Whether Seer code review is enabled for this repository               |
  | codeReviewTriggers | string[] | When code review runs. Values: `on_new_commit`, `on_ready_for_review` |

  ```json
  [
    {
      "id": "123",
      "name": "getsentry/sentry",
      "url": "https://github.com/getsentry/sentry",
      "provider": {"id": "integrations:github", "name": "GitHub"},
      "status": "active",
      "dateCreated": "2024-01-15T00:00:00Z",
      "integrationId": "456",
      "externalSlug": "getsentry/sentry",
      "externalId": "12345678",
      "settings": {
        "enabledCodeReview": true,
        "codeReviewTriggers": ["on_new_commit", "on_ready_for_review"]
      }
    }
  ]
  ```

## Organization Repository Settings [/organizations/<organization_id_or_slug>/repos/settings/]

Bulk endpoint for managing Seer-specific repository settings (code review configuration).

- Endpoint: `OrganizationRepositorySettingsEndpoint`
- Source: `src/sentry/integrations/api/endpoints/organization_repository_settings.py`
- Silo: Region

### Bulk Update Repository Settings [PUT]

Updates code review settings for multiple repositories in a single request. At least one of `enabledCodeReview` or `codeReviewTriggers` must be provided.

- Request (application/json)

  **Attributes**

  | Column             | Type      | Required | Description                                                           |
  | ------------------ | --------- | -------- | --------------------------------------------------------------------- |
  | repositoryIds      | list[int] | Yes      | Repository IDs to update (max 1000)                                   |
  | enabledCodeReview  | boolean   | No\*     | Whether code review is enabled                                        |
  | codeReviewTriggers | string[]  | No\*     | When code review runs. Values: `on_new_commit`, `on_ready_for_review` |

  \* At least one of `enabledCodeReview` or `codeReviewTriggers` must be provided.

  ```json
  {
    "repositoryIds": [123, 456, 789],
    "enabledCodeReview": true,
    "codeReviewTriggers": ["on_new_commit"]
  }
  ```

- Response 200

  Returns the updated repositories with expanded settings (same shape as List Repositories with `expand=settings`).

  ```json
  [
    {
      "id": "123",
      "name": "getsentry/sentry",
      "url": "https://github.com/getsentry/sentry",
      "provider": {"id": "integrations:github", "name": "GitHub"},
      "status": "active",
      "dateCreated": "2024-01-15T00:00:00Z",
      "integrationId": "456",
      "externalSlug": "getsentry/sentry",
      "externalId": "12345678",
      "settings": {
        "enabledCodeReview": true,
        "codeReviewTriggers": ["on_new_commit"]
      }
    }
  ]
  ```

- Response 400

  ```json
  {
    "detail": "One or more repositories were not found in this organization."
  }
  ```

## Project Seer Preferences [/projects/<organization_id_or_slug>/<project_id_or_slug>/seer/preferences/] (DEPRECATED)

> **Deprecated.** This endpoint will be replaced by:
>
> - `GET/PUT /projects/<org>/<project>/seer/` — configured background agent and stopping point
> - `GET /projects/<org>/<project>/seer/repos/` — paginated list of repos connected to this project
> - `GET /projects/<org>/<project>/seer/code-mappings/` — paginated list of code_mapping_repos

Per-project Seer preferences including repository configurations for autofix, branch overrides, custom instructions, and automation handoff settings. Data is stored in the Seer service (not Sentry's database) via signed API calls.

- Endpoint: `ProjectSeerPreferencesEndpoint`
- Source: `src/sentry/seer/endpoints/project_seer_preferences.py`
- Models: `src/sentry/seer/models/seer_api_models.py`
- Silo: Region

### Get Project Preferences [GET]

Retrieves the project's Seer preferences from the Seer service and augments them with `code_mapping_repos` derived from the project's code mappings.

- Response 200

  **Attributes**

  | Column             | Type                          | Description                                                                 |
  | ------------------ | ----------------------------- | --------------------------------------------------------------------------- |
  | preference         | SeerProjectPreference \| null | The project's saved preferences, or `null` if none are set                  |
  | code_mapping_repos | list[SeerRepoDefinition]      | Repositories inferred from the project's code mappings (read-only fallback) |

  **SeerProjectPreference Attributes**

  | Column                       | Type                                       | Description                                                |
  | ---------------------------- | ------------------------------------------ | ---------------------------------------------------------- |
  | organization_id              | int                                        | The organization ID                                        |
  | project_id                   | int                                        | The project ID                                             |
  | repositories                 | list[SeerRepoDefinition]                   | Configured repositories for this project                   |
  | automated_run_stopping_point | string \| null                             | Where automated runs stop (e.g. `code_changes`, `open_pr`) |
  | automation_handoff           | SeerAutomationHandoffConfiguration \| null | Handoff config for external coding agents                  |

  **SeerRepoDefinition Attributes**

  | Column           | Type                 | Description                                            |
  | ---------------- | -------------------- | ------------------------------------------------------ |
  | organization_id  | int \| null          | Organization ID (auto-filled on POST)                  |
  | integration_id   | string \| null       | Integration ID for the SCM provider                    |
  | provider         | string               | SCM provider key (e.g. `integrations:github`)          |
  | owner            | string               | Repository owner (e.g. `getsentry`)                    |
  | name             | string               | Repository name (e.g. `sentry`)                        |
  | external_id      | string               | Provider-specific external ID                          |
  | branch_name      | string \| null       | Override branch (default branch used if null)          |
  | branch_overrides | list[BranchOverride] | Tag-based branch overrides                             |
  | instructions     | string \| null       | Custom instructions for Seer when working in this repo |
  | base_commit_sha  | string \| null       | Base commit SHA to use                                 |
  | provider_raw     | string \| null       | Raw provider identifier                                |

  **BranchOverride Attributes**

  | Column      | Type   | Description                             |
  | ----------- | ------ | --------------------------------------- |
  | tag_name    | string | The event tag key to match against      |
  | tag_value   | string | The event tag value to match against    |
  | branch_name | string | The branch to use when this tag matches |

  **SeerAutomationHandoffConfiguration Attributes**

  | Column         | Type    | Description                                                |
  | -------------- | ------- | ---------------------------------------------------------- |
  | handoff_point  | string  | When to hand off. Currently only `root_cause`              |
  | target         | string  | The target agent. Currently only `cursor_background_agent` |
  | integration_id | int     | Integration ID for the target agent                        |
  | auto_create_pr | boolean | Whether to auto-create a PR (default: `false`)             |

  ```json
  {
    "preference": {
      "organization_id": 1,
      "project_id": 123,
      "repositories": [
        {
          "organization_id": 1,
          "integration_id": "456",
          "provider": "integrations:github",
          "owner": "getsentry",
          "name": "sentry",
          "external_id": "12345678",
          "branch_name": "main",
          "branch_overrides": [
            {
              "tag_name": "environment",
              "tag_value": "staging",
              "branch_name": "staging"
            }
          ],
          "instructions": "Follow the AGENTS.md conventions",
          "base_commit_sha": null,
          "provider_raw": null
        }
      ],
      "automated_run_stopping_point": "code_changes",
      "automation_handoff": {
        "handoff_point": "root_cause",
        "target": "cursor_background_agent",
        "integration_id": 789,
        "auto_create_pr": false
      }
    },
    "code_mapping_repos": [
      {
        "organization_id": 1,
        "integration_id": "456",
        "provider": "integrations:github",
        "owner": "getsentry",
        "name": "sentry",
        "external_id": "12345678"
      }
    ]
  }
  ```

### Set Project Preferences [POST]

Saves the project's Seer preferences to the Seer service. The `organization_id` on each repository is validated to match the project's organization; mismatches return 400.

- Request (application/json)

  **Attributes**

  | Column                       | Type                               | Required | Description                               |
  | ---------------------------- | ---------------------------------- | -------- | ----------------------------------------- |
  | repositories                 | list[SeerRepoDefinition]           | Yes      | Repositories for this project             |
  | automated_run_stopping_point | string                             | No       | Where automated runs stop                 |
  | automation_handoff           | SeerAutomationHandoffConfiguration | No       | Handoff config for external coding agents |

  ```json
  {
    "repositories": [
      {
        "organizationId": 1,
        "integrationId": "456",
        "provider": "integrations:github",
        "owner": "getsentry",
        "name": "sentry",
        "externalId": "12345678",
        "branchName": "main",
        "branchOverrides": [
          {
            "tagName": "environment",
            "tagValue": "staging",
            "branchName": "staging"
          }
        ],
        "instructions": "Follow the AGENTS.md conventions"
      }
    ],
    "automatedRunStoppingPoint": "code_changes",
    "automationHandoff": {
      "handoffPoint": "root_cause",
      "target": "cursor_background_agent",
      "integrationId": 789,
      "autoCreatePr": false
    }
  }
  ```

- Response 204

  No content on success.

- Response 400

  ```json
  {
    "detail": "Invalid repository"
  }
  ```

## Organization Autofix Automation Settings [/organizations/<organization_id_or_slug>/autofix/automation-settings/]

Bulk endpoint for managing project-level autofix automation settings across an organization. Handles tuning, stopping points, automation handoff, and per-project repository mappings.

- Endpoint: `OrganizationAutofixAutomationSettingsEndpoint`
- Source: `src/sentry/seer/endpoints/organization_autofix_automation_settings.py`
- Silo: Region

### List Projects with Settings [GET]

Retrieves a paginated list of projects with their autofix automation settings. Settings are assembled from two sources: `autofixAutomationTuning` comes from `ProjectOption`, while `automatedRunStoppingPoint`, `automationHandoff`, and `reposCount` come from Seer project preferences.

- Parameters
  - query (optional, string) - Search query to filter by project name or slug.

- Response 200

  **Attributes (per project)**

  | Column                    | Type                                       | Description                                                                                                                  |
  | ------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
  | projectId                 | int                                        | The project ID                                                                                                               |
  | autofixAutomationTuning   | string                                     | The tuning setting. One of: `off`, `medium` (deprecated values: `super_low`, `low`, `high`, `always`)                        |
  | automatedRunStoppingPoint | string                                     | The stopping point. One of: `code_changes`, `open_pr` (deprecated values: `root_cause`, `solution`). Default: `code_changes` |
  | automationHandoff         | SeerAutomationHandoffConfiguration \| null | Handoff config for external coding agents, or `null`                                                                         |
  | reposCount                | int                                        | Number of repositories configured for the project                                                                            |

  ```json
  [
    {
      "projectId": 123,
      "autofixAutomationTuning": "medium",
      "automatedRunStoppingPoint": "code_changes",
      "automationHandoff": {
        "handoff_point": "root_cause",
        "target": "cursor_background_agent",
        "integration_id": 789,
        "auto_create_pr": false
      },
      "reposCount": 2
    },
    {
      "projectId": 456,
      "autofixAutomationTuning": "off",
      "automatedRunStoppingPoint": "code_changes",
      "automationHandoff": null,
      "reposCount": 0
    }
  ]
  ```

### Bulk Update Settings [POST]

Bulk create/update the autofix automation settings for multiple projects in a single request. Supports updating tuning, stopping points, and per-project repository mappings. At least one of `autofixAutomationTuning`, `automatedRunStoppingPoint`, or `projectRepoMappings` must be provided.

DB writes and Seer API calls are wrapped in a transaction — if the Seer API call fails, DB changes are rolled back.

- Request (application/json)

  **Attributes**

  | Column                    | Type                               | Required | Description                                                                                                           |
  | ------------------------- | ---------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
  | projectIds                | list[int]                          | Yes      | List of project IDs to update (min: 1, max: 1000)                                                                     |
  | autofixAutomationTuning   | string                             | No\*     | The tuning setting. One of: `off`, `medium` (deprecated values: `super_low`, `low`, `high`, `always`)                 |
  | automatedRunStoppingPoint | string                             | No\*     | The stopping point. One of: `code_changes`, `open_pr` (deprecated values: `root_cause`, `solution`)                   |
  | projectRepoMappings       | dict[string, list[RepoDefinition]] | No\*     | Mapping of project ID (as string) to list of repository configurations                                                |
  | appendRepositories        | boolean                            | No       | If `true`, appends repos to existing list (deduped by org_id + provider + external_id). Default: `false` (overwrites) |

  \* At least one of `autofixAutomationTuning`, `automatedRunStoppingPoint`, or `projectRepoMappings` must be provided.

  **RepoDefinition Attributes**

  | Column          | Type                 | Required | Description                                             |
  | --------------- | -------------------- | -------- | ------------------------------------------------------- |
  | provider        | string               | Yes      | SCM provider key (e.g. `integrations:github`)           |
  | owner           | string               | Yes      | Repository owner (e.g. `getsentry`)                     |
  | name            | string               | Yes      | Repository name (e.g. `sentry`)                         |
  | externalId      | string               | Yes      | Provider-specific external ID                           |
  | organizationId  | int                  | No       | Organization ID (validated to match the org in the URL) |
  | integrationId   | string               | No       | Integration ID for the SCM provider                     |
  | branchName      | string               | No       | Override branch                                         |
  | branchOverrides | list[BranchOverride] | No       | Tag-based branch overrides                              |
  | instructions    | string               | No       | Custom instructions for Seer                            |
  | baseCommitSha   | string               | No       | Base commit SHA                                         |
  | providerRaw     | string               | No       | Raw provider identifier                                 |

  ```json
  {
    "projectIds": [123, 456],
    "autofixAutomationTuning": "medium",
    "automatedRunStoppingPoint": "code_changes",
    "projectRepoMappings": {
      "123": [
        {
          "provider": "integrations:github",
          "owner": "getsentry",
          "name": "sentry",
          "externalId": "12345678",
          "branchName": "main"
        }
      ]
    },
    "appendRepositories": true
  }
  ```

- Response 204

  No content on success.

- Response 400

  ```json
  {
    "detail": "Invalid repository"
  }
  ```

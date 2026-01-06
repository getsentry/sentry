# Seer Autofix Settings API

Host: https://sentry.io/api/0

**Authors.**

@ryan953

**How to read this document.**

This document is structured by resource with each resource having actions that
can be performed against it. Every action that either accepts a request or
returns a response _will_ document the full interchange format. Clients may opt
to restrict response data or provide a subset of the request data. The API may
or may not accept partial payloads.

## Organization Autofix Automation Settings [/organizations/<organization_id_or_slug>/autofix/automation-settings/]

Bulk endpoint for managing project-level autofix automation settings across an organization.

### List Projects with Settings [GET]

Retrieves a paginated list of projects with their autofix automation settings.

- Parameters
  - query (optional, string) - Search query to filter by project name or slug.

**Attributes**

| Column                    | Type   | Description                                                                                                                  |
| ------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| projectId                 | int    | The project ID                                                                                                               |
| autofixAutomationTuning   | string | The tuning setting for automated autofix. One of: `off`, `medium`, (deprecated values: `super_low`, `low`, `high`, `always`) |
| automatedRunStoppingPoint | string | The stopping point for automated runs. One of: `code_changes`, `open_pr`, (deprecated values: `root_cause`, `solution`)      |
| reposCount                | int    | Number of repositories configured for the project                                                                            |

- Response 200

  ```json
  [
    {
      "projectId": 123,
      "autofixAutomationTuning": "medium",
      "automatedRunStoppingPoint": "code_changes",
      "reposCount": 2
    },
    {
      "projectId": 456,
      "autofixAutomationTuning": "off",
      "automatedRunStoppingPoint": "root_cause",
      "reposCount": 0
    }
  ]
  ```

### Bulk Update Settings [POST]

Bulk create/update the autofix automation settings for multiple projects in a single request.

- Request (application/json)

**Attributes**

| Column                    | Type      | Required | Description                                                                                            |
| ------------------------- | --------- | -------- | ------------------------------------------------------------------------------------------------------ |
| projectIds                | list[int] | Yes      | List of project IDs to update (min: 1, max: 1000)                                                      |
| autofixAutomationTuning   | string    | No\*     | The tuning setting. One of: `off`, `medium`, (deprecated values: `super_low`, `low`, `high`, `always`) |
| automatedRunStoppingPoint | string    | No\*     | The stopping point. One of: `code_changes`, `open_pr`, (deprecated values: `root_cause`, `solution`)   |

\* At least one of either `autofixAutomationTuning` or `automatedRunStoppingPoint` must be provided.

```json
{
  "projectIds": [123, 456, 789],
  "autofixAutomationTuning": "medium",
  "automatedRunStoppingPoint": "code_changes"
}
```

- Response 204

  No content on success.

- Response 400

  ```json
  {
    "autofixAutomationTuning": ["This field is required."],
    "automatedRunStoppingPoint": ["This field is required."]
  }
  ```

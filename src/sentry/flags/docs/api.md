# Flags API

Host: https://sentry.io/api/0

**Authors.**

@cmanallen

**How to read this document.**

This document is structured by resource with each resource having actions that can be performed against it. Every action that either accepts a request or returns a response WILL document the full interchange format. Clients may opt to restrict response data or provide a subset of the request data.

## Flag Logs [/organizations/<organization_id_or_slug>/flag-log/]

- Parameters
  - query (optional, string) - Search query with space-separated field/value pairs. ie: `?query=environment:prod AND project:3`.
  - start (optional, string) - ISO 8601 format (`YYYY-MM-DDTHH:mm:ss.sssZ`)
  - end (optional, string) - ISO 8601 format. Required if `start` is set.
  - statsPeriod (optional, string) - A positive integer suffixed with a unit type.
  - cursor (optional, string)`
  - per_page (optional, number)
    Default: 10
  - offset (optional, number)
    Default: 0

### Browse Flag Logs [GET]

Retrieve a collection of flag logs.

**Attributes**

| Column          | Type   | Description                                          |
| --------------- | ------ | ---------------------------------------------------- |
| action          | string | Enum of `created`, `updated`, or `deleted`.          |
| flag            | string | The name of the flag changed.                        |
| created_at      | string | ISO-8601 timestamp of when the flag was changed.     |
| created_by      | string | The user responsible for the change.                 |
| created_by_type | string | Enum of `email`, `id`, or `name`.                    |
| tags            | object | A collection of provider-specified scoping metadata. |

- Response 200

  ```json
  {
    "data": [
      {
        "action": "created",
        "flag": "my-flag-name",
        "created_at": "2024-01-01T05:12:33",
        "created_by": "2552",
        "created_by_type": "id",
        "tags": {
          "environment": "production"
        }
      }
    ]
  }
  ```

## Flag Log [/organizations/<organization_id_or_slug>/flag-log/<flag>/]

### Fetch Flag Log [GET]

Retrieve a single flag log instance.

- Response 200

  ```json
  {
    "data": {
      "action": "updated",
      "flag": "new-flag-name",
      "created_at": "2024-11-19T19:12:55",
      "created_by": "user@site.com",
      "created_by_type": "email",
      "tags": {
        "environment": "development"
      }
    }
  }
  ```

## Webhooks [/webhooks/flags/organization/<organization_id_or_slug>/provider/<provider>/]

### Create Flag Log [POST]

The shape of the request object varies by provider. The `<provider>` URI parameter informs the server of the shape of the request and it is on the server to handle the provider. The following providers are supported: Unleash, Split, and LaunchDarkly.

**Flag Pole Example:**

Flag pole is Sentry owned. It matches our audit-log resource because it is designed for that purpose.

- Request (application/json)

  ```json
  {
    "data": [
      {
        "action": "updated",
        "flag": "flag-name",
        "created_at": "2024-11-19T19:12:55",
        "created_by": "colton.allen@sentry.io",
        "tags": {
          "commit_sha": "1f33a107d7cd060ab9c98e11c9e5a62dc1347861"
        }
      }
    ]
  }
  ```

- Response 201

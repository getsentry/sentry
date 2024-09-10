# Flags API

Host: https://sentry.io/api/0

**Authors.**

@cmanallen

**How to read this document.**

This document is structured by resource with each resource having actions that can be performed against it. Every action that either accepts a request or returns a response WILL document the full interchange format. Clients may opt to restrict response data or provide a subset of the request data.

## Flag Logs [/organizations/<organization_id_or_slug>/flag-log/]

- Parameters
  - environment (optional, string) - Filter the result-set by environment.
  - project (optional, string) - Filter the result-set by project-id.
  - start (optional, string) - ISO 8601 format (`YYYY-MM-DDTHH:mm:ss.sssZ`)
  - end (optional, string) - ISO 8601 format. Required if `start` is set.
  - per_page (optional, number)
    Default: 10
  - offset (optional, number)
    Default: 0

### Browse Flag Logs [GET]

Retrieve a collection of flag logs.

**Attributes**

| Column      | Type   | Description                                      |
| ----------- | ------ | ------------------------------------------------ |
| action      | string | Enum of `created` or `modified`.                |
| environment | string | The environment the change applies to.           |
| flag        | string | The name of the flag changed.                    |
| modified_at | string | ISO-8601 timestamp of when the flag was changed. |
| modified_by | string | The user responsible for the change.             |

- Response 200

  ```json
  {
    "data": [
      {
        "action": "created",
        "environment": "production",
        "flag": "my-flag-name",
        "modified_at": "2024-01-01T05:12:33",
        "modified_by": "2552"
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
      "action": "modified",
      "environment": "development",
      "flag": "new-flag-name",
      "modified_at": "2024-11-19T19:12:55",
      "modified_by": "user@site.com"
    }
  }
  ```

## Webhooks [/webhooks/flags/organization/<organization_id_or_slug>/provider/<provider>/]

### Create Flag Log [POST]

The shape of the request object varies by provider. The `<provider>` URI parameter informs the server of the shape of the request and it is on the server to handle the provider. The following providers are supported: Unleash, Split, and LaunchDarkly.

- Request (application/json)

- Response 201

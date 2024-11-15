# Flags API

Host: https://sentry.io/api/0

**Authors.**

@cmanallen

**How to read this document.**

This document is structured by resource with each resource having actions that can be performed against it. Every action that either accepts a request or returns a response WILL document the full interchange format. Clients may opt to restrict response data or provide a subset of the request data.

## Flag Logs [/organizations/<organization_id_or_slug>/flags/logs/]

- Parameters
  - flag (optional, string) - The flag name to filter the result by. Can be specified multiple times.
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

| Column        | Type   | Description                                                   |
| ------------- | ------ | ------------------------------------------------------------- |
| action        | string | Enum of `created`, `updated`, or `deleted`.                   |
| createdAt     | string | ISO-8601 timestamp of when the flag was changed.              |
| createdBy     | string | The user responsible for the change.                          |
| createdByType | string | Enum of `email`, `id`, or `name`.                             |
| flag          | string | The name of the flag changed. Maps to flag_log_id in the URI. |
| id            | number | A unique identifier for the log entry.                        |
| tags          | object | A collection of provider-specified scoping metadata.          |

- Response 200

  ```json
  {
    "data": [
      {
        "action": "created",
        "createdAt": "2024-01-01T05:12:33",
        "createdBy": "2552",
        "createdByType": "id",
        "flag": "my-flag-name",
        "id": 1,
        "tags": {
          "environment": "production"
        }
      }
    ]
  }
  ```

## Flag Log [/organizations/<organization_id_or_slug>/flags/logs/<flag_log_id>/]

### Fetch Flag Log [GET]

Retrieve a single flag log instance.

- Response 200

  ```json
  {
    "data": {
      "action": "updated",
      "createdAt": "2024-11-19T19:12:55",
      "createdBy": "user@site.com",
      "createdByType": "email",
      "flag": "new-flag-name",
      "id": 1,
      "tags": {
        "environment": "development"
      }
    }
  }
  ```

## Signing Secret [/organizations/<organization_id_or_slug>/flags/hooks/provider/<provider>/signing-secret/]

### Create Signing Secret [POST]

Requests from web hook providers can be signed. We use the signing secret to verify the webhook's origin is authentic.

- Request (application/json)

  ```json
  {
    "secret": "d41d7d1adced450d9e2eb7f76dde6a04"
  }
  ```

- Response 201

## Webhooks [/organizations/<organization_id_or_slug>/flags/hooks/provider/<provider>/]

### Create Flag Log [POST]

The shape of the request object varies by provider. The `<provider>` URI parameter informs the server of the shape of the request and it is on the server to handle the provider. The following providers are supported: Unleash, Split, Statsig, and LaunchDarkly.

Webhooks are signed by their provider. The provider handler must use the secret stored in Sentry to verify the signature of the payload. Failure to do so could lead to unauthorized access.

**Flag Pole Example:**

Flag pole is Sentry owned. It matches our audit-log resource because it is designed for that purpose.

- Request (application/json)

  ```json
  {
    "data": [
      {
        "action": "updated",
        "createdAt": "2024-11-19T19:12:55",
        "createdBy": "colton.allen@sentry.io",
        "flag": "flag-name",
        "tags": {
          "commit_sha": "1f33a107d7cd060ab9c98e11c9e5a62dc1347861"
        }
      }
    ]
  }
  ```

- Response 201

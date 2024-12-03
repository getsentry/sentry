# Flags API

Host: https://sentry.io/api/0

**Authors.**

@cmanallen

**How to read this document.**

This document is structured by resource with each resource having actions that can be performed against it. Every action that either accepts a request or returns a response **must** document the full interchange format.

## Flag Logs [/organizations/<organization_id_or_slug>/flags/logs/]

- Parameters
  - flag (optional, string) - The flag name to filter the result by. Can be specified multiple times.
  - start (optional, string) - ISO 8601 format (`YYYY-MM-DDTHH:mm:ss.sssZ`)
  - end (optional, string) - ISO 8601 format. Required if `start` is set.
  - statsPeriod (optional, string) - A positive integer suffixed with a unit type.
  - cursor (optional, string)
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

## Signing Secrets [/organizations/<organization_id_or_slug>/flags/signing-secrets/]

- Parameters
  - cursor (optional, string)
  - per_page (optional, number)
    Default: 10
  - offset (optional, number)
    Default: 0

### Browse Signing Secrets [GET]

Browse a list of signing secrets. Secrets are unique per provider. Secrets only show the first six characters; the remainder are redacted.

**Attributes**

| Column    | Type   | Description                                                            |
| --------- | ------ | ---------------------------------------------------------------------- |
| createdAt | string | ISO-8601 timestamp of when the secret was added.                       |
| createdBy | string | The user responsible for adding the secret.                            |
| id        | number | A unique identifier for the secret entry.                              |
| provider  | string | The provider this secret applies to.                                   |
| secret    | string | A secret value which allows us to verify the signature of the request. |

- Response 200

  ```json
  {
    "data": [
      {
        "createdAt": "2024-12-12T00:00:00+00:00",
        "createdBy": 12345,
        "id": 123,
        "provider": "launchdarkly",
        "secret": "abc123**********"
      }
    ]
  }
  ```

### Create Signing Secret [POST]

Requests from web hook providers can be signed. We use the signing secret to verify the webhook's origin is authentic.

- Request (application/json)

  ```json
  {
    "provider": "launchdarkly",
    "secret": "d41d7d1adced450d9e2eb7f76dde6a04"
  }
  ```

- Response 201

## Signing Secret [/organizations/<organization_id_or_slug>/flags/signing-secrets/<signing_secret_id>/]

### Delete Signing Secret [DELETE]

Delete a signing secret.

- Response 204

## Webhooks [/organizations/<organization_id_or_slug>/flags/hooks/provider/<provider>/]

### Create Flag Log [POST]

The shape of the request object varies by provider. The `<provider>` URI parameter informs the server of the shape of the request and it is on the server to handle the provider. The following providers are supported: LaunchDarkly.

Webhooks are signed by their provider. The provider handler must use the secret stored in Sentry to verify the signature of the payload. Failure to do so could lead to unauthorized access.

Any request content-type is acceptable (JSON, XML, binary-formats) so long as the server is capable of decoding the request and mapping it to our object model.

- Request

- Response 201

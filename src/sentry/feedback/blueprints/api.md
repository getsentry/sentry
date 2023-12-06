# Feedback API

Host: https://sentry.io/api/0

**Authors.**

@cmanallen

**How to read this document.**

This document is structured by resource with each resource having actions that
can be performed against it. Every action that either accepts a request or
returns a response _will_ document the full interchange format. Clients may opt
to restrict response data or provide a subset of the request data. The API may
or may not accept partial payloads.

## Feedback Index [/organizations/<organization_slug>/feedback/]

- Parameters

  - field (optional, string)
  - environment (optional, string)
  - project (optional, string)
  - sort (optional, string) Default: -timestamp Members
    - projectId
    - -projectId
    - timestamp
    - -timestamp
  - statsPeriod (optional, string) - A positive integer suffixed with a unit
    type. Default: 7d Members
    - s
    - m
    - h
    - d
    - w
  - start (optional, string) - ISO 8601 format (`YYYY-MM-DDTHH:mm:ss.sssZ`)
  - end (optional, string) - ISO 8601 format. Required if `start` is set.
  - utc (optiona, 'true') - Whether start/end should use the UTC timezone
  - cursor (optional, str)
  - per_page (optional, number) Default: 10
  - offset (optional, number) Default: 0
  - query (optional, string) - Search query with space-separated field/value
    pairs. ie: `?query=browser:Firefox`.
  - queryReferrer(optional, string) - Specify the page which this query is being
    made from. Used for cross project query on issue replays page. Pass
    `queryReferrer=replayUserFeedback` for this query.

### Browse Feedback [GET]

Retrieve a collection of feedback items.

**Attributes**

| Column            | Type             | Description                                         |
| ----------------- | ---------------- | --------------------------------------------------- |
| browser           | object           | -                                                   |
| browser.name      | optional[string] | -                                                   |
| browser.version   | optional[string] | -                                                   |
| contact_email     | optional[string] | The contact email of the user writing feedback.     |
| device            | object           | -                                                   |
| device.brand      | optional[string] | -                                                   |
| device.family     | optional[string] | -                                                   |
| device.model      | optional[string] | -                                                   |
| device.name       | optional[string] | -                                                   |
| dist              | optional[string] |                                                     |
| environment       | optional[string] |                                                     |
| feedback_id       | string           |                                                     |
| locale            | object           | Browser locale information.                         |
| locale.lang       | string           | The language preference of the user's browser.      |
| locale.timezone   | string           | The timezone the feedback was submitted from.       |
| message           | string           | The message written by the user providing feedback. |
| name              | optional[string] | The name of the user writing feedback.              |
| os                | object           | -                                                   |
| os.name           | optional[string] | -                                                   |
| os.version        | optional[string] | -                                                   |
| platform          | string           |                                                     |
| project_id        | string           |                                                     |
| release           | optional[string] |                                                     |
| replay_id         | optional[string] | The id of a running replay.                         |
| sdk               | object           | SDK information.                                    |
| sdk.name          | string           | -                                                   |
| sdk.version       | string           | -                                                   |
| status            | string           | One of: resolved, unresolved.                       |
| tags              | object           | Mapping of key, value pairs.                        |
| timestamp         | string           | ISO-8061 formatted UTC datetime.                    |
| url               | string           | The page the feedback was triggered on.             |
| user              | object           | The authorized user's information.                  |
| user.display_name | optional[string] | -                                                   |
| user.email        | optional[string] | -                                                   |
| user.id           | optional[string] | -                                                   |
| user.ip           | optional[string] | Same search field as Events                         |
| user.username     | optional[string] | -                                                   |

- Response 200

  - Headers

    ```
    X-Hits: 42
    ```

  - Body
    ```json
    {
      "data": [
        {
          "browser": {
            "name": "Chome",
            "version": "103.0.38"
          },
          "contact_email": "colton.allen@sentry.io",
          "device": {
            "brand": "Apple",
            "family": "iPhone",
            "model": "11",
            "name": "iPhone 11"
          },
          "dist": "abc123",
          "environment": "production",
          "feedback_id": "1ffe0775ac0f4417aed9de36d9f6f8dc",
          "locale": {
            "lang": "en",
            "timezone": "UTC+1"
          },
          "message": "I really like this feedback feature!",
          "name": "John Doe",
          "os": {
            "name": "iOS",
            "version": "16.2"
          },
          "platform": "javascript",
          "project_id": "11276",
          "release": "version@1.3",
          "replay_id": "ec3b4dc8b79f417596f7a1aa4fcca5d2",
          "sdk": {
            "name": "sentry.javascript.react",
            "version": "6.18.1"
          },
          "status": "unresolved",
          "tags": {
            "hello": "is",
            "it": ["me", "you're", "looking", "for"]
          },
          "timestamp": "2023-08-31T14:10:34.954048",
          "url": "https://docs.sentry.io/platforms/javascript/",
          "user": {
            "display_name": "John Doe",
            "email": "john.doe@example.com",
            "id": "30246326",
            "ip": "213.164.1.114",
            "username": "John Doe"
          }
        }
      ]
    }
    ```

## Feedback [/projects/<organization_slug>/<project_slug>/feedback/<feedback_id>/]

- Model

  - Body

    ```json
    {
      "data": {
        "browser": {
          "name": "Chome",
          "version": "103.0.38"
        },
        "contact_email": "colton.allen@sentry.io",
        "device": {
          "brand": "Apple",
          "family": "iPhone",
          "model": "11",
          "name": "iPhone 11"
        },
        "dist": "abc123",
        "environment": "production",
        "feedback_id": "1ffe0775ac0f4417aed9de36d9f6f8dc",
        "locale": {
          "lang": "en",
          "timezone": "UTC+1"
        },
        "message": "I really like this feedback feature!",
        "name": "John Doe",
        "os": {
          "name": "iOS",
          "version": "16.2"
        },
        "platform": "javascript",
        "project_id": "11276",
        "release": "version@1.3",
        "replay_id": "ec3b4dc8b79f417596f7a1aa4fcca5d2",
        "sdk": {
          "name": "sentry.javascript.react",
          "version": "6.18.1"
        },
        "status": "unresolved",
        "tags": {
          "hello": "is",
          "it": ["me", "you're", "looking", "for"]
        },
        "timestamp": "2023-08-31T14:10:34.954048",
        "url": "https://docs.sentry.io/platforms/javascript/",
        "user": {
          "display_name": "John Doe",
          "email": "john.doe@example.com",
          "id": "30246326",
          "ip": "213.164.1.114",
          "username": "John Doe"
        }
      }
    }
    ```

### Fetch Feedback [GET]

Retrieve a single feedback item.

- Response 200

  [UserFeedback]

### Update Feedback [PATCH]

Partially update a feedback item.

- Request

  ```json
  {
    "data": {
      "status": "resolved"
    }
  }
  ```

- Response 202

  [UserFeedback]

### Delete Feedback [DELETE]

Delete a feedback item.

- Response 204

## Feedback Ingest [/feedback/]

### Create Feedback [POST]

Create a new feedback item. This method is a subset of the Event protocol with
an additional "feedback" object added. Within the feedback object are feedback
related event metadata.

Every field not marked as "optional" is considered a required field and must be
present in the request body.

See https://develop.sentry.dev/sdk/event-payloads/types/ for more information

| Column                     | Type             | Description                           |
| -------------------------- | ---------------- | ------------------------------------- |
| dist                       | optional[string] | -                                     |
| environment                | optional[string] | -                                     |
| event_id                   | optional[string] | Omitted IDs are internally generated. |
| feedback                   | object           | -                                     |
| feedback.contact_email     | optional[string] | -                                     |
| feedback.message           | string           | -                                     |
| feedback.name              | optional[string] | -                                     |
| feedback.replay_id         | optional[string] | -                                     |
| feedback.url               | string           | -                                     |
| platform                   | string           | -                                     |
| release                    | optional[string] | -                                     |
| request                    | optional[object] | -                                     |
| request.headers            | optional[object] | -                                     |
| request.headers.User-Agent | optional[string] | -                                     |
| sdk                        | object           | -                                     |
| sdk.name                   | string           | -                                     |
| sdk.version                | string           | -                                     |
| tags                       | optional[object] | -                                     |
| timestamp                  | number           | UTC timestamp.                        |
| user                       | optional[object] | -                                     |
| user.email                 | optional[string] | -                                     |
| user.id                    | optional[string] | -                                     |
| user.ip_address            | optional[string] | -                                     |
| user.name                  | optional[string] | -                                     |
| user.username              | optional[string] | -                                     |

- Request

  ```json
  {
    "dist": "abc123",
    "environment": "production",
    "event_id": "1ffe0775ac0f4417aed9de36d9f6f8dc",
    "feedback": {
      "contact_email": "colton.allen@sentry.io",
      "message": "I really like this feedback feature!",
      "replay_id": "ec3b4dc8b79f417596f7a1aa4fcca5d2",
      "url": "https://docs.sentry.io/platforms/javascript/"
    },
    "platform": "javascript",
    "release": "version@1.3",
    "request": {
      "headers": {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36"
      }
    },
    "sdk": {
      "name": "sentry.javascript.react",
      "version": "6.18.1"
    },
    "tags": {
      "key": "value"
    },
    "timestamp": "2023-08-31T14:10:34.954048",
    "user": {
      "email": "username@example.com",
      "id": "123",
      "ip_address": "127.0.0.1",
      "name": "user",
      "username": "user2270129"
    }
  }
  ```

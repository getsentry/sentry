# User Feedback API

Host: https://sentry.io/api/0

**Authors.**

@cmanallen

**How to read this document.**

This document is structured by resource with each resource having actions that can be performed against it. Every action that either accepts a request or returns a response _will_ document the full interchange format. Clients may opt to restrict response data or provide a subset of the request data. The API may or may not accept partial payloads.

## User Feedback Index [/organizations/<organization_slug>/user-feedback/]

- Parameters

  - field (optional, string)
  - environment (optional, string)
  - project (optional, string)
  - sort (optional, string)
    Default: -timestamp
    Members
    - projectId
    - -projectId
    - timestamp
    - -timestamp
  - statsPeriod (optional, string) - A positive integer suffixed with a unit type.
    Default: 7d
    Members
    - s
    - m
    - h
    - d
    - w
  - start (optional, string) - ISO 8601 format (`YYYY-MM-DDTHH:mm:ss.sssZ`)
  - end (optional, string) - ISO 8601 format. Required if `start` is set.
  - limit (optional, number)
    Default: 10
  - offset (optional, number)
    Default: 0
  - query (optional, string) - Search query with space-separated field/value pairs. ie: `?query=count_errors:>2`.
  - queryReferrer(optional, string) - Specify the page which this query is being made from. Used for cross project query on issue replays page. Pass `queryReferrer=replayUserFeedback` for this query.

### Browse User Feedback [GET]

Retrieve a collection of user-feedback items.

**Attributes**

| Column        | Type             | Description                                         |
| ------------- | ---------------- | --------------------------------------------------- |
| email         | string           | The contact email of the user writing feedback.     |
| error_ids     | array[string]    | A list of error_ids encountered during the session. |
| feedback_text | string           | The message written by the user providing feedback. |
| id            | string           |                                                     |
| replay_id     | optional[string] | The id of a running replay.                         |
| timestamp     | string           | ISO-8061 formatted datetime.                        |
| trace_ids     | array[string]    | A list of trace_ids.                                |
| url           | string           | The page the user-feedback was triggered on.        |

- Response 200

  ```json
  {
    "data": [
      {
        "email": "colton.allen@sentry.io",
        "error_ids": ["4f0e18332d11431c9b97d924edecb76e"],
        "feedback_text": "I really like this user-feedback feature!",
        "id": "1ffe0775ac0f4417aed9de36d9f6f8dc",
        "replay_id": "ec3b4dc8b79f417596f7a1aa4fcca5d2",
        "timestamp": "2023-08-31T14:10:34.954048",
        "trace_ids": ["fbb42a39a61e4aa6969b4fecbfbbc114"],
        "url": "https://docs.sentry.io/platforms/javascript/"
      }
    ]
  }
  ```

## User Feedback [/projects/<organization_slug>/<project_slug>/user-feedback/<user_feedback_id>/]

- Model

  - Body

    ```json
    {
      "data": {
        "email": "colton.allen@sentry.io",
        "error_ids": ["4f0e18332d11431c9b97d924edecb76e"],
        "feedback_text": "I really like this user-feedback feature!",
        "id": "1ffe0775ac0f4417aed9de36d9f6f8dc",
        "replay_id": "ec3b4dc8b79f417596f7a1aa4fcca5d2",
        "timestamp": "2023-08-31T14:10:34.954048",
        "trace_ids": ["fbb42a39a61e4aa6969b4fecbfbbc114"],
        "url": "https://docs.sentry.io/platforms/javascript/"
      }
    }
    ```

### Fetch User Feedback [GET]

Retrieve a single user-feedback item.

- Response 200

  [UserFeedback]

### Update User Feedback [PATCH]

Partially update a user-feedback item.

- Request

  ```json
  {
    "data": {}
  }
  ```

- Response 202

  [UserFeedback]

### Delete User Feedback [DELETE]

Delete a user-feedback item.

- Response 204

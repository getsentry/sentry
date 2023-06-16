# Replays SDK Event

**Authors:**
@cmanallen

### Replay Event

**Replay SDK Event**

| Column                              | Type         | Description                            |
| ----------------------------------- | ------------ | -------------------------------------- |
| type                                | string       | -                                      |
| replay_id                           | string       | -                                      |
| replay_type                         | enum[string] | "error", "session"                     |
| event_id                            | string       | Unique ID specific to the event.       |
| segment_id                          | number       | -                                      |
| timestamp                           | number       | -                                      |
| replay_start_timestamp              | number       | -                                      |
| urls                                | list[string] | A list of URLs in order of visitation. |
| error_ids                           | list[string] | -                                      |
| trace_ids                           | list[string] | -                                      |
| contexts.replay.error_sample_rate   | float        | -                                      |
| contexts.replay.session_sample_rate | float        | -                                      |

**Base SDK Event**

| Column                     | Type   | Description |
| -------------------------- | ------ | ----------- |
| dist                       | string | -           |
| platform                   | string | -           |
| environment                | string | -           |
| release                    | string | -           |
| user.id                    | string | -           |
| user.username              | string | -           |
| user.email                 | string | -           |
| user.ip_address            | string | -           |
| sdk.name                   | string | -           |
| sdk.version                | string | -           |
| request.headers.User-Agent | string | -           |

- Request (ContentType: application/json)

  ```json
  {
    "type": "replay_event",
    "replay_type": "session",
    "replay_id": "515539018c9b4260a6f999572f1661ee",
    "event_id": "e4a28052c54743a286be419c9d168ef5",
    "segment_id": 0,
    "timestamp": 161657652454,
    "replay_start_timestamp": 160006562825,
    "urls": ["https://www.sentry.io", "https://www.sentry.io/login"],
    "error_ids": [],
    "trace_ids": [],
    "dist": "abc123",
    "platform": "javascript",
    "environment": "production",
    "release": "version@1.3",
    "user": {
      "id": "123",
      "username": "username",
      "email": "username@example.com",
      "ip_address": "127.0.0.1"
    },
    "sdk": {
      "name": "sentry.javascript.react",
      "version": "6.18.1"
    },
    "tags": {
      "customtag": "is_set",
      "transaction": "Title"
    },
    "contexts": {
      "replay": {
        "error_sample_rate": 0.2,
        "session_sample_rate": 0.5
      },
      "trace": {
        "op": "pageload",
        "span_id": "affa5649681a1eeb",
        "trace_id": "23eda6cd4b174ef8a51f0096df3bfdd1"
      }
    },
    "request": {
      "url": "http://localhost:3000/",
      "headers": {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36"
      }
    },
    "extra": {}
  }
  ```

### Replay Recording Segment Event

- Request (application/octet-stream)

  ```bytes
  {"segment_id": 0}
  \x00\x00\x00\x14ftypqt  \x00\x00\x00\x00qt  \x00\x00\x00\x08wide\x03\xbdd\x11mdat
  ```

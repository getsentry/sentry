# Replays Snuba Consumer

## Replay Event

```json
{
  "type": "replay_event",
  "start_time": 1678478346.735299,
  "replay_id": "e5e062bf2e1d4afd96fd2f90b6770431",
  "project_id": 1,
  "retention_days": 30,
  "payload": {
    "type": "replay_event",
    "replay_id": "e5e062bf2e1d4afd96fd2f90b6770431",
    "replay_type": "session",
    "segment_id": 0,
    "event_hash": "8bea4461d8b944f393c15a3cb1c4169a",
    "urls": ["https:://www.sentry.io", "https:://www.sentry.io/login"],
    "is_archived": false,
    "trace_ids": ["36e980a9c6024cde9f5d089f15b83b5f", "8bea4461d8b944f393c15a3cb1c4169a"],
    "error_ids": ["36e980a9c6024cde9f5d089f15b83b5f"],
    "dist": "",
    "platform": "javascript",
    "timestamp": 1678478346,
    "replay_start_timestamp": 1678478346,
    "environment": "prod",
    "release": "34a554c14b68285d8a8eb6c5c4c56dfc1db9a83a",
    "user": {
      "id": "101",
      "username": "sentaur",
      "email": "sentaur@sentry.io",
      "ip_address": "127.0.0.1"
    },
    "sdk": {
      "name": "sentry.javascript",
      "version": "7.41.0"
    },
    "tags": {
      "customtag": "is_set",
      "transaction": "/organizations/:orgId/issues/"
    },
    "contexts": {
      "trace": {
        "op": "pageload",
        "span_id": "affa5649681a1eeb",
        "trace_id": "23eda6cd4b174ef8a51f0096df3bfdd1"
      },
      "replay": {
        "error_sample_rate": 0.5,
        "session_sample_rate": 0.5
      },
      "os": {
        "name": "iOS",
        "version": "16.2"
      },
      "browser": {
        "name": "Firefox",
        "version": "110.0"
      },
      "device": {
        "name": "iPhone 11",
        "brand": "Apple",
        "family": "iPhone",
        "model": "iPhone"
      }
    },
    "request": {
      "url": "https:://www.sentry.io",
      "headers": {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/110.0"
      }
    }
  }
}
```

## Replay Actions Event

```json
{
  "type": "replay_event",
  "start_time": 1678478346.735299,
  "replay_id": "e5e062bf2e1d4afd96fd2f90b6770431",
  "project_id": 1,
  "retention_days": 30,
  "payload": {
    "type": "replay_actions",
    "replay_id": "e5e062bf2e1d4afd96fd2f90b6770431",
    "segment_id": 0,
    "actions": [
      {
        "dom_action": "click",
        "dom_element": "div",
        "dom_id": "id",
        "dom_classes": ["class1", "class2"],
        "dom_aria_label": "test",
        "dom_aria_role": "aria-button",
        "dom_role": "button",
        "dom_text_content": "text",
        "dom_node_id": 59,
        "timestamp": 1678478346,
        "event_hash": "df3c3aa2daae465e89f1169e49139827"
      }
    ]
  }
}
```

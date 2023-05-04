# Replays API

Host: https://sentry.io/api/0

**Authors.**

@cmanallen
@joshferge

**How to read this document.**

This document is structured by resource with each resource having actions that can be performed against it. Every action that either accepts a request or returns a response WILL document the full interchange format. Clients may opt to restrict response data or provide a subset of the request data. The API may or may not accept partial payloads.

## Replays [/organizations/<organization_slug>/replays/]

- Parameters

  - field (optional, string)
  - environment (optional, string)
  - project (optional, string)
  - sort (optional, string)
    Default: -startedAt
    Members: + projectId + -projectId + startedAt + -startedAt + finishedAt + -finishedAt + duration + -duration + countErrors + -countErrors
  - statsPeriod (optional, string) - A positive integer suffixed with a unit type.
    Default: 7d
    Members: + s + m + h + d + w
  - start (optional, string) - ISO 8601 format (`YYYY-MM-DDTHH:mm:ss.sssZ`)
  - end (optional, string) - ISO 8601 format. Required if `start` is set.
  - limit (optional, number)
    Default: 10
  - offset (optional, number)
    Default: 0
  - query (optional, string) - Search query with space-separated field/value pairs. ie: `?query=count_errors:>2 AND duration:<1h`.
  - queryReferrer(optional, string) - Specify the page which this query is being made from. Used for cross project query on issue replays page. pass `queryReferrer=issueReplays` for this query.
    Some fields in the API response have their own dedicated parameters, or are otherwide not supported in the `query` param. They are:

    | Response Field      | Parameter       |
    | ------------------- | --------------- |
    | `environment`       | `?environment=` |
    | `project_id`        | `?project=`     |
    | `started_at`        | `?start=`       |
    | `finished_at`       | `?end=`         |
    | `user.display_name` | -               |

    You can use the following aliases to query for fields that are plural in the API response:

    | Response Field | Search Alias         |
    | -------------- | -------------------- |
    | `error_ids`    | `error_id`           |
    | `releases`     | `release`            |
    | `trace_ids`    | `trace` & `trace_id` |
    | `urls`         | `url`                |

    Additionally, you can filter by these hidden fields.

    | Field             | Type          | Description                                                    |
    | ----------------- | ------------- | -------------------------------------------------------------- |
    | click.alt         | string        | The alt attribute of the HTML element.                         |
    | click.class       | array[string] | An array of HTML element classes.                              |
    | click.id          | string        | The ID of an HTML element.                                     |
    | click.label       | string        | The aria-label attribute of an HTML element.                   |
    | click.role        | string        | The role of an HTML element.                                   |
    | click.tag         | string        | Valid HTML5 tag name.                                          |
    | click.testid      | string        | The data-testid of an HTML element. (omitted from public docs) |
    | click.textContent | string        | The text-content of an HTML element.                           |
    | click.title       | string        | The title attribute of an HTML element.                        |
    | click.selector    | string        | A valid CSS selector.                                          |

### Browse Replays [GET]

Retrieve a collection of replays.

**Attributes**

| Column            | Type                          | Description                                            |
| ----------------- | ----------------------------- | ------------------------------------------------------ |
| activity          | number                        | -                                                      |
| browser.name      | optional[string]              | -                                                      |
| browser.version   | optional[string]              | -                                                      |
| count_errors      | number                        | The number of errors associated with the replay.       |
| count_segments    | number                        | The number of segments that make up the replay.        |
| count_urls        | number                        | The number of urls visited in the replay.              |
| device.brand      | optional[string]              | -                                                      |
| device.family     | optional[string]              | -                                                      |
| device.model_id   | optional[string]              | Same search field as Events                            |
| device.name       | optional[string]              | -                                                      |
| dist              | optional[string]              | -                                                      |
| duration          | number                        | Difference of `finishedAt` and `startedAt` in seconds. |
| environment       | optional[string]              | -                                                      |
| error_ids         | array[string]                 | -                                                      |
| finished_at       | string                        | The **latest** timestamp received.                     |
| id                | string                        | The ID of the Replay instance.                         |
| is_archived       | bool                          | Whether the replay was deleted or not.                 |
| os.name           | optional[string]              | -                                                      |
| os.version        | optional[string]              | -                                                      |
| platform          | string                        | -                                                      |
| project_id        | string                        | -                                                      |
| releases          | array[string]                 | Same search field as Events                            |
| sdk.name          | string                        | -                                                      |
| sdk.version       | string                        | -                                                      |
| started_at        | string                        | The **earliest** replay_start_timestamp received.      |
| tags              | object[string, array[string]] | -                                                      |
| trace_ids         | array[string]                 | Same search field as Events                            |
| urls              | array[string]                 | -                                                      |
| user.display_name | optional[string]              | -                                                      |
| user.email        | optional[string]              | -                                                      |
| user.id           | optional[string]              | -                                                      |
| user.ip           | optional[string]              | Same search field as Events                            |
| user.username     | optional[string]              | -                                                      |

- Response 200

  ```json
  {
    "data": [
      {
        "activity": 5,
        "browser": {
          "name": "Chome",
          "version": "103.0.38"
        },
        "count_errors": 1,
        "count_segments": 0,
        "count_urls": 1,
        "device": {
          "brand": "Apple",
          "family": "iPhone",
          "model_id": "11",
          "name": "iPhone 11"
        },
        "dist": null,
        "duration": 576,
        "environment": "production",
        "error_ids": ["7e07485f-12f9-416b-8b14-26260799b51f"],
        "finished_at": "2022-07-07T14:15:33.201019",
        "id": "7e07485f-12f9-416b-8b14-26260799b51f",
        "is_archived": false,
        "os": {
          "name": "iOS",
          "version": "16.2"
        },
        "platform": "Sentry",
        "project_dd": "639195",
        "releases": ["version@1.4"],
        "sdk": {
          "name": "Thundercat",
          "version": "27.1"
        },
        "started_at": "2022-07-07T14:05:57.909921",
        "tags": {
          "hello": ["world", "Lionel Richie"]
        },
        "trace_ids": ["7e07485f-12f9-416b-8b14-26260799b51f"],
        "urls": ["/organizations/abc123/issues"],
        "user": {
          "display_name": "John Doe",
          "email": "john.doe@example.com",
          "id": "30246326",
          "ip_address": "213.164.1.114",
          "username": "John Doe"
        }
      }
    ]
  }
  ```

## Replay [/projects/<organization_slug>/<project_slug>/replays/<replay_id>/]

- Parameters
  - field (optional, string)

### Fetch Replay [GET]

Retrieve a single replay instance.

- Response 200

  ```json
  {
    "data": {
      "activity": 5,
      "browser": {
        "name": "Chome",
        "version": "103.0.38"
      },
      "count_errors": 1,
      "count_segments": 0,
      "count_urls": 1,
      "device": {
        "brand": "Apple",
        "family": "iPhone",
        "model_id": "11",
        "name": "iPhone 11"
      },
      "dist": null,
      "duration": 576,
      "environment": "production",
      "error_ids": ["7e07485f-12f9-416b-8b14-26260799b51f"],
      "finished_at": "2022-07-07T14:15:33.201019",
      "id": "7e07485f-12f9-416b-8b14-26260799b51f",
      "os": {
        "name": "iOS",
        "version": "16.2"
      },
      "platform": "Sentry",
      "project_id": "639195",
      "releases": ["version@1.4"],
      "sdk": {
        "name": "Thundercat",
        "version": "27.1"
      },
      "started_at": "2022-07-07T14:05:57.909921",
      "tags": {
        "hello": ["world", "Lionel Richie"]
      },
      "trace_ids": ["7e07485f-12f9-416b-8b14-26260799b51f"],
      "urls": ["/organizations/abc123/issues"],
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

### Delete Replay [DELETE]

Deletes a replay instance.

- Response 204

## Replay Recording Segments [/projects/<organization_slug>/<project_slug>/replays/<replay_id>/recording-segments/]

- Parameters
  - per_page
  - cursor
  - download - Instruct the API to return a streaming json response

### Browse Replay Recording Segments [GET]

Retrieve a collection of replay recording-segments.

| Column    | Type   | Description |
| --------- | ------ | ----------- |
| replayId  | string | -           |
| segmentId | number | -           |
| projectId | string | -           |
| dateAdded | string | -           |

Without download query argument

- Response 200

  ```json
  {
    "data": [
      {
        "replayId": "7e07485f-12f9-416b-8b14-26260799b51f",
        "segmentId": 0,
        "projectId": "409512",
        "dateAdded": "2022-07-07T14:15:33.201019"
      }
    ]
  }
  ```

With download query argument, rrweb events JSON

- Response 200
  Content-Type application/json

  ```json
  [
    [
      {"type":4, "data":{"href":"https://example.com", "width":1500, "height":1200}},
      {...}
    ],
    [
      {...}
    ]
  ]
  ```

## Replay Recording Segment [/projects/<organization_slug>/<project_slug>/replays/<replay_id>/recording-segments/<segment_id>/]

- Parameters
  - download - Instruct the API to return a streaming bytes response.

### Fetch Replay Recording Segment [GET]

Retrieve a single replay recording-segment.

Without download query argument.

- Response 200

  ```json
  {
    "data": {
      "replayId": "7e07485f-12f9-416b-8b14-26260799b51f",
      "segmentId": 0,
      "projectId": 409512,
      "dateAdded": "2022-07-07T14:15:33.201019"
    }
  }
  ```

With download query argument.

- Response 200

  Content-Type application/octet-stream

## Replay Tag Keys [/projects/<organization_slug>/<project_slug>/replays/tags/]

### Fetch Tag Keys [GET]

Retrieve a collection of tag keys associated with the replays dataset.

| Column      | Type   | Description |
| ----------- | ------ | ----------- |
| key         | string | -           |
| name        | string | -           |
| totalValues | number | -           |

- Response 200

  ```json
  [
    {
      "key": "plan.total_members",
      "name": "Plan.Total Members",
      "totalValues": 630661
    }
  ]
  ```

## Replay Tag Values [/projects/<organization_slug>/<project_slug>/replays/tags/<key>/values/]

### Fetch Tag Values [GET]

Retrieve a collection of tag values associated with a tag key on the replays dataset.

| Column    | Type   | Description |
| --------- | ------ | ----------- |
| key       | string | -           |
| name      | string | -           |
| value     | string | -           |
| count     | number | -           |
| lastSeen  | string | -           |
| firstSeen | string | -           |

- Response 200

  ```json
  [
    {
      "key": "plan",
      "name": "am1_team",
      "value": "am1_team",
      "count": 66880,
      "lastSeen": "2022-12-09T19:39:53Z",
      "firstSeen": "2022-11-25T19:40:39Z"
    }
  ]
  ```

## Replay Click [/projects/<organization_slug>/<project_slug>/replays/<replay_id>/clicks/]

Parameters:

| Parameter | Type   | Default | Description                                  |
| --------- | ------ | ------- | -------------------------------------------- |
| limit     | number | 100     |                                              |
| offset    | number | 0       |                                              |
| query     | string | 0       | Space-separated string of field, value pairs |

Queryable fields:

| Field             | Type          | Description                                                    |
| ----------------- | ------------- | -------------------------------------------------------------- |
| click.alt         | string        | The alt attribute of the HTML element.                         |
| click.class       | array[string] | An array of HTML element classes.                              |
| click.id          | string        | The ID of an HTML element.                                     |
| click.label       | string        | The aria-label attribute of an HTML element.                   |
| click.role        | string        | The role of an HTML element.                                   |
| click.selector    | string        | A valid CSS selector.                                          |
| click.tag         | string        | Valid HTML5 tag name.                                          |
| click.testid      | string        | The data-testid of an HTML element. (omitted from public docs) |
| click.textContent | string        | The text-content of an HTML element.                           |
| click.title       | string        | The title attribute of an HTML element.                        |

### Fetch Replay Clicks [GET]

Retrieve a collection of click events associated with a replay.

| Column    | Type   | Description                    |
| --------- | ------ | ------------------------------ |
| node_id   | number | RRWeb node id.                 |
| timestamp | number | Unix timestamp of click event. |

- Response 200

  ```json
  {
    "data": [
      {
        "node_id": 339,
        "timestamp": 1681226444
      }
    ]
  }
  ```

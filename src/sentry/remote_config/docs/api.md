# Configurations API

Host: https://sentry.io/api/0

**Authors.**

@cmanallen

## Configuration [/projects/<organization_id_or_slug>/<project_id_or_slug>/configuration/]

### Get Configuration [GET]

Retrieve the project's configuration.

**Attributes**

| Column   | Type           | Description                                   |
| -------- | -------------- | --------------------------------------------- |
| features | array[Feature] | Custom, user-defined configuration container. |
| options  | Option         | Sentry SDK options container.                 |

**Feature Object**

| Field | Type   | Description                        |
| ----- | ------ | ---------------------------------- |
| key   | string | The name used to lookup a feature. |
| value | any    | A JSON value.                      |

**Option Object**

| Field              | Type  | Description                                         |
| ------------------ | ----- | --------------------------------------------------- |
| sample_rate        | float | Error sample rate. A numeric value between 0 and 1. |
| traces_sample_rate | float | Trace sample rate. A numeric value between 0 and 1. |

**If an existing configuration exists**

- Response 200

  ```json
  {
    "data": {
      "features": [
        {
          "key": "hello",
          "value": "world"
        },
        {
          "key": "has_access",
          "value": true
        }
      ],
      "options": {
        "sample_rate": 1.0,
        "traces_sample_rate": 0.5
      }
    }
  }
  ```

**If no existing configuration exists**

- Response 404

### Set Configuration [POST]

Set the project's configuration.

- Request

  ```json
  {
    "data": {
      "features": [
        {
          "key": "hello",
          "value": "world"
        },
        {
          "key": "has_access",
          "value": true
        }
      ],
      "options": {
        "sample_rate": 1.0,
        "traces_sample_rate": 0.5
      }
    }
  }
  ```

- Response 201

  ```json
  {
    "data": {
      "features": [
        {
          "key": "hello",
          "value": "world"
        },
        {
          "key": "has_access",
          "value": true
        }
      ],
      "options": {
        "sample_rate": 1.0,
        "traces_sample_rate": 0.5
      }
    }
  }
  ```

### Delete Configuration [DELETE]

Delete the project's configuration.

- Response 204

## Configuration Proxy [/remote-config/projects/<project_id>/]

Temporary configuration proxy resource.

### Get Configuration [GET]

Fetch a project's configuration. Responses should be proxied exactly to the SDK.

- Response 200

  - Headers

    Cache-Control: public, max-age=3600
    Content-Type: application/json
    ETag: a7966bf58e23583c9a5a4059383ff850

  - Body

    ```json
    {
      "features": [
        {
          "key": "hello",
          "value": "world"
        },
        {
          "key": "has_access",
          "value": true
        }
      ],
      "options": {
        "sample_rate": 1.0,
        "traces_sample_rate": 0.5
      },
      "version": 1
    }
    ```

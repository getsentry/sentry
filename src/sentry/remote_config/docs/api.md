# Configurations API

Host: https://sentry.io/api/0

**Authors.**

@cmanallen

## Configuration [/projects/<organization_id_or_slug>/<project_id_or_slug>/keys/<key_id>/configuration/]

### Get Configuration [GET]

Retrieve the DSN's configuration.

**Attributes**

| Column   | Type           | Description                                                                  |
| -------- | -------------- | ---------------------------------------------------------------------------- |
| id       | string         | Client key.                                                                  |
| hash     | option[string] | A hash of the contents of the value. Sent on write to ensure atomic updates. |
| features | array[Feature] | Custom, user-defined configuration container.                                |
| options  | Option         | Sentry SDK options container.                                                |

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
      "id": "99aabf0dad1c48ad8e47e2a43969f312",
      "hash": "4e0bc3b37ede0701dc388c360a8ba5849700739c",
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

Set the DSN's configuration. A hash value of `null` is provided if the object does not exist. If the API finds an existing configuration object an error is returned. If the hash value is provided then it will be compared against the hash of the remote value. A new hash is always returned on successful write. If the hashes do not match an error is returned.

The client will never generate a HASH. It forwards the hash the server has provided it.

- Request

  ```json
  {
    "data": {
      "hash": null,
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
      "id": "99aabf0dad1c48ad8e47e2a43969f312",
      "hash": "4e0bc3b37ede0701dc388c360a8ba5849700739c",
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

Delete the DSN's configuration.

- Response 204

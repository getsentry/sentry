# Configurations API

Host: https://sentry.io/api/0

**Authors.**

@cmanallen

## Configuration [/projects/<organization_id_or_slug>/<project_id_or_slug>/keys/<key_id>/configuration/]

### Get Configuration [GET]

Retrieve the DSN's configuration.

**Attributes**

| Column             | Type   | Description                     |
| ------------------ | ------ | ------------------------------- |
| id                 | string | Client key.                     |
| sample_rate        | number | A number value between 0 and 1. |
| traces_sample_rate | number | A number value between 0 and 1. |
| user_config        | any    | Arbitrary user supplied JSON.   |

**If an existing configuration exists**

- Response 200

  ```json
  {
    "data": {
      "id": 1,
      "sample_rate": 1.0,
      "traces_sample_rate": 0.5,
      "user_config": {
        "hello": "world"
      }
    }
  }
  ```

**If no existing configuration exists**

- Response 404

### Set Configuration [POST]

Set the DSN's configuration.

- Request

  ```json
  {
    "data": {
      "sample_rate": 0.2,
      "traces_sample_rate": 0.5,
      "user_config": ["hello", "world"]
    }
  }
  ```

- Response 201

  ```json
  {
    "data": {
      "id": 1,
      "sample_rate": 0.2,
      "traces_sample_rate": 0.5,
      "user_config": ["hello", "world"]
    }
  }
  ```

### Delete Configuration [DELETE]

Delete the DSN's configuration.

- Response 204

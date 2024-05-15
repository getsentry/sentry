# Configurations API

Host: https://sentry.io/api/0

**Authors.**

@cmanallen

## Configuration [/projects/<organization_id_or_slug>/<project_id_or_slug>/configuration/]

### Get Configuration [GET]

Retrieve the project's configuration.

**Attributes**

| Column             | Type   | Description                     |
| ------------------ | ------ | ------------------------------- |
| id                 | number | Project id.                     |
| sample_rate        | number | A number value between 0 and 1. |
| traces_sample_rate | number | A number value between 0 and 1. |
| user_config        | any    | Arbitrary user supplied JSON.   |

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

### Update Configuration [PATCH]

Update the project's configuration.

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

Delete the project's configuration.

- Response 204

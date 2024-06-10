# Configurations API

Host: https://sentry.io/api/0

**Authors.**

@cmanallen

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

## Configurations [/projects/<organization_id_or_slug>/<project_id_or_slug>/configurations/]

| Field              | Type             | Description                                                                   |
| ------------------ | ---------------- | ----------------------------------------------------------------------------- |
| environment        | optional[string] | The environment the configuration is associated with.                         |
| id                 | string           | A server generated unique identifier.                                         |
| name               | optional[string] | A custom name distinguishing the configuration from the default project name. |
| sample_rate        | number           |                                                                               |
| traces_sample_rate | number           |                                                                               |
| version            | number           | The current configuration version. Initialized to 1.                          |

### Get Configurations [GET]

Retrieve configurations.

- Response 200

  ```json
  {
    "data": [
      {
        "environment": null,
        "id": "0b88ac27a7b444a6baeb312c0493aed5",
        "name": null,
        "sample_rate": 0,
        "traces_sample_rate": 0.75,
        "version": 1
      }
    ]
  }
  ```

### Create Configuration [POST]

Create a new configuration. The version field is ignored on create. Version is initialized to 1.

- Request

  ```json
  {
    "data": {
      "environment": "production",
      "name": "custom-name",
      "sample_rate": 1.0,
      "traces_sample_rate": 0.5
    }
  }
  ```

- Response 201

  ```json
  {
    "data": {
      "environment": "production",
      "id": "0b88ac27a7b444a6baeb312c0493aed5",
      "name": "custom-name",
      "sample_rate": 1.0,
      "traces_sample_rate": 0.5,
      "version": 1
    }
  }
  ```

## Configuration [/projects/<organization_id_or_slug>/<project_id_or_slug>/configurations/<configuration_id>/]

### Get Configuration [GET]

Retrieve a configuration.

- Response 200

  ```json
  {
    "data": {
      "environment": null,
      "id": "0b88ac27a7b444a6baeb312c0493aed5",
      "name": null,
      "sample_rate": 0,
      "traces_sample_rate": 0.75,
      "version": 1
    }
  }
  ```

### Update Configuration [PATCH]

Update a configuration. The version attribute is required for all update requests and must match the current server configuration in order to update else an error is returned.

- Request

  ```json
  {
    "data": {
      "sample_rate": 0,
      "version": 2
    }
  }
  ```

- Response 202

  ```json
  {
    "data": {
      "environment": "production",
      "id": "0b88ac27a7b444a6baeb312c0493aed5",
      "name": null,
      "sample_rate": 0,
      "traces_sample_rate": 0.5,
      "version": 2
    }
  }
  ```

### Delete Configuration [DELETE]

Delete a configuration.

- Response 204

## Features [/projects/<organization_id_or_slug>/<project_id_or_slug>/configuration/<configuration_id>/features/]

### Get Features [GET]

Retrieve configuration features.

- Response 200

  ```json
  {
    "data": [
      {
        "description": "A feature description.",
        "is_enabled": true,
        "key": "hello",
        "value": 22.3
      }
    ]
  }
  ```

### Create Feature [POST]

Create a configuration feature.

- Request

  ```json
  {
    "data": {
      "description": "Another key.",
      "is_enabled": true,
      "key": "other",
      "value": "key"
    }
  }
  ```

- Response 201

  ```json
  {
    "data": {
      "description": "Another key.",
      "is_enabled": true,
      "key": "other",
      "value": "key"
    }
  }
  ```

## Feature [/projects/<organization_id_or_slug>/<project_id_or_slug>/configuration/<configuration_id>/features/<feature_id>/]

### Get Feature [GET]

Retrieve a configuration feature.

- Response 200

  ```json
  {
    "data": {
      "description": "A feature description.",
      "is_enabled": true,
      "key": "hello",
      "value": 22.3
    }
  }
  ```

### Update Feature [PATCH]

Update a configuration feature.

- Request

  ```json
  {
    "data": {
      "is_enabled": false
    }
  }
  ```

- Response 202

  ```json
  {
    "data": {
      "description": "A feature description.",
      "is_enabled": false,
      "key": "hello",
      "value": 22.3
    }
  }
  ```

### Delete Feature [DELETE]

Delete a configuration feature.

- Response 204

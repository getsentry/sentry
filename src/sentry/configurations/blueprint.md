# Configurations API

Host: https://sentry.io/api/0

**Authors.**

@cmanallen

## Configurations [/organizations/<organization_slug>/configurations/]

- Parameters

  - per_page (optional, number)
    Default: 10
  - offset (optional, number)
    Default: 0

### Browse Configurations [GET]

Retrieve a collection of configurations.

**Attributes**

| Column | Type   | Description                                                                              |
| ------ | ------ | ---------------------------------------------------------------------------------------- |
| id     | string | Unique (per organization), user-specified configuration slug (can never be overwritten). |

- Response 200

  ```json
  {
    "data": [
      {
        "id": 42,
        "slug": "my_configuration"
      }
    ]
  }
  ```

### Create Configuration [POST]

Create a new configuration instance.

- Request

  ```json
  {
    "data": {
      "slug": "my_configuration"
    }
  }
  ```

- Response 201

  ```json
  {
    "data": {
      "id": 42,
      "slug": "my_configuration"
    }
  }
  ```

## Configuration [/organizations/<organization_slug>/configurations/<id>/]

### Fetch Configuration [GET]

Retrieve a single configuration instance.

- Response 200

  ```json
  {
    "data": {
      "id": 42,
      "slug": "my_configuration"
    }
  }
  ```

### Delete Configuration [DELETE]

Delete a configuration instance.

- Response 204

## Configuration Features [/organizations/<organization_slug>/configurations/<id>/features/]

- Parameters

  - per_page (optional, number)
    Default: 10
  - offset (optional, number)
    Default: 0

### Browse Configuration Features [GET]

Retrieve a collection of configuration features.

**Attributes**

| Column | Type   | Description         |
| ------ | ------ | ------------------- |
| id     | string | -                   |
| key    | string | Limit 32 bytes.     |
| value  | string | Must be valid JSON. |

- Response 200

  ```json
  {
    "data": [
      {
        "id": "d53bf0e4-d0f7-4e2e-878d-7a54cebe187b",
        "key": "sample_rate",
        "value": "0.675"
      }
    ]
  }
  ```

### Create Configuration Feature [POST]

Create a new configuration feature instance.

- Request

  ```json
  {
    "data": {
      "key": "hello",
      "value": "world"
    }
  }
  ```

- Response 201

  ```json
  {
    "data": {
      "key": "hello",
      "value": "world"
    }
  }
  ```

## Configuration Feature [/organizations/<organization_slug>/configurations/<configuration_id>/features/<id>]

### Fetch Configuration Feature [GET]

Retrieve a single configuration feature instance.

- Response 200

  ```json
  {
    "data": {
      "id": "f5592ea5-db87-43c7-9fa3-581c83122477",
      "key": "enable_profiling",
      "value": "true"
    }
  }
  ```

### Update Configuration Feature [PATCH]

Update a configuration feature instance.

- Request

  ```json
  {
    "data": {
      "id": "f5592ea5-db87-43c7-9fa3-581c83122477",
      "key": "enable_profiling",
      "value": "false"
    }
  }
  ```

- Response 202

  ```json
  {
    "data": {
      "id": "f5592ea5-db87-43c7-9fa3-581c83122477",
      "key": "enable_profiling",
      "value": "false"
    }
  }
  ```

### Delete Configuration Feature [DELETE]

Delete a configuration feature instance.

- Response 204

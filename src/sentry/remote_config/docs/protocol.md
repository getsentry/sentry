# Remote Configuration Protocol

Host: https://o1300299.ingest.us.sentry.io

**Authors.**

@cmanallen

## Configuration [/api/<project_id>/configuration/]

### Get Configuration [GET]

Retrieve a project's configuration.

**Attributes**

| Field    | Type           | Description                                   |
| -------- | -------------- | --------------------------------------------- |
| features | array[Feature] | Custom, user-defined configuration container. |
| options  | Option         | Sentry SDK options container.                 |
| version  | number         | The version of the protocol.                  |

**Feature Object**

| Field | Type   | Description                        |
| ----- | ------ | ---------------------------------- |
| key   | string | The name used to lookup a feature. |
| value | any    | A JSON value.                      |

**Option Object**

| Field              | Type  | Description        |
| ------------------ | ----- | ------------------ |
| sample_rate        | float | Error sample rate. |
| traces_sample_rate | float | Trace sample rate. |

**Server ETag Matches**

If the server's ETag matches the request's a 304 (NOT MODIFIED) response is returned.

- Request

  - Headers

    Accept: application/json
    If-None-Match: 8832040536272351350

- Response 304

  - Headers

    Cache-Control: public, max-age=60
    Content-Type: application/json
    ETag: 8832040536272351350

**Server ETag Does Not Match or If-None-Match Omitted**

If the server's ETag does not match the request's a 200 response is returned.

- Request

  - Headers

    Accept: application/json
    If-None-Match: ABC

- Response 200

  - Headers

    Cache-Control: public, max-age=60
    Content-Type: application/json
    ETag: 8832040536272351350

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

**No Configuration Exists for the Project**

- Request

  - Headers

    Accept: application/json
    If-None-Match: ABC

- Response 404

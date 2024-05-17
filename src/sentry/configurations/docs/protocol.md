# Remote Configuration Protocol

Host: https://o1300299.ingest.us.sentry.io

**Authors.**

@cmanallen

## Configuration [/api/<project_id>/configuration/]

### Get Configuration [GET]

Retrieve a project's configuration.

**Attributes**

| Field                      | Type   | Description                           |
| -------------------------- | ------ | ------------------------------------- |
| options                    | object | A statically typed options structure. |
| options.sample_rate        | float  | The rate at which to sample errors.   |
| options.traces_sample_rate | float  | The rate at which to sample traces.   |
| options.user_config        | any    | Arbitrary JSON provided by the user.  |
| version                    | number | The version of the protocol.          |

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
      "options": {
        "sample_rate": 1.0,
        "traces_sample_rate": 0.5,
        "user_config": {
          "hello": "world"
        }
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

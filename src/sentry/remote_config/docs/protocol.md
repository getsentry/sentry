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

| Field    | Type           | Description                                                                     |
| -------- | -------------- | ------------------------------------------------------------------------------- |
| key      | string         | The name used to lookup a feature.                                              |
| value    | any            | A JSON value.                                                                   |
| variants | array[Variant] | Features can have any number of possible variants which alter the return value. |

Features may specify zero or more variants which may alter the evaluation result.

**Variant Object**

| Field   | Type        | Description                                                                               |
| ------- | ----------- | ----------------------------------------------------------------------------------------- |
| rollout | Rollout     | An object which contains instructions for rolling out a variant.                          |
| rules   | array[Rule] | An array of rules which all must evaluate to true in order to return the variant's value. |
| value   | any         | The value of the feature if the variant is successfully evaluated.                        |

When evaluating a set of rules and varaints each rule is a logical `AND` while each variant is a logical `OR`. Failure to evaluate one variant does not prevent another variant from successfully evaluating. Failure to evaluate one rule does invalidate the remaining rules and the evaluation proceedure can eagerly terminate.

**Rollout Object**

| Field      | Type   | Description                                                 |
| ---------- | ------ | ----------------------------------------------------------- |
| percentage | number | The percentage of requests which should evaluate to true.   |
| seed       | string | A SHA1 hash used to seed a random number generator.         |
| target     | string | The name of a property contained within the context object. |

The rollout cohort a session is bucketed into is deterministic some long as the `target` value is static. The `target` value controls the bucket a session is placed into. The `seed` value provides randomization _between features_ such that if a session is successfully opted into feature `A` they will not necesssarily be opted into feature `B` even if those features share the same rollout percentage. The `percentage` value controls the number of buckets which evaluate to `true`.

**Rule Object**

| Field    | Type                                        | Description                                                             |
| -------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| format   | optional[string]                            | A deserialization hint for further processing of string values.         |
| operator | string                                      | A conditional operator that evaluates the value against the target.     |
| property | string                                      | A context object property name which contains the value of the operand. |
| value    | union[string, int, bool, null, array[self]] | The value being compared against.                                       |

Rules contain evaluation and extraction instructions. The context object provided must contain the key defined on the `property` attribute. If the SDK can not find the `property` within the context object the evaluation fails and the variant is skipped. The `operator` defines how the context value is compared against the literal provided by the configuration on the `value` attribute. If the value provided in the context object can not be compared against the value provided in the configuration the evaluation fails and the variant is skipped.

Some data-type can not be represented in JSON. These types will be serialized to a string and a decoding hint will be defined on the `format` key.

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
          "value": "world",
          "variants": [
            {
              "rollout": {
                "percentage": 50,
                "seed": "5f927c1c3676abbe5f13d9f8d28ffa625e80bf04",
                "target": "user_id"
              },
              "rules": [
                {
                  "format": null,
                  "operator": "==",
                  "property": "region",
                  "value": "Europe"
                },
                {
                  "format": "datetime",
                  "operator": "==",
                  "property": "now",
                  "value": "2024-12-25T00:00:00+00:00"
                }
              ],
              "value": "computer"
            }
          ]
        },
        {
          "key": "has_access",
          "value": true,
          "variants": []
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

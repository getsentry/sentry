# Sentiment Analysis API

Host: https://sentry.io/api/0

**Authors.**

@cmanallen

**How to read this document.**

This document is structured by resource with each resource having actions that
can be performed against it. Every action that either accepts a request or
returns a response _will_ document the full interchange format. Clients may opt
to restrict response data or provide a subset of the request data. The API may
or may not accept partial payloads.

**Design philosophy.**

The resources contained within this document are designed to be embedded. Though,
we expose our own endpoints (and encourage usage) many products will wish
to embed sentiment-analysis data into their API responses. To prevent a profileration
of serializers and deserializers we encourage standardizing on our embeddable
format. Response objects are identified by their type field. The type indicates the
structure of the object and can be switched on to select the correct deserialization
logic. This should enable significant re-use within both client and server contexts.

## Sentiment Analysis Document [/organizations/<organization_id_or_slug>/sentiment-analysis/<id>/]

Pending, in-progress, and failed sentiment-analysis items are not returned. A 404 status code should be issued.

**Fields**

| Field               | Type            | Description                                                               |
| ------------------- | --------------- | ------------------------------------------------------------------------- |
| id                  | number          | -                                                                         |
| type                | string          | Literal of `sentiment-analysis`                                           |
| language            | string          | ISO 639-1 identifier or ISO 639-2 3-letter code                           |
| magnitude           | number          | Non-negative number which represents the absolute magnitude of sentiment. |
| score               | number          | The sentiment score from -1.0 to 1.0. Higher is more positive.            |
| sentences           | array[Sentence] | The sentiment score of an individual sentence within the document.        |
| sentences.offset    | number          | The starting position of the sentence in the document.                    |
| sentences.length    | number          | The length of the analyzed sub-sequence.                                  |
| sentences.magnitude | number          | Non-negative number which represents the absolute magnitude of sentiment. |
| sentences.score     | number          | The sentiment score from -1.0 to 1.0. Higher is more positive.            |

- Model

  - Body

    ```json
    {
      "data": {
        "id": 44334,
        "type": "sentiment-analysis",
        "attributes": {
          "language": "en",
          "magnitude": 45,
          "score": 0.82,
          "sentences": [
            {
              "offset": 0,
              "length": 18,
              "magnitude": 144,
              "score": 0.91
            },
            {
              "offset": 18,
              "length": 45,
              "magnitude": 9,
              "score": -0.54
            }
          ]
        }
      }
    }
    ```

### Fetch Sentiment Analysis Document [GET]

Retrieve a sentiment analysis document.

- Response 200

## Sentiment Analysis Entities [/organizations/<organization_id_or_slug>/entity-sentiment-analysis/<id>/]

Pending, in-progress, and failed sentiment-analysis items are not returned. A 404 status code should be issued.

- Parameters

  - cursor (optional, str)
  - per_page (optional, number) Default: 50
  - offset (optional, number) Default: 0

**Fields**

| Field     | Type   | Description                                                                           |
| --------- | ------ | ------------------------------------------------------------------------------------- |
| id        | number | -                                                                                     |
| type      | string | Literal of `entity-sentiment-analysis`                                                |
| name      | string | The word being analyzed.                                                              |
| type      | string | A general category the word falls under e.g. location and person.                     |
| magnitude | number | Non-negative number which represents the absolute magnitude of sentiment.             |
| salience  | number | A number between 0 and 1.0. Represents the centrality of the keyword to the document. |
| score     | number | The sentiment score from -1.0 to 1.0. Higher is more positive.                        |

- Model

  - Body

    ```json
    {
      "data": [
        {
          "id": 10,
          "type": "entity-sentiment-analysis",
          "attributes": {
            "magnitude": 144,
            "name": "issues platform",
            "salience": 0.77,
            "score": 0.91,
            "type": "LOCATION"
          }
        }
      ]
    }
    ```

### Fetch Sentiment Analysis Entities [GET]

Retrieve a collection of sentiment analysis entities.

- Response 200

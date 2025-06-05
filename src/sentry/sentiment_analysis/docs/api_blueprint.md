# Feedback API

Host: https://sentry.io/api/0

**Authors.**

@cmanallen

**How to read this document.**

This document is structured by resource with each resource having actions that
can be performed against it. Every action that either accepts a request or
returns a response _will_ document the full interchange format. Clients may opt
to restrict response data or provide a subset of the request data. The API may
or may not accept partial payloads.

## Document Sentiment Analysis [/organizations/<organization_id_or_slug>/sentiment-analysis/<key_id>/document/]

- Model

  - Body

    ```json
    {
      "data": {
        "id": 1200,
        "type": "sentiment-analysis-documents",
        "attributes": {
          "group": 22142,
          "language": "en",
          "magnitude": 9,
          "score": 1.0
        }
      }
    }
    ```

### Fetch Document Sentiment Analysis [GET]

Retrieve a document sentiment analysis.

- Response 200

  [DocumentSentimentAnalysis]

## Entity Sentiment Analysis [/organizations/<organization_id_or_slug>/sentiment-analysis/<key_id>/entities/]

- Parameters

  - cursor (optional, str)
  - per_page (optional, number) Default: 10
  - offset (optional, number) Default: 0

- Model

  - Body

    ```json
    {
      "data": [
        "id": 1200,
        "type": "sentiment-analysis-entities",
        "attributes": {
            "magnitude": 144,
            "name": "issues platform",
            "salience": 0.77,
            "score": 0.91,
            "type": "LOCATION"
        }
      ]
    }
    ```

### Fetch Entity Sentiment Analyses [GET]

Retrieve an entity sentiment analysis.

- Response 200

  [EntitySentimentAnalysis]

## Sentence Sentiment Analysis [/organizations/<organization_id_or_slug>/sentiment-analysis/<key_id>/sentences/]

Sentences have a sentiment score associated to them.

- Parameters

  - cursor (optional, str)
  - per_page (optional, number) Default: 10
  - offset (optional, number) Default: 0

- Model

  - Body

    ```json
    {
      "data": [
        "id": 1200,
        "type": "sentiment-analysis-sentences",
        "attributes": {
            "offset": 22,
            "length": 18,
            "magnitude": 144,
            "score": 0.91
        }
      ]
    }
    ```

### Fetch Sentence Sentiment Analyses [GET]

Retrieve an sentence sentiment analysis.

- Response 200

  [SentenceSentimentAnalysis]

# Data Model

(Possibly) Temporary plannding document for the sentiment analysis data model. For information on what the columns are or what their purpose is view the `api_blueprint.md` file.

## Tables

### Document Sentiment Tables

Sentiment analysis is a combination of document sentiment scoring and sentence scoring.

`sentiment_analysis`

| id  | status                                     | created_at | updated_at |
| --- | ------------------------------------------ | ---------- | ---------- |
| int | enum[pending,in-progress,completed,failed] | datetime   | datetime   |

`sentiment_analysis_document`

| id  | sentiment_analysis_id | langugage | score | magnitude | created_at |
| --- | --------------------- | --------- | ----- | --------- | ---------- |
| int | int                   | str       | float | float     | datetime   |

`sentiment_analysis_sentence`

| id  | sentiment_analysis_id | offset | length | score | magnitude | created_at |
| --- | --------------------- | ------ | ------ | ----- | --------- | ---------- |
| int | int                   | int    | int    | float | float     | datetime   |

### Entity Sentiment Tables

Entity sentiment analysis is a combination of keyword extraction and sentiment scoring.

`entity_sentiment_analysis`

| id  | status                                     | created_at | updated_at |
| --- | ------------------------------------------ | ---------- | ---------- |
| int | enum[pending,in-progress,completed,failed] | datetime   | datetime   |

`entity_sentiment_analysis_entity`

| id  | entity_sentiment_analysis_id | name | type | salience | score | magnitude | created_at |
| --- | ---------------------------- | ---- | ---- | -------- | ----- | --------- | ---------- |
| int | int                          | str  | str  | float    | float | float     | datetime   |

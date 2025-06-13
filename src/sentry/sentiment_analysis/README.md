# Sentiment Analysis Module

The sentiment-analysis module is responsible for analyzing the sentiment of a string of text.

## Data Model

Sentiment analysis models have no relationship to any product in Sentry beyond what a developer specifies in their data model. In other words, do not modify or extend the sentiment analysis models for your use case. Extend your models with a `sentiment_analysis_id` or similar. The sentiment analysis data model is generic and is meant to be used-by and embedded-into other products.

## Endpoints

The sentiment-analysis module offers two endpoints to allow clients to lazy load sentiment-analysis results. If the sentiment-analysis has not completed a 404 response is returned. It is expected that not every use case of sentiment-analysis will make use of these endpoints and will instead choose to embed the sentiment-analysis results directly into their API response. Its recommended that these embedded use cases use the same serialization format as the API endpoints.

## Service Drivers

Its expected that self-hosted installs may not have access to Google Cloud Platform. We should gracefully degrade to their configured service or, if a supported service can not be found, disable the feature.

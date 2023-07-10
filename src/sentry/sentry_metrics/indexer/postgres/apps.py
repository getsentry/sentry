from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.sentry_metrics.indexer.postgres"
    label = "indexer_postgres_config"

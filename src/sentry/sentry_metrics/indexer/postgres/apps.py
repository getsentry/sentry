from django.apps import AppConfig


class Config(AppConfig):  # type: ignore
    name = "sentry.sentry_metrics.indexer.postgres"
    label = "indexer.postgres.config"

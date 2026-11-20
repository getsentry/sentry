from django.apps import AppConfig, apps

from sentry.db.partitions.validation import validate_all_models


class PartitionsConfig(AppConfig):
    name = "sentry.db.partitions"
    label = "sentry_partitions"

    def ready(self) -> None:
        # Per-model rules already ran when each model class was prepared. Foreign keys
        # into partitioned tables can only be checked once every model is loaded.
        validate_all_models(apps.get_models(include_auto_created=True))

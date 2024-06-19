from datetime import timedelta
from typing import ClassVar, Self

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BaseManager,
    BoundedBigIntegerField,
    DefaultFieldsModel,
    FlexibleForeignKey,
    region_silo_model,
)


@region_silo_model
class ProjectUptimeSubscription(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    project_id = BoundedBigIntegerField(db_index=True)
    uptime_subscription = FlexibleForeignKey("sentry.UptimeSubscription")

    objects: ClassVar[BaseManager[Self]] = BaseManager(
        cache_fields=["pk"], cache_ttl=int(timedelta(hours=1).total_seconds())
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectuptimesubscription"

        constraints = [
            models.UniqueConstraint(
                fields=["project_id", "uptime_subscription"],
                name="sentry_projectuptimesubscription_unique_project_subscription",
            ),
        ]


@region_silo_model
class UptimeSubscription(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    remote_subscription_id = BoundedBigIntegerField(unique=True)
    # The url to check
    url = models.CharField(max_length=255)
    # How frequently to run the check in seconds
    interval_seconds = models.IntegerField()
    # How long to wait for a response from the url before we assume a timeout
    timeout_ms = models.IntegerField()

    objects: ClassVar[BaseManager[Self]] = BaseManager(
        cache_fields=["pk", "remote_subscription_id"],
        cache_ttl=int(timedelta(hours=1).total_seconds()),
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_uptimesubscription"

        constraints = [
            models.UniqueConstraint(
                fields=["url", "interval_seconds"],
                name="sentry_uptimesubscription_unique_url_check",
            ),
        ]

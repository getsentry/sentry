import enum
from datetime import timedelta
from typing import ClassVar, Self

from django.db import models
from django.db.models import Q

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model
from sentry.db.models.manager.base import BaseManager
from sentry.remote_subscriptions.models import BaseRemoteSubscription


@region_silo_model
class UptimeSubscription(BaseRemoteSubscription, DefaultFieldsModel):
    # TODO: This should be included in export/import, but right now it has no relation to
    # any projects/orgs. Will fix this in a later pr
    __relocation_scope__ = RelocationScope.Excluded

    # The url to check
    url = models.CharField(max_length=255)
    # How frequently to run the check in seconds
    interval_seconds = models.IntegerField()
    # How long to wait for a response from the url before we assume a timeout
    timeout_ms = models.IntegerField()

    objects: ClassVar[BaseManager[Self]] = BaseManager(
        cache_fields=["pk", "subscription_id"],
        cache_ttl=int(timedelta(hours=1).total_seconds()),
    )

    class Meta:
        app_label = "uptime"
        db_table = "uptime_uptimesubscription"

        constraints = [
            models.UniqueConstraint(
                fields=["url", "interval_seconds"],
                name="uptime_uptimesubscription_unique_url_check",
            ),
        ]


class ProjectUptimeSubscriptionMode(enum.Enum):
    # Manually created by a user
    MANUAL = 1
    # Auto-detected by our system and in the onboarding stage
    AUTO_DETECTED_ONBOARDING = 2
    # Auto-detected by our system and actively monitoring
    AUTO_DETECTED_ACTIVE = 3


@region_silo_model
class ProjectUptimeSubscription(DefaultFieldsModel):
    # TODO: This should be included in export/import, but right now it has no relation to
    # any projects/orgs. Will fix this in a later pr
    __relocation_scope__ = RelocationScope.Excluded
    project = FlexibleForeignKey("sentry.Project")
    uptime_subscription = FlexibleForeignKey("uptime.UptimeSubscription", on_delete=models.PROTECT)
    mode = models.SmallIntegerField(default=ProjectUptimeSubscriptionMode.MANUAL.value)

    objects: ClassVar[BaseManager[Self]] = BaseManager(
        cache_fields=["pk"], cache_ttl=int(timedelta(hours=1).total_seconds())
    )

    class Meta:
        app_label = "uptime"
        db_table = "uptime_projectuptimesubscription"

        indexes = [
            models.Index(fields=("project", "mode")),
        ]

        constraints = [
            # We might not actually need this constraint - there's no ddos potential of a user making a lot of uptime
            # monitors to the same uptime_subscription, since we'll de-dupe. We can always remove this constraint if
            # we want to allow this in the future.
            models.UniqueConstraint(
                fields=["project_id", "uptime_subscription"],
                name="uptime_projectuptimesubscription_unique_manual_project_subscription",
                condition=Q(mode=ProjectUptimeSubscriptionMode.MANUAL.value),
            ),
            models.UniqueConstraint(
                fields=["project_id", "uptime_subscription"],
                name="uptime_projectuptimesubscription_unique_auto_project_subscription",
                condition=Q(
                    mode__in=(
                        ProjectUptimeSubscriptionMode.AUTO_DETECTED_ONBOARDING.value,
                        ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE.value,
                    )
                ),
            ),
        ]

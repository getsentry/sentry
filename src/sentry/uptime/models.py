import enum
from datetime import timedelta
from typing import ClassVar, Literal, Self

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.db.models.expressions import Value
from django.db.models.functions import MD5, Coalesce

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    DefaultFieldsModelExisting,
    FlexibleForeignKey,
    JSONField,
    region_silo_model,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager.base import BaseManager
from sentry.models.organization import Organization
from sentry.remote_subscriptions.models import BaseRemoteSubscription
from sentry.types.actor import Actor
from sentry.utils.function_cache import cache_func_for_models
from sentry.utils.json import JSONEncoder

headers_json_encoder = JSONEncoder(
    separators=(",", ":"),
    # We sort the keys here so that we can deterministically compare headers
    sort_keys=True,
).encode

SupportedHTTPMethodsLiteral = Literal["GET", "POST", "HEAD", "PUT", "DELETE", "PATCH", "OPTIONS"]
IntervalSecondsLiteral = Literal[60, 300, 600, 1200, 1800, 3600]


@region_silo_model
class UptimeSubscription(BaseRemoteSubscription, DefaultFieldsModelExisting):
    # TODO: This should be included in export/import, but right now it has no relation to
    # any projects/orgs. Will fix this in a later pr
    __relocation_scope__ = RelocationScope.Excluded

    class SupportedHTTPMethods(models.TextChoices):
        GET = "GET", "GET"
        POST = "POST", "POST"
        HEAD = "HEAD", "HEAD"
        PUT = "PUT", "PUT"
        DELETE = "DELETE", "DELETE"
        PATCH = "PATCH", "PATCH"
        OPTIONS = "OPTIONS", "OPTIONS"

    class IntervalSeconds(models.IntegerChoices):
        ONE_MINUTE = 60, "1 minute"
        FIVE_MINUTES = 300, "5 minutes"
        TEN_MINUTES = 600, "10 minutes"
        TWENTY_MINUTES = 1200, "20 minutes"
        THIRTY_MINUTES = 1800, "30 minutes"
        ONE_HOUR = 3600, "1 hour"

    # The url to check
    url = models.CharField(max_length=255)
    # The domain of the url, extracted via TLDExtract
    url_domain = models.CharField(max_length=255, db_index=True, default="")
    # The suffix of the url, extracted via TLDExtract. This can be a public
    # suffix, such as com, gov.uk, com.au, or a private suffix, such as vercel.dev
    url_domain_suffix = models.CharField(max_length=255, db_index=True, default="")
    # A unique identifier for the provider hosting the domain
    host_provider_id = models.CharField(max_length=255, db_index=True, null=True)
    # The name of the provider hosting this domain
    host_provider_name = models.CharField(max_length=255, db_index=True, null=True)
    # How frequently to run the check in seconds
    interval_seconds: models.IntegerField[IntervalSecondsLiteral, IntervalSecondsLiteral] = (
        models.IntegerField(choices=IntervalSeconds)
    )
    # How long to wait for a response from the url before we assume a timeout
    timeout_ms = models.IntegerField()
    # HTTP method to perform the check with
    method: models.CharField[SupportedHTTPMethodsLiteral, SupportedHTTPMethodsLiteral] = (
        models.CharField(max_length=20, choices=SupportedHTTPMethods, db_default="GET")
    )
    # HTTP headers to send when performing the check
    headers = JSONField(json_dumps=headers_json_encoder, db_default=[])
    # HTTP body to send when performing the check
    body = models.TextField(null=True)
    # How to sample traces for this monitor. Note that we always send a trace_id, so any errors will
    # be associated, this just controls the span sampling.
    trace_sampling = models.BooleanField(default=False)

    objects: ClassVar[BaseManager[Self]] = BaseManager(
        cache_fields=["pk", "subscription_id"],
        cache_ttl=int(timedelta(hours=1).total_seconds()),
    )

    class Meta:
        app_label = "uptime"
        db_table = "uptime_uptimesubscription"

        constraints = [
            models.UniqueConstraint(
                "url",
                "interval_seconds",
                "timeout_ms",
                "method",
                MD5("headers"),
                Coalesce(MD5("body"), Value("")),
                name="uptime_uptimesubscription_unique_subscription_check",
            ),
        ]


class ProjectUptimeSubscriptionMode(enum.IntEnum):
    # Manually created by a user
    MANUAL = 1
    # Auto-detected by our system and in the onboarding stage
    AUTO_DETECTED_ONBOARDING = 2
    # Auto-detected by our system and actively monitoring
    AUTO_DETECTED_ACTIVE = 3


class UptimeStatus(enum.IntEnum):
    OK = 1
    FAILED = 2


@region_silo_model
class ProjectUptimeSubscription(DefaultFieldsModelExisting):
    # TODO: This should be included in export/import, but right now it has no relation to
    # any projects/orgs. Will fix this in a later pr

    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey("sentry.Project")
    environment = FlexibleForeignKey(
        "sentry.Environment", db_index=True, db_constraint=False, null=True
    )
    uptime_subscription = FlexibleForeignKey("uptime.UptimeSubscription", on_delete=models.PROTECT)
    mode = models.SmallIntegerField(default=ProjectUptimeSubscriptionMode.MANUAL.value)
    uptime_status = models.PositiveSmallIntegerField(default=UptimeStatus.OK.value)
    # (Likely) temporary column to keep track of the current uptime status of this monitor
    name = models.TextField()
    owner_user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")
    owner_team = FlexibleForeignKey("sentry.Team", null=True, on_delete=models.SET_NULL)

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

    @property
    def owner(self) -> Actor | None:
        return Actor.from_id(user_id=self.owner_user_id, team_id=self.owner_team_id)

    def get_audit_log_data(self):
        return {
            "project": self.project.id,
            "name": self.name,
            "owner_user_id": self.owner_user_id,
            "owner_team_id": self.owner_team_id,
            "url": self.uptime_subscription.url,
            "interval_seconds": self.uptime_subscription.interval_seconds,
            "timeout": self.uptime_subscription.timeout_ms,
            "method": self.uptime_subscription.method,
            "headers": self.uptime_subscription.headers,
            "body": self.uptime_subscription.body,
        }


def get_org_from_uptime_monitor(uptime_monitor: ProjectUptimeSubscription) -> tuple[Organization]:
    return (uptime_monitor.project.organization,)


@cache_func_for_models([(ProjectUptimeSubscription, get_org_from_uptime_monitor)])
def get_active_auto_monitor_count_for_org(organization: Organization) -> int:
    return ProjectUptimeSubscription.objects.filter(
        project__organization=organization,
        mode__in=[
            ProjectUptimeSubscriptionMode.AUTO_DETECTED_ONBOARDING,
            ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        ],
    ).count()

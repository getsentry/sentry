import enum
import logging
from datetime import timedelta
from typing import ClassVar, Literal, Self, cast, override

from django.db import models
from django.db.models import Count

from sentry.backup.scopes import RelocationScope
from sentry.constants import ObjectStatus
from sentry.db.models import (
    DefaultFieldsModel,
    DefaultFieldsModelExisting,
    FlexibleForeignKey,
    region_silo_model,
)
from sentry.db.models.manager.base import BaseManager
from sentry.deletions.base import ModelRelation
from sentry.models.organization import Organization
from sentry.remote_subscriptions.models import BaseRemoteSubscription
from sentry.uptime.types import (
    DATA_SOURCE_UPTIME_SUBSCRIPTION,
    GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE,
    UptimeMonitorMode,
)
from sentry.utils.function_cache import cache_func, cache_func_for_models
from sentry.workflow_engine.models import DataSource, Detector
from sentry.workflow_engine.registry import data_source_type_registry
from sentry.workflow_engine.types import DataSourceTypeHandler

logger = logging.getLogger(__name__)

SupportedHTTPMethodsLiteral = Literal["GET", "POST", "HEAD", "PUT", "DELETE", "PATCH", "OPTIONS"]
IntervalSecondsLiteral = Literal[60, 300, 600, 1200, 1800, 3600]


class UptimeStatus(enum.IntEnum):
    OK = 1
    FAILED = 2


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
    url_domain = models.CharField(max_length=255, default="", db_default="")
    # The suffix of the url, extracted via TLDExtract. This can be a public
    # suffix, such as com, gov.uk, com.au, or a private suffix, such as vercel.dev
    url_domain_suffix = models.CharField(max_length=255, default="", db_default="")
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
    # TODO(mdtro): This field can potentially contain sensitive data, encrypt when field available
    # HTTP headers to send when performing the check
    headers = models.JSONField(db_default=[])
    # HTTP body to send when performing the check
    # TODO(mdtro): This field can potentially contain sensitive data, encrypt when field available
    body = models.TextField(null=True)
    # How to sample traces for this monitor. Note that we always send a trace_id, so any errors will
    # be associated, this just controls the span sampling.
    trace_sampling = models.BooleanField(default=False, db_default=False)

    objects: ClassVar[BaseManager[Self]] = BaseManager(
        cache_fields=["pk", "subscription_id"],
        cache_ttl=int(timedelta(hours=1).total_seconds()),
    )

    class Meta:
        app_label = "uptime"
        db_table = "uptime_uptimesubscription"

        indexes = [
            models.Index(fields=("url_domain_suffix", "url_domain")),
        ]


@region_silo_model
class UptimeSubscriptionRegion(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    class RegionMode(enum.StrEnum):
        # Region is running as usual
        ACTIVE = "active"
        # Region is disabled and not running
        INACTIVE = "inactive"
        # Region is running in shadow mode. This means it is performing checks, but results are
        # ignored.
        SHADOW = "shadow"

    uptime_subscription = FlexibleForeignKey("uptime.UptimeSubscription", related_name="regions")
    region_slug = models.CharField(max_length=255, db_index=True, db_default="")
    mode = models.CharField(max_length=32, db_default=RegionMode.ACTIVE)

    class Meta:
        app_label = "uptime"
        db_table = "uptime_uptimesubscriptionregion"

        constraints = [
            models.UniqueConstraint(
                "uptime_subscription",
                "region_slug",
                name="uptime_uptimesubscription_region_slug_unique",
            ),
        ]


def get_org_from_detector(detector: Detector) -> tuple[Organization]:
    return (detector.project.organization,)


@cache_func_for_models([(Detector, get_org_from_detector)])
def get_active_auto_monitor_count_for_org(organization: Organization) -> int:
    return Detector.objects.filter(
        status=ObjectStatus.ACTIVE,
        type=GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE,
        project__organization=organization,
        config__mode__in=[
            UptimeMonitorMode.AUTO_DETECTED_ONBOARDING,
            UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
        ],
    ).count()


@cache_func(cache_ttl=timedelta(hours=1))
def get_top_hosting_provider_names(limit: int) -> set[str]:
    return set(
        cast(
            list[str],
            UptimeSubscription.objects.filter(status=UptimeSubscription.Status.ACTIVE.value)
            .values("host_provider_name")
            .annotate(total=Count("id"))
            .order_by("-total")
            .values_list("host_provider_name", flat=True)[:limit],
        )
    )


@cache_func_for_models(
    [(UptimeSubscriptionRegion, lambda region: (region.uptime_subscription_id,))],
    recalculate=False,
)
def load_regions_for_uptime_subscription(
    uptime_subscription_id: int,
) -> list[UptimeSubscriptionRegion]:
    return list(
        UptimeSubscriptionRegion.objects.filter(uptime_subscription_id=uptime_subscription_id)
    )


class UptimeRegionScheduleMode(enum.StrEnum):
    ROUND_ROBIN = "round_robin"


@data_source_type_registry.register(DATA_SOURCE_UPTIME_SUBSCRIPTION)
class UptimeSubscriptionDataSourceHandler(DataSourceTypeHandler[UptimeSubscription]):
    @override
    @staticmethod
    def bulk_get_query_object(
        data_sources: list[DataSource],
    ) -> dict[int, UptimeSubscription | None]:
        uptime_subscription_ids: list[int] = []

        for ds in data_sources:
            try:
                uptime_subscription_id = int(ds.source_id)
                uptime_subscription_ids.append(uptime_subscription_id)
            except ValueError:
                logger.exception(
                    "Invalid DataSource.source_id fetching UptimeSubscription",
                    extra={"id": ds.id, "source_id": ds.source_id},
                )

        qs_lookup = {
            str(uptime_subscription.id): uptime_subscription
            for uptime_subscription in UptimeSubscription.objects.filter(
                id__in=uptime_subscription_ids
            )
        }
        return {ds.id: qs_lookup.get(ds.source_id) for ds in data_sources}

    @override
    @staticmethod
    def related_model(instance) -> list[ModelRelation]:
        return [ModelRelation(UptimeSubscription, {"id": instance.source_id})]

    @override
    @staticmethod
    def get_instance_limit(org: Organization) -> int | None:
        return None

    @override
    @staticmethod
    def get_current_instance_count(org: Organization) -> int:
        # We don't have a limit at the moment, so no need to count.
        raise NotImplementedError

    @override
    @staticmethod
    def get_relocation_model_name() -> str:
        return "uptime.uptimesubscription"


def get_detector(uptime_subscription: UptimeSubscription, prefetch_workflow_data=False) -> Detector:
    """
    Fetches a workflow_engine Detector given an existing uptime_subscription.
    This is used during the transition period moving uptime to detector.
    """
    data_source = DataSource.objects.filter(
        type=DATA_SOURCE_UPTIME_SUBSCRIPTION,
        source_id=str(uptime_subscription.id),
    )
    qs = Detector.objects_for_deletion.filter(
        type=GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE, data_sources=data_source[:1]
    )
    select_related = ["project", "project__organization"]
    if prefetch_workflow_data:
        select_related.append("workflow_condition_group")
        qs = qs.prefetch_related("workflow_condition_group__conditions")
    qs = qs.select_related(*select_related)
    return qs.get()


def get_uptime_subscription(detector: Detector) -> UptimeSubscription:
    """
    Given a detector get the matching uptime subscription
    """
    data_source = detector.data_sources.first()
    assert data_source
    return UptimeSubscription.objects.get_from_cache(id=int(data_source.source_id))


def get_audit_log_data(detector: Detector):
    """Get audit log data from a detector."""
    uptime_subscription = get_uptime_subscription(detector)

    owner_user_id = None
    owner_team_id = None
    if detector.owner:
        if detector.owner.is_user:
            owner_user_id = detector.owner.id
        elif detector.owner.is_team:
            owner_team_id = detector.owner.id

    return {
        "project": detector.project_id,
        "name": detector.name,
        "owner_user_id": owner_user_id,
        "owner_team_id": owner_team_id,
        "url": uptime_subscription.url,
        "interval_seconds": uptime_subscription.interval_seconds,
        "timeout": uptime_subscription.timeout_ms,
        "method": uptime_subscription.method,
        "headers": uptime_subscription.headers,
        "body": uptime_subscription.body,
    }

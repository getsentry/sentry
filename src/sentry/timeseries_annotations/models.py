from __future__ import annotations

from datetime import timedelta
from enum import IntEnum
from typing import TYPE_CHECKING, ClassVar

from django.db import models
from django.db.models.functions import Coalesce
from django.utils import timezone

from sentry import quotas
from sentry.backup.scopes import RelocationScope
from sentry.db.models.base import DefaultFieldsModel, cell_silo_model
from sentry.db.models.fields.bounded import BoundedPositiveIntegerField
from sentry.db.models.fields.foreignkey import FlexibleForeignKey
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager.base import BaseManager
from sentry.db.models.manager.base_query_set import BaseQuerySet

if TYPE_CHECKING:
    from sentry.models.organization import Organization


class IntervalType(IntEnum):
    POINT = 0
    RANGE = 1

    @classmethod
    def as_choices(cls) -> tuple[tuple[int, str], ...]:
        return (
            (cls.POINT, "point"),
            (cls.RANGE, "range"),
        )


class AnnotationScope(IntEnum):
    GLOBAL = 0
    SPANS = 1
    LOGS = 2
    TRACEMETRICS = 3
    ERRORS = 4
    OCCURRENCES = 5

    @classmethod
    def as_choices(cls) -> tuple[tuple[int, str], ...]:
        return (
            (cls.GLOBAL, "global"),
            (cls.SPANS, "spans"),
            (cls.LOGS, "logs"),
            (cls.TRACEMETRICS, "tracemetrics"),
            (cls.ERRORS, "errors"),
            (cls.OCCURRENCES, "occurrences"),
        )


class Severity(IntEnum):
    LOW = 25
    MEDIUM = 50
    HIGH = 75

    @classmethod
    def as_choices(cls) -> tuple[tuple[int, str], ...]:
        return (
            (cls.LOW, "low"),
            (cls.MEDIUM, "medium"),
            (cls.HIGH, "high"),
        )


class AnnotationType(IntEnum):
    INBOUND_FILTER_CHANGE = 0
    INFRASTRUCTURE_CHANGE = 1
    SDK_UPDATE = 2
    SENTRY_OUTAGE = 3
    CUSTOM = 4
    SDK_CONFIG_CHANGE_EXPERIMENTAL = 5

    @classmethod
    def as_choices(cls) -> tuple[tuple[int, str], ...]:
        return (
            (cls.INBOUND_FILTER_CHANGE, "inbound_filter_change"),
            (cls.INFRASTRUCTURE_CHANGE, "infrastructure_change"),
            (cls.SDK_UPDATE, "sdk_update"),
            (cls.SENTRY_OUTAGE, "sentry_outage"),
            (cls.CUSTOM, "custom"),
            (cls.SDK_CONFIG_CHANGE_EXPERIMENTAL, "sdk_config_change_experimental"),
        )


class TimeseriesAnnotationManager(BaseManager["TimeseriesAnnotation"]):
    def within_retention(self, organization: Organization) -> BaseQuerySet[TimeseriesAnnotation]:
        """
        Read annotations within the retention window of Organization
        """
        retention_days = quotas.backend.get_event_retention(organization=organization)
        if not retention_days:
            return self.get_queryset()
        cutoff = timezone.now() - timedelta(days=retention_days)
        return self.annotate(_effective_end=Coalesce("end_timestamp", "start_timestamp")).filter(
            _effective_end__gte=cutoff
        )


@cell_silo_model
class TimeseriesAnnotation(DefaultFieldsModel):
    """
    An external event that could explain a change in telemetry data
    """

    __relocation_scope__ = RelocationScope.Organization

    objects: ClassVar[TimeseriesAnnotationManager] = TimeseriesAnnotationManager()

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    project = FlexibleForeignKey("sentry.Project", null=True, on_delete=models.CASCADE)
    environment = FlexibleForeignKey("sentry.Environment", null=True, on_delete=models.CASCADE)

    start_timestamp = models.DateTimeField()
    end_timestamp = models.DateTimeField(null=True)

    interval_type = BoundedPositiveIntegerField(
        default=IntervalType.POINT, choices=IntervalType.as_choices()
    )
    annotation_type = BoundedPositiveIntegerField(choices=AnnotationType.as_choices())
    scope = BoundedPositiveIntegerField(
        default=AnnotationScope.GLOBAL, choices=AnnotationScope.as_choices()
    )
    severity = BoundedPositiveIntegerField(
        default=Severity.LOW, db_default=Severity.LOW, choices=Severity.as_choices()
    )

    description = models.TextField()
    tags = models.JSONField(null=True)

    created_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    created_by_service_account_id = HybridCloudForeignKey(
        "service_accounts.ServiceAccount", null=True, on_delete="SET_NULL"
    )
    created_by_label = models.CharField(max_length=64, null=True)
    updated_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    updated_by_service_account_id = HybridCloudForeignKey(
        "service_accounts.ServiceAccount", null=True, on_delete="SET_NULL"
    )
    updated_by_label = models.CharField(max_length=64, null=True)

    class Meta:
        app_label = "timeseries_annotations"
        db_table = "timeseries_annotations_timeseriesannotation"
        indexes = [
            models.Index(fields=["organization", "start_timestamp"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(
                        created_by_service_account_id__isnull=True,
                        created_by_label__isnull=True,
                    )
                    | models.Q(
                        created_by_id__isnull=True,
                        created_by_label__isnull=True,
                    )
                    | models.Q(
                        created_by_id__isnull=True,
                        created_by_service_account_id__isnull=True,
                    )
                ),
                name="timeseries_annotation_at_most_one_creator",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        updated_by_service_account_id__isnull=True,
                        updated_by_label__isnull=True,
                    )
                    | models.Q(
                        updated_by_id__isnull=True,
                        updated_by_label__isnull=True,
                    )
                    | models.Q(
                        updated_by_id__isnull=True,
                        updated_by_service_account_id__isnull=True,
                    )
                ),
                name="timeseries_annotation_at_most_one_updater",
            ),
        ]

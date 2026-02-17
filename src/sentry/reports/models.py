from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, region_silo_model
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.bounded import BoundedBigIntegerField, BoundedPositiveIntegerField
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.explore.models import ExploreSavedQueryDataset
from sentry.models.dashboard_widget import TypesClass

VALID_TIME_RANGES = ("1h", "1d", "24h", "7d", "14d", "30d", "90d")

VALID_EXPLORE_DATASETS = (ExploreSavedQueryDataset.SPANS, ExploreSavedQueryDataset.OURLOGS)


class ScheduledReportFrequency(TypesClass):
    DAILY = 0
    WEEKLY = 1
    MONTHLY = 2
    TYPES = [
        (DAILY, "daily"),
        (WEEKLY, "weekly"),
        (MONTHLY, "monthly"),
    ]


class ScheduledReportSourceType(TypesClass):
    EXPLORE_SAVED_QUERY = 0
    DASHBOARD = 1
    TYPES = [
        (EXPLORE_SAVED_QUERY, "explore_saved_query"),
        (DASHBOARD, "dashboard"),
    ]


@region_silo_model
class ScheduledReport(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    organization = FlexibleForeignKey("sentry.Organization", db_index=True)
    created_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    name = models.CharField(max_length=255)

    # Polymorphic source reference: points to ExploreSavedQuery.id or Dashboard.id
    source_type = BoundedPositiveIntegerField(
        choices=ScheduledReportSourceType.as_choices(),
    )
    source_id = BoundedBigIntegerField(db_index=True)

    # Schedule configuration
    frequency = BoundedPositiveIntegerField(
        choices=ScheduledReportFrequency.as_choices(),
    )
    day_of_week = BoundedPositiveIntegerField(null=True, blank=True)  # 0=Monday, for weekly
    day_of_month = BoundedPositiveIntegerField(null=True, blank=True)  # 1-31, for monthly
    hour = BoundedPositiveIntegerField()  # 0-23, stored in UTC

    # Time range override (optional); constrained to VALID_TIME_RANGES
    time_range = models.CharField(
        max_length=32, null=True, blank=True, choices=[(v, v) for v in VALID_TIME_RANGES]
    )

    # Delivery configuration: list of org member email strings
    recipient_emails = models.JSONField(default=list)

    # Scheduling state
    is_active = models.BooleanField(default=True)
    next_run_at = models.DateTimeField(db_index=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_scheduledreport"
        indexes = [
            models.Index(fields=["organization", "source_type", "source_id"]),
            models.Index(fields=["is_active", "next_run_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(time_range__in=VALID_TIME_RANGES) | models.Q(time_range=None),
                name="sentry_scheduledreport_valid_time_range",
            ),
        ]

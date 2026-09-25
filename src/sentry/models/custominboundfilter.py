from __future__ import annotations

from enum import StrEnum

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, cell_silo_model, sane_repr


class ConditionType(StrEnum):
    ERROR_TYPE = "error_type"
    ERROR_MESSAGE = "error_message"
    LOG_MESSAGE = "log_message"
    METRIC_NAME = "metric_name"
    RELEASE = "release"
    IP_ADDRESS = "ip_address"


class DataType(StrEnum):
    ALL = "all"
    ERROR = "error"
    LOG = "log"
    METRIC = "metric"
    SPAN = "span"


class LegacyFilter(StrEnum):
    """
    The legacy inbound filter a row stands in for. The values are the ids Relay reports
    filter outcomes under, so a row that replaces a legacy filter keeps its stats.
    """

    RELEASE_VERSION = "release-version"
    ERROR_MESSAGE = "error-message"
    LOG_MESSAGE = "log-message"
    TRACE_METRIC_NAME = "trace-metric-name"


@cell_silo_model
class CustomInboundFilter(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    project = FlexibleForeignKey(
        "sentry.Project", on_delete=models.CASCADE, related_name="custom_inbound_filters"
    )
    name = models.CharField(max_length=256, null=True, blank=True)
    active = models.BooleanField(default=True, db_default=True)
    # Nullable only because the column was added to an existing table. A reader
    # refuses a filter without one rather than guessing.
    data_type = models.CharField(
        max_length=32,
        choices=[(data_type, data_type) for data_type in DataType],
        null=True,
    )
    conditions = models.JSONField(default=list)
    # Set on the one row per project that holds a legacy newline list. Null on every
    # filter a user created in the custom filter UI or API.
    legacy_filter = models.CharField(
        max_length=32,
        choices=[(legacy_filter, legacy_filter) for legacy_filter in LegacyFilter],
        null=True,
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_custominboundfilter"
        constraints = [
            models.UniqueConstraint(
                fields=["project", "legacy_filter"],
                name="sentry_custominboundfilter_legacy_filter_per_project",
            )
        ]

    __repr__ = sane_repr("project_id", "name")

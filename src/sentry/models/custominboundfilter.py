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
    GEO_COUNTRY_CODE = "geo_country_code"


class ConditionOperator(StrEnum):
    """
    How a condition compares the field to its values. ``glob`` matches the field against
    each value as a glob pattern. The other text operators read every character of a
    value literally and match a field that equals, starts with, contains or ends with
    any value, or one that does none of that, case-insensitively. The ordered operators
    compare one value as a release version.

    A stored condition without an operator holds raw glob patterns, as with ``glob``: a
    row written before operators existed, or the row of a legacy list.
    """

    GLOB = "glob"
    EQUALS = "equals"
    STARTS_WITH = "starts_with"
    CONTAINS = "contains"
    ENDS_WITH = "ends_with"
    DOES_NOT_START_WITH = "does_not_start_with"
    DOES_NOT_CONTAIN = "does_not_contain"
    DOES_NOT_END_WITH = "does_not_end_with"
    GT = "gt"
    GTE = "gte"
    LT = "lt"
    LTE = "lte"


TEXT_OPERATORS = frozenset(
    {
        ConditionOperator.GLOB,
        ConditionOperator.EQUALS,
        ConditionOperator.STARTS_WITH,
        ConditionOperator.CONTAINS,
        ConditionOperator.ENDS_WITH,
        ConditionOperator.DOES_NOT_START_WITH,
        ConditionOperator.DOES_NOT_CONTAIN,
        ConditionOperator.DOES_NOT_END_WITH,
    }
)

COMPARISON_OPERATORS = frozenset(
    {ConditionOperator.GT, ConditionOperator.GTE, ConditionOperator.LT, ConditionOperator.LTE}
)


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


# Bounds how many generic filters one project sends Relay. The API refuses to create a
# filter past the cap, and the Relay config builder stops at it too so that rows made
# some other way, e.g. before the cap or by a backfill, cannot blow up a project config.
MAX_FILTERS_PER_PROJECT = 50


@cell_silo_model
class CustomInboundFilter(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    project = FlexibleForeignKey(
        "sentry.Project", on_delete=models.CASCADE, related_name="custom_inbound_filters"
    )
    name = models.CharField(max_length=256, null=True, blank=True)
    active = models.BooleanField(default=True, db_default=True)
    data_type = models.CharField(
        max_length=32,
        choices=[(data_type, data_type) for data_type in DataType],
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

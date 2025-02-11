from __future__ import annotations

from enum import Enum
from typing import Any

from django.contrib.postgres.fields import ArrayField as DjangoArrayField
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    ArrayField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_model,
    sane_repr,
)
from sentry.db.models.fields import JSONField

ON_DEMAND_ENABLED_KEY = "enabled"


class TypesClass:
    TYPES: list[tuple[int, str]]

    @classmethod
    def as_choices(cls):
        return [(k, str(v)) for k, v in cls.TYPES]

    @classmethod
    def as_text_choices(cls):
        return [(str(v), str(v)) for _, v in cls.TYPES]

    @classmethod
    def get_type_name(cls, num):
        for id, name in cls.TYPES:
            if id == num:
                return name

    @classmethod
    def get_id_for_type_name(cls, type_name):
        for id, name in cls.TYPES:
            if type_name == name:
                return id


class DashboardWidgetTypes(TypesClass):
    DISCOVER = 0
    """
    Old way of accessing error events and transaction events simultaneously @deprecated. Use ERROR_EVENTS or TRANSACTION_LIKE instead.
    """
    ISSUE = 1
    RELEASE_HEALTH = 2
    METRICS = 3
    ERROR_EVENTS = 100
    """
     Error side of the split from Discover.
    """
    TRANSACTION_LIKE = 101
    """
    This targets transaction-like data from the split from discover. Itt may either use 'Transactions' events or 'PerformanceMetrics' depending on on-demand, MEP metrics, etc.
    """
    SPANS = 102

    TYPES = [
        (DISCOVER, "discover"),
        (ISSUE, "issue"),
        (
            RELEASE_HEALTH,
            "metrics",
        ),
        (ERROR_EVENTS, "error-events"),
        (TRANSACTION_LIKE, "transaction-like"),
        (SPANS, "spans"),
    ]
    TYPE_NAMES = [t[1] for t in TYPES]


class DatasetSourcesTypes(Enum):
    """
    Ambiguous queries that haven't been or couldn't be categorized into a
    specific dataset.
    """

    UNKNOWN = 0
    """
     Dataset inferred by either running the query or using heuristics.
    """
    INFERRED = 1
    """
     Canonical dataset, user explicitly selected it.
    """
    USER = 2
    """
     Was an ambiguous dataset forced to split (i.e. we picked a default)
    """
    FORCED = 3
    """
     Dataset inferred by split script, version 1
    """
    SPLIT_VERSION_1 = 4
    """
     Dataset inferred by split script, version 2
    """
    SPLIT_VERSION_2 = 5

    @classmethod
    def as_choices(cls):
        return tuple((source.value, source.name.lower()) for source in cls)

    @classmethod
    def as_text_choices(cls):
        return tuple((source.name.lower(), source.value) for source in cls)


# TODO: Can eventually be replaced solely with TRANSACTION_MULTI once no more dashboards use Discover.
TransactionWidgetType = [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
# TODO: Can be replaced once conditions are replaced at all callsite to split transaction and error behaviour, and once dashboard no longer have saved Discover dataset.
DiscoverFullFallbackWidgetType = [
    DashboardWidgetTypes.DISCOVER,
    DashboardWidgetTypes.ERROR_EVENTS,
    DashboardWidgetTypes.TRANSACTION_LIKE,
]


class DashboardWidgetDisplayTypes(TypesClass):
    LINE_CHART = 0
    AREA_CHART = 1
    STACKED_AREA_CHART = 2
    BAR_CHART = 3
    TABLE = 4
    BIG_NUMBER = 6
    TOP_N = 7
    TYPES = [
        (LINE_CHART, "line"),
        (AREA_CHART, "area"),
        (STACKED_AREA_CHART, "stacked_area"),
        (BAR_CHART, "bar"),
        (TABLE, "table"),
        (BIG_NUMBER, "big_number"),
        (TOP_N, "top_n"),
    ]
    TYPE_NAMES = [t[1] for t in TYPES]


@region_silo_model
class DashboardWidgetQuery(Model):
    """
    A query in a dashboard widget.
    """

    __relocation_scope__ = RelocationScope.Organization

    widget = FlexibleForeignKey("sentry.DashboardWidget")
    name = models.CharField(max_length=255)
    fields = ArrayField()
    conditions = models.TextField()
    # aggregates and columns will eventually replace fields.
    # Using django's built-in array field here since the one
    # from sentry/db/model/fields.py adds a default value to the
    # database migration.
    aggregates = DjangoArrayField(models.TextField(), null=True)
    columns = DjangoArrayField(models.TextField(), null=True)
    # Currently only used for tabular widgets.
    # If an alias is defined it will be shown in place of the field description in the table header
    field_aliases = DjangoArrayField(models.TextField(), null=True)
    # Orderby condition for the query
    orderby = models.TextField(default="")
    # Order of the widget query in the widget.
    order = BoundedPositiveIntegerField()
    date_added = models.DateTimeField(default=timezone.now)
    date_modified = models.DateTimeField(default=timezone.now)
    # Whether this query is hidden from the UI, used by metric widgets
    is_hidden = models.BooleanField(default=False)
    # Used by Big Number to select aggregate displayed
    selected_aggregate = models.IntegerField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardwidgetquery"
        unique_together = (("widget", "order"),)

    __repr__ = sane_repr("widget", "type", "name")


@region_silo_model
class DashboardWidgetQueryOnDemand(Model):
    """
    Tracks on_demand state and values for dashboard widget queries.
    Only a subset of dashboard widget queries have conditions or columns that would
    require on-demand extraction, and others are simply not applicable (eg. different dataset).
    """

    __relocation_scope__ = RelocationScope.Organization

    dashboard_widget_query = FlexibleForeignKey("sentry.DashboardWidgetQuery")

    spec_hashes = ArrayField()

    class OnDemandExtractionState(models.TextChoices):
        DISABLED_NOT_APPLICABLE = "disabled:not-applicable", gettext_lazy("disabled:not-applicable")
        """ This widget does not have on-demand metrics needing extraction. """
        DISABLED_PREROLLOUT = "disabled:pre-rollout", gettext_lazy("disabled:pre-rollout")
        """ This represents a pre-filled on-demand value to do load estimates before enabling extraction. """
        DISABLED_MANUAL = "disabled:manual", gettext_lazy("disabled:manual")
        """ The widget was manually disabled by a user """
        DISABLED_SPEC_LIMIT = "disabled:spec-limit", gettext_lazy("disabled:spec-limit")
        """ This widget query was disabled during rollout due to the organization reaching it's spec limit. """
        DISABLED_HIGH_CARDINALITY = "disabled:high-cardinality", gettext_lazy(
            "disabled:high-cardinality"
        )
        """ This widget query was disabled by the cardinality cron due to one of the columns having high cardinality """
        ENABLED_ENROLLED = "enabled:enrolled", gettext_lazy("enabled:enrolled")
        """ This widget query was enabled automatically during rollout for automatic support for users migrating from AM1. """
        ENABLED_CREATION = "enabled:creation", gettext_lazy("enabled:creation")
        """ This widget query was opted into on-demand during creation. """
        ENABLED_MANUAL = "enabled:manual", gettext_lazy("enabled:manual")
        """ This widget query was enabled manually post creation or otherwise. """

    spec_version = models.IntegerField(null=True)
    extraction_state = models.CharField(max_length=30, choices=OnDemandExtractionState.choices)
    date_modified = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)

    def can_extraction_be_auto_overridden(self):
        """Determines whether tasks can override extraction state"""
        if self.extraction_state == self.OnDemandExtractionState.DISABLED_MANUAL:
            # Manually disabling a widget will cause it to stay off until manually re-enabled.
            return False

        if self.extraction_state == self.OnDemandExtractionState.DISABLED_HIGH_CARDINALITY:
            # High cardinality should remain off until manually re-enabled.
            return False

        if self.extraction_state == self.OnDemandExtractionState.DISABLED_SPEC_LIMIT:
            # Spec limits also can only be re-enabled manually.
            return False

        return True

    def extraction_enabled(self):
        """Whether on-demand is enabled or disabled for this widget.
        If this is enabled, Relay should be extracting metrics from events matching the associated widget_query upon ingest.
        """
        return self.extraction_state.startswith(ON_DEMAND_ENABLED_KEY)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardwidgetqueryondemand"

    __repr__ = sane_repr("extraction_state", "spec_hashes")


@region_silo_model
class DashboardWidget(Model):
    """
    A dashboard widget.
    """

    __relocation_scope__ = RelocationScope.Organization

    dashboard = FlexibleForeignKey("sentry.Dashboard")
    order = BoundedPositiveIntegerField()
    title = models.CharField(max_length=255)
    description = models.CharField(max_length=255, null=True)
    thresholds = JSONField(null=True)
    interval = models.CharField(max_length=10, null=True)
    display_type = BoundedPositiveIntegerField(choices=DashboardWidgetDisplayTypes.as_choices())
    date_added = models.DateTimeField(default=timezone.now)
    widget_type = BoundedPositiveIntegerField(choices=DashboardWidgetTypes.as_choices(), null=True)
    limit = models.IntegerField(null=True)
    detail: models.Field[dict[str, Any], dict[str, Any]] = JSONField(null=True)
    discover_widget_split = BoundedPositiveIntegerField(
        choices=DashboardWidgetTypes.as_choices(), null=True
    )

    # The method of which the discover split datasets was decided
    dataset_source = BoundedPositiveIntegerField(
        choices=DatasetSourcesTypes.as_choices(), default=DatasetSourcesTypes.UNKNOWN.value
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardwidget"
        unique_together = (("dashboard", "order"),)

    __repr__ = sane_repr("dashboard", "title")

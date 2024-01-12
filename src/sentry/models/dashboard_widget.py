from __future__ import annotations

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
    region_silo_only_model,
    sane_repr,
)
from sentry.db.models.fields import JSONField

_ON_DEMAND_ENABLED_KEY = "enabled"


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
    ISSUE = 1
    RELEASE_HEALTH = 2
    METRICS = 3
    TYPES = [
        (DISCOVER, "discover"),
        (ISSUE, "issue"),
        (
            RELEASE_HEALTH,
            "metrics",
        ),  # TODO(ddm): rename RELEASE to 'release', and METRICS to 'metrics'
        (METRICS, "custom-metrics"),
    ]
    TYPE_NAMES = [t[1] for t in TYPES]


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


@region_silo_only_model
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

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardwidgetquery"
        unique_together = (("widget", "order"),)

    __repr__ = sane_repr("widget", "type", "name")


@region_silo_only_model
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

    extraction_state = models.CharField(max_length=30, choices=OnDemandExtractionState.choices)
    date_modified = models.DateTimeField(default=timezone.now)

    def extraction_enabled(self):
        """Whether on-demand is enabled or disabled for this widget.
        If this is enabled, Relay should be extracting metrics from events matching the associated widget_query upon ingest.
        """
        return self.extraction_state.startswith(_ON_DEMAND_ENABLED_KEY)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardwidgetqueryondemand"

    __repr__ = sane_repr("extraction_state", "extraction_enabled")


@region_silo_only_model
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

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardwidget"
        unique_together = (("dashboard", "order"),)

    __repr__ = sane_repr("dashboard", "title")

from django.contrib.postgres.fields import ArrayField as DjangoArrayField
from django.db import models
from django.utils import timezone

from sentry.db.models import (
    ArrayField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    sane_repr,
)
from sentry.db.models.fields import JSONField


class TypesClass:
    TYPES = []

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
    METRICS = 2
    TYPES = [
        (DISCOVER, "discover"),
        (ISSUE, "issue"),
        (METRICS, "metrics"),
    ]
    TYPE_NAMES = [t[1] for t in TYPES]


class DashboardWidgetDisplayTypes(TypesClass):
    LINE_CHART = 0
    AREA_CHART = 1
    STACKED_AREA_CHART = 2
    BAR_CHART = 3
    TABLE = 4
    WORLD_MAP = 5
    BIG_NUMBER = 6
    TOP_N = 7
    TYPES = [
        (LINE_CHART, "line"),
        (AREA_CHART, "area"),
        (STACKED_AREA_CHART, "stacked_area"),
        (BAR_CHART, "bar"),
        (TABLE, "table"),
        (WORLD_MAP, "world_map"),
        (BIG_NUMBER, "big_number"),
        (TOP_N, "top_n"),
    ]
    TYPE_NAMES = [t[1] for t in TYPES]


class DashboardWidgetQuery(Model):
    """
    A query in a dashboard widget.
    """

    __include_in_export__ = True

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


class DashboardWidget(Model):
    """
    A dashboard widget.
    """

    __include_in_export__ = True

    dashboard = FlexibleForeignKey("sentry.Dashboard")
    order = BoundedPositiveIntegerField()
    title = models.CharField(max_length=255)
    interval = models.CharField(max_length=10, null=True)
    display_type = BoundedPositiveIntegerField(choices=DashboardWidgetDisplayTypes.as_choices())
    date_added = models.DateTimeField(default=timezone.now)
    widget_type = BoundedPositiveIntegerField(choices=DashboardWidgetTypes.as_choices(), null=True)
    detail = JSONField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardwidget"
        unique_together = (("dashboard", "order"),)

    __repr__ = sane_repr("dashboard", "title")

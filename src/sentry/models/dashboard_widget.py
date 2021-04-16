from django.db import models
from django.utils import timezone

from sentry.db.models import (
    ArrayField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    sane_repr,
)


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


class DashboardWidgetDisplayTypes(TypesClass):
    LINE_CHART = 0
    AREA_CHART = 1
    STACKED_AREA_CHART = 2
    BAR_CHART = 3
    TABLE = 4
    WORLD_MAP = 5
    BIG_NUMBER = 6
    TYPES = [
        (LINE_CHART, "line"),
        (AREA_CHART, "area"),
        (STACKED_AREA_CHART, "stacked_area"),
        (BAR_CHART, "bar"),
        (TABLE, "table"),
        (WORLD_MAP, "world_map"),
        (BIG_NUMBER, "big_number"),
    ]
    TYPE_NAMES = [t[1] for t in TYPES]


class DashboardWidgetQueryBase(Model):
    """
    Base class for a query in a dashboard widget.
    """

    widget = FlexibleForeignKey("sentry.DashboardWidget")
    name = models.CharField(max_length=255)
    fields = ArrayField()
    conditions = models.TextField()
    # Order of the widget query in the widget.
    order = BoundedPositiveIntegerField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        abstract = True


class DashboardWidgetQuery(DashboardWidgetQueryBase):
    """
    A query in a dashboard widget.
    """

    __core__ = True

    # Orderby condition for the query
    orderby = models.TextField(default="")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardwidgetquery"
        unique_together = (("widget", "order"),)

    __repr__ = sane_repr("widget", "type", "name")


class DashboardWidgetMetricsQuery(DashboardWidgetQueryBase):
    """
    A metrics query in a dashboard widget.
    """

    __core__ = True

    #: A list of metrics tag names to group by
    groupby = ArrayField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardwidgetmetricsquery"
        unique_together = (("widget", "order"),)

    __repr__ = sane_repr("widget", "name")


class DashboardWidget(Model):
    """
    A dashboard widget.
    """

    __core__ = True

    dashboard = FlexibleForeignKey("sentry.Dashboard")
    order = BoundedPositiveIntegerField()
    title = models.CharField(max_length=255)
    interval = models.CharField(max_length=10, null=True)
    display_type = BoundedPositiveIntegerField(choices=DashboardWidgetDisplayTypes.as_choices())
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardwidget"
        unique_together = (("dashboard", "order"),)

    __repr__ = sane_repr("dashboard", "title")

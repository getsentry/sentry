from __future__ import absolute_import, print_function

import six
from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    ArrayField,
    Model,
    sane_repr,
)


class TypesClass(object):
    TYPES = []

    @classmethod
    def as_choices(cls):
        return [(k, six.text_type(v)) for k, v in cls.TYPES]

    @classmethod
    def as_text_choices(cls):
        return [(six.text_type(v), six.text_type(v)) for _, v in cls.TYPES]

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
    TYPES = [
        (LINE_CHART, "line"),
        (AREA_CHART, "area"),
        (STACKED_AREA_CHART, "stacked_area"),
        (BAR_CHART, "bar"),
        (TABLE, "table"),
    ]
    TYPE_NAMES = [t[1] for t in TYPES]


class DashboardWidgetQuery(Model):
    """
    A query in a dashboard widget.
    """

    __core__ = True

    widget = FlexibleForeignKey("sentry.DashboardWidget")
    name = models.CharField(max_length=255)
    fields = ArrayField()
    conditions = models.TextField()
    interval = models.CharField(max_length=10)
    order = BoundedPositiveIntegerField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardwidgetquery"
        unique_together = (("widget", "name"), ("widget", "order"))

    __repr__ = sane_repr("widget", "type", "name")


class DashboardWidget(Model):
    """
    A dashboard widget.
    """

    __core__ = True

    dashboard = FlexibleForeignKey("sentry.Dashboard")
    order = BoundedPositiveIntegerField()
    title = models.CharField(max_length=255)
    display_type = BoundedPositiveIntegerField(choices=DashboardWidgetDisplayTypes.as_choices())
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_dashboardwidget"
        unique_together = (("dashboard", "order"), ("dashboard", "title"))

    __repr__ = sane_repr("dashboard", "title")

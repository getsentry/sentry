from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    JSONField,
    Model,
    sane_repr,
)


class TypesClass(object):
    TYPES = []

    @classmethod
    def as_choices(cls):
        return cls.TYPES

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


class WidgetDisplayTypes(TypesClass):
    LINE_CHART = 0
    AREA_CHART = 1
    STACKED_AREA_CHART = 2
    BAR_CHART = 3
    PIE_CHART = 4
    TABLE = 5
    WORLD_MAP = 6
    PERCENTAGE_AREA_CHART = 7
    TYPES = [
        (LINE_CHART, "line"),
        (AREA_CHART, "area"),
        (STACKED_AREA_CHART, "stacked_area"),
        (BAR_CHART, "bar"),
        (PIE_CHART, "pie"),
        (TABLE, "table"),
        (WORLD_MAP, "world_map"),
        (PERCENTAGE_AREA_CHART, "percentage_area_chart"),
    ]
    TYPE_NAMES = [t[1] for t in TYPES]


class WidgetDataSourceTypes(TypesClass):
    DISCOVER_SAVED_SEARCH = 0
    TYPES = [(DISCOVER_SAVED_SEARCH, "discover_saved_search")]
    TYPE_NAMES = [t[1] for t in TYPES]


class WidgetDataSource(Model):
    """
    A dashboard widget.
    """

    __core__ = True

    widget = FlexibleForeignKey("sentry.Widget")
    type = BoundedPositiveIntegerField(choices=WidgetDataSourceTypes.as_choices())
    name = models.CharField(max_length=255)
    data = JSONField(default={})  # i.e. saved discover query
    order = BoundedPositiveIntegerField()
    date_added = models.DateTimeField(default=timezone.now)
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.VISIBLE, choices=ObjectStatus.as_choices()
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_widgetdatasource"
        unique_together = (("widget", "name"), ("widget", "order"))

    __repr__ = sane_repr("widget", "type", "name")


class Widget(Model):
    """
    A dashboard widget.
    """

    __core__ = True

    dashboard = FlexibleForeignKey("sentry.Dashboard")
    order = BoundedPositiveIntegerField()
    title = models.CharField(max_length=255)
    display_type = BoundedPositiveIntegerField(choices=WidgetDisplayTypes.as_choices())
    display_options = JSONField(default={})
    date_added = models.DateTimeField(default=timezone.now)
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.VISIBLE, choices=ObjectStatus.as_choices()
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_widget"
        unique_together = (("dashboard", "order"), ("dashboard", "title"))

    __repr__ = sane_repr("dashboard", "title")

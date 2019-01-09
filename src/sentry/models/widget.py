from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone
from jsonfield import JSONField

from sentry.constants import ObjectStatus
from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr


class WidgetDisplayTypes(object):
    LINE_CHART = 0
    AREA_CHART = 1
    STACKED_AREA_CHART = 2
    BAR_CHART = 3
    PIE_CHART = 4
    TABLE = 5
    WORLD_MAP = 6
    PERCENTAGE_AREA_CHART = 7

    @classmethod
    def as_choices(cls):
        return [
            (cls.LINE_CHART, 'line'),
            (cls.AREA_CHART, 'area'),
            (cls.STACKED_AREA_CHART, 'stacked_area'),
            (cls.BAR_CHART, 'bar'),
            (cls.PIE_CHART, 'pie'),
            (cls.TABLE, 'table'),
            (cls.WORLD_MAP, 'world_map'),
            (cls.PERCENTAGE_AREA_CHART, 'percentage_area_chart')
        ]


class WidgetDataSourceTypes(object):
    DISCOVER_SAVED_SEARCH = 0

    @classmethod
    def as_choices(cls):
        return [
            (cls.DISCOVER_SAVED_SEARCH, 'discover_saved_search'),
        ]


class WidgetDataSource(Model):
    """
    A dashboard widget.
    """
    __core__ = True

    widget = FlexibleForeignKey('sentry.Widget')
    type = BoundedPositiveIntegerField(choices=WidgetDataSourceTypes.as_choices())
    name = models.CharField(max_length=255)
    data = JSONField(default={})  # i.e. saved discover query
    date_added = models.DateTimeField(default=timezone.now)
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.VISIBLE,
        choices=ObjectStatus.as_choices(),
    )

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_widgetdatasource'
        unique_together = (('widget', 'type', 'name'), )

    __repr__ = sane_repr('widget', 'type', 'name')


class Widget(Model):
    """
    A dashboard widget.
    """
    __core__ = True

    dashboard = FlexibleForeignKey('sentry.Dashboard')
    order = BoundedPositiveIntegerField()
    title = models.CharField(max_length=255)
    display_type = BoundedPositiveIntegerField(choices=WidgetDisplayTypes.as_choices())
    display_options = JSONField(default={})
    organization = FlexibleForeignKey('sentry.Organization')
    date_added = models.DateTimeField(default=timezone.now)
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.VISIBLE,
        choices=ObjectStatus.as_choices(),
    )

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_widget'
        unique_together = (('organization', 'dashboard', 'order', 'title'), )

    __repr__ = sane_repr('organization', 'dashboard', 'title')

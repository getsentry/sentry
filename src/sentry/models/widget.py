from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone
from jsonfield import JSONField

from sentry.constants import ObjectStatus
from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr


class WidgetDisplayTypes(object):
    BASIC_LINE_CHART = 1
    TWO_QUERY_LINE_CHART = 2
    MAP = 3
    HORIZONATAL_BAR_CHART = 4
    TIMELINE = 5
    STACKED_AREA = 6

    @classmethod
    def as_choices(cls):
        return [
            (cls.BASIC_LINE_CHART, 'basic_line_chart'),
            (cls.TWO_QUERY_LINE_CHART, 'two_query_line_chart'),
            (cls.MAP, 'map'),
            (cls.HORIZONATAL_BAR_CHART, 'horizontal_bar_chart'),
            (cls.TIMELINE, 'timeline'),
            (cls.STACKED_AREA, 'stacked_area')
        ]


class WidgetDataSourceTypes(object):
    DISCOVER_SAVED_SEARCH = 1
    API_QUERY = 2  # ehhhh.....

    @classmethod
    def as_choices(cls):
        return [
            (cls.DISCOVER_SAVED_SEARCH, 'discover_saved_search'),
            (cls.API_QUERY, 'api_query')
        ]


class WidgetDataSource(Model):
    """
    A dashboard widget.
    """
    __core__ = True

    widget = FlexibleForeignKey('sentry.Widget')
    type = BoundedPositiveIntegerField(choices=WidgetDataSourceTypes.as_choices())
    name = models.CharField(max_length=128)
    data = JSONField(default={})
    date_added = models.DateTimeField(default=timezone.now)
    # hmmm do I need this one?
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
    dashboard_order = BoundedPositiveIntegerField()
    title = models.CharField(max_length=128)
    display_type = BoundedPositiveIntegerField(choices=WidgetDisplayTypes.as_choices())
    organization = FlexibleForeignKey('sentry.Organization')
    data = JSONField(default={})
    date_added = models.DateTimeField(default=timezone.now)
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.VISIBLE,
        choices=ObjectStatus.as_choices(),
    )

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_widget'
        unique_together = (('organization', 'dashboard', 'dashboard_order', 'title'), )

    __repr__ = sane_repr('organization', 'dashboard', 'title')

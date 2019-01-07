from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone
from enum import Enum
from jsonfield import JSONField

from sentry.constants import ObjectStatus
from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr


class WidgetDisplayTypes(Enum):
    BASIC_LINE_CHART = 'basic_line_chart'
    TWO_QUERY_LINE_CHART = 'two_query_line_chart'
    MAP = 'map'
    HORIZONATAL_BAR_CHART = 'horizontal_bar_chart'
    TIMELINE = 'timeline'
    STACKED_AREA = 'stacked_area'


class WidgetDataSourceTypes(Enum):
    DISCOVER_SAVED_SEARCH = 'discover_saved_search'
    API_QUERY = 'api_query'  # ehhhh.....


class WidgetDataSource(Model):
    """
    A dashboard widget.
    """
    __core__ = True

    widget = FlexibleForeignKey('sentry.Widget')
    type = BoundedPositiveIntegerField(choices=WidgetDataSourceTypes)
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
        unique_together = (('widget_id', 'type', 'name'), )

    __repr__ = sane_repr('widget_id', 'type', 'name')


class Widget(Model):
    """
    A dashboard widget.
    """
    __core__ = True

    dashboard = FlexibleForeignKey('sentry.Dashboard')
    dashboard_order = BoundedPositiveIntegerField()
    title = models.CharField(max_length=128)
    display_type = BoundedPositiveIntegerField(choices=WidgetDisplayTypes)
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
        unique_together = (('organization_id', 'dashboard_id', 'dashboard_order', 'title'), )

    __repr__ = sane_repr('organization_id', 'dashboard_id', 'title')

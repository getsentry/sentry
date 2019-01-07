from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone
from enum import Enum
from jsonfield import JSONField

from sentry.constants import ObjectStatus
from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr


class WidgetDisplayTypes(Enum):
    LINE_CHART = 'line-chart'
    MAP = 'map'
    HORIZONATAL_BAR_CHART = 'horizontal-bar-chart'
    TIMELINE = 'timeline'
    STACKED_AREA = 'stacked-area'


class Dashboard(Model):
    """
    A dashboard.
    """
    __core__ = True

    title = models.CharField(max_length=128)
    owner = FlexibleForeignKey('sentry.User')
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
        unique_together = (('organization_id', 'title'), )

    __repr__ = sane_repr('organization_id', 'title')

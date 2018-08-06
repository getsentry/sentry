from __future__ import absolute_import

from sentry.db.models import (
    ArrayField, Model, FlexibleForeignKey, sane_repr
)
from django.db import models
from jsonfield import JSONField
from django.utils import timezone


class PluginHealth(Model):
    __core__ = True

    name = models.CharField(max_length=128, db_index=True)
    features_list = ArrayField(of=models.TextField)
    date_added = models.DateTimeField(default=timezone.now)
    link = models.URLField(null=True, blank=True)
    author = models.CharField(max_length=64)
    metadata = JSONField()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_pluginhealth'

    __repr__ = sane_repr('name')


class PluginHealthTest(Model):
    date_added = models.DateTimeField(default=timezone.now)
    plugin = FlexibleForeignKey('sentry.PluginHealth')
    test_data = JSONField()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_pluginhealthtest'
        unique_together = (('plugin', 'date_added'))

    __repr__ = sane_repr('plugin', 'date_added')

"""
sentry.models.rule
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone

from sentry.db.models import (
    Model, FlexibleForeignKey, GzippedDictField, sane_repr
)
from sentry.db.models.manager import BaseManager


class Rule(Model):
    project = FlexibleForeignKey('sentry.Project')
    label = models.CharField(max_length=64)
    data = GzippedDictField()
    date_added = models.DateTimeField(default=timezone.now)

    objects = BaseManager(cache_fields=(
        'pk',
    ))

    class Meta:
        db_table = 'sentry_rule'
        app_label = 'sentry'

    __repr__ = sane_repr('project_id', 'label')

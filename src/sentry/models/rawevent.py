"""
sentry.models.rawevent
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import (BaseManager, Model, NodeField, FlexibleForeignKey, sane_repr)
from sentry.utils.cache import memoize
from sentry.utils.canonical import CanonicalKeyView


class RawEventManager(BaseManager):

    def bind_nodes(self, object_list, *node_names):
        node_names = [x == 'data' and 'node_data' or x for x in node_names]
        return BaseManager.bind_nodes(self, object_list, *node_names)


class RawEvent(Model):
    __core__ = False

    project = FlexibleForeignKey('sentry.Project')
    event_id = models.CharField(max_length=32, null=True)
    datetime = models.DateTimeField(default=timezone.now)
    node_data = NodeField(
        blank=True,
        null=True,
        ref_func=lambda x: x.project_id or x.project.id,
        ref_version=1,
        db_column='data',
    )

    objects = RawEventManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_rawevent'
        unique_together = (('project', 'event_id'), )

    __repr__ = sane_repr('project_id')

    @memoize
    def data(self):
        return CanonicalKeyView(self.node_data)

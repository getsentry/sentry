"""
sentry.search.django.models
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import (
    Model, BoundedPositiveIntegerField, FlexibleForeignKey, sane_repr
)


class SearchDocument(Model):
    project = FlexibleForeignKey('sentry.Project')
    group = FlexibleForeignKey('sentry.Group')
    total_events = BoundedPositiveIntegerField(default=1)
    status = BoundedPositiveIntegerField(default=0)
    date_added = models.DateTimeField(default=timezone.now)
    date_changed = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'search'
        db_table = 'sentry_searchdocument'
        unique_together = (('project', 'group'),)

    __repr__ = sane_repr('project_id', 'group_id')


class SearchToken(Model):
    document = FlexibleForeignKey(SearchDocument, related_name="token_set")
    field = models.CharField(max_length=64, default='text')
    token = models.CharField(max_length=128)
    times_seen = BoundedPositiveIntegerField(default=1)

    class Meta:
        app_label = 'search'
        db_table = 'sentry_searchtoken'
        unique_together = (('document', 'field', 'token'),)

    __repr__ = sane_repr('document_id', 'field', 'token')

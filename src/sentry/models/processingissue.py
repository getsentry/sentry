"""
sentry.models.processingissue
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from hashlib import sha1
from django.db import models

from sentry.db.models import (
    BaseManager, Model, FlexibleForeignKey, GzippedDictField, sane_repr
)


def get_processing_issue_checksum(scope, object):
    h = sha1()
    h.update(scope.encode('utf-8') + '\x00')
    h.update(object.encode('utf-8') + '\x00')
    return h.hexdigest()


class ProcessingIssueManager(BaseManager):

    def resolve_processing_issue(self, project, scope, object, type):
        """Given scope, object and type this marks all issues as resolved
        and returns a list of events that now require reprocessing.
        """
        checksum = get_processing_issue_checksum(scope, object)

        # Find all raw events that suffer from this issue.
        q = EventProcessingIssue.objects.filter(
            processing_issue__project=project,
            processing_issue__checksum=checksum,
        )
        if type is not None:
            q = q.filter(processing_issue__type=type)
        raw_events = set(q.values_list('raw_event_id', flat=True).distinct())

        # Delete all affected processing issue mappings
        q.delete()
        q = ProcessingIssue.objects.filter(
            project=project,
            checksum=checksum,
        )
        if type is not None:
            q = q.filter(type=type)
        q.delete()

        # If we did not find any raw events, we can bail here now safely.
        if not raw_events:
            return []

        # Now look for all the raw events that now have no processing
        # issues left.
        still_broken = set(EventProcessingIssue.objects.filter(
            raw_event__in=list(raw_events),
            processing_issue__project=project,
        ).value_list('raw_event_id', flat=True).distinct())

        return list(raw_events - still_broken)

    def record_processing_issue(self, project, raw_event, scope, object,
                                type, data=None):
        data = dict(data or {})
        checksum = get_processing_issue_checksum(scope, object)
        data['_scope'] = scope
        data['_object'] = object
        issue = ProcessingIssue.objects.get_or_create(
            project=project,
            checksum=checksum,
            type=type,
            data=data,
        )
        EventProcessingIssue.objects.get_or_create(
            raw_event=raw_event,
            issue=issue,
        )


class ProcessingIssue(Model):
    __core__ = False

    project = FlexibleForeignKey('sentry.Project', db_index=True)
    checksum = models.CharField(max_length=40, db_index=True)
    type = models.IntegerField()
    data = GzippedDictField()

    objects = BaseManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_processingissue'
        unique_together = (('project', 'checksum', 'type'),)

    __repr__ = sane_repr('project_id')

    @property
    def scope(self):
        return self.data['_scope']

    @property
    def object(self):
        return self.data['_object']


class EventProcessingIssue(Model):
    __core__ = False

    raw_event = FlexibleForeignKey('sentry.RawEvent')
    processing_issue = FlexibleForeignKey('sentry.ProcessingIssue')

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_eventprocessingissue'
        unique_together = (('raw_event', 'processing_issue'),)

    __repr__ = sane_repr('raw_event', 'processing_issue')

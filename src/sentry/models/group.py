"""
sentry.models.group
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import logging
import math
import time

from datetime import timedelta

from django.core.urlresolvers import reverse
from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

import six

from sentry.constants import (
    LOG_LEVELS, STATUS_LEVELS, MAX_CULPRIT_LENGTH, STATUS_RESOLVED,
    STATUS_UNRESOLVED, STATUS_MUTED
)
from sentry.db.models import (
    Model, GzippedDictField, BoundedIntegerField, BoundedPositiveIntegerField,
    sane_repr
)
from sentry.manager import GroupManager
from sentry.utils.http import absolute_uri
from sentry.utils.strings import truncatechars, strip


class Group(Model):
    """
    Aggregated message which summarizes a set of Events.
    """
    project = models.ForeignKey('sentry.Project', null=True)
    logger = models.CharField(
        max_length=64, blank=True, default='root', db_index=True)
    level = BoundedPositiveIntegerField(
        choices=LOG_LEVELS.items(), default=logging.ERROR, blank=True,
        db_index=True)
    message = models.TextField()
    culprit = models.CharField(
        max_length=MAX_CULPRIT_LENGTH, blank=True, null=True,
        db_column='view')
    checksum = models.CharField(max_length=32, db_index=True)
    num_comments = BoundedPositiveIntegerField(default=0, null=True)
    platform = models.CharField(max_length=64, null=True)
    status = BoundedPositiveIntegerField(
        default=0, choices=STATUS_LEVELS, db_index=True)
    times_seen = BoundedPositiveIntegerField(default=1, db_index=True)
    last_seen = models.DateTimeField(default=timezone.now, db_index=True)
    first_seen = models.DateTimeField(default=timezone.now, db_index=True)
    resolved_at = models.DateTimeField(null=True, db_index=True)
    # active_at should be the same as first_seen by default
    active_at = models.DateTimeField(null=True, db_index=True)
    time_spent_total = BoundedIntegerField(default=0)
    time_spent_count = BoundedIntegerField(default=0)
    score = BoundedIntegerField(default=0)
    is_public = models.NullBooleanField(default=False, null=True)
    data = GzippedDictField(blank=True, null=True)

    objects = GroupManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_groupedmessage'
        unique_together = (('project', 'checksum'),)
        verbose_name_plural = _('grouped messages')
        verbose_name = _('grouped message')
        permissions = (
            ("can_view", "Can view"),
        )

    __repr__ = sane_repr('project_id', 'checksum')

    def __unicode__(self):
        return "(%s) %s" % (self.times_seen, self.error())

    def save(self, *args, **kwargs):
        if not self.last_seen:
            self.last_seen = timezone.now()
        if not self.first_seen:
            self.first_seen = self.last_seen
        if not self.active_at:
            self.active_at = self.first_seen
        if self.message:
            # We limit what we store for the message body
            self.message = self.message.splitlines()[0][:255]
        super(Group, self).save(*args, **kwargs)

    def get_absolute_url(self):
        return absolute_uri(reverse('sentry-group', args=[
            self.team.slug, self.project.slug, self.id]))

    @property
    def avg_time_spent(self):
        if not self.time_spent_count:
            return
        return float(self.time_spent_total) / self.time_spent_count

    def natural_key(self):
        return (self.project, self.checksum)

    def is_over_resolve_age(self):
        resolve_age = self.project.get_option('sentry:resolve_age', None)
        if not resolve_age:
            return False
        return self.last_seen < timezone.now() - timedelta(hours=int(resolve_age))

    def is_muted(self):
        return self.get_status() == STATUS_MUTED

    def is_resolved(self):
        return self.get_status() == STATUS_RESOLVED

    def get_status(self):
        if self.status == STATUS_UNRESOLVED and self.is_over_resolve_age():
            return STATUS_RESOLVED
        return self.status

    def get_score(self):
        return int(math.log(self.times_seen) * 600 + float(time.mktime(self.last_seen.timetuple())))

    def get_latest_event(self):
        from sentry.models import Event

        if not hasattr(self, '_latest_event'):
            try:
                self._latest_event = Event.objects.filter(
                    group=self,
                ).order_by('-datetime')[0]
            except IndexError:
                self._latest_event = None
        return self._latest_event

    def get_version(self):
        if not self.data:
            return
        if 'version' not in self.data:
            return
        module = self.data.get('module', 'ver')
        return module, self.data['version']

    def get_unique_tags(self, tag, since=None, order_by='-times_seen'):
        # TODO(dcramer): this has zero test coverage and is a critical path
        from sentry.models import GroupTagValue

        queryset = GroupTagValue.objects.filter(
            group=self,
            key=tag,
        )
        if since:
            queryset = queryset.filter(last_seen__gte=since)
        return queryset.values_list(
            'value',
            'times_seen',
            'first_seen',
            'last_seen',
        ).order_by(order_by)

    def get_tags(self):
        from sentry.models import GroupTagKey

        if not hasattr(self, '_tag_cache'):
            self._tag_cache = sorted([
                t for t in GroupTagKey.objects.filter(
                    group=self,
                    project=self.project,
                ).values_list('key', flat=True)
                if not t.startswith('sentry:')
            ])
        return self._tag_cache

    def error(self):
        return self.message
    error.short_description = _('error')

    def has_two_part_message(self):
        message = strip(self.message)
        return '\n' in message or len(message) > 100

    @property
    def title(self):
        culprit = strip(self.culprit)
        if culprit:
            return culprit
        return self.message

    @property
    def message_short(self):
        message = strip(self.message)
        if not message:
            message = '<unlabeled message>'
        else:
            message = truncatechars(message.splitlines()[0], 100)
        return message

    @property
    def team(self):
        return self.project.team

    def get_email_subject(self):
        return '[%s %s] %s: %s' % (
            self.team.name.encode('utf-8'),
            self.project.name.encode('utf-8'),
            six.text_type(self.get_level_display()).upper().encode('utf-8'),
            self.message_short.encode('utf-8')
        )

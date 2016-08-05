"""
sentry.models.activity
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import six

from django.conf import settings
from django.db import models
from django.db.models import F
from django.utils import timezone

from sentry.db.models import (
    Model, BoundedPositiveIntegerField, FlexibleForeignKey, GzippedDictField,
    sane_repr
)
from sentry.tasks import activity


class Activity(Model):
    __core__ = False

    SET_RESOLVED = 1
    SET_UNRESOLVED = 2
    SET_MUTED = 3
    SET_PUBLIC = 4
    SET_PRIVATE = 5
    SET_REGRESSION = 6
    CREATE_ISSUE = 7
    NOTE = 8
    FIRST_SEEN = 9
    RELEASE = 10
    ASSIGNED = 11
    UNASSIGNED = 12
    SET_RESOLVED_IN_RELEASE = 13
    MERGE = 14
    SET_RESOLVED_BY_AGE = 15

    TYPE = (
        # (TYPE, verb-slug)
        (SET_RESOLVED, 'set_resolved'),
        (SET_RESOLVED_BY_AGE, 'set_resolved_by_age'),
        (SET_RESOLVED_IN_RELEASE, 'set_resolved_in_release'),
        (SET_UNRESOLVED, 'set_unresolved'),
        (SET_MUTED, 'set_muted'),
        (SET_PUBLIC, 'set_public'),
        (SET_PRIVATE, 'set_private'),
        (SET_REGRESSION, 'set_regression'),
        (CREATE_ISSUE, 'create_issue'),
        (NOTE, 'note'),
        (FIRST_SEEN, 'first_seen'),
        (RELEASE, 'release'),
        (ASSIGNED, 'assigned'),
        (UNASSIGNED, 'unassigned'),
        (MERGE, 'merge'),
    )

    project = FlexibleForeignKey('sentry.Project')
    group = FlexibleForeignKey('sentry.Group', null=True)
    # index on (type, ident)
    type = BoundedPositiveIntegerField(choices=TYPE)
    ident = models.CharField(max_length=64, null=True)
    # if the user is not set, it's assumed to be the system
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, null=True)
    datetime = models.DateTimeField(default=timezone.now)
    data = GzippedDictField(null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_activity'

    __repr__ = sane_repr('project_id', 'group_id', 'event_id', 'user_id',
                         'type', 'ident')

    def __init__(self, *args, **kwargs):
        super(Activity, self).__init__(*args, **kwargs)
        from sentry.models import Release

        # XXX(dcramer): fix for bad data
        if self.type == self.RELEASE and isinstance(self.data['version'], Release):
            self.data['version'] = self.data['version'].version
        if self.type == self.ASSIGNED:
            self.data['assignee'] = six.text_type(self.data['assignee'])

    def save(self, *args, **kwargs):
        created = bool(not self.id)

        super(Activity, self).save(*args, **kwargs)

        if not created:
            return

        # HACK: support Group.num_comments
        if self.type == Activity.NOTE:
            self.group.update(num_comments=F('num_comments') + 1)

    def delete(self, *args, **kwargs):
        super(Activity, self).delete(*args, **kwargs)

        # HACK: support Group.num_comments
        if self.type == Activity.NOTE:
            self.group.update(num_comments=F('num_comments') - 1)

    def send_notification(self):
        activity.send_activity_notifications.delay(self.id)

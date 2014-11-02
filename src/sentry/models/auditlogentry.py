"""
sentry.models.auditlogentry
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.db.models import (
    Model, BoundedPositiveIntegerField, GzippedDictField,
    sane_repr
)


class AuditLogEntryEvent(object):
    MEMBER_INVITE = 1
    MEMBER_ADD = 2
    MEMBER_ACCEPT = 3
    MEMBER_EDIT = 4
    MEMBER_REMOVE = 5


class AuditLogEntry(Model):
    organization = models.ForeignKey('sentry.Organization')
    actor = models.ForeignKey('sentry.User', related_name='audit_actors')
    target_object = BoundedPositiveIntegerField(null=True)
    target_user = models.ForeignKey('sentry.User', null=True, related_name='audit_targets')
    event = BoundedPositiveIntegerField(choices=(
        (AuditLogEntryEvent.MEMBER_INVITE, _('Invited member')),
        (AuditLogEntryEvent.MEMBER_ADD, _('Added member')),
        (AuditLogEntryEvent.MEMBER_ACCEPT, _('Accepted Invite')),
        (AuditLogEntryEvent.MEMBER_REMOVE, _('Removed member')),
        (AuditLogEntryEvent.MEMBER_EDIT, _('Edited member')),
    ))
    data = GzippedDictField()
    datetime = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_auditlogentry'

    __repr__ = sane_repr('organization_id', 'type')

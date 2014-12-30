"""
sentry.models.auditlogentry
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone

from sentry.db.models import (
    Model, BoundedPositiveIntegerField, FlexibleForeignKey, GzippedDictField,
    sane_repr
)


class AuditLogEntryEvent(object):
    MEMBER_INVITE = 1
    MEMBER_ADD = 2
    MEMBER_ACCEPT = 3
    MEMBER_EDIT = 4
    MEMBER_REMOVE = 5

    ORG_ADD = 10
    ORG_EDIT = 11

    TEAM_ADD = 20
    TEAM_EDIT = 21
    TEAM_REMOVE = 22

    PROJECT_ADD = 30
    PROJECT_EDIT = 31
    PROJECT_REMOVE = 32
    PROJECT_SET_PUBLIC = 33
    PROJECT_SET_PRIVATE = 34


class AuditLogEntry(Model):
    organization = FlexibleForeignKey('sentry.Organization')
    actor = FlexibleForeignKey('sentry.User', related_name='audit_actors')
    target_object = BoundedPositiveIntegerField(null=True)
    target_user = FlexibleForeignKey('sentry.User', null=True, blank=True,
                                    related_name='audit_targets')
    event = BoundedPositiveIntegerField(choices=(
        # We emulate github a bit with event naming
        (AuditLogEntryEvent.MEMBER_INVITE, 'member.invite'),
        (AuditLogEntryEvent.MEMBER_ADD, 'member.add'),
        (AuditLogEntryEvent.MEMBER_ACCEPT, 'member.accept-invite'),
        (AuditLogEntryEvent.MEMBER_REMOVE, 'member.remove'),
        (AuditLogEntryEvent.MEMBER_EDIT, 'member.edit'),

        (AuditLogEntryEvent.TEAM_ADD, 'team.create'),
        (AuditLogEntryEvent.TEAM_EDIT, 'team.edit'),
        (AuditLogEntryEvent.TEAM_REMOVE, 'team.remove'),

        (AuditLogEntryEvent.PROJECT_ADD, 'project.create'),
        (AuditLogEntryEvent.PROJECT_EDIT, 'project.edit'),
        (AuditLogEntryEvent.PROJECT_REMOVE, 'project.remove'),
        (AuditLogEntryEvent.PROJECT_SET_PUBLIC, 'project.set-public'),
        (AuditLogEntryEvent.PROJECT_SET_PRIVATE, 'project.set-private'),

        (AuditLogEntryEvent.ORG_ADD, 'org.create'),
        (AuditLogEntryEvent.ORG_EDIT, 'org.edit'),
    ))
    ip_address = models.GenericIPAddressField(null=True, unpack_ipv4=True)
    data = GzippedDictField()
    datetime = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_auditlogentry'

    __repr__ = sane_repr('organization_id', 'type')

    def get_note(self):
        if self.event == AuditLogEntryEvent.MEMBER_INVITE:
            return 'invited member %s' % (self.data['email'],)
        elif self.event == AuditLogEntryEvent.MEMBER_ADD:
            return 'added member %s' % (self.target_user.get_display_name(),)
        elif self.event == AuditLogEntryEvent.MEMBER_ACCEPT:
            return 'accepted the membership invite'
        elif self.event == AuditLogEntryEvent.MEMBER_REMOVE:
            if self.target_user == self.actor:
                return 'left the organization'
            return 'removed member %s' % (self.data.get('email') or self.target_user.get_display_name(),)
        elif self.event == AuditLogEntryEvent.MEMBER_EDIT:
            return 'edited member %s' % (self.data.get('email') or self.target_user.get_display_name(),)

        elif self.event == AuditLogEntryEvent.TEAM_ADD:
            return 'created team %s' % (self.data['slug'],)
        elif self.event == AuditLogEntryEvent.TEAM_EDIT:
            return 'edited team %s' % (self.data['slug'],)
        elif self.event == AuditLogEntryEvent.TEAM_REMOVE:
            return 'removed team %s' % (self.data['slug'],)

        elif self.event == AuditLogEntryEvent.PROJECT_ADD:
            return 'created project %s' % (self.data['slug'],)
        elif self.event == AuditLogEntryEvent.PROJECT_EDIT:
            return 'edited project %s' % (self.data['slug'],)
        elif self.event == AuditLogEntryEvent.PROJECT_REMOVE:
            return 'removed project %s' % (self.data['slug'],)

        return ''

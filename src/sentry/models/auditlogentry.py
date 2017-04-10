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
    MEMBER_JOIN_TEAM = 6
    MEMBER_LEAVE_TEAM = 7

    ORG_ADD = 10
    ORG_EDIT = 11
    ORG_REMOVE = 12
    ORG_RESTORE = 13

    TEAM_ADD = 20
    TEAM_EDIT = 21
    TEAM_REMOVE = 22

    PROJECT_ADD = 30
    PROJECT_EDIT = 31
    PROJECT_REMOVE = 32
    PROJECT_SET_PUBLIC = 33
    PROJECT_SET_PRIVATE = 34

    TAGKEY_REMOVE = 40

    PROJECTKEY_ADD = 50
    PROJECTKEY_EDIT = 51
    PROJECTKEY_REMOVE = 52
    PROJECTKEY_ENABLE = 53
    PROJECTKEY_DISABLE = 53

    SSO_ENABLE = 60
    SSO_DISABLE = 61
    SSO_EDIT = 62
    SSO_IDENTITY_LINK = 63

    APIKEY_ADD = 70
    APIKEY_EDIT = 71
    APIKEY_REMOVE = 72

    RULE_ADD = 80
    RULE_EDIT = 81
    RULE_REMOVE = 82


class AuditLogEntry(Model):
    __core__ = False

    organization = FlexibleForeignKey('sentry.Organization')
    actor_label = models.CharField(max_length=64, null=True, blank=True)
    # if the entry was created via a user
    actor = FlexibleForeignKey('sentry.User', related_name='audit_actors',
                               null=True, blank=True)
    # if the entry was created via an api key
    actor_key = FlexibleForeignKey('sentry.ApiKey', null=True, blank=True)
    target_object = BoundedPositiveIntegerField(null=True)
    target_user = FlexibleForeignKey('sentry.User', null=True, blank=True,
                                    related_name='audit_targets')
    # TODO(dcramer): we want to compile this mapping into JSX for the UI
    event = BoundedPositiveIntegerField(choices=(
        # We emulate github a bit with event naming
        (AuditLogEntryEvent.MEMBER_INVITE, 'member.invite'),
        (AuditLogEntryEvent.MEMBER_ADD, 'member.add'),
        (AuditLogEntryEvent.MEMBER_ACCEPT, 'member.accept-invite'),
        (AuditLogEntryEvent.MEMBER_REMOVE, 'member.remove'),
        (AuditLogEntryEvent.MEMBER_EDIT, 'member.edit'),
        (AuditLogEntryEvent.MEMBER_JOIN_TEAM, 'member.join-team'),
        (AuditLogEntryEvent.MEMBER_LEAVE_TEAM, 'member.leave-team'),

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
        (AuditLogEntryEvent.ORG_REMOVE, 'org.remove'),
        (AuditLogEntryEvent.ORG_RESTORE, 'org.restore'),

        (AuditLogEntryEvent.TAGKEY_REMOVE, 'tagkey.remove'),

        (AuditLogEntryEvent.PROJECTKEY_ADD, 'projectkey.create'),
        (AuditLogEntryEvent.PROJECTKEY_EDIT, 'projectkey.edit'),
        (AuditLogEntryEvent.PROJECTKEY_REMOVE, 'projectkey.remove'),
        (AuditLogEntryEvent.PROJECTKEY_ENABLE, 'projectkey.enable'),
        (AuditLogEntryEvent.PROJECTKEY_DISABLE, 'projectkey.disable'),

        (AuditLogEntryEvent.SSO_ENABLE, 'sso.enable'),
        (AuditLogEntryEvent.SSO_DISABLE, 'sso.disable'),
        (AuditLogEntryEvent.SSO_EDIT, 'sso.edit'),
        (AuditLogEntryEvent.SSO_IDENTITY_LINK, 'sso-identity.link'),

        (AuditLogEntryEvent.APIKEY_ADD, 'api-key.create'),
        (AuditLogEntryEvent.APIKEY_EDIT, 'api-key.edit'),
        (AuditLogEntryEvent.APIKEY_REMOVE, 'api-key.remove'),

        (AuditLogEntryEvent.RULE_ADD, 'rule.create'),
        (AuditLogEntryEvent.RULE_EDIT, 'rule.edit'),
        (AuditLogEntryEvent.RULE_REMOVE, 'rule.remove'),
    ))
    ip_address = models.GenericIPAddressField(null=True, unpack_ipv4=True)
    data = GzippedDictField()
    datetime = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_auditlogentry'

    __repr__ = sane_repr('organization_id', 'type')

    def save(self, *args, **kwargs):
        if not self.actor_label:
            assert self.actor or self.actor_key
            if self.actor:
                self.actor_label = self.actor.username
            else:
                self.actor_label = self.actor_key.key
        super(AuditLogEntry, self).save(*args, **kwargs)

    def get_actor_name(self):
        if self.actor:
            return self.actor.get_display_name()
        elif self.actor_key:
            return self.actor_key.key + ' (api key)'
        return self.actor_label

    def get_note(self):
        if self.event == AuditLogEntryEvent.MEMBER_INVITE:
            return 'invited member %s' % (self.data['email'],)
        elif self.event == AuditLogEntryEvent.MEMBER_ADD:
            if self.target_user == self.actor:
                return 'joined the organization'
            return 'added member %s' % (self.target_user.get_display_name(),)
        elif self.event == AuditLogEntryEvent.MEMBER_ACCEPT:
            return 'accepted the membership invite'
        elif self.event == AuditLogEntryEvent.MEMBER_REMOVE:
            if self.target_user == self.actor:
                return 'left the organization'
            return 'removed member %s' % (self.data.get('email') or self.target_user.get_display_name(),)
        elif self.event == AuditLogEntryEvent.MEMBER_EDIT:
            return 'edited member %s' % (self.data.get('email') or self.target_user.get_display_name(),)
        elif self.event == AuditLogEntryEvent.MEMBER_JOIN_TEAM:
            if self.target_user == self.actor:
                return 'joined team %s' % (self.data['team_slug'],)
            return 'added %s to team %s' % (
                self.data.get('email') or self.target_user.get_display_name(),
                self.data['team_slug'],
            )
        elif self.event == AuditLogEntryEvent.MEMBER_LEAVE_TEAM:
            if self.target_user == self.actor:
                return 'left team %s' % (self.data['team_slug'],)
            return 'removed %s from team %s' % (
                self.data.get('email') or self.target_user.get_display_name(),
                self.data['team_slug'],
            )

        elif self.event == AuditLogEntryEvent.ORG_ADD:
            return 'created the organization'
        elif self.event == AuditLogEntryEvent.ORG_EDIT:
            return 'edited the organization'
        elif self.event == AuditLogEntryEvent.ORG_REMOVE:
            return 'removed the organization'
        elif self.event == AuditLogEntryEvent.ORG_RESTORE:
            return 'restored the organization'

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

        elif self.event == AuditLogEntryEvent.TAGKEY_REMOVE:
            return 'removed tags matching %s = *' % (self.data['key'],)

        elif self.event == AuditLogEntryEvent.PROJECTKEY_ADD:
            return 'added project key %s' % (self.data['public_key'],)
        elif self.event == AuditLogEntryEvent.PROJECTKEY_EDIT:
            return 'edited project key %s' % (self.data['public_key'],)
        elif self.event == AuditLogEntryEvent.PROJECTKEY_REMOVE:
            return 'removed project key %s' % (self.data['public_key'],)
        elif self.event == AuditLogEntryEvent.PROJECTKEY_ENABLE:
            return 'enabled project key %s' % (self.data['public_key'],)
        elif self.event == AuditLogEntryEvent.PROJECTKEY_DISABLE:
            return 'disabled project key %s' % (self.data['public_key'],)

        elif self.event == AuditLogEntryEvent.SSO_ENABLE:
            return 'enabled sso (%s)' % (self.data['provider'],)
        elif self.event == AuditLogEntryEvent.SSO_DISABLE:
            return 'disabled sso (%s)' % (self.data['provider'],)
        elif self.event == AuditLogEntryEvent.SSO_EDIT:
            return 'edited sso settings'
        elif self.event == AuditLogEntryEvent.SSO_IDENTITY_LINK:
            return 'linked their account to a new identity'

        elif self.event == AuditLogEntryEvent.APIKEY_ADD:
            return 'added api key %s' % (self.data['label'],)
        elif self.event == AuditLogEntryEvent.APIKEY_EDIT:
            return 'edited api key %s' % (self.data['label'],)
        elif self.event == AuditLogEntryEvent.APIKEY_REMOVE:
            return 'removed api key %s' % (self.data['label'],)

        elif self.event == AuditLogEntryEvent.RULE_ADD:
            return 'added rule "%s"' % (self.data['label'],)
        elif self.event == AuditLogEntryEvent.RULE_EDIT:
            return 'edited rule "%s"' % (self.data['label'],)
        elif self.event == AuditLogEntryEvent.RULE_REMOVE:
            return 'removed rule "%s"' % (self.data['label'],)

        return ''

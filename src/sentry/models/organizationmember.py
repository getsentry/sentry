"""
sentry.models.organizationmember
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging

from bitfield import BitField
from django.conf import settings
from django.core.urlresolvers import reverse
from django.db import models, transaction
from django.db.models import F
from django.utils import timezone
from hashlib import md5

from sentry import roles
from sentry.db.models import (
    BaseModel, BoundedAutoField, BoundedPositiveIntegerField,
    FlexibleForeignKey, Model, sane_repr
)
from sentry.utils.http import absolute_uri


class OrganizationMemberTeam(BaseModel):
    id = BoundedAutoField(primary_key=True)
    team = FlexibleForeignKey('sentry.Team')
    organizationmember = FlexibleForeignKey('sentry.OrganizationMember')
    # an inactive membership simply removes the team from the default list
    # but still allows them to re-join without request
    is_active = models.BooleanField(default=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_organizationmember_teams'
        unique_together = (('team', 'organizationmember'),)

    __repr__ = sane_repr('team_id', 'organizationmember_id')

    def get_audit_log_data(self):
        return {
            'team_slug': self.team.slug,
            'member_id': self.organizationmember_id,
            'email': self.organizationmember.get_email(),
            'is_active': self.is_active,
        }


class OrganizationMember(Model):
    """
    Identifies relationships between teams and users.

    Users listed as team members are considered to have access to all projects
    and could be thought of as team owners (though their access level may not)
    be set to ownership.
    """
    organization = FlexibleForeignKey('sentry.Organization', related_name="member_set")

    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                             related_name="sentry_orgmember_set")
    email = models.EmailField(null=True, blank=True)
    role = models.CharField(
        choices=roles.get_choices(),
        max_length=32,
        default=roles.get_default().id,
    )
    flags = BitField(flags=(
        ('sso:linked', 'sso:linked'),
        ('sso:invalid', 'sso:invalid'),
    ), default=0)
    date_added = models.DateTimeField(default=timezone.now)
    has_global_access = models.BooleanField(default=True)
    counter = BoundedPositiveIntegerField(null=True, blank=True)
    teams = models.ManyToManyField('sentry.Team', blank=True,
                                   through='sentry.OrganizationMemberTeam')

    # Deprecated -- no longer used
    type = BoundedPositiveIntegerField(default=50, blank=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_organizationmember'
        unique_together = (
            ('organization', 'user'),
            ('organization', 'email'),
        )

    __repr__ = sane_repr('organization_id', 'user_id', 'role',)

    @transaction.atomic
    def save(self, *args, **kwargs):
        assert self.user_id or self.email, \
            'Must set user or email'
        super(OrganizationMember, self).save(*args, **kwargs)

        if not self.counter:
            self._set_counter()

    @transaction.atomic
    def delete(self, *args, **kwargs):
        super(OrganizationMember, self).delete(*args, **kwargs)
        if self.counter:
            self._unshift_counter()

    def _unshift_counter(self):
        assert self.counter
        OrganizationMember.objects.filter(
            organization=self.organization,
            counter__gt=self.counter,
        ).update(
            counter=F('counter') - 1,
        )

    def _set_counter(self):
        assert self.id and not self.counter
        # XXX(dcramer): this isnt atomic, but unfortunately MySQL doesnt support
        # the subquery pattern we'd need
        self.update(
            counter=OrganizationMember.objects.filter(
                organization=self.organization,
            ).count(),
        )

    @property
    def is_pending(self):
        return self.user_id is None

    @property
    def token(self):
        checksum = md5()
        for x in (str(self.organization_id), self.get_email(), settings.SECRET_KEY):
            checksum.update(x)
        return checksum.hexdigest()

    def send_invite_email(self):
        from sentry.utils.email import MessageBuilder

        context = {
            'email': self.email,
            'organization': self.organization,
            'url': absolute_uri(reverse('sentry-accept-invite', kwargs={
                'member_id': self.id,
                'token': self.token,
            })),
        }

        msg = MessageBuilder(
            subject='Join %s in using Sentry' % self.organization.name,
            template='sentry/emails/member-invite.txt',
            html_template='sentry/emails/member-invite.html',
            context=context,
        )

        try:
            msg.send([self.get_email()])
        except Exception as e:
            logger = logging.getLogger('sentry.mail.errors')
            logger.exception(e)

    def send_sso_link_email(self):
        from sentry.utils.email import MessageBuilder

        context = {
            'email': self.email,
            'organization_name': self.organization.name,
            'url': absolute_uri(reverse('sentry-auth-organization', kwargs={
                'organization_slug': self.organization.slug,
            })),
        }

        msg = MessageBuilder(
            subject='Action Required for %s' % (self.organization.name,),
            template='sentry/emails/auth-link-identity.txt',
            html_template='sentry/emails/auth-link-identity.html',
            context=context,
        )
        msg.send_async([self.get_email()])

    def get_display_name(self):
        if self.user_id:
            return self.user.get_display_name()
        return self.email

    def get_label(self):
        if self.user_id:
            return self.user.get_label()
        return self.email or self.id

    def get_email(self):
        if self.user_id:
            return self.user.email
        return self.email

    def get_audit_log_data(self):
        from sentry.models import Team
        return {
            'email': self.email,
            'user': self.user_id,
            'teams': list(Team.objects.filter(
                id__in=OrganizationMemberTeam.objects.filter(
                    organizationmember=self,
                    is_active=True,
                ).values_list('team', flat=True)
            )),
            'has_global_access': self.has_global_access,
            'role': self.role,
        }

    def get_teams(self):
        from sentry.models import Team

        if roles.get(self.role).is_global:
            return self.organization.team_set.all()

        return Team.objects.filter(
            id__in=OrganizationMemberTeam.objects.filter(
                organizationmember=self,
                is_active=True,
            ).values('team')
        )

    def get_scopes(self):
        return roles.get(self.role).scopes

    def can_manage_member(self, member):
        return roles.can_manage(self.role, member.role)

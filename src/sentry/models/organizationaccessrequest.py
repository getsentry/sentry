"""
sentry.models.organizationmember
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from django.core.urlresolvers import reverse
from django.db.models import Q

from sentry import roles
from sentry.db.models import FlexibleForeignKey, Model, sane_repr
from sentry.utils.http import absolute_uri


class OrganizationAccessRequest(Model):
    team = FlexibleForeignKey('sentry.Team')
    member = FlexibleForeignKey('sentry.OrganizationMember')

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_organizationaccessrequest'
        unique_together = (('team', 'member'),)

    __repr__ = sane_repr('team_id', 'member_id')

    def send_request_email(self):
        from sentry.models import OrganizationMember
        from sentry.utils.email import MessageBuilder

        user = self.member.user
        email = user.email
        organization = self.team.organization

        context = {
            'email': email,
            'name': user.get_display_name(),
            'organization': organization,
            'team': self.team,
            'url': absolute_uri(reverse('sentry-organization-members', kwargs={
                'organization_slug': organization.slug,
            }) + '?ref=access-requests'),
        }

        msg = MessageBuilder(
            subject='Sentry Access Request',
            template='sentry/emails/request-team-access.txt',
            html_template='sentry/emails/request-team-access.html',
            context=context,
        )

        global_roles = [
            r.id for r in roles.with_scope('org:write')
            if r.is_global
        ]
        team_roles = [
            r.id for r in roles.with_scope('team:write')
        ]

        # find members which are either team scoped or have access to all teams
        member_list = OrganizationMember.objects.filter(
            Q(role__in=global_roles) |
            Q(teams=self.team, role__in=team_roles),
            organization=self.team.organization,
            user__isnull=False,
        ).select_related('user')

        msg.send_async([m.user.email for m in member_list])

    def send_approved_email(self):
        from sentry.utils.email import MessageBuilder

        user = self.member.user
        email = user.email
        organization = self.team.organization

        context = {
            'email': email,
            'name': user.get_display_name(),
            'organization': organization,
            'team': self.team,
        }

        msg = MessageBuilder(
            subject='Sentry Access Request',
            template='sentry/emails/access-approved.txt',
            html_template='sentry/emails/access-approved.html',
            context=context,
        )

        msg.send_async([email])

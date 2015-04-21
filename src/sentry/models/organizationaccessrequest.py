"""
sentry.models.organizationmember
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging

from django.core.urlresolvers import reverse

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
        from sentry.utils.email import MessageBuilder

        user = self.member.user
        email = user.get_email()
        organization = self.team.organization

        context = {
            'email': email,
            'name': user.get_display_name(),
            'organization': organization,
            'team': self.team,
            'url': absolute_uri(reverse('sentry-organization-access-requests', kwargs={
                'organization_slug': organization.slug,
            })),
        }

        msg = MessageBuilder(
            subject='Sentry Access Request',
            template='sentry/emails/request-team-access.txt',
            html_template='sentry/emails/request-team-access.html',
            context=context,
        )

        try:
            msg.send([email])
        except Exception as e:
            logger = logging.getLogger('sentry.mail.errors')
            logger.exception(e)

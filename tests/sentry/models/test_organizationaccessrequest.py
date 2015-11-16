from __future__ import absolute_import

from django.core import mail

from sentry.models import (
    OrganizationAccessRequest, OrganizationMember, OrganizationMemberTeam
)
from sentry.testutils import TestCase


class SendRequestEmailTest(TestCase):
    def test_sends_email_to_everyone(self):
        owner = self.create_user('owner@example.com')
        team_admin = self.create_user('team-admin@example.com')
        non_team_admin = self.create_user('non-team-admin@example.com')
        random_member = self.create_user('member@example.com')
        requesting_user = self.create_user('requesting@example.com')

        org = self.create_organization(owner=owner)
        team = self.create_team(organization=org)

        OrganizationMemberTeam.objects.create(
            organizationmember=OrganizationMember.objects.get(
                organization=org,
                user=owner,
            ),
            team=team,
        )

        self.create_member(
            organization=org,
            user=team_admin,
            role='admin',
            teams=[team],
        )

        self.create_member(
            organization=org,
            user=non_team_admin,
            role='admin',
            teams=[],
        )

        self.create_member(
            organization=org,
            user=random_member,
            role='member',
            teams=[team],
        )

        requesting_member = self.create_member(
            organization=org,
            user=requesting_user,
            role='member',
            teams=[],
        )

        request = OrganizationAccessRequest.objects.create(
            member=requesting_member,
            team=team,
        )

        with self.tasks():
            request.send_request_email()

        assert len(mail.outbox) == 2, [m.subject for m in mail.outbox]
        assert sorted([m.to[0] for m in mail.outbox]) == \
            sorted([owner.email, team_admin.email])

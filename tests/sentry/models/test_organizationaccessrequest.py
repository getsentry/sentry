from django.core import mail

from sentry.models.organizationaccessrequest import OrganizationAccessRequest
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import region_silo_test


@region_silo_test
class SendRequestEmailTest(TestCase):
    def test_sends_email_to_everyone(self):
        owner = self.create_user("owner@example.com")
        team_admin = self.create_user("team-admin@example.com")
        non_team_admin = self.create_user("non-team-admin@example.com")
        random_member = self.create_user("member@example.com")
        requesting_user = self.create_user("requesting@example.com")

        org = self.create_organization(owner=owner)
        team = self.create_team(organization=org)

        OrganizationMemberTeam.objects.create(
            organizationmember=OrganizationMember.objects.get(organization=org, user_id=owner.id),
            team=team,
        )

        self.create_member(organization=org, user=team_admin, role="admin", teams=[team])

        self.create_member(organization=org, user=non_team_admin, role="admin", teams=[])

        self.create_member(organization=org, user=random_member, role="member", teams=[team])

        requesting_member = self.create_member(
            organization=org, user=requesting_user, role="member", teams=[]
        )

        request = OrganizationAccessRequest.objects.create(member=requesting_member, team=team)

        with self.tasks():
            request.send_request_email()

        assert len(mail.outbox) == 2, [m.subject for m in mail.outbox]
        assert sorted(m.to[0] for m in mail.outbox) == sorted([owner.email, team_admin.email])

    @with_feature("organizations:customer-domains")
    def test_sends_email_with_link(self):
        owner = self.create_user("owner@example.com")
        requesting_user = self.create_user("requesting@example.com")

        org = self.create_organization(owner=owner)
        team = self.create_team(organization=org)
        self.create_team_membership(team=team, user=owner)

        requesting_member = self.create_member(
            organization=org, user=requesting_user, role="member", teams=[]
        )

        request = OrganizationAccessRequest.objects.create(member=requesting_member, team=team)

        with self.tasks():
            request.send_request_email()

        assert len(mail.outbox) == 1
        assert org.absolute_url("/settings/teams/") in mail.outbox[0].body

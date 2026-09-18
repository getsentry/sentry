from unittest.mock import patch

from django.core import mail

from sentry.models.organizationaccessrequest import OrganizationAccessRequest
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.users.services.user.service import user_service


class SendRequestEmailTest(TestCase):
    @with_feature("system:multi-region")
    def test_sends_no_email_to_invited_member(self) -> None:
        owner = self.create_user("owner@example.com")

        org = self.create_organization(owner=owner)
        team = self.create_team(organization=org)
        self.create_team_membership(team=team, user=owner)

        requesting_member = self.create_member(
            organization=org, role="member", email="joe@example.com"
        )
        request = OrganizationAccessRequest.objects.create(member=requesting_member, team=team)

        with self.tasks():
            request.send_request_email()

        assert len(mail.outbox) == 0

    @with_feature("system:multi-region")
    def test_sends_email_with_link(self) -> None:
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

    @with_feature("system:multi-region")
    def test_sanitizes_periods_in_display_name(self) -> None:
        owner = self.create_user("owner@example.com")
        requesting_user = self.create_user("requesting@example.com", name="Visit evil.com now")

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
        assert "evil.com" not in mail.outbox[0].body
        assert "evil\u2060.com" in mail.outbox[0].body


class TeamAdminRequestEmailTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user, flags=0)
        self.team = self.create_team(organization=self.organization)
        other_team = self.create_team(organization=self.organization)
        self.create_team_membership(team=self.team, user=self.user)
        self.create_team_membership(team=other_team, user=self.user)
        self.manager = self.create_user()
        self.create_member(organization=self.organization, user=self.manager, role="manager")
        self.org_admin = self.create_user()
        self.create_member(
            organization=self.organization, user=self.org_admin, role="admin", teams=[self.team]
        )
        self.create_member(organization=self.organization, user=self.create_user(), role="admin")
        self.team_admin = self.create_user()
        self.create_member(
            organization=self.organization,
            user=self.team_admin,
            role="member",
            team_roles=[(self.team, "admin")],
        )
        self.create_member(
            organization=self.organization,
            user=self.create_user(),
            team_roles=[(self.team, "contributor"), (other_team, "admin")],
        )
        inactive_admin = self.create_member(organization=self.organization, user=self.create_user())
        self.create_team_membership(team=self.team, member=inactive_admin, role="admin").update(
            is_active=False
        )
        self.access_request = self.create_organization_access_request(
            team=self.team,
            member=self.create_member(organization=self.organization, user=self.create_user()),
        )

    @with_feature("organizations:team-roles")
    @patch("sentry.models.organizationaccessrequest.REQUEST_EMAIL_BATCH_SIZE", 2)
    def test_emails_only_approvers_in_batches(self) -> None:
        duplicate_email_user = self.create_user(email=self.user.email, username="duplicate-email")
        self.create_member(
            organization=self.organization,
            user=duplicate_email_user,
            team_roles=[(self.team, "admin")],
        )
        with (
            self.tasks(),
            patch.object(
                user_service, "get_many_by_id", wraps=user_service.get_many_by_id
            ) as get_many_by_id,
        ):
            self.access_request.send_request_email()

        assert [len(call.kwargs["ids"]) for call in get_many_by_id.call_args_list] == [2, 2, 1]
        assert sorted(message.to[0] for message in mail.outbox) == sorted(
            [self.user.email, self.manager.email, self.org_admin.email, self.team_admin.email]
        )

    def test_team_roles_disabled(self) -> None:
        with self.feature({"organizations:team-roles": False}), self.tasks():
            self.access_request.send_request_email()

        assert sorted(message.to[0] for message in mail.outbox) == sorted(
            [self.user.email, self.manager.email, self.org_admin.email]
        )

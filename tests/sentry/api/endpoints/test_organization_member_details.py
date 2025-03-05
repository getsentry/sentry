from unittest.mock import patch

from django.core import mail
from django.db.models import F
from django.test import override_settings
from django.urls import reverse

from sentry import audit_log
from sentry.auth.authenticators.recovery_code import RecoveryCodeInterface
from sentry.auth.authenticators.totp import TotpInterface
from sentry.models.authprovider import AuthProvider
from sentry.models.organization import Organization
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.roles import organization_roles
from sentry.silo.base import SiloMode
from sentry.testutils.asserts import assert_org_audit_log_exists
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.models.authenticator import Authenticator
from sentry.users.models.user_option import UserOption
from tests.sentry.api.endpoints.test_organization_member_index import (
    mock_organization_roles_get_factory,
)


class OrganizationMemberTestBase(APITestCase):
    endpoint = "sentry-api-0-organization-member-details"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)


class GetOrganizationMemberTest(OrganizationMemberTestBase):
    def test_me(self):
        response = self.get_success_response(self.organization.slug, "me")

        assert response.data["role"] == "owner"
        assert response.data["orgRole"] == "owner"
        assert response.data["user"]["id"] == str(self.user.id)
        assert response.data["email"] == self.user.email

    def test_get_by_id(self):
        user = self.create_user("dummy@example.com")
        member = OrganizationMember.objects.create(
            organization=self.organization, user_id=user.id, role="member"
        )
        self.login_as(user)

        response = self.get_success_response(self.organization.slug, member.id)
        assert response.data["role"] == "member"
        assert response.data["orgRole"] == "member"
        assert response.data["id"] == str(member.id)

    def test_get_by_garbage(self):
        self.get_error_response(self.organization.slug, "trash", status_code=404)

    def test_cannot_get_unapproved_invite(self):
        join_request = self.create_member(
            organization=self.organization,
            email="test@gmail.com",
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )

        invite_request = self.create_member(
            organization=self.organization,
            email="test2@gmail.com",
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )

        self.get_error_response(self.organization.slug, join_request.id, status_code=404)
        self.get_error_response(self.organization.slug, invite_request.id, status_code=404)

    def test_invite_link_does_not_exist(self):
        pending_om = self.create_member(
            user=None,
            email="bar@example.com",
            organization=self.organization,
            role="member",
            teams=[],
        )

        response = self.get_success_response(self.organization.slug, pending_om.id)
        assert "invite_link" not in response.data

    def test_member_cannot_get_invite_link(self):
        pending_om = self.create_member(
            user=None,
            email="bar@example.com",
            organization=self.organization,
            role="member",
            teams=[],
        )

        member = self.create_user("baz@example.com")
        self.create_member(organization=self.organization, user=member, role="member")
        self.login_as(member)

        response = self.get_success_response(self.organization.slug, pending_om.id)
        assert "invite_link" not in response.data

    def test_get_member_list_teams(self):
        team = self.create_team(organization=self.organization, name="Team")

        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=self.organization, user=member, role="member", teams=[team]
        )

        response = self.get_success_response(self.organization.slug, member_om.id)
        assert team.slug in response.data["teams"]

        assert response.data["teamRoles"][0]["teamSlug"] == team.slug
        assert response.data["teamRoles"][0]["role"] is None

    def test_lists_organization_roles(self):
        response = self.get_success_response(self.organization.slug, "me")
        assert response.data["roles"] == response.data["orgRoleList"]

        role_ids = [role["id"] for role in response.data["orgRoleList"]]
        assert role_ids == ["member", "admin", "manager", "owner"]

    @with_feature("organizations:team-roles")
    def test_hides_retired_organization_roles(self):
        """
        Note: Admin will be hidden after team-roles EA.
        """
        response = self.get_success_response(self.organization.slug, "me")
        assert response.data["roles"] == response.data["orgRoleList"]

        role_ids = [role["id"] for role in response.data["orgRoleList"]]
        assert role_ids == ["member", "admin", "manager", "owner"]

    def test_lists_team_roles(self):
        response = self.get_success_response(self.organization.slug, "me")

        role_ids = [role["id"] for role in response.data["teamRoleList"]]
        assert role_ids == ["contributor", "admin"]

    def test_does_not_include_secondary_emails(self):
        # Create a user with multiple email addresses
        user = self.create_user("primary@example.com", username="multi_email_user")
        self.create_useremail(user, "secondary1@example.com")
        self.create_useremail(user, "secondary2@example.com")

        # Add user to organization
        member = self.create_member(organization=self.organization, user=user, role="member")

        response = self.get_success_response(self.organization.slug, member.id)

        # Check that only primary email is present and no other email addresses are exposed
        assert response.data["email"] == "primary@example.com"
        assert "emails" not in response.data["user"]
        assert "emails" not in response.data.get("serializedUser", {})


class UpdateOrganizationMemberTest(OrganizationMemberTestBase, HybridCloudTestMixin):
    method = "put"

    def setUp(self):
        super().setUp()

        self.curr_user = self.create_user("member@example.com")
        self.curr_member = self.create_member(
            organization=self.organization, role="member", user=self.curr_user
        )
        self.other_user = self.create_user("other@example.com")
        self.other_member = self.create_member(
            organization=self.organization, role="member", user=self.other_user
        )

        self.curr_invite = self.create_member(
            organization=self.organization,
            user=None,
            email="member_invite@example.com",
            role="member",
            inviter_id=self.curr_user.id,
        )
        self.other_invite = self.create_member(
            organization=self.organization,
            user=None,
            email="other_invite@example.com",
            role="member",
            inviter_id=self.other_user.id,
        )

    def test_invalid_id(self):
        self.get_error_response(self.organization.slug, "trash", reinvite=1, status_code=404)

    @patch("sentry.models.OrganizationMember.send_invite_email")
    def test_reinvite_pending_member(self, mock_send_invite_email):
        member_om = self.create_member(
            organization=self.organization, email="foo@example.com", role="member"
        )

        self.get_success_response(self.organization.slug, member_om.id, reinvite=1)
        mock_send_invite_email.assert_called_once_with()

    @patch("sentry.models.OrganizationMember.send_invite_email")
    def test_member_reinvite_pending_member(self, mock_send_invite_email):
        self.login_as(self.curr_user)

        self.organization.flags.disable_member_invite = True
        self.organization.save()
        response = self.get_error_response(
            self.organization.slug, self.curr_invite.id, reinvite=1, status_code=403
        )
        assert response.data.get("detail") == "You do not have permission to perform this action."
        response = self.get_error_response(
            self.organization.slug, self.other_invite.id, reinvite=1, status_code=403
        )
        assert response.data.get("detail") == "You do not have permission to perform this action."
        assert not mock_send_invite_email.mock_calls

        self.organization.flags.disable_member_invite = False
        self.organization.save()
        with outbox_runner():
            self.get_success_response(self.organization.slug, self.curr_invite.id, reinvite=1)
        mock_send_invite_email.assert_called_once_with()
        assert_org_audit_log_exists(
            organization=self.organization,
            event=audit_log.get_event_id("MEMBER_REINVITE"),
        )
        mock_send_invite_email.reset_mock()

        response = self.get_error_response(
            self.organization.slug, self.other_invite.id, reinvite=1, status_code=403
        )
        assert response.data.get("detail") == "You cannot modify invitations sent by someone else."
        assert not mock_send_invite_email.mock_calls

    @patch("sentry.models.OrganizationMember.send_invite_email")
    def test_member_can_only_reinvite(self, mock_send_invite_email):
        foo = self.create_team(organization=self.organization, name="Team Foo")
        self.login_as(self.curr_user)

        self.organization.flags.disable_member_invite = True
        self.organization.save()
        response = self.get_error_response(
            self.organization.slug,
            self.curr_invite.id,
            teams=[foo.slug],
            status_code=403,
        )
        assert response.data.get("detail") == "You do not have permission to perform this action."
        assert not mock_send_invite_email.mock_calls

        self.organization.flags.disable_member_invite = False
        self.organization.save()
        response = self.get_error_response(
            self.organization.slug,
            self.curr_invite.id,
            teams=[foo.slug],
            status_code=403,
        )
        assert response.data.get("detail") == "You do not have permission to perform this action."
        assert not mock_send_invite_email.mock_calls

    @patch("sentry.models.OrganizationMember.send_invite_email")
    def test_member_cannot_reinvite_non_pending_members(self, mock_send_invite_email):
        self.login_as(self.curr_user)

        self.organization.flags.disable_member_invite = True
        self.organization.save()
        response = self.get_error_response(
            self.organization.slug, self.other_member.id, reinvite=1, status_code=403
        )
        assert response.data.get("detail") == "You do not have permission to perform this action."

        self.organization.flags.disable_member_invite = False
        self.organization.save()
        response = self.get_error_response(
            self.organization.slug, self.other_member.id, reinvite=1, status_code=403
        )
        assert response.data.get("detail") == "You do not have permission to perform this action."
        assert not mock_send_invite_email.mock_calls

    @patch("sentry.models.OrganizationMember.send_invite_email")
    def test_cannot_reinvite_and_modify_member(self, mock_send_invite_email):
        member_om = self.create_member(
            organization=self.organization, email="foo@example.com", role="member"
        )

        response = self.get_error_response(
            self.organization.slug, member_om.id, reinvite=1, role="manager", status_code=403
        )
        assert (
            response.data.get("detail")
            == "You cannot modify member details when resending an invitation. Separate requests are required."
        )
        assert not mock_send_invite_email.mock_calls

    @patch("sentry.models.OrganizationMember.send_invite_email")
    def test_member_details_not_modified_after_reinviting(self, mock_send_invite_email):
        team = self.create_team(organization=self.organization, name="Moo Deng's Team")

        member_om = self.create_member(
            organization=self.organization,
            email="foo@example.com",
            role="member",
            teams=[team],
        )
        teams = list(map(lambda team: team.slug, member_om.teams.all()))
        roles = [t for t in member_om.get_team_roles()]
        assert member_om.role == "member"
        assert team.slug in teams
        assert roles == [
            {
                "team": team.id,
                "role": None,
            }
        ]
        with outbox_runner():
            self.get_success_response(self.organization.slug, member_om.id, reinvite=1)

        assert_org_audit_log_exists(
            organization=self.organization,
            event=audit_log.get_event_id("MEMBER_REINVITE"),
        )

        teams = list(map(lambda team: team.slug, member_om.teams.all()))
        roles = [t for t in member_om.get_team_roles()]
        assert member_om.role == "member"
        assert team.slug in teams
        assert roles == [
            {
                "team": team.id,
                "role": None,
            }
        ]

    @patch("sentry.ratelimits.for_organization_member_invite")
    @patch("sentry.models.OrganizationMember.send_invite_email")
    def test_rate_limited(self, mock_send_invite_email, mock_rate_limit):
        mock_rate_limit.return_value = True

        member_om = self.create_member(
            organization=self.organization, email="foo@example.com", role="member"
        )

        self.get_error_response(self.organization.slug, member_om.id, reinvite=1, status_code=429)

        assert not mock_send_invite_email.mock_calls

    @patch("sentry.models.OrganizationMember.send_invite_email")
    def test_member_cannot_regenerate_pending_invite(self, mock_send_invite_email):
        member_om = self.create_member(
            organization=self.organization, email="foo@example.com", role="member"
        )
        old_invite = member_om.get_invite_link()

        member = self.create_user("baz@example.com")
        self.create_member(organization=self.organization, user=member, role="member")
        self.login_as(member)

        self.get_error_response(
            self.organization.slug, member_om.id, reinvite=1, regenerate=1, status_code=403
        )
        member_om = OrganizationMember.objects.get(id=member_om.id)
        assert old_invite == member_om.get_invite_link()
        assert not mock_send_invite_email.mock_calls

        self.login_as(self.curr_user)

        self.organization.flags.disable_member_invite = True
        self.organization.save()
        response = self.get_error_response(
            self.organization.slug, self.curr_invite.id, reinvite=1, regenerate=1, status_code=403
        )
        assert response.data.get("detail") == "You do not have permission to perform this action."

        self.organization.flags.disable_member_invite = False
        self.organization.save()
        response = self.get_error_response(
            self.organization.slug,
            self.curr_invite.id,
            reinvite=1,
            regenerate=1,
            status_code=400,
        )
        assert response.data.get("detail") == "You are missing the member:admin scope."

    @patch("sentry.models.OrganizationMember.send_invite_email")
    def test_admin_can_regenerate_pending_invite(self, mock_send_invite_email):
        member_om = self.create_member(
            organization=self.organization, email="foo@example.com", role="member"
        )
        old_invite = member_om.get_invite_link()

        response = self.get_success_response(
            self.organization.slug, member_om.id, reinvite=1, regenerate=1
        )
        member_om = OrganizationMember.objects.get(id=member_om.id)
        assert old_invite != member_om.get_invite_link()
        mock_send_invite_email.assert_called_once_with()
        assert "invite_link" not in response.data
        self.assert_org_member_mapping(org_member=member_om)

    @patch("sentry.models.OrganizationMember.send_invite_email")
    def test_reinvite_invite_expired_member(self, mock_send_invite_email):
        member = self.create_member(
            organization=self.organization,
            email="foo@example.com",
            role="member",
            token_expires_at="2018-10-20 00:00:00+00:00",
        )

        self.get_error_response(self.organization.slug, member.id, reinvite=1, status_code=400)
        assert mock_send_invite_email.called is False

        member = OrganizationMember.objects.get(pk=member.id)
        assert member.token_expired

    @patch("sentry.models.OrganizationMember.send_invite_email")
    def test_regenerate_invite_expired_member(self, mock_send_invite_email):
        member = self.create_member(
            organization=self.organization,
            email="foo@example.com",
            role="member",
            token_expires_at="2018-10-20 00:00:00+00:00",
        )

        self.get_success_response(self.organization.slug, member.id, reinvite=1, regenerate=1)

        mock_send_invite_email.assert_called_once_with()

        member = OrganizationMember.objects.get(pk=member.id)
        assert member.token_expired is False
        self.assert_org_member_mapping(org_member=member)

    @patch("sentry.models.OrganizationMember.send_invite_email")
    def test_cannot_reinvite_unapproved_invite(self, mock_send_invite_email):
        member = self.create_member(
            organization=self.organization,
            email="foo@example.com",
            role="member",
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )

        self.get_error_response(self.organization.slug, member.id, reinvite=1, status_code=404)

    @patch("sentry.models.OrganizationMember.send_invite_email")
    def test_cannot_regenerate_unapproved_invite(self, mock_send_invite_email):
        member = self.create_member(
            organization=self.organization,
            email="foo@example.com",
            role="member",
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )

        self.get_error_response(
            self.organization.slug, member.id, reinvite=1, regenerate=1, status_code=404
        )

    def test_reinvite_sso_link(self):
        member = self.create_user("bar@example.com")
        member_om = self.create_member(organization=self.organization, user=member, role="member")
        with assume_test_silo_mode(SiloMode.CONTROL):
            AuthProvider.objects.create(
                organization_id=self.organization.id, provider="dummy", flags=1
            )

        with self.tasks():
            self.get_success_response(self.organization.slug, member_om.id, reinvite=1)

        assert len(mail.outbox) == 1

    def test_can_update_member_membership(self):
        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=self.organization, user=member, role="member", teams=[]
        )

        with outbox_runner():
            self.get_success_response(self.organization.slug, member_om.id, role="manager")
        member_om = OrganizationMember.objects.get(id=member_om.id)
        assert member_om.role == "manager"
        self.assert_org_member_mapping(org_member=member_om)

    def test_cannot_update_own_membership(self):
        member_om = OrganizationMember.objects.get(
            organization=self.organization, user_id=self.user.id
        )

        self.get_error_response(
            self.organization.slug, member_om.id, role="manager", status_code=400
        )

        member_om = OrganizationMember.objects.get(user_id=self.user.id)
        assert member_om.role == "owner"

    def test_can_update_teams(self):
        foo = self.create_team(organization=self.organization, name="Team Foo")
        bar = self.create_team(organization=self.organization, name="Team Bar")

        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=self.organization, user=member, role="member", teams=[]
        )
        self.get_success_response(self.organization.slug, member_om.id, teams=[foo.slug, bar.slug])

        member_teams = OrganizationMemberTeam.objects.filter(organizationmember=member_om)
        team_ids = list(map(lambda x: x.team_id, member_teams))
        assert foo.id in team_ids
        assert bar.id in team_ids

        member_om = OrganizationMember.objects.get(id=member_om.id)

        teams = list(map(lambda team: team.slug, member_om.teams.all()))
        assert foo.slug in teams
        assert bar.slug in teams

    @with_feature("organizations:team-roles")
    def test_can_update_teams_with_feature_flag(self):
        self.test_can_update_teams()

    def test_can_update_teams_using_teamRoles(self):
        foo = self.create_team(organization=self.organization, name="Team Foo")
        bar = self.create_team(organization=self.organization, name="Team Bar")

        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=self.organization, user=member, role="member", teams=[]
        )

        self.get_success_response(
            self.organization.slug,
            member_om.id,
            teamRoles=[
                {
                    "teamSlug": foo.slug,
                    "role": None,
                },
                {
                    "teamSlug": bar.slug,
                    "role": None,
                },
            ],
        )

        member_teams = OrganizationMemberTeam.objects.filter(organizationmember=member_om)
        team_ids = list(map(lambda x: x.team_id, member_teams))
        assert foo.id in team_ids
        assert bar.id in team_ids

    def test_cannot_update_with_invalid_team(self):
        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=self.organization, user=member, role="member", teams=[]
        )

        self.get_error_response(
            self.organization.slug, member_om.id, teams=["invalid"], status_code=400
        )

        member_om = OrganizationMember.objects.get(id=member_om.id)
        teams = list(map(lambda team: team.slug, member_om.teams.all()))
        assert len(teams) == 0

    def test_can_update_org_role(self):
        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=self.organization, user=member, role="member", teams=[]
        )

        with outbox_runner():
            self.get_success_response(self.organization.slug, member_om.id, role="manager")

        member_om = OrganizationMember.objects.get(
            organization=self.organization, user_id=member.id
        )
        assert member_om.role == "manager"
        self.assert_org_member_mapping(org_member=member_om)

    @with_feature("organizations:team-roles")
    def test_can_update_team_role(self):
        foo = self.create_team(organization=self.organization, name="Team Foo")

        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=self.organization, user=member, role="member", teams=[foo]
        )

        member_omt = OrganizationMemberTeam.objects.get(organizationmember=member_om, team=foo)
        assert member_omt.role is None

        self.get_success_response(
            self.organization.slug,
            member_om.id,
            teamRoles=[
                {
                    "teamSlug": foo.slug,
                    "role": "admin",
                },
            ],
        )

        member_omt = OrganizationMemberTeam.objects.get(organizationmember=member_om, team=foo)
        assert member_omt.role == "admin"

        self.get_success_response(
            self.organization.slug,
            member_om.id,
            teamRoles=[
                {
                    "teamSlug": foo.slug,
                    "role": None,
                },
            ],
        )

        member_omt = OrganizationMemberTeam.objects.get(organizationmember=member_om, team=foo)
        assert member_omt.role is None

    def test_cannot_update_with_invalid_role(self):
        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=self.organization, user=member, role="member", teams=[]
        )

        self.get_error_response(
            self.organization.slug, member_om.id, role="invalid", status_code=400
        )

        member_om = OrganizationMember.objects.get(
            organization=self.organization, user_id=member.id
        )
        assert member_om.role == "member"

    @with_feature({"organizations:team-roles": False})
    def test_can_update_from_retired_role_without_flag(self):
        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=self.organization, user=member, role="admin", teams=[]
        )

        with outbox_runner():
            self.get_success_response(self.organization.slug, member_om.id, role="member")

        member_om = OrganizationMember.objects.get(
            organization=self.organization, user_id=member.id
        )
        assert member_om.role == "member"
        self.assert_org_member_mapping(org_member=member_om)

    @with_feature("organizations:team-roles")
    def test_can_update_from_retired_role_with_flag(self):
        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=self.organization, user=member, role="admin", teams=[]
        )

        with outbox_runner():
            self.get_success_response(self.organization.slug, member_om.id, role="member")

        member_om = OrganizationMember.objects.get(
            organization=self.organization, user_id=member.id
        )
        assert member_om.role == "member"
        self.assert_org_member_mapping(org_member=member_om)

    @with_feature({"organizations:team-roles": False})
    def test_can_update_to_retired_role_without_flag(self):
        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=self.organization, user=member, role="member", teams=[]
        )

        with outbox_runner():
            self.get_success_response(self.organization.slug, member_om.id, role="admin")

        member_om = OrganizationMember.objects.get(
            organization=self.organization, user_id=member.id
        )
        assert member_om.role == "admin"
        self.assert_org_member_mapping(org_member=member_om)

    @with_feature("organizations:team-roles")
    def test_cannot_update_to_retired_role_with_flag(self):
        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=self.organization, user=member, role="member", teams=[]
        )

        self.get_error_response(self.organization.slug, member_om.id, role="admin", status_code=400)

        member_om = OrganizationMember.objects.get(
            organization=self.organization, user_id=member.id
        )
        assert member_om.role == "member"

    @patch("sentry.models.OrganizationMember.send_sso_link_email")
    def test_cannot_reinvite_normal_member(self, mock_send_sso_link_email):
        member = self.create_user("bar@example.com")
        member_om = self.create_member(organization=self.organization, user=member, role="member")

        self.get_error_response(self.organization.slug, member_om.id, reinvite=1, status_code=400)

    def test_cannot_lower_superior_role(self):
        owner = self.create_user("baz@example.com")
        owner_om = self.create_member(
            organization=self.organization, user=owner, role="owner", teams=[]
        )

        manager = self.create_user("foo@example.com")
        self.create_member(organization=self.organization, user=manager, role="manager", teams=[])
        self.login_as(manager)

        self.get_error_response(self.organization.slug, owner_om.id, role="member", status_code=403)

        owner_om = OrganizationMember.objects.get(organization=self.organization, user_id=owner.id)
        assert owner_om.role == "owner"

    def test_with_internal_integration(self):
        member = self.create_user("baz@example.com")
        member_om = self.create_member(organization=self.organization, user=member, role="member")
        internal_integration = self.create_internal_integration(
            name="my_app",
            organization=self.organization,
            scopes=("member:admin",),
            webhook_url="http://example.com",
        )
        token = self.create_internal_integration_token(
            user=self.user, internal_integration=internal_integration
        )

        response = self.client.put(
            reverse(self.endpoint, args=[self.organization.slug, member_om.id]),
            {"role": "manager"},
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
        )

        # The app token has no associated OrganizationMember and therefore no role.
        # So we can't authorize it to promote to a role less than or equal to its
        # own. This may be supported in the future. For now, assert that it provides
        # a graceful authorization failure.
        assert response.status_code == 400

    def test_cannot_update_partnership_member(self):
        member = self.create_user("bar@example.com")
        member_om = self.create_member(
            organization=self.organization,
            user=member,
            role="member",
            flags=OrganizationMember.flags["partnership:restricted"],
        )

        self.get_error_response(self.organization.slug, member_om.id, status_code=403)

    @patch(
        "sentry.roles.organization_roles.get",
        wraps=mock_organization_roles_get_factory(organization_roles.get),
    )
    def test_cannot_add_to_team_when_team_roles_disabled(self, mock_get):
        team = self.create_team(organization=self.organization, name="Team Foo")

        self.member = self.create_user()
        self.member_om = self.create_member(
            organization=self.organization, user=self.member, role="member", teams=[]
        )

        owner_user = self.create_user("owner@localhost")
        self.owner = self.create_member(
            user=owner_user, organization=self.organization, role="owner"
        )
        self.login_as(user=owner_user)

        response = self.get_error_response(
            self.organization.slug,
            self.member_om.id,
            teamRoles=[{"teamSlug": team.slug, "role": None}],
            status_code=400,
        )
        assert (
            response.data["detail"]
            == "The user with a 'member' role cannot have team-level permissions."
        )

    @patch(
        "sentry.roles.organization_roles.get",
        wraps=mock_organization_roles_get_factory(organization_roles.get),
    )
    def test_cannot_demote_team_member_to_role_where_team_roles_disabled(self, mock_get):
        team = self.create_team(organization=self.organization, name="Team Foo")

        self.manager = self.create_user()
        self.manager_om = self.create_member(
            organization=self.organization, user=self.manager, role="manager", teams=[team]
        )

        owner_user = self.create_user("owner@localhost")
        self.owner = self.create_member(
            user=owner_user, organization=self.organization, role="owner"
        )
        self.login_as(user=owner_user)

        response = self.get_error_response(
            self.organization.slug, self.manager_om.id, orgRole="member", status_code=400
        )
        assert (
            response.data["detail"]
            == "The user with a 'member' role cannot have team-level permissions."
        )

    @patch(
        "sentry.roles.organization_roles.get",
        wraps=mock_organization_roles_get_factory(organization_roles.get),
    )
    def test_can_demote_team_member_to_role_where_team_roles_disabled_with_team_removed(
        self, mock_get
    ):
        team = self.create_team(organization=self.organization, name="Team Foo")

        self.manager = self.create_user()
        self.manager_om = self.create_member(
            organization=self.organization, user=self.manager, role="manager", teams=[team]
        )

        owner_user = self.create_user("owner@localhost")
        self.owner = self.create_member(
            user=owner_user, organization=self.organization, role="owner"
        )
        self.login_as(user=owner_user)

        self.get_success_response(
            self.organization.slug, self.manager_om.id, orgRole="member", teamRoles=[]
        )

    @patch(
        "sentry.roles.organization_roles.get",
        wraps=mock_organization_roles_get_factory(organization_roles.get),
    )
    def test_can_promote_team_member_to_role_where_team_roles_enabled(self, mock_get):
        team = self.create_team(organization=self.organization, name="Team Foo")

        self.member = self.create_user()
        self.member_om = self.create_member(
            organization=self.organization, user=self.member, role="member", teams=[]
        )

        owner_user = self.create_user("owner@localhost")
        self.owner = self.create_member(
            user=owner_user, organization=self.organization, role="owner"
        )
        self.login_as(user=owner_user)

        self.get_success_response(
            self.organization.slug,
            self.member_om.id,
            teamRoles=[{"teamSlug": team.slug, "role": None}],
            orgRole="manager",
        )

    @patch("sentry.quotas.base.Quota.on_role_change")
    def test_on_role_change_called_when_role_updated(self, mock_on_role_change):
        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=self.organization, user=member, role="member", teams=[]
        )

        with outbox_runner():
            self.get_success_response(self.organization.slug, member_om.id, role="manager")

        mock_on_role_change.assert_called_once_with(
            organization=self.organization,
            organization_member=member_om,
            previous_role="member",
            new_role="manager",
        )

    @patch("sentry.quotas.base.Quota.on_role_change")
    def test_on_role_change_not_called_when_role_unchanged(self, mock_on_role_change):
        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=self.organization, user=member, role="member", teams=[]
        )

        # Update something else but keep role the same
        self.get_success_response(self.organization.slug, member_om.id, teams=[])

        mock_on_role_change.assert_not_called()

    @patch("sentry.quotas.base.Quota.on_role_change")
    def test_on_role_change_not_called_when_reinviting(self, mock_on_role_change):
        member_om = self.create_member(
            organization=self.organization, email="foo@example.com", role="member"
        )

        self.get_success_response(self.organization.slug, member_om.id, reinvite=1)

        mock_on_role_change.assert_not_called()


class DeleteOrganizationMemberTest(OrganizationMemberTestBase):
    method = "delete"

    def setUp(self):
        super().setUp()

        self.curr_user = self.create_user("member@example.com")
        self.curr_member = self.create_member(
            organization=self.organization, role="member", user=self.curr_user
        )
        self.other_user = self.create_user("other@example.com")
        self.other_member = self.create_member(
            organization=self.organization, role="member", user=self.other_user
        )

    def test_simple(self):
        member = self.create_user("bar@example.com")
        member_om = self.create_member(organization=self.organization, user=member, role="member")

        self.get_success_response(self.organization.slug, member_om.id)

        assert not OrganizationMember.objects.filter(id=member_om.id).exists()

    def test_simple_related_user_options_are_deleted(self):
        """
        Test that ensures that when a member is removed from an org, their corresponding
        `UserOption` instances for that the projects in that org are deleted as well
        """
        org = self.create_organization()
        project2 = self.create_project(organization=org)
        member = self.create_user("ahmed@ahmed.io")
        with assume_test_silo_mode(SiloMode.CONTROL):
            u1 = UserOption.objects.create(
                user=member, project_id=self.project.id, key="mail:email", value="ahmed@ahmed.io"
            )
            u2 = UserOption.objects.create(
                user=member, project_id=project2.id, key="mail:email", value="ahmed@ahmed.io"
            )

        member_om = self.create_member(organization=self.organization, user=member, role="member")

        self.get_success_response(self.organization.slug, member_om.id)

        assert not OrganizationMember.objects.filter(id=member_om.id).exists()
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not UserOption.objects.filter(id=u1.id).exists()
            # Ensure that `UserOption` for a user in a different org does not get
            # deleted when that same member is deleted from another org
            assert UserOption.objects.filter(id=u2.id).exists()

    def test_invalid_id(self):
        member = self.create_user("bar@example.com")
        self.create_member(organization=self.organization, user=member, role="member")

        self.get_error_response(self.organization.slug, "trash", status_code=404)

    def test_cannot_delete_member_with_higher_access(self):
        other_user = self.create_user("bar@example.com")

        self.create_member(organization=self.organization, role="manager", user=other_user)

        owner_om = OrganizationMember.objects.get(
            organization=self.organization, user_id=self.user.id
        )

        assert owner_om.role == "owner"

        self.login_as(other_user)
        self.get_error_response(self.organization.slug, owner_om.id, status_code=400)

        assert OrganizationMember.objects.filter(id=owner_om.id).exists()

    def test_cannot_delete_only_owner(self):
        # create a pending member, which shouldn't be counted in the checks
        self.create_member(organization=self.organization, role="owner", email="bar@example.com")

        owner_om = OrganizationMember.objects.get(
            organization=self.organization, user_id=self.user.id
        )

        assert owner_om.role == "owner"

        self.get_error_response(self.organization.slug, owner_om.id, status_code=403)

        assert OrganizationMember.objects.filter(id=owner_om.id).exists()

    def test_can_delete_self(self):
        other_user = self.create_user("bar@example.com")
        self.create_member(organization=self.organization, role="member", user=other_user)

        self.login_as(other_user)
        self.get_success_response(self.organization.slug, "me")

        assert not OrganizationMember.objects.filter(
            user_id=other_user.id, organization=self.organization
        ).exists()

    def test_missing_scope(self):
        no_scope_user = self.create_user("bar@example.com")
        self.create_member(organization=self.organization, role="member", user=no_scope_user)

        member_user = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=self.organization, role="member", user=member_user
        )

        self.login_as(no_scope_user)
        self.get_error_response(self.organization.slug, member_om.id, status_code=400)

        assert OrganizationMember.objects.filter(id=member_om.id).exists()

    def test_cannot_delete_unapproved_invite(self):
        join_request = self.create_member(
            organization=self.organization,
            email="test@gmail.com",
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )

        invite_request = self.create_member(
            organization=self.organization,
            email="test2@gmail.com",
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )

        self.get_error_response(self.organization.slug, join_request.id, status_code=404)
        self.get_error_response(self.organization.slug, invite_request.id, status_code=404)

    def test_disabled_member_can_remove(self):
        other_user = self.create_user("bar@example.com")
        self.create_member(
            organization=self.organization,
            role="member",
            user=other_user,
            flags=OrganizationMember.flags["member-limit:restricted"],
        )

        self.login_as(other_user)
        self.get_success_response(self.organization.slug, "me")

        assert not OrganizationMember.objects.filter(
            user_id=other_user.id, organization=self.organization
        ).exists()

    def test_cannot_delete_idp_provisioned_member(self):
        member = self.create_user("bar@example.com")
        member_om = self.create_member(
            organization=self.organization,
            user=member,
            role="member",
            flags=OrganizationMember.flags["idp:provisioned"],
        )

        self.get_error_response(self.organization.slug, member_om.id)

        assert OrganizationMember.objects.filter(id=member_om.id).exists()

    def test_can_delete_pending_invite(self):
        invite = self.create_member(
            organization=self.organization, user=None, email="invitee@example.com", role="member"
        )
        self.get_success_response(self.organization.slug, invite.id)

    def test_cannot_delete_partnership_member(self):
        member = self.create_user("bar@example.com")
        member_om = self.create_member(
            organization=self.organization,
            user=member,
            role="member",
            flags=OrganizationMember.flags["partnership:restricted"],
        )

        self.get_error_response(self.organization.slug, member_om.id, status_code=403)

    def test_member_delete_pending_invite(self):
        curr_invite = self.create_member(
            organization=self.organization,
            user=None,
            email="member_invite@example.com",
            role="member",
            inviter_id=self.curr_user.id,
        )
        other_invite = self.create_member(
            organization=self.organization,
            user=None,
            email="other_invite@example.com",
            role="member",
            inviter_id=self.other_user.id,
        )

        self.login_as(self.curr_user)

        self.organization.flags.disable_member_invite = True
        self.organization.save()
        self.get_error_response(self.organization.slug, curr_invite.id, status_code=400)
        self.get_error_response(self.organization.slug, curr_invite.id, status_code=400)

        self.organization.flags.disable_member_invite = False
        self.organization.save()
        self.get_success_response(self.organization.slug, curr_invite.id)
        self.get_error_response(self.organization.slug, other_invite.id, status_code=400)

    def test_member_cannot_delete_members(self):
        self.login_as(self.curr_user)

        self.organization.flags.disable_member_invite = True
        self.organization.save()
        self.get_error_response(self.organization.slug, self.other_member.id, status_code=400)

        self.organization.flags.disable_member_invite = False
        self.organization.save()
        self.get_error_response(self.organization.slug, self.other_member.id, status_code=400)

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_cannot_delete_as_superuser_read(self):
        superuser = self.create_user(is_superuser=True)
        self.login_as(superuser, superuser=True)

        member = self.create_user("bar@example.com")
        member_om = self.create_member(
            organization=self.organization,
            user=member,
            role="member",
        )

        self.get_error_response(self.organization.slug, member_om.id, status_code=400)

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_can_delete_as_superuser_write(self):
        superuser = self.create_user(is_superuser=True)
        self.add_user_permission(superuser, "superuser.write")
        self.login_as(superuser, superuser=True)

        member = self.create_user("bar@example.com")
        member_om = self.create_member(
            organization=self.organization,
            user=member,
            role="member",
        )

        self.get_success_response(self.organization.slug, member_om.id)

    def test_related_invitations_are_deleted(self):
        manager_user = self.create_user("manager@localhost")
        self.manager = self.create_member(
            user=manager_user, organization=self.organization, role="manager"
        )
        self.login_as(user=manager_user)

        assert not OrganizationMember.objects.filter(inviter_id=manager_user.id).exists()

        # invite request
        data = {"email": "foo@example.com", "role": "member", "teams": [self.team.slug]}
        url = reverse(
            "sentry-api-0-organization-invite-request-index", args=(self.organization.slug,)
        )
        self.client.post(url, data=data)

        # pending invite
        data = {"email": "bar@example.com", "role": "member", "teams": [self.team.slug]}
        url = reverse("sentry-api-0-organization-member-index", args=(self.organization.slug,))
        self.client.post(url, data=data)

        assert OrganizationMember.objects.filter(inviter_id=manager_user.id).count() == 2

        # manager leaves
        self.get_success_response(self.organization.slug, self.manager.id)

        assert not OrganizationMember.objects.filter(inviter_id=manager_user.id).exists()

    def test_invitations_dont_get_deleted_on_invite_detetion(self):
        # create manager
        manager_user = self.create_user("manager@localhost")
        self.manager = self.create_member(
            user=manager_user, organization=self.organization, role="manager"
        )
        user = self.create_user("user@org.com")
        # create approved member with token -- before the fix for inc-886 this member would get deleted
        # because they look like a invite with a token
        self.create_member(
            user=user, organization=self.organization, role="member", token="x123x", inviter_id=None
        )

        self.login_as(user=manager_user)
        # pending invite
        data = {"email": "bar@example.com", "role": "member", "teams": [self.team.slug]}
        url = reverse("sentry-api-0-organization-member-index", args=(self.organization.slug,))
        self.client.post(url, data=data)

        members_and_invites_count_before = OrganizationMember.objects.filter(
            organization_id=self.organization.id
        ).count()

        invited_member = OrganizationMember.objects.get(inviter_id=manager_user.id)
        # manager deletes the invite sent by them
        self.get_success_response(self.organization.slug, invited_member.id)

        members_and_invites_count_after = OrganizationMember.objects.filter(
            organization_id=self.organization.id
        ).count()
        # only one is deleted which is the invite
        assert members_and_invites_count_after == members_and_invites_count_before - 1
        assert not OrganizationMember.objects.filter(inviter_id=manager_user.id).exists()


class ResetOrganizationMember2faTest(APITestCase):
    def setUp(self):
        self.owner = self.create_user()
        self.org = self.create_organization(owner=self.owner)

        self.member = self.create_user()
        self.member_om = self.create_member(
            organization=self.org, user=self.member, role="member", teams=[]
        )
        self.login_as(self.member)

        with assume_test_silo_mode(SiloMode.CONTROL):
            totp = TotpInterface()
            totp.enroll(self.member)
            assert totp.authenticator is not None
            self.interface_id = totp.authenticator.id
            assert Authenticator.objects.filter(user=self.member).exists()

    def assert_can_get_authenticators(self):
        path = reverse(
            "sentry-api-0-organization-member-details", args=[self.org.slug, self.member_om.id]
        )
        resp = self.client.get(path)
        assert resp.status_code == 200
        data = resp.data

        assert len(data["user"]["authenticators"]) == 1
        assert data["user"]["has2fa"] is True
        assert data["user"]["canReset2fa"] is True

    def assert_cannot_get_authenticators(self):
        path = reverse(
            "sentry-api-0-organization-member-details", args=[self.org.slug, self.member_om.id]
        )
        resp = self.client.get(path)
        assert resp.status_code == 200
        data = resp.data

        assert "authenticators" not in data["user"]
        assert "canReset2fa" not in data["user"]

    @assume_test_silo_mode(SiloMode.CONTROL)
    def assert_can_remove_authenticators(self):
        path = reverse(
            "sentry-api-0-user-authenticator-details", args=[self.member.id, self.interface_id]
        )
        resp = self.client.delete(path)
        assert resp.status_code == 204
        assert not Authenticator.objects.filter(user=self.member).exists()

    @assume_test_silo_mode(SiloMode.CONTROL)
    def assert_cannot_remove_authenticators(self):
        path = reverse(
            "sentry-api-0-user-authenticator-details", args=[self.member.id, self.interface_id]
        )
        resp = self.client.delete(path)
        assert resp.status_code == 403
        assert Authenticator.objects.filter(user=self.member).exists()

    @patch("sentry.security.utils.generate_security_email")
    def test_org_owner_can_reset_member_2fa(self, mock_generate_security_email):
        self.login_as(self.owner)

        self.assert_can_get_authenticators()
        self.assert_can_remove_authenticators()

        mock_generate_security_email.assert_called_once()

    def test_owner_must_have_org_membership(self):
        owner = self.create_user()
        self.create_organization(owner=owner)
        self.login_as(owner)

        path = reverse(
            "sentry-api-0-organization-member-details", args=[self.org.slug, self.member_om.id]
        )
        resp = self.client.get(path)
        assert resp.status_code == 403

        self.assert_cannot_remove_authenticators()

    @patch("sentry.security.utils.generate_security_email")
    def test_org_manager_can_reset_member_2fa(self, mock_generate_security_email):
        manager = self.create_user()
        self.create_member(organization=self.org, user=manager, role="manager", teams=[])
        self.login_as(manager)

        self.assert_can_get_authenticators()
        self.assert_can_remove_authenticators()

        mock_generate_security_email.assert_called_once()

    def test_org_admin_cannot_reset_member_2fa(self):
        admin = self.create_user()
        self.create_member(organization=self.org, user=admin, role="admin", teams=[])
        self.login_as(admin)

        self.assert_cannot_get_authenticators()
        self.assert_cannot_remove_authenticators()

    def test_org_member_cannot_reset_member_2fa(self):
        member = self.create_user()
        self.create_member(organization=self.org, user=member, role="member", teams=[])
        self.login_as(member)

        self.assert_cannot_get_authenticators()
        self.assert_cannot_remove_authenticators()

    def test_cannot_reset_member_2fa__has_multiple_org_membership(self):
        self.create_organization(owner=self.member)
        self.login_as(self.owner)

        path = reverse(
            "sentry-api-0-organization-member-details", args=[self.org.slug, self.member_om.id]
        )
        resp = self.client.get(path)
        assert resp.status_code == 200
        data = resp.data

        assert len(data["user"]["authenticators"]) == 1
        assert data["user"]["has2fa"] is True
        assert data["user"]["canReset2fa"] is False

        self.assert_cannot_remove_authenticators()

    def test_cannot_reset_member_2fa__org_requires_2fa(self):
        self.login_as(self.owner)
        with assume_test_silo_mode(SiloMode.CONTROL):
            TotpInterface().enroll(self.owner)

        self.org.update(flags=F("flags").bitor(Organization.flags.require_2fa))
        assert self.org.flags.require_2fa.is_set is True

        self.assert_cannot_remove_authenticators()

    @assume_test_silo_mode(SiloMode.CONTROL)
    def test_owner_can_only_reset_member_2fa(self):
        self.login_as(self.owner)

        path = reverse(
            "sentry-api-0-user-authenticator-details", args=[self.member.id, self.interface_id]
        )
        resp = self.client.get(path)
        assert resp.status_code == 403

        # cannot regenerate recovery codes
        recovery = RecoveryCodeInterface()
        recovery.enroll(self.user)
        assert recovery.authenticator, "authenticator should exist"

        path = reverse(
            "sentry-api-0-user-authenticator-details",
            args=[self.member.id, recovery.authenticator.id],
        )
        resp = self.client.put(path)
        assert resp.status_code == 403

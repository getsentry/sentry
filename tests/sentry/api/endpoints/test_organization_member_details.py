from unittest.mock import patch

from django.core import mail
from django.db.models import F
from django.urls import reverse

from sentry.auth.authenticators import RecoveryCodeInterface, TotpInterface
from sentry.models import (
    Authenticator,
    AuthProvider,
    InviteStatus,
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    SentryAppInstallationToken,
    UserOption,
)
from sentry.testutils import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import region_silo_test


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
            organization=self.organization, user=user, role="member"
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

    def test_superuser_can_get_invite_link(self):
        pending_om = self.create_member(
            user=None,
            email="bar@example.com",
            organization=self.organization,
            role="member",
            teams=[],
        )

        response = self.get_success_response(self.organization.slug, pending_om.id)
        assert response.data["invite_link"] == pending_om.get_invite_link()

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


@region_silo_test
class UpdateOrganizationMemberTest(OrganizationMemberTestBase):
    method = "put"

    def test_invalid_id(self):
        self.get_error_response(self.organization.slug, "trash", reinvite=1, status_code=404)

    @patch("sentry.models.OrganizationMember.send_invite_email")
    def test_reinvite_pending_member(self, mock_send_invite_email):
        member_om = self.create_member(
            organization=self.organization, email="foo@example.com", role="member"
        )

        self.get_success_response(self.organization.slug, member_om.id, reinvite=1)
        mock_send_invite_email.assert_called_once_with()

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
        assert response.data["invite_link"] == member_om.get_invite_link()

    @patch("sentry.models.OrganizationMember.send_invite_email")
    def test_reinvite_invite_expired_member(self, mock_send_invite_email):
        member = self.create_member(
            organization=self.organization,
            email="foo@example.com",
            role="member",
            token_expires_at="2018-10-20 00:00:00",
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
            token_expires_at="2018-10-20 00:00:00",
        )

        self.get_success_response(self.organization.slug, member.id, reinvite=1, regenerate=1)

        mock_send_invite_email.assert_called_once_with()

        member = OrganizationMember.objects.get(pk=member.id)
        assert member.token_expired is False

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
        AuthProvider.objects.create(organization_id=self.organization.id, provider="dummy", flags=1)

        with self.tasks():
            self.get_success_response(self.organization.slug, member_om.id, reinvite=1)

        assert len(mail.outbox) == 1

    def test_can_update_member_membership(self):
        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=self.organization, user=member, role="member", teams=[]
        )

        self.get_success_response(self.organization.slug, member_om.id, role="manager")
        member_om = OrganizationMember.objects.get(id=member_om.id)
        assert member_om.role == "manager"

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

        self.get_success_response(self.organization.slug, member_om.id, role="manager")

        member_om = OrganizationMember.objects.get(organization=self.organization, user=member)
        assert member_om.role == "manager"

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

        member_om = OrganizationMember.objects.get(organization=self.organization, user=member)
        assert member_om.role == "member"

    def test_cannot_update_idp_role_restricted_member_role(self):
        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=self.organization,
            user=member,
            role="member",
            teams=[],
            flags=OrganizationMember.flags["idp:role-restricted"],
        )

        self.get_error_response(
            self.organization.slug, member_om.id, role="manager", status_code=403
        )

        member_om = OrganizationMember.objects.get(organization=self.organization, user=member)
        assert member_om.role == "member"

    @with_feature({"organizations:team-roles": False})
    def test_can_update_from_retired_role_without_flag(self):
        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=self.organization, user=member, role="admin", teams=[]
        )

        self.get_success_response(self.organization.slug, member_om.id, role="member")

        member_om = OrganizationMember.objects.get(organization=self.organization, user=member)
        assert member_om.role == "member"

    @with_feature("organizations:team-roles")
    def test_can_update_from_retired_role_with_flag(self):
        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=self.organization, user=member, role="admin", teams=[]
        )

        self.get_success_response(self.organization.slug, member_om.id, role="member")

        member_om = OrganizationMember.objects.get(organization=self.organization, user=member)
        assert member_om.role == "member"

    @with_feature({"organizations:team-roles": False})
    def test_can_update_to_retired_role_without_flag(self):
        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=self.organization, user=member, role="member", teams=[]
        )

        self.get_success_response(self.organization.slug, member_om.id, role="admin")

        member_om = OrganizationMember.objects.get(organization=self.organization, user=member)
        assert member_om.role == "admin"

    @with_feature("organizations:team-roles")
    def test_cannot_update_to_retired_role_with_flag(self):
        member = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=self.organization, user=member, role="member", teams=[]
        )

        self.get_error_response(self.organization.slug, member_om.id, role="admin", status_code=400)

        member_om = OrganizationMember.objects.get(organization=self.organization, user=member)
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

        owner_om = OrganizationMember.objects.get(organization=self.organization, user=owner)
        assert owner_om.role == "owner"

    def test_with_internal_integration(self):
        member = self.create_user("baz@example.com")
        member_om = self.create_member(organization=self.organization, user=member, role="member")
        self.create_internal_integration(
            name="my_app",
            organization=self.organization,
            scopes=("member:admin",),
            webhook_url="http://example.com",
        )
        # there should only be one record created so just grab the first one
        token = SentryAppInstallationToken.objects.first()

        response = self.client.put(
            reverse(self.endpoint, args=[self.organization.slug, member_om.id]),
            {"role": "manager"},
            HTTP_AUTHORIZATION=f"Bearer {token.api_token.token}",
        )

        # The app token has no associated OrganizationMember and therefore no role.
        # So we can't authorize it to promote to a role less than or equal to its
        # own. This may be supported in the future. For now, assert that it provides
        # a graceful authorization failure.
        assert response.status_code == 400


@region_silo_test
class DeleteOrganizationMemberTest(OrganizationMemberTestBase):
    method = "delete"

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
        u1 = UserOption.objects.create(
            user=member, project_id=self.project.id, key="mail:email", value="ahmed@ahmed.io"
        )
        u2 = UserOption.objects.create(
            user=member, project_id=project2.id, key="mail:email", value="ahmed@ahmed.io"
        )

        member_om = self.create_member(organization=self.organization, user=member, role="member")

        self.get_success_response(self.organization.slug, member_om.id)

        assert not OrganizationMember.objects.filter(id=member_om.id).exists()
        assert not UserOption.objects.filter(id=u1.id).exists()
        # Ensure that `UserOption` for a user in a different org does not get deleted when that
        # same member is deleted from another org
        assert UserOption.objects.filter(id=u2.id).exists()

    def test_invalid_id(self):
        member = self.create_user("bar@example.com")
        self.create_member(organization=self.organization, user=member, role="member")

        self.get_error_response(self.organization.slug, "trash", status_code=404)

    def test_cannot_delete_member_with_higher_access(self):
        other_user = self.create_user("bar@example.com")

        self.create_member(organization=self.organization, role="manager", user=other_user)

        owner_om = OrganizationMember.objects.get(organization=self.organization, user=self.user)

        assert owner_om.role == "owner"

        self.login_as(other_user)
        self.get_error_response(self.organization.slug, owner_om.id, status_code=400)

        assert OrganizationMember.objects.filter(id=owner_om.id).exists()

    def test_cannot_delete_only_owner(self):
        # create a pending member, which shouldn't be counted in the checks
        self.create_member(organization=self.organization, role="owner", email="bar@example.com")

        owner_om = OrganizationMember.objects.get(organization=self.organization, user=self.user)

        assert owner_om.role == "owner"

        self.get_error_response(self.organization.slug, owner_om.id, status_code=403)

        assert OrganizationMember.objects.filter(id=owner_om.id).exists()

    def test_can_delete_owner_if_other_owners_through_teams(self):
        # two members of an owner team
        member = self.create_user("bar@example.com")
        member2 = self.create_user("foo@example.com")
        team = self.create_team(org_role="owner")
        owner = self.create_member(
            organization=self.organization, role="member", user=member, teams=[team]
        )
        self.create_member(
            organization=self.organization, role="member", user=member2, teams=[team]
        )

        self.login_as(member)
        self.get_success_response(self.organization.slug, owner.id)

        assert not OrganizationMember.objects.filter(id=owner.id).exists()

    def test_can_delete_self(self):
        other_user = self.create_user("bar@example.com")
        self.create_member(organization=self.organization, role="member", user=other_user)

        self.login_as(other_user)
        self.get_success_response(self.organization.slug, "me")

        assert not OrganizationMember.objects.filter(
            user=other_user, organization=self.organization
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
            user=other_user, organization=self.organization
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

    def test_can_delete_with_org_role_from_team(self):
        member = self.create_user("bar@example.com")
        team = self.create_team(org_role="manager")
        self.create_member(organization=self.organization, user=member, role="member", teams=[team])

        member_user = self.create_user("baz@example.com")
        member_om = self.create_member(
            organization=self.organization, role="manager", user=member_user
        )

        self.login_as(member)
        self.get_success_response(self.organization.slug, member_om.id)

        assert not OrganizationMember.objects.filter(
            user=member_user, organization=self.organization
        ).exists()


@region_silo_test
class ResetOrganizationMember2faTest(APITestCase):
    def setUp(self):
        self.owner = self.create_user()
        self.org = self.create_organization(owner=self.owner)

        self.member = self.create_user()
        self.member_om = self.create_member(
            organization=self.org, user=self.member, role="member", teams=[]
        )
        self.login_as(self.member)
        totp = TotpInterface()
        totp.enroll(self.member)
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

    def assert_can_remove_authenticators(self):
        path = reverse(
            "sentry-api-0-user-authenticator-details", args=[self.member.id, self.interface_id]
        )
        resp = self.client.delete(path)
        assert resp.status_code == 204
        assert not Authenticator.objects.filter(user=self.member).exists()

    def assert_cannot_remove_authenticators(self):
        path = reverse(
            "sentry-api-0-user-authenticator-details", args=[self.member.id, self.interface_id]
        )
        resp = self.client.delete(path)
        assert resp.status_code == 403
        assert Authenticator.objects.filter(user=self.member).exists()

    def test_org_owner_can_reset_member_2fa(self):
        self.login_as(self.owner)

        self.assert_can_get_authenticators()
        self.assert_can_remove_authenticators()

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

    def test_org_manager_can_reset_member_2fa(self):
        manager = self.create_user()
        self.create_member(organization=self.org, user=manager, role="manager", teams=[])
        self.login_as(manager)

        self.assert_can_get_authenticators()
        self.assert_can_remove_authenticators()

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
        TotpInterface().enroll(self.owner)

        self.org.update(flags=F("flags").bitor(Organization.flags.require_2fa))
        assert self.org.flags.require_2fa.is_set is True

        self.assert_cannot_remove_authenticators()

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
        path = reverse(
            "sentry-api-0-user-authenticator-details",
            args=[self.member.id, recovery.authenticator.id],
        )
        resp = self.client.put(path)
        assert resp.status_code == 403

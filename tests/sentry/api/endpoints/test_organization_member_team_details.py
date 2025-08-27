from functools import cached_property
from unittest.mock import MagicMock, patch

from django.test import override_settings
from rest_framework import status

from sentry.api.endpoints.organization_member.team_details import ERR_INSUFFICIENT_ROLE
from sentry.auth import access
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupsubscription import GroupSubscription
from sentry.models.organization import Organization
from sentry.models.organizationaccessrequest import OrganizationAccessRequest
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.notifications.types import GroupSubscriptionReason
from sentry.roles import organization_roles
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.options import override_options
from tests.sentry.api.endpoints.test_organization_member_index import (
    mock_organization_roles_get_factory,
)


class OrganizationMemberTeamTestBase(APITestCase):
    endpoint = "sentry-api-0-organization-member-team-details"

    @cached_property
    def org(self):
        # open membership
        return self.create_organization(owner=self.user, flags=Organization.flags.allow_joinleave)

    @cached_property
    def team(self):
        return self.create_team(organization=self.org)

    @cached_property
    def idp_team(self):
        return self.create_team(organization=self.org, idp_provisioned=True)

    @cached_property
    def owner(self):
        return OrganizationMember.objects.get(organization=self.org, user_id=self.user.id)

    @cached_property
    def member(self):
        return self.create_member(organization=self.org, user=self.create_user(), role="member")

    @cached_property
    def admin(self):
        self.admin_user = self.create_user()
        return self.create_member(organization=self.org, user=self.admin_user, role="admin")

    @cached_property
    def manager(self):
        self.manager_user = self.create_user()
        return self.create_member(organization=self.org, user=self.manager_user, role="manager")

    @cached_property
    def member_on_team(self):
        self.member_on_team_user = self.create_user()
        return self.create_member(
            organization=self.org, user=self.member_on_team_user, role="member", teams=[self.team]
        )

    @cached_property
    def admin_on_team(self):
        self.admin_on_team_user = self.create_user()
        return self.create_member(
            organization=self.org, user=self.admin_on_team_user, role="admin", teams=[self.team]
        )

    @cached_property
    def manager_on_team(self):
        return self.create_member(
            organization=self.org, user=self.create_user(), role="manager", teams=[self.team]
        )

    @cached_property
    def owner_on_team(self):
        return self.create_member(
            organization=self.org, user=self.create_user(), role="owner", teams=[self.team]
        )

    @cached_property
    def team_admin(self):
        self.team_admin_user = self.create_user()
        member = self.create_member(organization=self.org, user=self.team_admin_user, role="member")
        OrganizationMemberTeam.objects.create(
            team=self.team, organizationmember=member, role="admin"
        )
        return member


class CreateOrganizationMemberTeamTest(OrganizationMemberTeamTestBase):
    method = "post"

    def test_manager_can_join_team(self) -> None:
        self.login_as(self.manager)
        self.get_success_response(
            self.org.slug, self.manager.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.manager
        ).exists()

    def test_owner_can_join_team(self) -> None:
        owner = self.create_member(organization=self.org, user=self.create_user(), role="owner")
        self.login_as(owner)
        self.get_success_response(
            self.org.slug, owner.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=owner
        ).exists()

    def test_admin_on_team_can_add_members_to_team(self) -> None:
        self.login_as(self.admin_on_team)

        # member
        self.get_success_response(
            self.org.slug, self.member.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

        # manager
        self.get_success_response(
            self.org.slug, self.manager.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.manager
        ).exists()

    def test_manager_can_add_members_to_team(self) -> None:
        self.login_as(self.manager)

        # member
        self.get_success_response(
            self.org.slug, self.member.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

        # owner
        self.get_success_response(
            self.org.slug, self.owner.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.owner.id
        ).exists()

    def test_owner_can_add_members_to_team(self) -> None:
        self.login_as(self.owner)

        # member
        self.get_success_response(
            self.org.slug, self.member.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

        # manager
        self.get_success_response(
            self.org.slug, self.manager.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.manager
        ).exists()

        # owner
        target_owner = self.create_member(
            organization=self.org, user=self.create_user(), role="owner"
        )
        self.get_success_response(
            self.org.slug, target_owner.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=target_owner
        ).exists()

    @patch(
        "sentry.roles.organization_roles.get",
        wraps=mock_organization_roles_get_factory(organization_roles.get),
    )
    def test_cannot_add_to_team_when_team_roles_disabled(self, mock_get: MagicMock) -> None:
        self.login_as(self.manager)
        response = self.get_error_response(
            self.org.slug, self.member.id, self.team.slug, status_code=403
        )
        assert (
            response.data["detail"]
            == "The user with a 'member' role cannot have team-level permissions."
        )


class CreateWithOpenMembershipTest(OrganizationMemberTeamTestBase):
    method = "post"

    def test_member_can_join_team(self) -> None:
        self.login_as(self.member)
        self.get_success_response(
            self.org.slug, self.member.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

    def test_admin_can_join_team(self) -> None:
        self.login_as(self.admin)
        self.get_success_response(
            self.org.slug, self.admin.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.admin
        ).exists()

    def test_cannot_join_idp_team(self) -> None:
        self.login_as(self.admin)
        self.get_error_response(self.org.slug, self.admin.id, self.idp_team.slug, status_code=403)

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.admin
        ).exists()

        self.login_as(self.member)
        self.get_error_response(self.org.slug, self.member.id, self.idp_team.slug, status_code=403)

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

    def test_member_can_add_member_to_team(self) -> None:
        target_member = self.create_member(
            organization=self.org, user=self.create_user(), role="member"
        )

        self.login_as(self.member)
        self.get_success_response(
            self.org.slug, target_member.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=target_member
        ).exists()

    def test_admin_can_add_member_to_team(self) -> None:
        self.login_as(self.admin)
        self.get_success_response(
            self.org.slug, self.member.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

    def test_cannot_add_to_idp_team(self) -> None:
        target_member = self.create_member(
            organization=self.org, user=self.create_user(), role="member"
        )

        self.login_as(self.member)
        self.get_error_response(
            self.org.slug, target_member.id, self.idp_team.slug, status_code=403
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=target_member
        ).exists()

        self.login_as(self.admin)
        self.get_error_response(self.org.slug, self.member.id, self.idp_team.slug, status_code=403)

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

    @with_feature("organizations:team-roles")
    def test_team_admin_can_add_member(self) -> None:
        self.login_as(self.team_admin)

        self.get_success_response(
            self.org.slug, self.member.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()


class CreateWithClosedMembershipTest(CreateOrganizationMemberTeamTest):
    @cached_property
    def org(self):
        # rerun create org member tests with closed membership
        return self.create_organization(owner=self.user, flags=0)

    def test_member_must_request_access_to_join_team(self) -> None:
        self.login_as(self.member)
        self.get_success_response(
            self.org.slug, self.member.id, self.team.slug, status_code=status.HTTP_202_ACCEPTED
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

        assert OrganizationAccessRequest.objects.filter(
            team=self.team, member=self.member, requester_id=None
        ).exists()

    def test_admin_must_request_access_to_join_team(self) -> None:
        self.login_as(self.admin)
        self.get_success_response(
            self.org.slug, self.admin.id, self.team.slug, status_code=status.HTTP_202_ACCEPTED
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.admin
        ).exists()

        assert OrganizationAccessRequest.objects.filter(
            team=self.team, member=self.admin, requester_id=None
        ).exists()

    def test_member_on_team_must_request_access_to_add_member_to_team(self) -> None:
        self.login_as(self.member_on_team)
        self.get_success_response(
            self.org.slug, self.member.id, self.team.slug, status_code=status.HTTP_202_ACCEPTED
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

        assert OrganizationAccessRequest.objects.filter(
            team=self.team, member=self.member, requester_id=self.member_on_team.user_id
        ).exists()

    def test_admin_must_request_access_to_add_member_to_team(self) -> None:
        # admin not in the team
        self.login_as(self.admin)
        self.get_success_response(
            self.org.slug, self.member.id, self.team.slug, status_code=status.HTTP_202_ACCEPTED
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

        assert OrganizationAccessRequest.objects.filter(
            team=self.team, member=self.member, requester_id=self.admin.user_id
        ).exists()

    @with_feature("organizations:team-roles")
    def test_team_admin_can_add_member(self) -> None:
        self.login_as(self.team_admin)

        self.get_success_response(
            self.org.slug, self.member.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

    @with_feature("organizations:team-roles")
    def test_team_admin_can_add_member_using_user_token(self) -> None:
        self.login_as(self.team_admin)

        # Team admins needs both org:read and team:write to pass the permissions checks when open
        # membership is off
        token = self.create_user_auth_token(
            user=self.team_admin_user, scope_list=["org:read", "team:write"]
        )

        self.get_success_response(
            self.org.slug,
            self.member.id,
            self.team.slug,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
            status_code=status.HTTP_201_CREATED,
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

    def test_integration_token_needs_elevated_permissions(self) -> None:
        internal_integration = self.create_internal_integration(
            name="Internal App", organization=self.org, scopes=["org:read"]
        )
        # Integration tokens with org:read should generate an access request when open membership is off
        integration_token = self.create_internal_integration_token(
            user=self.user, internal_integration=internal_integration
        )

        self.get_success_response(
            self.org.slug,
            self.member.id,
            self.team.slug,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {integration_token.token}"},
            status_code=status.HTTP_202_ACCEPTED,
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

        assert OrganizationAccessRequest.objects.filter(
            team=self.team,
            member=self.member,
        ).exists()

    def test_multiple_of_the_same_access_request(self) -> None:
        self.login_as(self.member)
        self.get_success_response(
            self.org.slug, self.admin.id, self.team.slug, status_code=status.HTTP_202_ACCEPTED
        )

        self.login_as(self.member_on_team)
        self.get_success_response(
            self.org.slug, self.admin.id, self.team.slug, status_code=status.HTTP_202_ACCEPTED
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.admin
        ).exists()

        oar = OrganizationAccessRequest.objects.get(team=self.team, member=self.admin)
        assert oar.requester_id == self.member.user_id


class DeleteOrganizationMemberTeamTest(OrganizationMemberTeamTestBase):
    method = "delete"

    def test_member_can_leave(self) -> None:
        self.login_as(self.member_on_team)
        response = self.get_success_response(
            self.org.slug, self.member_on_team.id, self.team.slug, status_code=status.HTTP_200_OK
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member_on_team
        ).exists()
        assert response.data["isMember"] is False

    def test_member_can_leave_without_membership(self) -> None:
        self.login_as(self.member)
        self.get_success_response(
            self.org.slug, self.member.id, self.team.slug, status_code=status.HTTP_200_OK
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

    def test_can_leave_as_superuser_without_membership(self) -> None:
        superuser = self.create_user(is_superuser=True)
        member = self.create_member(organization=self.org, user=superuser, role="member", teams=[])

        self.login_as(member)
        self.get_success_response(
            self.org.slug, member.id, self.team.slug, status_code=status.HTTP_200_OK
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=member
        ).exists()

    def test_member_cannot_remove_member(self) -> None:
        target_member = self.create_member(
            organization=self.org, user=self.create_user(), role="member", teams=[self.team]
        )

        self.login_as(self.member_on_team)
        self.get_error_response(
            self.org.slug,
            target_member.id,
            self.team.slug,
            status_code=400,
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=target_member
        ).exists()

    def test_admin_cannot_remove_member(self) -> None:
        # admin not in team
        self.login_as(self.admin)
        self.get_error_response(
            self.org.slug,
            self.member_on_team.id,
            self.team.slug,
            status_code=400,
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member_on_team
        ).exists()

    def test_admin_cannot_remove_member_using_user_token(self) -> None:
        # admin not in team
        self.login_as(self.admin)
        token = self.create_user_auth_token(user=self.admin_user, scope_list=["team:admin"])
        response = self.get_error_response(
            self.org.slug,
            self.member_on_team.id,
            self.team.slug,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
            status_code=400,
        )

        assert response.data["detail"] == ERR_INSUFFICIENT_ROLE
        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member_on_team
        ).exists()

    def test_admin_on_team_can_remove_members(self) -> None:
        self.login_as(self.admin_on_team)

        # member
        self.get_success_response(
            self.org.slug, self.member_on_team.id, self.team.slug, status_code=status.HTTP_200_OK
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member_on_team
        ).exists()

        # manager
        self.get_response(
            self.org.slug, self.manager_on_team.id, self.team.slug, status_code=status.HTTP_200_OK
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.manager_on_team
        ).exists()

        # owner
        self.get_success_response(
            self.org.slug, self.owner_on_team.id, self.team.slug, status_code=status.HTTP_200_OK
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.owner_on_team
        ).exists()

    def test_admin_on_team_can_remove_members_using_user_token(self) -> None:
        self.login_as(self.admin_on_team)

        token = self.create_user_auth_token(user=self.admin_on_team_user, scope_list=["team:admin"])
        self.get_success_response(
            self.org.slug,
            self.member_on_team.id,
            self.team.slug,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
            status_code=200,
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member_on_team
        ).exists()

    def test_superuser_can_remove_member(self) -> None:
        superuser = self.create_user(is_superuser=True)
        self.login_as(superuser, superuser=True)

        self.get_success_response(
            self.org.slug, self.member_on_team.id, self.team.slug, status_code=200
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member_on_team
        ).exists()

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_superuser_read_cannot_remove_member(self) -> None:
        superuser = self.create_user(is_superuser=True)
        self.login_as(superuser, superuser=True)

        self.get_error_response(
            self.org.slug, self.member_on_team.id, self.team.slug, status_code=400
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member_on_team
        ).exists()

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_superuser_write_can_remove_member(self) -> None:
        superuser = self.create_user(is_superuser=True)
        self.add_user_permission(superuser, "superuser.write")
        self.login_as(superuser, superuser=True)

        self.get_success_response(
            self.org.slug, self.member_on_team.id, self.team.slug, status_code=200
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member_on_team
        ).exists()

    def test_manager_can_remove_members(self) -> None:
        self.login_as(self.manager_on_team)

        # member
        self.get_success_response(
            self.org.slug, self.member_on_team.id, self.team.slug, status_code=status.HTTP_200_OK
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member_on_team
        ).exists()

        # manager
        self.get_success_response(
            self.org.slug, self.manager_on_team.id, self.team.slug, status_code=status.HTTP_200_OK
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.manager_on_team
        ).exists()

        # owner
        self.get_success_response(
            self.org.slug, self.owner_on_team.id, self.team.slug, status_code=status.HTTP_200_OK
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.owner_on_team
        ).exists()

    def test_manager_can_remove_members_using_user_token(self) -> None:
        self.login_as(self.manager)

        scopes = ["org:write", "team:admin"]
        members = [self.member_on_team, self.manager_on_team, self.owner_on_team]
        for scope in scopes:
            for member in members:
                token = self.create_user_auth_token(user=self.manager_user, scope_list=[scope])
                self.get_success_response(
                    self.org.slug,
                    member.id,
                    self.team.slug,
                    extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
                    status_code=200,
                )

                assert not OrganizationMemberTeam.objects.filter(
                    team=self.team, organizationmember=member
                ).exists()

    def test_owner_can_remove_members(self) -> None:
        self.login_as(self.owner)

        # member
        self.get_success_response(
            self.org.slug, self.member_on_team.id, self.team.slug, status_code=status.HTTP_200_OK
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member_on_team
        ).exists()

        # manager
        self.get_success_response(
            self.org.slug, self.manager_on_team.id, self.team.slug, status_code=status.HTTP_200_OK
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.manager_on_team
        ).exists()

        # owner
        self.get_success_response(
            self.org.slug, self.owner_on_team.id, self.team.slug, status_code=status.HTTP_200_OK
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.owner_on_team
        ).exists()

    def test_owner_can_remove_members_using_user_token(self) -> None:
        self.login_as(self.owner)

        scopes = ["org:write", "org:admin", "team:admin"]
        members = [self.member_on_team, self.manager_on_team, self.owner_on_team]
        for scope in scopes:
            for member in members:
                token = self.create_user_auth_token(user=self.user, scope_list=[scope])
                self.get_success_response(
                    self.org.slug,
                    member.id,
                    self.team.slug,
                    extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
                    status_code=200,
                )

                assert not OrganizationMemberTeam.objects.filter(
                    team=self.team, organizationmember=member
                ).exists()

    def test_access_revoked_after_leaving_team(self) -> None:
        user = self.create_user()
        organization = self.create_organization(flags=0)
        team = self.create_team(organization=organization)
        project = self.create_project(organization=organization, teams=[team])
        member = self.create_member(organization=organization, user=user, teams=[team])

        ax = access.from_user(user, organization)

        # user a member of the team that is a part of the project should have the following access and scopes
        assert ax.has_team_access(team)
        assert ax.has_project_access(project)
        assert ax.has_project_membership(project)

        self.login_as(user)
        self.get_success_response(
            organization.slug, member.id, team.slug, status_code=status.HTTP_200_OK
        )

        assert OrganizationMember.objects.filter(id=member.id).exists()
        assert not OrganizationMemberTeam.objects.filter(organizationmember=member.id).exists()

        ax_after_leaving = access.from_user(user, organization)
        assert not ax_after_leaving.has_team_access(team)
        assert not ax_after_leaving.has_project_access(project)
        assert not ax_after_leaving.has_project_membership(project)

    def test_cannot_leave_idp_provisioned_team(self) -> None:
        user = self.create_user()
        organization = self.create_organization(flags=0)
        idp_team = self.create_team(organization=organization, idp_provisioned=True)
        member = self.create_member(organization=organization, user=user, teams=[idp_team])

        self.login_as(user)
        self.get_error_response(
            organization.slug,
            member.id,
            idp_team.slug,
            status_code=403,
        )
        assert OrganizationMemberTeam.objects.filter(
            team=idp_team, organizationmember=member
        ).exists()

    def test_unsubscribe_user_from_team_issues_legacy(self):
        """
        We have some legacy DB rows from before the GroupSubscription table had a team_id
        where there is a row for each user_id of all team members. If a user leaves the team
        we want to unsubscribe them from the issues the team was subscribed to
        """
        self.login_as(self.member_on_team)
        user2 = self.create_user()
        self.create_member(user=user2, organization=self.org, role="member", teams=[self.team])
        group = self.create_group()
        GroupAssignee.objects.create(group=group, team=self.team, project=self.project)
        for member in OrganizationMemberTeam.objects.filter(team=self.team):
            GroupSubscription.objects.get_or_create(
                group=group,
                project_id=self.project.id,
                user_id=member.organizationmember.user_id,
                reason=GroupSubscriptionReason.assigned,
            )

        # check member is subscribed
        assert GroupSubscription.objects.filter(user_id=self.member_on_team_user.id).exists()
        # check user2 is subscribed
        assert GroupSubscription.objects.filter(user_id=user2.id).exists()
        response = self.get_success_response(
            self.org.slug, self.member_on_team.id, self.team.slug, status_code=status.HTTP_200_OK
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member_on_team
        ).exists()
        assert response.data["isMember"] is False
        # team is still assigned
        assert GroupAssignee.objects.filter(team=self.team).exists()
        # user is not subscribed
        assert not GroupSubscription.objects.filter(
            group=group, user_id=self.member_on_team_user.id
        ).exists()
        # other user in team still subscribed
        assert GroupSubscription.objects.filter(group=group, user_id=user2.id).exists()


class ReadOrganizationMemberTeamTest(OrganizationMemberTeamTestBase):
    endpoint = "sentry-api-0-organization-member-team-details"
    method = "get"

    def test_get(self) -> None:
        self.login_as(self.owner)

        resp = self.get_success_response(self.org.slug, self.member_on_team.id, self.team.slug)
        assert resp.data["isActive"] is True

    def test_get_role(self) -> None:
        self.login_as(self.owner)

        resp = self.get_success_response(self.org.slug, self.team_admin.id, self.team.slug)
        assert resp.data["isActive"] is True
        assert resp.data["teamRole"] == "admin"

    def test_not_found(self) -> None:
        self.login_as(self.owner)

        self.get_error_response(
            "bad_slug", self.team_admin.id, self.team.slug, status_code=status.HTTP_404_NOT_FOUND
        )
        self.get_error_response(
            self.org.slug, self.team_admin.id, "bad_team", status_code=status.HTTP_404_NOT_FOUND
        )


class UpdateOrganizationMemberTeamTest(OrganizationMemberTeamTestBase):
    endpoint = "sentry-api-0-organization-member-team-details"
    method = "put"

    @with_feature("organizations:team-roles")
    def test_cannot_set_nonexistent_role(self) -> None:
        self.login_as(self.owner)

        resp = self.get_response(
            self.org.slug, self.member_on_team.id, self.team.slug, teamRole="poobah"
        )
        assert resp.status_code == 400

    @with_feature("organizations:team-roles")
    def test_cannot_promote_nonmember(self) -> None:
        self.login_as(self.owner)

        resp = self.get_response(self.org.slug, self.member.id, self.team.slug, teamRole="admin")
        assert resp.status_code == 404

    @with_feature("organizations:team-roles")
    def test_owner_can_promote_member(self) -> None:
        self.login_as(self.owner)

        resp = self.get_response(
            self.org.slug, self.member_on_team.id, self.team.slug, teamRole="admin"
        )
        assert resp.status_code == 200

        updated_omt = OrganizationMemberTeam.objects.get(
            team=self.team, organizationmember=self.member_on_team
        )
        assert updated_omt.role == "admin"

    @with_feature("organizations:team-roles")
    def test_team_admin_can_promote_member(self) -> None:
        self.login_as(self.team_admin)

        resp = self.get_response(
            self.org.slug, self.member_on_team.id, self.team.slug, teamRole="admin"
        )
        assert resp.status_code == 200

        updated_omt = OrganizationMemberTeam.objects.get(
            team=self.team, organizationmember=self.member_on_team
        )
        assert updated_omt.role == "admin"

    @with_feature("organizations:team-roles")
    def test_superuser_can_promote_member(self) -> None:
        superuser = self.create_user(is_superuser=True)
        self.login_as(superuser, superuser=True)

        resp = self.get_response(
            self.org.slug, self.member_on_team.id, self.team.slug, teamRole="admin"
        )
        assert resp.status_code == 200

        updated_omt = OrganizationMemberTeam.objects.get(
            team=self.team, organizationmember=self.member_on_team
        )
        assert updated_omt.role == "admin"

        with self.settings(SENTRY_SELF_HOSTED=False):
            resp = self.get_response(
                self.org.slug, self.member_on_team.id, self.team.slug, teamRole="admin"
            )
            assert resp.status_code == 200

            updated_omt = OrganizationMemberTeam.objects.get(
                team=self.team, organizationmember=self.member_on_team
            )
            assert updated_omt.role == "admin"

    @with_feature("organizations:team-roles")
    @override_options({"superuser.read-write.ga-rollout": True})
    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_superuser_read_cannot_promote_member(self) -> None:
        superuser = self.create_user(is_superuser=True)
        self.login_as(superuser, superuser=True)

        resp = self.get_response(
            self.org.slug, self.member_on_team.id, self.team.slug, teamRole="admin"
        )
        assert resp.status_code == 400
        assert resp.data["detail"] == ERR_INSUFFICIENT_ROLE

    @with_feature("organizations:team-roles")
    @override_options({"superuser.read-write.ga-rollout": True})
    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_superuser_write_can_promote_member(self) -> None:
        superuser = self.create_user(is_superuser=True)
        self.login_as(superuser, superuser=True)

        self.add_user_permission(superuser, "superuser.write")
        resp = self.get_response(
            self.org.slug, self.member_on_team.id, self.team.slug, teamRole="admin"
        )
        assert resp.status_code == 200

        updated_omt = OrganizationMemberTeam.objects.get(
            team=self.team, organizationmember=self.member_on_team
        )
        assert updated_omt.role == "admin"

    @with_feature("organizations:team-roles")
    def test_admin_can_promote_member(self) -> None:
        self.login_as(self.admin_on_team)

        resp = self.get_response(
            self.org.slug, self.member_on_team.id, self.team.slug, teamRole="admin"
        )
        assert resp.status_code == 200

        updated_omt = OrganizationMemberTeam.objects.get(
            team=self.team, organizationmember=self.member_on_team
        )
        assert updated_omt.role == "admin"

    @with_feature("organizations:team-roles")
    def test_member_cannot_promote_member(self) -> None:
        self.login_as(self.member_on_team)
        other_member = self.create_member(
            organization=self.org, user=self.create_user(), role="member", teams=[self.team]
        )

        resp = self.get_response(self.org.slug, other_member.id, self.team.slug, teamRole="admin")
        assert resp.status_code == 400
        assert resp.data["detail"] == ERR_INSUFFICIENT_ROLE

        target_omt = OrganizationMemberTeam.objects.get(
            team=self.team, organizationmember=other_member
        )
        assert target_omt.role is None
        assert target_omt.role is None

    @with_feature("organizations:team-roles")
    def test_org_write_scope_can_manage_team_roles(self) -> None:
        """Test that org:write scope is sufficient for managing team roles"""
        user = self.create_user()
        member = self.create_member(
            organization=self.org, user=user, role="member", teams=[self.team]
        )
        self.sentry_app = self.create_sentry_app(
            name="Testin",
            organization=self.org,
            webhook_url="https://example.com",
            scopes=["org:write"],
        )
        self.install = self.create_sentry_app_installation(
            organization=self.org, slug=self.sentry_app.slug, user=self.admin
        )
        self.api_token = self.create_internal_integration_token(
            install=self.install, user=self.admin
        )
        resp = self.get_response(
            self.org.slug,
            member.id,
            self.team.slug,
            teamRole="admin",
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {self.api_token.token}"},
        )
        assert resp.status_code == 200

    @with_feature("organizations:team-roles")
    def test_member_write_scope_can_manage_team_roles(self) -> None:
        """Test that member:write scope is sufficient for managing team roles"""
        user = self.create_user()
        member = self.create_member(
            organization=self.org, user=user, role="member", teams=[self.team]
        )
        self.sentry_app = self.create_sentry_app(
            name="Testin",
            organization=self.org,
            webhook_url="https://example.com",
            scopes=["member:write"],
        )
        self.install = self.create_sentry_app_installation(
            organization=self.org, slug=self.sentry_app.slug, user=self.admin
        )
        self.api_token = self.create_internal_integration_token(
            install=self.install, user=self.admin
        )

        resp = self.get_response(
            self.org.slug,
            member.id,
            self.team.slug,
            teamRole="admin",
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {self.api_token.token}"},
        )
        assert resp.status_code == 200

    @with_feature("organizations:team-roles")
    def test_team_write_scope_can_manage_team_roles(self) -> None:
        """Test that team:write scope is sufficient for managing team roles"""
        user = self.create_user()
        member = self.create_member(
            organization=self.org, user=user, role="member", teams=[self.team]
        )
        self.sentry_app = self.create_sentry_app(
            name="Testin",
            organization=self.org,
            webhook_url="https://example.com",
            scopes=["team:write"],
        )
        self.install = self.create_sentry_app_installation(
            organization=self.org, slug=self.sentry_app.slug, user=self.admin
        )
        self.api_token = self.create_internal_integration_token(
            install=self.install, user=self.admin
        )

        resp = self.get_response(
            self.org.slug,
            member.id,
            self.team.slug,
            teamRole="admin",
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {self.api_token.token}"},
        )
        assert resp.status_code == 200

    @with_feature("organizations:team-roles")
    def test_org_read_scope_cannot_manage_team_roles(self) -> None:
        """Test that org:read scope is insufficient for managing team roles"""
        user = self.create_user()
        member = self.create_member(
            organization=self.org, user=user, role="member", teams=[self.team]
        )
        self.sentry_app = self.create_sentry_app(
            name="Testin",
            organization=self.org,
            webhook_url="https://example.com",
            scopes=["org:read"],
        )
        self.install = self.create_sentry_app_installation(
            organization=self.org, slug=self.sentry_app.slug, user=self.admin
        )
        self.api_token = self.create_internal_integration_token(
            install=self.install, user=self.admin
        )

        resp = self.get_response(
            self.org.slug,
            member.id,
            self.team.slug,
            teamRole="admin",
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {self.api_token.token}"},
        )

        assert resp.status_code == 400
        assert resp.data["detail"] == ERR_INSUFFICIENT_ROLE

    @with_feature("organizations:team-roles")
    def test_member_read_scope_cannot_manage_team_roles(self) -> None:
        """Test that member:read scope is insufficient for managing team roles"""
        user = self.create_user()
        member = self.create_member(
            organization=self.org, user=user, role="member", teams=[self.team]
        )
        self.sentry_app = self.create_sentry_app(
            name="Testin",
            organization=self.org,
            webhook_url="https://example.com",
            scopes=["member:read"],
        )
        self.install = self.create_sentry_app_installation(
            organization=self.org, slug=self.sentry_app.slug, user=self.admin
        )
        self.api_token = self.create_internal_integration_token(
            install=self.install, user=self.admin
        )

        resp = self.get_response(
            self.org.slug,
            member.id,
            self.team.slug,
            teamRole="admin",
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {self.api_token.token}"},
        )

        assert resp.status_code == 400
        assert resp.data["detail"] == ERR_INSUFFICIENT_ROLE

    @with_feature("organizations:team-roles")
    def test_team_contributor_cannot_downgrade_team_admin(self) -> None:
        self.login_as(self.member)

        resp = self.get_response(
            self.org.slug,
            self.team_admin.id,
            self.team.slug,
            teamRole="contributor",
        )

        assert resp.status_code == 400
        assert resp.data["detail"] == ERR_INSUFFICIENT_ROLE

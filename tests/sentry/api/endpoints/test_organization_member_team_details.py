from functools import cached_property

from rest_framework import status

from sentry.api.endpoints.organization_member.team_details import ERR_INSUFFICIENT_ROLE
from sentry.auth import access
from sentry.models.organization import Organization
from sentry.models.organizationaccessrequest import OrganizationAccessRequest
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import region_silo_test


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
        return self.create_member(
            organization=self.org, user=self.create_user(), role="member", teams=[self.team]
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


@region_silo_test
class CreateOrganizationMemberTeamTest(OrganizationMemberTeamTestBase):
    method = "post"

    def test_manager_can_join_team(self):
        self.login_as(self.manager)
        self.get_success_response(
            self.org.slug, self.manager.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.manager
        ).exists()

    def test_owner_can_join_team(self):
        owner = self.create_member(organization=self.org, user=self.create_user(), role="owner")
        self.login_as(owner)
        self.get_success_response(
            self.org.slug, owner.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=owner
        ).exists()

    def test_admin_on_team_can_add_members_to_team(self):
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

    def test_manager_can_add_members_to_team(self):
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

    def test_owner_can_add_members_to_team(self):
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


class CreateWithOpenMembershipTest(OrganizationMemberTeamTestBase):
    method = "post"

    def test_member_can_join_team(self):
        self.login_as(self.member)
        self.get_success_response(
            self.org.slug, self.member.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

    def test_admin_can_join_team(self):
        self.login_as(self.admin)
        self.get_success_response(
            self.org.slug, self.admin.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.admin
        ).exists()

    def test_cannot_join_idp_team(self):
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

    def test_member_can_add_member_to_team(self):
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

    def test_admin_can_add_member_to_team(self):
        self.login_as(self.admin)
        self.get_success_response(
            self.org.slug, self.member.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

    def test_cannot_add_to_idp_team(self):
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
    def test_team_admin_can_add_member(self):
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

    def test_member_must_request_access_to_join_team(self):
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

    def test_admin_must_request_access_to_join_team(self):
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

    def test_member_on_team_must_request_access_to_add_member_to_team(self):
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

    def test_admin_must_request_access_to_add_member_to_team(self):
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
    def test_team_admin_can_add_member(self):
        self.login_as(self.team_admin)

        self.get_success_response(
            self.org.slug, self.member.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

    @with_feature("organizations:team-roles")
    def test_team_admin_can_add_member_using_user_token(self):
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

    def test_integration_token_needs_elevated_permissions(self):
        # Integration tokens with org:read should generate an access request when open membership is off
        integration_token = self.create_internal_integration_token(
            user=self.user, org=self.org, scopes=["org:read"]
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

    def test_multiple_of_the_same_access_request(self):
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


@region_silo_test
class DeleteOrganizationMemberTeamTest(OrganizationMemberTeamTestBase):
    method = "delete"

    def test_member_can_leave(self):
        self.login_as(self.member_on_team)
        response = self.get_success_response(
            self.org.slug, self.member_on_team.id, self.team.slug, status_code=status.HTTP_200_OK
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member_on_team
        ).exists()
        assert response.data["isMember"] is False

    def test_member_can_leave_without_membership(self):
        self.login_as(self.member)
        self.get_success_response(
            self.org.slug, self.member.id, self.team.slug, status_code=status.HTTP_200_OK
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

    def test_can_leave_as_superuser_without_membership(self):
        superuser = self.create_user(is_superuser=True)
        member = self.create_member(organization=self.org, user=superuser, role="member", teams=[])

        self.login_as(member)
        self.get_success_response(
            self.org.slug, member.id, self.team.slug, status_code=status.HTTP_200_OK
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=member
        ).exists()

    def test_member_cannot_remove_member(self):
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

    def test_admin_cannot_remove_member(self):
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

    def test_admin_cannot_remove_member_using_user_token(self):
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

    def test_admin_on_team_can_remove_members(self):
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

    def test_admin_on_team_can_remove_members_using_user_token(self):
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

    def test_manager_can_remove_members(self):
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

    def test_manager_can_remove_members_using_user_token(self):
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

    def test_owner_can_remove_members(self):
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

    def test_owner_can_remove_members_using_user_token(self):
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

    def test_access_revoked_after_leaving_team(self):
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

    def test_cannot_leave_idp_provisioned_team(self):
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


@region_silo_test
class ReadOrganizationMemberTeamTest(OrganizationMemberTeamTestBase):
    endpoint = "sentry-api-0-organization-member-team-details"
    method = "get"

    def test_get(self):
        self.login_as(self.owner)

        resp = self.get_success_response(self.org.slug, self.member_on_team.id, self.team.slug)
        assert resp.data["isActive"] is True

    def test_get_role(self):
        self.login_as(self.owner)

        resp = self.get_success_response(self.org.slug, self.team_admin.id, self.team.slug)
        assert resp.data["isActive"] is True
        assert resp.data["teamRole"] == "admin"

    def test_not_found(self):
        self.login_as(self.owner)

        self.get_error_response(
            "bad_slug", self.team_admin.id, self.team.slug, status_code=status.HTTP_404_NOT_FOUND
        )
        self.get_error_response(
            self.org.slug, self.team_admin.id, "bad_team", status_code=status.HTTP_404_NOT_FOUND
        )


@region_silo_test
class UpdateOrganizationMemberTeamTest(OrganizationMemberTeamTestBase):
    endpoint = "sentry-api-0-organization-member-team-details"
    method = "put"

    @with_feature("organizations:team-roles")
    def test_cannot_set_nonexistent_role(self):
        self.login_as(self.owner)

        resp = self.get_response(
            self.org.slug, self.member_on_team.id, self.team.slug, teamRole="poobah"
        )
        assert resp.status_code == 400

    @with_feature("organizations:team-roles")
    def test_cannot_promote_nonmember(self):
        self.login_as(self.owner)

        resp = self.get_response(self.org.slug, self.member.id, self.team.slug, teamRole="admin")
        assert resp.status_code == 404

    @with_feature("organizations:team-roles")
    def test_owner_can_promote_member(self):
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
    def test_team_admin_can_promote_member(self):
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
    def test_superuser_can_promote_member(self):
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

    @with_feature("organizations:team-roles")
    def test_admin_can_promote_member(self):
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
    def test_member_cannot_promote_member(self):
        self.login_as(self.member_on_team)
        other_member = self.create_member(
            organization=self.org, user=self.create_user(), role="member", teams=[self.team]
        )

        resp = self.get_response(self.org.slug, other_member.id, self.team.slug, teamRole="admin")
        assert resp.status_code == 400

        target_omt = OrganizationMemberTeam.objects.get(
            team=self.team, organizationmember=other_member
        )
        assert target_omt.role is None

    @with_feature("organizations:team-roles")
    def test_member_on_owner_team_can_promote_member(self):
        owner_team = self.create_team(org_role="owner")
        member = self.create_member(
            organization=self.org,
            user=self.create_user(),
            role="member",
            teams=[owner_team],
        )

        self.login_as(member)
        resp = self.get_response(
            self.org.slug, self.member_on_team.id, self.team.slug, teamRole="admin"
        )
        assert resp.status_code == 200

        updated_omt = OrganizationMemberTeam.objects.get(
            team=self.team, organizationmember=self.member_on_team
        )
        assert updated_omt.role == "admin"

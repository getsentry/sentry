from exam import fixture
from rest_framework import status

from sentry.models import (
    Organization,
    OrganizationAccessRequest,
    OrganizationMember,
    OrganizationMemberTeam,
)
from sentry.testutils import APITestCase
from sentry.testutils.helpers import with_feature


class OrganizationMemberTeamTestBase(APITestCase):
    endpoint = "sentry-api-0-organization-member-team-details"

    @fixture
    def org(self):
        # open membership
        return self.create_organization(owner=self.user, flags=Organization.flags.allow_joinleave)

    @fixture
    def team(self):
        return self.create_team(organization=self.org)

    @fixture
    def owner(self):
        return OrganizationMember.objects.get(organization=self.org, user=self.user)

    @fixture
    def member(self):
        return self.create_member(organization=self.org, user=self.create_user(), role="member")

    @fixture
    def admin(self):
        return self.create_member(organization=self.org, user=self.create_user(), role="admin")

    @fixture
    def manager(self):
        return self.create_member(organization=self.org, user=self.create_user(), role="manager")

    @fixture
    def member_on_team(self):
        return self.create_member(
            organization=self.org, user=self.create_user(), role="member", teams=[self.team]
        )

    @fixture
    def admin_on_team(self):
        return self.create_member(
            organization=self.org, user=self.create_user(), role="admin", teams=[self.team]
        )

    @fixture
    def manager_on_team(self):
        return self.create_member(
            organization=self.org, user=self.create_user(), role="manager", teams=[self.team]
        )

    @fixture
    def owner_on_team(self):
        return self.create_member(
            organization=self.org, user=self.create_user(), role="owner", teams=[self.team]
        )

    @fixture
    def team_admin(self):
        member = self.create_member(organization=self.org, user=self.create_user(), role="member")
        OrganizationMemberTeam.objects.create(
            team=self.team, organizationmember=member, role="admin"
        )
        return member


class CreateOrganizationMemberTeamTest(OrganizationMemberTeamTestBase):
    method = "post"

    def test_manager_can_join_team(self):
        self.login_as(self.manager.user)
        self.get_success_response(
            self.org.slug, self.manager.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.manager
        ).exists()

    def test_owner_can_join_team(self):
        owner = self.create_member(organization=self.org, user=self.create_user(), role="owner")
        self.login_as(owner.user)
        self.get_success_response(
            self.org.slug, owner.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=owner
        ).exists()

    def test_admin_on_team_can_add_members_to_team(self):
        self.login_as(self.admin_on_team.user)

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
        self.login_as(self.manager.user)

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
        self.login_as(self.owner.user)

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
        self.login_as(self.member.user)
        self.get_success_response(
            self.org.slug, self.member.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

    def test_admin_can_join_team(self):
        self.login_as(self.admin.user)
        self.get_success_response(
            self.org.slug, self.admin.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.admin
        ).exists()

    def test_member_can_add_member_to_team(self):
        target_member = self.create_member(
            organization=self.org, user=self.create_user(), role="member"
        )

        self.login_as(self.member.user)
        self.get_success_response(
            self.org.slug, target_member.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=target_member
        ).exists()

    def test_admin_can_add_member_to_team(self):
        self.login_as(self.admin.user)
        self.get_success_response(
            self.org.slug, self.member.id, self.team.slug, status_code=status.HTTP_201_CREATED
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()


class CreateWithClosedMembershipTest(CreateOrganizationMemberTeamTest):
    @fixture
    def org(self):
        # rerun create org member tests with closed membership
        return self.create_organization(owner=self.user, flags=0)

    def test_member_must_request_access_to_join_team(self):
        self.login_as(self.member.user)
        self.get_success_response(
            self.org.slug, self.member.id, self.team.slug, status_code=status.HTTP_202_ACCEPTED
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

        assert OrganizationAccessRequest.objects.filter(
            team=self.team, member=self.member, requester=None
        ).exists()

    def test_admin_must_request_access_to_join_team(self):
        self.login_as(self.admin.user)
        self.get_success_response(
            self.org.slug, self.admin.id, self.team.slug, status_code=status.HTTP_202_ACCEPTED
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.admin
        ).exists()

        assert OrganizationAccessRequest.objects.filter(
            team=self.team, member=self.admin, requester=None
        ).exists()

    def test_member_on_team_must_request_access_to_add_member_to_team(self):
        self.login_as(self.member_on_team.user)
        self.get_success_response(
            self.org.slug, self.member.id, self.team.slug, status_code=status.HTTP_202_ACCEPTED
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

        assert OrganizationAccessRequest.objects.filter(
            team=self.team, member=self.member, requester=self.member_on_team.user
        ).exists()

    def test_admin_must_request_access_to_add_member_to_team(self):
        # admin not in the team
        self.login_as(self.admin.user)
        self.get_success_response(
            self.org.slug, self.member.id, self.team.slug, status_code=status.HTTP_202_ACCEPTED
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

        assert OrganizationAccessRequest.objects.filter(
            team=self.team, member=self.member, requester=self.admin.user
        ).exists()

    def test_multiple_of_the_same_access_request(self):
        self.login_as(self.member.user)
        self.get_success_response(
            self.org.slug, self.admin.id, self.team.slug, status_code=status.HTTP_202_ACCEPTED
        )

        self.login_as(self.member_on_team.user)
        self.get_success_response(
            self.org.slug, self.admin.id, self.team.slug, status_code=status.HTTP_202_ACCEPTED
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.admin
        ).exists()

        oar = OrganizationAccessRequest.objects.get(team=self.team, member=self.admin)
        assert oar.requester == self.member.user


class DeleteOrganizationMemberTeamTest(OrganizationMemberTeamTestBase):
    method = "delete"

    def test_member_can_leave(self):
        self.login_as(self.member_on_team.user)
        self.get_success_response(
            self.org.slug, self.member_on_team.id, self.team.slug, status_code=status.HTTP_200_OK
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member_on_team
        ).exists()

    def test_member_can_leave_without_membership(self):
        self.login_as(self.member.user)
        self.get_success_response(
            self.org.slug, self.member.id, self.team.slug, status_code=status.HTTP_200_OK
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

    def test_can_leave_as_superuser_without_membership(self):
        superuser = self.create_user(is_superuser=True)
        member = self.create_member(organization=self.org, user=superuser, role="member", teams=[])

        self.login_as(member.user)
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

        self.login_as(self.member_on_team.user)
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
        self.login_as(self.admin.user)
        self.get_error_response(
            self.org.slug,
            self.member_on_team.id,
            self.team.slug,
            status_code=400,
        )

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member_on_team
        ).exists()

    def test_admin_on_team_can_remove_members(self):
        self.login_as(self.admin_on_team.user)

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

    def test_manager_can_remove_members(self):
        self.login_as(self.manager_on_team.user)

        # member
        self.get_success_response(
            self.org.slug, self.member_on_team.id, self.team.slug, status_code=status.HTTP_200_OK
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member_on_team
        ).exists()

        # owner
        self.get_success_response(
            self.org.slug, self.owner_on_team.id, self.team.slug, status_code=status.HTTP_200_OK
        )

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.owner_on_team
        ).exists()

    def test_owner_can_remove_members(self):
        self.login_as(self.owner.user)

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


class ReadOrganizationMemberTeamTest(OrganizationMemberTeamTestBase):
    endpoint = "sentry-api-0-organization-member-team-details"
    method = "get"

    def test_get(self):
        self.login_as(self.owner.user)

        resp = self.get_success_response(self.org.slug, self.member_on_team.id, self.team.slug)
        assert resp.data["isActive"] is True

    def test_get_role(self):
        self.login_as(self.owner.user)

        resp = self.get_success_response(self.org.slug, self.team_admin.id, self.team.slug)
        assert resp.data["isActive"] is True
        assert resp.data["teamRole"] == "admin"

    def test_not_found(self):
        self.login_as(self.owner.user)

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
    def test_cannot_set_nonexistent_role(self):
        self.login_as(self.owner.user)

        resp = self.get_response(
            self.org.slug, self.member_on_team.id, self.team.slug, teamRole="poobah"
        )
        assert resp.status_code == 400

    @with_feature("organizations:team-roles")
    def test_cannot_promote_nonmember(self):
        self.login_as(self.owner.user)

        resp = self.get_response(self.org.slug, self.member.id, self.team.slug, teamRole="admin")
        assert resp.status_code == 404

    @with_feature("organizations:team-roles")
    def test_owner_can_promote_member(self):
        self.login_as(self.owner.user)

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
        self.login_as(self.team_admin.user)

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
        self.login_as(self.member_on_team.user)
        other_member = self.create_member(
            organization=self.org, user=self.create_user(), role="member", teams=[self.team]
        )

        resp = self.get_response(self.org.slug, other_member.id, self.team.slug, teamRole="admin")
        assert resp.status_code == 400

        target_omt = OrganizationMemberTeam.objects.get(
            team=self.team, organizationmember=other_member
        )
        assert target_omt.role is None

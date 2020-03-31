from __future__ import absolute_import

from exam import fixture
from sentry.models import (
    Organization,
    OrganizationMember,
    OrganizationAccessRequest,
    OrganizationMemberTeam,
)
from sentry.testutils import APITestCase


class MemberTeamFixtures(APITestCase):
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
    def team_member(self):
        return self.create_member(
            organization=self.org, user=self.create_user(), role="member", teams=[self.team]
        )

    @fixture
    def team_admin(self):
        return self.create_member(
            organization=self.org, user=self.create_user(), role="admin", teams=[self.team]
        )

    @fixture
    def team_manager(self):
        return self.create_member(
            organization=self.org, user=self.create_user(), role="manager", teams=[self.team]
        )

    @fixture
    def team_owner(self):
        return self.create_member(
            organization=self.org, user=self.create_user(), role="owner", teams=[self.team]
        )


class CreateOrganizationMemberTeamTest(MemberTeamFixtures):
    endpoint = "sentry-api-0-organization-member-team-details"
    method = "post"

    def test_manager_can_join_team(self):
        self.login_as(self.manager.user)
        resp = self.get_response(self.org.slug, self.manager.id, self.team.slug)
        assert resp.status_code == 201

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.manager
        ).exists()

    def test_owner_can_join_team(self):
        owner = self.create_member(organization=self.org, user=self.create_user(), role="owner")
        self.login_as(owner.user)
        resp = self.get_response(self.org.slug, owner.id, self.team.slug)
        assert resp.status_code == 201

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=owner
        ).exists()

    def test_team_admin_can_add_members_to_team(self):
        self.login_as(self.team_admin.user)

        # member
        resp = self.get_response(self.org.slug, self.member.id, self.team.slug)
        assert resp.status_code == 201

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

        # manager
        resp = self.get_response(self.org.slug, self.manager.id, self.team.slug)
        assert resp.status_code == 201

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.manager
        ).exists()

    def test_manager_can_add_members_to_team(self):
        self.login_as(self.manager.user)

        # member
        resp = self.get_response(self.org.slug, self.member.id, self.team.slug)
        assert resp.status_code == 201

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

        # owner
        resp = self.get_response(self.org.slug, self.owner.id, self.team.slug)
        assert resp.status_code == 201

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.owner.id
        ).exists()

    def test_owner_can_add_members_to_team(self):
        self.login_as(self.owner.user)

        # member
        resp = self.get_response(self.org.slug, self.member.id, self.team.slug)
        assert resp.status_code == 201

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

        # manager
        resp = self.get_response(self.org.slug, self.manager.id, self.team.slug)
        assert resp.status_code == 201

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.manager
        ).exists()

        # owner
        target_owner = self.create_member(
            organization=self.org, user=self.create_user(), role="owner"
        )
        resp = self.get_response(self.org.slug, target_owner.id, self.team.slug)
        assert resp.status_code == 201

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=target_owner
        ).exists()


class CreateWithOpenMembershipTest(MemberTeamFixtures):
    endpoint = "sentry-api-0-organization-member-team-details"
    method = "post"

    def test_member_can_join_team(self):
        self.login_as(self.member.user)
        resp = self.get_response(self.org.slug, self.member.id, self.team.slug)
        assert resp.status_code == 201

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

    def test_admin_can_join_team(self):
        self.login_as(self.admin.user)
        resp = self.get_response(self.org.slug, self.admin.id, self.team.slug)
        assert resp.status_code == 201

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.admin
        ).exists()

    def test_member_can_add_member_to_team(self):
        target_member = self.create_member(
            organization=self.org, user=self.create_user(), role="member"
        )

        self.login_as(self.member.user)
        resp = self.get_response(self.org.slug, target_member.id, self.team.slug)
        assert resp.status_code == 201

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=target_member
        ).exists()

    def test_admin_can_add_member_to_team(self):
        self.login_as(self.admin.user)
        resp = self.get_response(self.org.slug, self.member.id, self.team.slug)
        assert resp.status_code == 201

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
        resp = self.get_response(self.org.slug, self.member.id, self.team.slug)
        assert resp.status_code == 202

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

        assert OrganizationAccessRequest.objects.filter(
            team=self.team, member=self.member, requester=None
        ).exists()

    def test_admin_must_request_access_to_join_team(self):
        self.login_as(self.admin.user)
        resp = self.get_response(self.org.slug, self.admin.id, self.team.slug)
        assert resp.status_code == 202

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.admin
        ).exists()

        assert OrganizationAccessRequest.objects.filter(
            team=self.team, member=self.admin, requester=None
        ).exists()

    def test_team_member_must_request_access_to_add_member_to_team(self):
        self.login_as(self.team_member.user)
        resp = self.get_response(self.org.slug, self.member.id, self.team.slug)
        assert resp.status_code == 202

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

        assert OrganizationAccessRequest.objects.filter(
            team=self.team, member=self.member, requester=self.team_member.user
        ).exists()

    def test_admin_must_request_access_to_add_member_to_team(self):
        # admin not in the team
        self.login_as(self.admin.user)
        resp = self.get_response(self.org.slug, self.member.id, self.team.slug)
        assert resp.status_code == 202

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

        assert OrganizationAccessRequest.objects.filter(
            team=self.team, member=self.member, requester=self.admin.user
        ).exists()

    def test_multiple_of_the_same_access_request(self):
        self.login_as(self.member.user)
        resp = self.get_response(self.org.slug, self.admin.id, self.team.slug)
        assert resp.status_code == 202

        self.login_as(self.team_member.user)
        resp = self.get_response(self.org.slug, self.admin.id, self.team.slug)
        assert resp.status_code == 202

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.admin
        ).exists()

        oar = OrganizationAccessRequest.objects.get(team=self.team, member=self.admin)
        assert oar.requester == self.member.user


class DeleteOrganizationMemberTeamTest(MemberTeamFixtures):
    endpoint = "sentry-api-0-organization-member-team-details"
    method = "delete"

    def test_member_can_leave(self):
        self.login_as(self.team_member.user)
        resp = self.get_response(self.org.slug, self.team_member.id, self.team.slug)
        assert resp.status_code == 200

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.team_member
        ).exists()

    def test_member_can_leave_without_membership(self):
        self.login_as(self.member.user)
        resp = self.get_response(self.org.slug, self.member.id, self.team.slug)
        assert resp.status_code == 200

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.member
        ).exists()

    def test_can_leave_as_superuser_without_membership(self):
        superuser = self.create_user(is_superuser=True)
        member = self.create_member(organization=self.org, user=superuser, role="member", teams=[])

        self.login_as(member.user)
        resp = self.get_response(self.org.slug, member.id, self.team.slug)
        assert resp.status_code == 200

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=member
        ).exists()

    def test_member_cannot_remove_member(self):
        target_member = self.create_member(
            organization=self.org, user=self.create_user(), role="member", teams=[self.team]
        )

        self.login_as(self.team_member.user)
        resp = self.get_response(self.org.slug, target_member.id, self.team.slug)
        assert resp.status_code == 400

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=target_member
        ).exists()

    def test_admin_cannot_remove_member(self):
        # admin not in team
        self.login_as(self.admin.user)
        resp = self.get_response(self.org.slug, self.team_member.id, self.team.slug)
        assert resp.status_code == 400

        assert OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.team_member
        ).exists()

    def test_team_admin_can_remove_members(self):
        self.login_as(self.team_admin.user)

        # member
        resp = self.get_response(self.org.slug, self.team_member.id, self.team.slug)
        assert resp.status_code == 200

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.team_member
        ).exists()

        # manager
        resp = self.get_response(self.org.slug, self.team_manager.id, self.team.slug)
        assert resp.status_code == 200

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.team_manager
        ).exists()

    def test_manager_can_remove_members(self):
        self.login_as(self.team_manager.user)

        # member
        resp = self.get_response(self.org.slug, self.team_member.id, self.team.slug)
        assert resp.status_code == 200

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.team_member
        ).exists()

        # owner
        resp = self.get_response(self.org.slug, self.team_owner.id, self.team.slug)
        assert resp.status_code == 200

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.team_owner
        ).exists()

    def test_owner_can_remove_members(self):
        self.login_as(self.owner.user)

        # member
        resp = self.get_response(self.org.slug, self.team_member.id, self.team.slug)
        assert resp.status_code == 200

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.team_member
        ).exists()

        # manager
        resp = self.get_response(self.org.slug, self.team_manager.id, self.team.slug)
        assert resp.status_code == 200

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.team_manager
        ).exists()

        # owner
        resp = self.get_response(self.org.slug, self.team_owner.id, self.team.slug)
        assert resp.status_code == 200

        assert not OrganizationMemberTeam.objects.filter(
            team=self.team, organizationmember=self.team_owner
        ).exists()

from __future__ import absolute_import

from sentry.models import Organization, OrganizationAccessRequest, OrganizationMemberTeam
from sentry.testutils import APITestCase


class CreateOrganizationMemberTeamTest(APITestCase):
    endpoint = "sentry-api-0-organization-member-team-details"
    method = "post"

    def test_can_join_as_owner_without_open_membership(self):
        organization = self.create_organization(name="foo", owner=self.user, flags=0)
        team = self.create_team(name="foo", organization=organization)
        owner = self.create_member(
            organization=organization, user=self.create_user(), role="owner", teams=[]
        )

        self.login_as(owner.user)
        resp = self.get_response(organization.slug, owner.id, team.slug)
        assert resp.status_code == 201

    def test_cannot_join_as_member_without_open_membership(self):
        organization = self.create_organization(name="foo", owner=self.user, flags=0)
        team = self.create_team(name="foo", organization=organization)
        member = self.create_member(
            organization=organization, user=self.create_user(), role="member", teams=[]
        )

        self.login_as(member.user)
        resp = self.get_response(organization.slug, member.id, team.slug)
        assert resp.status_code == 202

        assert not OrganizationMemberTeam.objects.filter(
            team=team, organizationmember=member
        ).exists()
        assert OrganizationAccessRequest.objects.filter(team=team, member=member).exists()

    def test_can_join_as_member_with_open_membership(self):
        organization = self.create_organization(
            name="foo", owner=self.user, flags=Organization.flags.allow_joinleave
        )
        team = self.create_team(name="foo", organization=organization)
        member = self.create_member(
            organization=organization, user=self.create_user(), role="member", teams=[]
        )

        self.login_as(member.user)
        resp = self.get_response(organization.slug, member.id, team.slug)
        assert resp.status_code == 201

        assert OrganizationMemberTeam.objects.filter(team=team, organizationmember=member).exists()

    def test_member_can_add_member_with_open_membership(self):
        organization = self.create_organization(
            name="foo", owner=self.user, flags=Organization.flags.allow_joinleave
        )
        team = self.create_team(name="foo", organization=organization)
        member = self.create_member(
            organization=organization, user=self.create_user(), role="member"
        )
        target_member = self.create_member(
            organization=organization, user=self.create_user(), role="member", teams=[]
        )

        self.login_as(member.user)
        resp = self.get_response(organization.slug, target_member.id, team.slug)
        assert resp.status_code == 201

        assert OrganizationMemberTeam.objects.filter(
            team=team, organizationmember=target_member
        ).exists()

    def test_owner_can_add_member(self):
        user = self.create_user()
        organization = self.create_organization(name="foo", owner=user, flags=0)
        team = self.create_team(name="foo", organization=organization)
        member = self.create_member(
            organization=organization, user=self.create_user(), role="member", teams=[]
        )

        self.login_as(user)
        resp = self.get_response(organization.slug, member.id, team.slug)
        assert resp.status_code == 201

        assert OrganizationMemberTeam.objects.filter(team=team, organizationmember=member).exists()

    def test_owner_can_add_manager(self):
        user = self.create_user()
        organization = self.create_organization(name="foo", owner=user, flags=0)
        team = self.create_team(name="foo", organization=organization)
        manager = self.create_member(
            organization=organization, user=self.create_user(), role="manager", teams=[]
        )

        self.login_as(user)
        resp = self.get_response(organization.slug, manager.id, team.slug)
        assert resp.status_code == 201

        assert OrganizationMemberTeam.objects.filter(team=team, organizationmember=manager).exists()

    def test_owner_can_add_other_owner(self):
        user = self.create_user()
        organization = self.create_organization(name="foo", owner=user, flags=0)
        team = self.create_team(name="foo", organization=organization)
        owner = self.create_member(
            organization=organization, user=self.create_user(), role="owner", teams=[]
        )

        self.login_as(user)
        resp = self.get_response(organization.slug, owner.id, team.slug)
        assert resp.status_code == 201

        assert OrganizationMemberTeam.objects.filter(team=team, organizationmember=owner).exists()

    def test_manager_can_add_member(self):
        organization = self.create_organization(name="foo", flags=0)
        team = self.create_team(name="foo", organization=organization)
        manager = self.create_member(
            organization=organization, user=self.create_user(), role="manager", teams=[team]
        )
        member = self.create_member(
            organization=organization, user=self.create_user(), role="member", teams=[]
        )

        self.login_as(manager.user)
        resp = self.get_response(organization.slug, member.id, team.slug)
        assert resp.status_code == 201

        assert OrganizationMemberTeam.objects.filter(team=team, organizationmember=member).exists()

    def test_manager_cannot_add_owner(self):
        organization = self.create_organization(name="foo", flags=0)
        team = self.create_team(name="foo", organization=organization)
        manager = self.create_member(
            organization=organization, user=self.create_user(), role="manager", teams=[team]
        )
        owner = self.create_member(
            organization=organization, user=self.create_user(), role="owner", teams=[]
        )

        self.login_as(manager.user)
        resp = self.get_response(organization.slug, owner.id, team.slug)
        assert resp.status_code == 400

        assert not OrganizationMemberTeam.objects.filter(
            team=team, organizationmember=owner
        ).exists()

    def test_admin_not_in_team_cannot_add_member(self):
        organization = self.create_organization(name="foo", owner=self.user, flags=0)
        team = self.create_team(name="foo", organization=organization)
        admin = self.create_member(
            organization=organization, user=self.create_user(), role="admin", teams=[]
        )
        member = self.create_member(
            organization=organization, user=self.create_user(), role="member", teams=[]
        )

        self.login_as(admin.user)
        resp = self.get_response(organization.slug, member.id, team.slug)
        assert resp.status_code == 400

        assert not OrganizationMemberTeam.objects.filter(
            team=team, organizationmember=member
        ).exists()

    def test_admin_in_team_can_add_member(self):
        organization = self.create_organization(name="foo", owner=self.user, flags=0)
        team = self.create_team(name="foo", organization=organization)
        admin = self.create_member(
            organization=organization, user=self.create_user(), role="admin", teams=[team]
        )
        member = self.create_member(
            organization=organization, user=self.create_user(), role="member", teams=[]
        )

        self.login_as(admin.user)
        resp = self.get_response(organization.slug, member.id, team.slug)
        assert resp.status_code == 201

        assert OrganizationMemberTeam.objects.filter(team=team, organizationmember=member).exists()


class DeleteOrganizationMemberTeamTest(APITestCase):
    endpoint = "sentry-api-0-organization-member-team-details"
    method = "delete"

    def test_can_leave_as_member(self):
        organization = self.create_organization(name="foo", owner=self.user)
        team = self.create_team(name="foo", organization=organization)
        member = self.create_member(
            organization=organization, user=self.create_user(), role="member", teams=[team]
        )

        self.login_as(member.user)
        resp = self.get_response(organization.slug, member.id, team.slug)
        assert resp.status_code == 200

        assert not OrganizationMemberTeam.objects.filter(
            team=team, organizationmember=member
        ).exists()

    def test_can_leave_as_non_member(self):
        organization = self.create_organization(name="foo", owner=self.user)
        team = self.create_team(name="foo", organization=organization)
        member = self.create_member(
            organization=organization,
            user=self.create_user(is_superuser=False),
            role="member",
            teams=[],
        )

        self.login_as(member.user)
        resp = self.get_response(organization.slug, member.id, team.slug)
        assert resp.status_code == 200

        assert not OrganizationMemberTeam.objects.filter(
            team=team, organizationmember=member
        ).exists()

    def test_can_leave_as_superuser_without_membership(self):
        organization = self.create_organization(name="foo", owner=self.user)
        team = self.create_team(name="foo", organization=organization)
        member = self.create_member(
            organization=organization,
            user=self.create_user(is_superuser=True),
            role="member",
            teams=[],
        )

        self.login_as(member.user)
        resp = self.get_response(organization.slug, member.id, team.slug)
        assert resp.status_code == 200

        assert not OrganizationMemberTeam.objects.filter(
            team=team, organizationmember=member
        ).exists()

    def test_owner_can_remove_member(self):
        user = self.create_user()
        organization = self.create_organization(name="foo", owner=user, flags=0)
        team = self.create_team(name="foo", organization=organization)
        member = self.create_member(
            organization=organization, user=self.create_user(), role="member", teams=[team]
        )

        self.login_as(user)
        resp = self.get_response(organization.slug, member.id, team.slug)
        assert resp.status_code == 200

        assert not OrganizationMemberTeam.objects.filter(
            team=team, organizationmember=member
        ).exists()

    def test_owner_can_remove_manager(self):
        user = self.create_user()
        organization = self.create_organization(name="foo", owner=user, flags=0)
        team = self.create_team(name="foo", organization=organization)
        manager = self.create_member(
            organization=organization, user=self.create_user(), role="manager", teams=[team]
        )

        self.login_as(user)
        resp = self.get_response(organization.slug, manager.id, team.slug)
        assert resp.status_code == 200

        assert not OrganizationMemberTeam.objects.filter(
            team=team, organizationmember=manager
        ).exists()

    def test_owner_can_remove_other_owner(self):
        user = self.create_user()
        organization = self.create_organization(name="foo", owner=user, flags=0)
        team = self.create_team(name="foo", organization=organization)
        owner = self.create_member(
            organization=organization, user=self.create_user(), role="owner", teams=[team]
        )

        self.login_as(user)
        resp = self.get_response(organization.slug, owner.id, team.slug)
        assert resp.status_code == 200

        assert not OrganizationMemberTeam.objects.filter(
            team=team, organizationmember=owner
        ).exists()

    def test_manager_can_remove_member(self):
        organization = self.create_organization(name="foo", flags=0)
        team = self.create_team(name="foo", organization=organization)
        manager = self.create_member(
            organization=organization, user=self.create_user(), role="manager", teams=[team]
        )
        member = self.create_member(
            organization=organization, user=self.create_user(), role="member", teams=[team]
        )

        self.login_as(manager.user)
        resp = self.get_response(organization.slug, member.id, team.slug)
        assert resp.status_code == 200

        assert not OrganizationMemberTeam.objects.filter(
            team=team, organizationmember=member
        ).exists()

    def test_manager_cannot_remove_owner(self):
        organization = self.create_organization(name="foo", flags=0)
        team = self.create_team(name="foo", organization=organization)
        manager = self.create_member(
            organization=organization, user=self.create_user(), role="manager", teams=[team]
        )
        owner = self.create_member(
            organization=organization, user=self.create_user(), role="owner", teams=[team]
        )

        self.login_as(manager.user)
        resp = self.get_response(organization.slug, owner.id, team.slug)
        assert resp.status_code == 400

        assert OrganizationMemberTeam.objects.filter(team=team, organizationmember=owner).exists()

    def test_admin_in_team_can_remove_member(self):
        organization = self.create_organization(name="foo", flags=0)
        team = self.create_team(name="foo", organization=organization)
        admin = self.create_member(
            organization=organization, user=self.create_user(), role="admin", teams=[team]
        )
        member = self.create_member(
            organization=organization, user=self.create_user(), role="member", teams=[team]
        )

        self.login_as(admin.user)
        resp = self.get_response(organization.slug, member.id, team.slug)
        assert resp.status_code == 200

        assert not OrganizationMemberTeam.objects.filter(
            team=team, organizationmember=member
        ).exists()

    def test_admin_not_in_team_cannot_remove_member(self):
        organization = self.create_organization(name="foo", flags=0)
        team = self.create_team(name="foo", organization=organization)
        admin = self.create_member(
            organization=organization, user=self.create_user(), role="admin", teams=[]
        )
        member = self.create_member(
            organization=organization, user=self.create_user(), role="member", teams=[team]
        )

        self.login_as(admin.user)
        resp = self.get_response(organization.slug, member.id, team.slug)
        assert resp.status_code == 400

        assert OrganizationMemberTeam.objects.filter(team=team, organizationmember=member).exists()

    def test_member_cannot_remove_member(self):
        organization = self.create_organization(
            name="foo", flags=Organization.flags.allow_joinleave
        )
        team = self.create_team(name="foo", organization=organization)
        member = self.create_member(
            organization=organization, user=self.create_user(), role="member", teams=[team]
        )
        target_member = self.create_member(
            organization=organization, user=self.create_user(), role="member", teams=[team]
        )

        self.login_as(member.user)
        resp = self.get_response(organization.slug, target_member.id, team.slug)
        assert resp.status_code == 400

        assert OrganizationMemberTeam.objects.filter(
            team=team, organizationmember=target_member
        ).exists()

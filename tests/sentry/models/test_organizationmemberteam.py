from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.roles import team_roles
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationMemberTest(TestCase):
    def setUp(self):
        self.organization = self.create_organization()
        self.team = self.create_team(organization=self.organization)
        self.member = self.create_member(organization=self.organization, user=self.create_user())

    @with_feature("organizations:team-roles")
    def test_get_team_role(self):
        omt = OrganizationMemberTeam(organizationmember=self.member, team=self.team)
        assert omt.get_team_role() == team_roles.get("contributor")

        omt.role = "admin"
        assert omt.get_team_role() == team_roles.get("admin")

    @with_feature("organizations:team-roles")
    def test_get_team_role_derives_minimum_role(self):
        omt = OrganizationMemberTeam(organizationmember=self.member, team=self.team)

        for org_role in ("admin", "manager", "owner"):
            self.member.role = org_role
            assert omt.get_team_role() == team_roles.get("admin")

    @with_feature("organizations:team-roles")
    def test_get_team_role_derives_minimum_role_from_team_membership(self):
        manager_team = self.create_team(org_role="manager")
        member = self.create_member(
            organization=self.organization, user=self.create_user(), teams=[manager_team]
        )
        omt = OrganizationMemberTeam(organizationmember=member, team=manager_team)

        assert omt.get_team_role() == team_roles.get("admin")

from sentry.models import OrganizationMemberTeam
from sentry.roles import team_roles
from sentry.testutils import TestCase


class OrganizationMemberTest(TestCase):
    def setUp(self):
        organization = self.create_organization()
        self.team = self.create_team(organization=organization)
        self.member = self.create_member(organization=organization, user=self.create_user())

    def test_get_team_role(self):
        omt = OrganizationMemberTeam(organizationmember=self.member, team=self.team)
        assert omt.get_team_role() == team_roles.get("contributor")

        omt.role = "admin"
        assert omt.get_team_role() == team_roles.get("admin")

    def test_get_team_role_derives_entry_role(self):
        omt = OrganizationMemberTeam(organizationmember=self.member, team=self.team)

        for org_role in ("admin", "manager", "owner"):
            self.member.role = org_role
            assert omt.get_team_role() == team_roles.get("admin")

    def test_update_team_role(self):
        omt = OrganizationMemberTeam.objects.create(organizationmember=self.member, team=self.team)
        omt.update_team_role(team_roles.get("admin"))
        assert omt.role == "admin"

        omt.refresh_from_db()
        assert omt.role == "admin"

    def test_update_team_role_writes_null(self):
        omt = OrganizationMemberTeam.objects.create(organizationmember=self.member, team=self.team)

        for org_role in ("admin", "manager", "owner"):
            self.member.update(role=org_role)

            for team_role in ("contributor", "admin"):
                omt.update_team_role(team_roles.get(team_role))
                assert omt.role is None

                omt.refresh_from_db()
                assert omt.role is None

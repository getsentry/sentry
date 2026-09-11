from sentry.hybridcloud.models.outbox import CellOutbox, outbox_context
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.roles import team_roles
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.outbox import outbox_runner


class OrganizationMemberTest(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization()
        self.team = self.create_team(organization=self.organization)
        self.member = self.create_member(organization=self.organization, user=self.create_user())

    @with_feature("organizations:team-roles")
    def test_get_team_role(self) -> None:
        omt = OrganizationMemberTeam(organizationmember=self.member, team=self.team)
        assert omt.get_team_role() == team_roles.get("contributor")

        omt.role = "admin"
        assert omt.get_team_role() == team_roles.get("admin")

    @with_feature("organizations:team-roles")
    def test_get_team_role_derives_minimum_role(self) -> None:
        omt = OrganizationMemberTeam(organizationmember=self.member, team=self.team)

        for org_role in ("admin", "manager", "owner"):
            self.member.role = org_role
            assert omt.get_team_role() == team_roles.get("admin")


class OrganizationMemberTeamOutboxTest(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization()
        self.team = self.create_team(organization=self.organization)
        self.member = self.create_member(organization=self.organization, user=self.create_user())
        # Drain the outboxes the fixtures above produce, so the assertions below
        # only see rows attributable to the membership writes under test.
        with outbox_runner():
            pass

    def test_membership_write_produces_no_outbox(self) -> None:
        with outbox_context(flush=False):
            omt = OrganizationMemberTeam.objects.create(
                organizationmember=self.member, team=self.team
            )
            omt.update(role="admin")
            omt.delete()

        assert CellOutbox.objects.count() == 0

    def test_bulk_membership_write_produces_no_outbox(self) -> None:
        with outbox_context(flush=False):
            omts = OrganizationMemberTeam.objects.bulk_create(
                [OrganizationMemberTeam(organizationmember=self.member, team=self.team)]
            )
            OrganizationMemberTeam.objects.filter(id__in=[o.id for o in omts]).delete()

        assert CellOutbox.objects.count() == 0

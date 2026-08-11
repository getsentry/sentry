from django.db import connections, router
from django.test.utils import CaptureQueriesContext

from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.team import Team
from sentry.roles import team_roles
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature


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


class OrganizationMemberTeamShadowIdTest(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization()
        self.team = self.create_team(organization=self.organization)

    def test_create_populates_new_id(self) -> None:
        member = self.create_member(organization=self.organization, user=self.create_user())

        omt = self.create_team_membership(team=self.team, member=member)

        omt.refresh_from_db()
        assert omt.new_id == omt.id

    # Built directly: no fixture exercises bulk_create, which is the path under test.
    def test_bulk_create_populates_new_id(self) -> None:
        members = [
            self.create_member(organization=self.organization, user=self.create_user())
            for _ in range(3)
        ]

        omts = OrganizationMemberTeam.objects.bulk_create(
            [
                OrganizationMemberTeam(organizationmember=member, team=self.team)
                for member in members
            ]
        )

        assert len(omts) == 3
        for omt in omts:
            omt.refresh_from_db()
            assert omt.new_id == omt.id

    def test_update_preserves_new_id(self) -> None:
        member = self.create_member(organization=self.organization, user=self.create_user())
        omt = self.create_team_membership(team=self.team, member=member)

        omt.role = "admin"
        omt.save()

        omt.refresh_from_db()
        assert omt.new_id == omt.id

    def test_create_issues_no_follow_up_update(self) -> None:
        member = self.create_member(organization=self.organization, user=self.create_user())
        using = router.db_for_write(OrganizationMemberTeam)

        with CaptureQueriesContext(connections[using]) as queries:
            self.create_team_membership(team=self.team, member=member)

        updates = [
            query["sql"]
            for query in queries.captured_queries
            if query["sql"].lstrip().upper().startswith("UPDATE")
            and "sentry_organizationmember_teams" in query["sql"]
        ]
        assert updates == []

    def test_sibling_model_does_not_reserve_ids(self) -> None:
        assert Team.shadow_id_field is None
        using = router.db_for_write(Team)

        with CaptureQueriesContext(connections[using]) as queries:
            team = self.create_team(organization=self.organization)

        assert team.id is not None
        assert [
            query["sql"] for query in queries.captured_queries if "nextval" in query["sql"]
        ] == []

    def test_bulk_create_with_no_objects(self) -> None:
        assert list(OrganizationMemberTeam.objects.bulk_create([])) == []

    # Built directly: no fixture exercises a bare save(), which is the path under test.
    def test_bare_save_issues_no_follow_up_update(self) -> None:
        member = self.create_member(organization=self.organization, user=self.create_user())
        using = router.db_for_write(OrganizationMemberTeam)

        with CaptureQueriesContext(connections[using]) as queries:
            OrganizationMemberTeam(organizationmember=member, team=self.team).save()

        updates = [
            query["sql"]
            for query in queries.captured_queries
            if query["sql"].lstrip().upper().startswith("UPDATE")
            and "sentry_organizationmember_teams" in query["sql"]
        ]
        assert updates == []

from unittest import mock

import pytest
from django.db import connections, router
from django.test.utils import CaptureQueriesContext

from sentry.hybridcloud.models.outbox import CellOutbox, outbox_context
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import (
    MAX_RESERVED_IDS,
    OrganizationMemberTeam,
    _reserve_ids,
)
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


class OrganizationMemberTeamShadowIdTest(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization()
        self.team = self.create_team(organization=self.organization)

    def new_member(self) -> OrganizationMember:
        return self.create_member(organization=self.organization, user=self.create_user())

    def omt_updates(self, queries: CaptureQueriesContext) -> list[str]:
        return [
            query["sql"]
            for query in queries.captured_queries
            if query["sql"].lstrip().upper().startswith("UPDATE")
            and "sentry_organizationmember_teams" in query["sql"]
        ]

    def test_create_populates_new_id(self) -> None:
        omt = self.create_team_membership(team=self.team, member=self.new_member())

        omt.refresh_from_db()
        assert omt.new_id == omt.id

    # Built directly: no fixture exercises bulk_create, which is the path under test.
    def test_bulk_create_populates_new_id(self) -> None:
        members = [self.new_member() for _ in range(3)]

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

    # Built directly: no fixture exercises a bare save(), which is the path under test.
    def test_bare_save_populates_new_id(self) -> None:
        omt = OrganizationMemberTeam(organizationmember=self.new_member(), team=self.team)

        omt.save()

        omt.refresh_from_db()
        assert omt.new_id == omt.id

    def test_update_preserves_new_id(self) -> None:
        omt = self.create_team_membership(team=self.team, member=self.new_member())

        omt.role = "admin"
        omt.save()

        omt.refresh_from_db()
        assert omt.new_id == omt.id

    def test_create_issues_no_follow_up_update(self) -> None:
        member = self.new_member()
        using = router.db_for_write(OrganizationMemberTeam)

        with CaptureQueriesContext(connections[using]) as queries:
            self.create_team_membership(team=self.team, member=member)

        assert self.omt_updates(queries) == []

    def test_bare_save_issues_no_follow_up_update(self) -> None:
        omt = OrganizationMemberTeam(organizationmember=self.new_member(), team=self.team)
        using = router.db_for_write(OrganizationMemberTeam)

        with CaptureQueriesContext(connections[using]) as queries:
            omt.save()

        assert self.omt_updates(queries) == []

    def test_bulk_create_with_no_objects(self) -> None:
        assert list(OrganizationMemberTeam.objects.bulk_create([])) == []

    def test_reserve_ids_rejects_a_count_below_one(self) -> None:
        using = router.db_for_write(OrganizationMemberTeam)

        with pytest.raises(ValueError):
            _reserve_ids(OrganizationMemberTeam, 0, using)

        with pytest.raises(ValueError):
            _reserve_ids(OrganizationMemberTeam, -1, using)

    # The ids have to stay unspent: the sequence never hands a value back.
    def test_reserve_ids_rejects_a_count_above_the_ceiling(self) -> None:
        using = router.db_for_write(OrganizationMemberTeam)

        with CaptureQueriesContext(connections[using]) as queries:
            with pytest.raises(ValueError):
                _reserve_ids(OrganizationMemberTeam, MAX_RESERVED_IDS + 1, using)

        assert [query for query in queries.captured_queries if "nextval" in query["sql"]] == []

    # The router is pointed elsewhere so the caller's database is the only thing that
    # can produce a working sequence.
    def test_bulk_create_reserves_ids_on_the_target_database(self) -> None:
        member = self.new_member()
        using = router.db_for_write(OrganizationMemberTeam)

        with mock.patch.object(router, "db_for_write", return_value="secondary"):
            with CaptureQueriesContext(connections[using]) as queries:
                OrganizationMemberTeam.objects.using(using).bulk_create(
                    [OrganizationMemberTeam(organizationmember=member, team=self.team)]
                )

        assert [query for query in queries.captured_queries if "nextval" in query["sql"]]

    # The m2m accessor inserts through-rows via `QuerySet.bulk_create`, bypassing
    # anything defined on the manager.
    def test_m2m_add_populates_new_id(self) -> None:
        member = self.new_member()

        member.teams.add(self.team)

        omt = OrganizationMemberTeam.objects.get(organizationmember=member, team=self.team)
        assert omt.new_id == omt.id

    # `Manager.using(...)` returns a queryset, so this too skips the manager.
    def test_queryset_bulk_create_populates_new_id(self) -> None:
        member = self.new_member()
        using = router.db_for_write(OrganizationMemberTeam)

        OrganizationMemberTeam.objects.using(using).bulk_create(
            [OrganizationMemberTeam(organizationmember=member, team=self.team)]
        )

        omt = OrganizationMemberTeam.objects.get(organizationmember=member, team=self.team)
        assert omt.new_id == omt.id

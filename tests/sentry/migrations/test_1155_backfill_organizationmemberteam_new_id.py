import importlib
from unittest import mock

from sentry.testutils.cases import TestMigrations

# A leading digit is legal in a module name but not in the dotted path mock.patch parses,
# so the module has to be imported by hand to patch anything on it.
migration = importlib.import_module("sentry.migrations.1155_backfill_organizationmemberteam_new_id")


class BackfillOrganizationMemberTeamNewIdTest(TestMigrations):
    app = "sentry"
    migrate_from = "1154_pullrequest_external_id"
    migrate_to = "1155_backfill_organizationmemberteam_new_id"

    def setUp(self):
        # A handful of rows spans several batches at this size, so the migration's
        # chunking is actually exercised rather than served by a single batch.
        with mock.patch.object(migration, "BATCH_SIZE", 2):
            super().setUp()

    def setup_initial_state(self):
        self.organization = self.create_organization()
        self.team = self.create_team(organization=self.organization)
        self.members = [
            self.create_member(organization=self.organization, user=self.create_user())
            for _ in range(6)
        ]

    def setup_before_migration(self, apps):
        OrganizationMemberTeam = apps.get_model("sentry", "OrganizationMemberTeam")

        # The historical model has none of the dual-write hooks, so these land with a
        # null new_id — the pre-deploy rows the backfill exists to fix.
        self.pending = [
            OrganizationMemberTeam.objects.create(
                team_id=self.team.id, organizationmember_id=member.id
            )
            for member in self.members[:-1]
        ]

        # new_id is deliberately not this row's id: production never writes a mismatch,
        # but it proves the backfill selects on "new_id is null" rather than rewriting
        # every row, which is what lets an interrupted run resume.
        self.already_written = OrganizationMemberTeam.objects.create(
            team_id=self.team.id,
            organizationmember_id=self.members[-1].id,
            new_id=-1,
        )

    def test_backfills_only_rows_missing_new_id(self):
        for row in self.pending:
            row.refresh_from_db()
            assert row.new_id == row.id

        self.already_written.refresh_from_db()
        assert self.already_written.new_id == -1

        OrganizationMemberTeam = self.apps.get_model("sentry", "OrganizationMemberTeam")
        assert not OrganizationMemberTeam.objects.filter(new_id__isnull=True).exists()

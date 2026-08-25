import importlib

from django.db import connections

from sentry.testutils.cases import TestMigrations

# A leading digit is legal in a module name but not in an import statement.
migration = importlib.import_module(
    "sentry.migrations.1156_organizationmemberteam_new_id_unique_not_null"
)

INDEX_SHAPE = """
    SELECT i.indisunique, i.indisvalid, c.conname
    FROM pg_class idx
    JOIN pg_index i ON i.indexrelid = idx.oid
    LEFT JOIN pg_constraint c ON c.conindid = idx.oid
    WHERE idx.relname = %s
"""

COLUMN_IS_NOT_NULL = """
    SELECT attnotnull
    FROM pg_attribute
    WHERE attrelid = 'sentry_organizationmember_teams'::regclass AND attname = 'new_id'
"""


class OrganizationMemberTeamNewIdUniqueNotNullTest(TestMigrations):
    app = "sentry"
    migrate_from = "1155_backfill_organizationmemberteam_new_id"
    migrate_to = "1156_organizationmemberteam_new_id_unique_not_null"

    def setup_initial_state(self):
        self.organization = self.create_organization()
        self.team = self.create_team(organization=self.organization)
        self.member = self.create_member(organization=self.organization, user=self.create_user())

    def setup_before_migration(self, apps):
        OrganizationMemberTeam = apps.get_model("sentry", "OrganizationMemberTeam")

        # The historical model has no dual-write hooks, so new_id has to be set by hand.
        self.membership = OrganizationMemberTeam.objects.create(
            team_id=self.team.id, organizationmember_id=self.member.id
        )
        self.membership.new_id = self.membership.id
        self.membership.save()

    def test_builds_a_bare_unique_index_and_a_not_null_column(self):
        with connections[self.connection].cursor() as cursor:
            cursor.execute(INDEX_SHAPE, [migration.NEW_ID_INDEX])
            index = cursor.fetchone()

            cursor.execute(COLUMN_IS_NOT_NULL)
            (not_null,) = cursor.fetchone()

        assert index is not None, f"{migration.NEW_ID_INDEX} was not created"
        is_unique, is_valid, owning_constraint = index
        assert is_unique
        assert is_valid

        # The load-bearing one: a UniqueConstraint would leave the PK swap nothing to attach to.
        assert owning_constraint is None

        assert not_null

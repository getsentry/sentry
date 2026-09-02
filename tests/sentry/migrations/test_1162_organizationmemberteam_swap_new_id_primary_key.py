from django.db import connection

from sentry.testutils.cases import TestMigrations

# Past int4, so a row carrying it can only have come through the wide column.
WIDE_ID = 2_147_483_648


def fetch_columns():
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'sentry_organizationmember_teams'
              AND column_name IN ('id', 'new_id')
            """
        )
        rows = cursor.fetchall()
    return {name: (data_type, default) for name, data_type, default in rows}


def fetch_primary_key():
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT pk.constraint_name, pk_columns.column_name
            FROM information_schema.table_constraints pk
            JOIN information_schema.key_column_usage pk_columns
              ON pk_columns.constraint_name = pk.constraint_name
            WHERE pk.table_name = 'sentry_organizationmember_teams'
              AND pk.constraint_type = 'PRIMARY KEY'
            """
        )
        return cursor.fetchall()


def fetch_sequence_type():
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT seqtypid::regtype::text FROM pg_sequence "
            "WHERE seqrelid = 'sentry_organizationmember_teams_id_seq'::regclass"
        )
        (sequence_type,) = cursor.fetchone()
        return sequence_type


def fetch_id_sequence_name():
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_get_serial_sequence('sentry_organizationmember_teams', 'id')")
        (sequence_name,) = cursor.fetchone()
        return sequence_name


def id_is_identity():
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT is_identity FROM information_schema.columns
            WHERE table_name = 'sentry_organizationmember_teams' AND column_name = 'id'
            """
        )
        (is_identity,) = cursor.fetchone()
        return is_identity == "YES"


def next_sequence_value():
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END "
            "FROM sentry_organizationmember_teams_id_seq"
        )
        (next_id,) = cursor.fetchone()
        return next_id


def assert_identity_id():
    # Rolling 1162 back always restores an identity, so this shape needs no reshaping.
    assert id_is_identity()


def force_sequence_backed_id():
    # Production's shape, which predates Django emitting identity columns.
    next_id = next_sequence_value()
    with connection.cursor() as cursor:
        cursor.execute("ALTER TABLE sentry_organizationmember_teams ALTER COLUMN id DROP IDENTITY")
        cursor.execute(
            "CREATE SEQUENCE sentry_organizationmember_teams_id_seq AS integer "
            f"START WITH {next_id} OWNED BY sentry_organizationmember_teams.id"
        )
        cursor.execute(
            "ALTER TABLE sentry_organizationmember_teams ALTER COLUMN id "
            "SET DEFAULT nextval('sentry_organizationmember_teams_id_seq')"
        )


class SwapOrganizationMemberTeamNewIdPrimaryKeyTest(TestMigrations):
    app = "sentry"
    migrate_from = "1161_drop_organizationmapping_require_email_verification_pending"
    migrate_to = "1162_organizationmemberteam_swap_new_id_primary_key"

    def prepare_id_shape(self):
        assert_identity_id()

    def setup_initial_state(self):
        self.organization = self.create_organization()
        self.team = self.create_team(organization=self.organization)
        self.member = self.create_member(organization=self.organization, user=self.create_user())
        self.other_member = self.create_member(
            organization=self.organization, user=self.create_user()
        )

    def setup_before_migration(self, apps):
        self.prepare_id_shape()
        ((self.original_pk_name, _),) = fetch_primary_key()

        OrganizationMemberTeam = apps.get_model("sentry", "OrganizationMemberTeam")

        # The historical model has none of the dual-write hooks and new_id is NOT NULL, so the
        # realistic row is created with a placeholder and squared up afterwards.
        self.matched = OrganizationMemberTeam.objects.create(
            team_id=self.team.id, organizationmember_id=self.member.id, new_id=-1
        )
        OrganizationMemberTeam.objects.filter(id=self.matched.id).update(new_id=self.matched.id)

        # Production never writes a mismatch, but it is what proves the surviving id column is
        # the wide one rather than the two happening to agree.
        self.mismatched = OrganizationMemberTeam.objects.create(
            team_id=self.team.id,
            organizationmember_id=self.other_member.id,
            new_id=WIDE_ID,
        )

    # One test method: setUp runs the whole migrate-down, seed, migrate-up cycle per method.
    def test_new_id_became_the_primary_key(self):
        columns = fetch_columns()
        assert columns["id"][0] == "bigint"
        assert columns["new_id"][0] == "integer"
        assert columns["new_id"][1] is None

        assert id_is_identity()
        assert fetch_primary_key() == [(self.original_pk_name, "id")]

        # _reserve_ids selects from this name, so an identity named after the pre-rename
        # column would break every insert.
        assert fetch_id_sequence_name() == "public.sentry_organizationmember_teams_id_seq"

        # A narrow sequence would cap inserts at 2^31 whatever the column can hold.
        assert fetch_sequence_type() == "bigint"

        OrganizationMemberTeam = self.apps.get_model("sentry", "OrganizationMemberTeam")

        swapped = OrganizationMemberTeam.objects.get(new_id=self.matched.id)
        assert swapped.id == self.matched.id

        swapped = OrganizationMemberTeam.objects.get(new_id=self.mismatched.id)
        assert swapped.id == WIDE_ID

        # No id given, so this only works if the identity survived the swap. A restarted
        # sequence would hand back an id that is already taken.
        third_member = self.create_member(organization=self.organization, user=self.create_user())
        inserted = OrganizationMemberTeam.objects.create(
            team_id=self.team.id, organizationmember_id=third_member.id, new_id=0
        )
        assert inserted.id > self.matched.id

        # What _reserve_ids does: claim from the sequence, then insert that id explicitly.
        # GENERATED ALWAYS would reject this; BY DEFAULT must not.
        fourth_member = self.create_member(organization=self.organization, user=self.create_user())
        with connection.cursor() as cursor:
            cursor.execute("SELECT nextval('sentry_organizationmember_teams_id_seq')")
            (claimed_id,) = cursor.fetchone()
        explicit = OrganizationMemberTeam.objects.create(
            id=claimed_id,
            team_id=self.team.id,
            organizationmember_id=fourth_member.id,
            new_id=claimed_id,
        )
        assert explicit.id == claimed_id


class SwapSequenceBackedOrganizationMemberTeamNewIdPrimaryKeyTest(
    SwapOrganizationMemberTeamNewIdPrimaryKeyTest
):
    """The same swap against production's shape, where id is sequence-backed, not an identity."""

    def prepare_id_shape(self):
        force_sequence_backed_id()

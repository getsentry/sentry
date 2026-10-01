import pytest
from django.db import IntegrityError, connection

from sentry.testutils.cases import TestMigrations

# Past int4, so a row carrying it can only have come through the wide column.
WIDE_ID = 2_147_483_648


def fetch_columns():
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'sentry_release'
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
            WHERE pk.table_name = 'sentry_release'
              AND pk.constraint_type = 'PRIMARY KEY'
            """
        )
        return cursor.fetchall()


def fetch_index_definitions():
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'sentry_release'"
        )
        rows = cursor.fetchall()
    return dict(rows)


def fetch_foreign_keys():
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT fk.conrelid::regclass::text, fk.conname, referenced.attname, fk.convalidated
            FROM pg_constraint fk
            JOIN pg_attribute referenced
              ON referenced.attrelid = fk.confrelid
             AND referenced.attnum = ANY(fk.confkey)
            WHERE fk.contype = 'f'
              AND fk.confrelid = 'sentry_release'::regclass
            ORDER BY 1, 2
            """
        )
        return cursor.fetchall()


def fetch_sequence_type():
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT seqtypid::regtype::text FROM pg_sequence "
            "WHERE seqrelid = 'sentry_release_id_seq'::regclass"
        )
        (sequence_type,) = cursor.fetchone()
        return sequence_type


def fetch_id_sequence_name():
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_get_serial_sequence('sentry_release', 'id')")
        (sequence_name,) = cursor.fetchone()
        return sequence_name


def id_is_identity():
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT is_identity FROM information_schema.columns
            WHERE table_name = 'sentry_release' AND column_name = 'id'
            """
        )
        (is_identity,) = cursor.fetchone()
        return is_identity == "YES"


def next_sequence_value():
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END "
            "FROM sentry_release_id_seq"
        )
        (next_id,) = cursor.fetchone()
        return next_id


def assert_identity_id():
    # Rolling 1205 back always restores an identity, so this shape needs no reshaping.
    assert id_is_identity()


def force_us1_shape():
    # US-1's shape: a narrow id that predates Django emitting identity columns, plus a
    # hand-built (id, organization_id) index that no migration knows about.
    next_id = next_sequence_value()
    with connection.cursor() as cursor:
        cursor.execute("ALTER TABLE sentry_release ALTER COLUMN id DROP IDENTITY")
        cursor.execute("ALTER TABLE sentry_release ALTER COLUMN id TYPE integer")
        cursor.execute(
            "CREATE SEQUENCE sentry_release_id_seq AS integer "
            f"START WITH {next_id} OWNED BY sentry_release.id"
        )
        cursor.execute(
            "ALTER TABLE sentry_release ALTER COLUMN id "
            "SET DEFAULT nextval('sentry_release_id_seq')"
        )
        cursor.execute(
            "CREATE INDEX sentry_release_id_organization_id ON sentry_release (id, organization_id)"
        )


class SwapReleaseNewIdPrimaryKeyTest(TestMigrations):
    app = "sentry"
    migrate_from = "1204_drop_alertruleactivity"
    migrate_to = "1205_release_swap_new_id_primary_key"

    # A fresh database, like DE, starts with a bigint id, so the leftover column keeps that.
    old_id_type = "bigint"

    def prepare_table_shape(self):
        assert_identity_id()

    def setup_initial_state(self):
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)

    def setup_before_migration(self, apps):
        self.prepare_table_shape()
        self.foreign_keys_before = fetch_foreign_keys()
        assert self.foreign_keys_before

        Release = apps.get_model("sentry", "Release")

        # The historical model has none of the dual-write hooks and new_id is NOT NULL, so the
        # realistic row is created with a placeholder and squared up afterwards.
        self.matched = Release.objects.create(
            organization_id=self.organization.id, version="matched", new_id=-1
        )
        Release.objects.filter(id=self.matched.id).update(new_id=self.matched.id)

        # Production never writes a mismatch, but it is what proves the surviving id column is
        # the wide one rather than the two happening to agree.
        self.mismatched = Release.objects.create(
            organization_id=self.organization.id, version="mismatched", new_id=WIDE_ID
        )

    # One test method: setUp runs the whole migrate-down, seed, migrate-up cycle per method.
    def test_new_id_became_the_primary_key(self):
        columns = fetch_columns()
        assert columns["id"][0] == "bigint"
        assert columns["new_id"][0] == self.old_id_type
        assert columns["new_id"][1] is None

        assert id_is_identity()
        assert fetch_primary_key() == [("sentry_release_pkey", "id")]

        # _reserve_ids selects from this name, so an identity named after the pre-rename
        # column would break every insert.
        assert fetch_id_sequence_name() == "public.sentry_release_id_seq"

        # A narrow sequence would cap inserts at 2^31 whatever the column can hold.
        assert fetch_sequence_type() == "bigint"

        indexes = fetch_index_definitions()
        assert "sentry_release_new_id_organization_id" not in indexes
        assert "sentry_release_new_id_uniq" not in indexes
        assert indexes["sentry_release_id_organization_id"].endswith("(id, organization_id)")

        # Every foreign key survives, now pinned to the wide column, and NOT VALID still
        # enforces new rows even though existing ones went unchecked.
        foreign_keys_after = fetch_foreign_keys()
        assert [(table, name) for table, name, _, _ in foreign_keys_after] == [
            (table, name) for table, name, _, _ in self.foreign_keys_before
        ]
        assert all(column == "id" for _, _, column, _ in foreign_keys_after)
        assert not any(validated for _, _, _, validated in foreign_keys_after)

        Release = self.apps.get_model("sentry", "Release")
        ReleaseProject = self.apps.get_model("sentry", "ReleaseProject")

        with connection.cursor() as cursor, pytest.raises(IntegrityError):
            cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")
            ReleaseProject.objects.create(project_id=self.project.id, release_id=WIDE_ID + 1)

        swapped = Release.objects.get(new_id=self.matched.id)
        assert swapped.id == self.matched.id

        swapped = Release.objects.get(new_id=self.mismatched.id)
        assert swapped.id == WIDE_ID

        # No id given, so this only works if the identity survived the swap. A restarted
        # sequence would hand back an id that is already taken.
        inserted = Release.objects.create(
            organization_id=self.organization.id, version="inserted", new_id=0
        )
        assert inserted.id > self.matched.id

        # What _reserve_ids does: claim from the sequence, then insert that id explicitly.
        # GENERATED ALWAYS would reject this; BY DEFAULT must not.
        with connection.cursor() as cursor:
            cursor.execute("SELECT nextval('sentry_release_id_seq')")
            (claimed_id,) = cursor.fetchone()
        explicit = Release.objects.create(
            id=claimed_id,
            organization_id=self.organization.id,
            version="explicit",
            new_id=claimed_id,
        )
        assert explicit.id == claimed_id


class SwapUs1ShapedReleaseNewIdPrimaryKeyTest(SwapReleaseNewIdPrimaryKeyTest):
    """The same swap against US-1's shape: a narrow, sequence-backed id and the hand-built index."""

    old_id_type = "integer"

    def prepare_table_shape(self):
        force_us1_shape()

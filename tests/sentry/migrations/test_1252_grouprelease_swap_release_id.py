import importlib

import pytest
from django.db import IntegrityError, InternalError, connection
from django.db.migrations.state import StateApps

from sentry.testutils.cases import TestMigrations

migration = importlib.import_module("sentry.migrations.1252_grouprelease_swap_release_id")

WIDE_RELEASE_ID = 2_147_483_648
US1_UNIQUE_NAME = "sentry_grouprelease_group_id_46ba6e430d088d04_uniq"
US1_RELEASE_ID_INDEX = "sentry_grouprelease_release_id"


def fetch_column_types() -> dict[str, str]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'sentry_grouprelease'
              AND column_name IN ('release_id', 'new_release_id')
            """
        )
        rows = cursor.fetchall()
    return dict(rows)


def fetch_column_nullability() -> dict[str, str]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT column_name, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'sentry_grouprelease'
              AND column_name IN ('release_id', 'new_release_id')
            """
        )
        rows = cursor.fetchall()
    return dict(rows)


def fetch_unique_constraint_columns(name: str) -> list[str] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT array_agg(attribute.attname ORDER BY key.position)
            FROM pg_constraint
            CROSS JOIN LATERAL unnest(pg_constraint.conkey) WITH ORDINALITY AS key(attnum, position)
            JOIN pg_attribute attribute
              ON attribute.attrelid = pg_constraint.conrelid
             AND attribute.attnum = key.attnum
            WHERE pg_constraint.conrelid = 'sentry_grouprelease'::regclass
              AND pg_constraint.contype = 'u'
              AND pg_constraint.conname = %s
            """,
            [name],
        )
        (columns,) = cursor.fetchone()
    return columns


def fetch_index_columns(name: str) -> list[str] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT array_agg(attribute.attname ORDER BY key.position)
            FROM pg_index
            JOIN pg_class index_class ON index_class.oid = pg_index.indexrelid
            CROSS JOIN LATERAL unnest(pg_index.indkey) WITH ORDINALITY AS key(attnum, position)
            JOIN pg_attribute attribute
              ON attribute.attrelid = pg_index.indrelid
             AND attribute.attnum = key.attnum
            WHERE pg_index.indrelid = 'sentry_grouprelease'::regclass
              AND index_class.relname = %s
            """,
            [name],
        )
        (columns,) = cursor.fetchone()
    return columns


def fetch_check_names() -> list[str]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'sentry_grouprelease'::regclass
              AND contype = 'c'
              AND conname IN (%s, %s)
            ORDER BY conname
            """,
            [migration.RELEASE_ID_CHECK, migration.NEW_RELEASE_ID_CHECK],
        )
        rows = cursor.fetchall()
    return [name for (name,) in rows]


def fetch_catalog_snapshot() -> dict[str, list[tuple[str, ...]]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'sentry_grouprelease'
            ORDER BY column_name
            """
        )
        columns = cursor.fetchall()

        cursor.execute(
            """
            SELECT conname, pg_get_constraintdef(oid)
            FROM pg_constraint
            WHERE conrelid = 'sentry_grouprelease'::regclass
            ORDER BY conname
            """
        )
        constraints = cursor.fetchall()

        cursor.execute(
            """
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'sentry_grouprelease'
            ORDER BY indexname
            """
        )
        indexes = cursor.fetchall()
    return {"columns": columns, "constraints": constraints, "indexes": indexes}


class SwapGroupReleaseReleaseIdTest(TestMigrations):
    app = "sentry"
    migrate_from = "1251_add_apisetupcode"
    migrate_to = "1252_grouprelease_swap_release_id"

    narrow_type = "integer"

    def prepare_table_shape(self) -> None:
        pass

    def setup_initial_state(self) -> None:
        self.project = self.create_project()
        self.group = self.create_group(project=self.project)

    def setup_before_migration(self, apps: StateApps) -> None:
        self.prepare_table_shape()

        GroupRelease = apps.get_model("sentry", "GroupRelease")

        self.matched = GroupRelease.objects.create(
            project_id=self.project.id,
            group_id=self.group.id,
            release_id=5,
            new_release_id=5,
        )
        self.mismatched = GroupRelease.objects.create(
            project_id=self.project.id,
            group_id=self.group.id,
            release_id=7,
            new_release_id=WIDE_RELEASE_ID,
        )

    def test_wide_column_became_release_id(self) -> None:
        with self.subTest("column types"):
            column_types = fetch_column_types()
            assert column_types["release_id"] == "bigint"
            assert column_types["new_release_id"] == self.narrow_type

        with self.subTest("narrow column is nullable"):
            assert fetch_column_nullability() == {"release_id": "NO", "new_release_id": "YES"}

        with self.subTest("unique constraint"):
            columns = fetch_unique_constraint_columns(migration.UNIQUE_NAME)
            assert columns == ["group_id", "release_id", "environment"]

        with self.subTest("indexes"):
            assert fetch_index_columns(migration.RELEASE_ID_INDEX) == ["release_id"]
            assert fetch_index_columns(migration.NEW_RELEASE_ID_INDEX) == ["new_release_id"]
            assert fetch_index_columns(migration.UNIQUE_TWIN) is None
            assert fetch_index_columns(migration.INDEX_TWIN) is None

        with self.subTest("check constraint"):
            assert fetch_check_names() == [migration.NEW_RELEASE_ID_CHECK]

        with self.subTest("rows"):
            GroupRelease = self.apps.get_model("sentry", "GroupRelease")

            matched = GroupRelease.objects.get(id=self.matched.id)
            assert (matched.release_id, matched.new_release_id) == (5, 5)

            mismatched = GroupRelease.objects.get(id=self.mismatched.id)
            assert (mismatched.release_id, mismatched.new_release_id) == (WIDE_RELEASE_ID, 7)

        with self.subTest("unique constraint is enforced"):
            with connection.cursor() as cursor:
                with pytest.raises(IntegrityError):
                    cursor.execute(
                        """
                        INSERT INTO sentry_grouprelease
                            (project_id, group_id, release_id, new_release_id, environment,
                             first_seen, last_seen)
                        VALUES (%s, %s, %s, 1, '', now(), now())
                        """,
                        [self.project.id, self.group.id, WIDE_RELEASE_ID],
                    )

        with self.subTest("second run is a no-op"):
            snapshot_before = fetch_catalog_snapshot()
            with connection.cursor() as cursor:
                cursor.execute(migration.SWAP_SQL)
            assert fetch_catalog_snapshot() == snapshot_before


class SwapUs1ShapedGroupReleaseReleaseIdTest(SwapGroupReleaseReleaseIdTest):
    """The same swap against US-1's shape: older unique and index names, and a bigint release_id."""

    narrow_type = "bigint"

    def prepare_table_shape(self) -> None:
        with connection.cursor() as cursor:
            cursor.execute(
                f'ALTER TABLE sentry_grouprelease RENAME CONSTRAINT "{migration.UNIQUE_NAME}" '
                f'TO "{US1_UNIQUE_NAME}"'
            )
            cursor.execute(
                f'ALTER INDEX "{migration.RELEASE_ID_INDEX}" RENAME TO "{US1_RELEASE_ID_INDEX}"'
            )
            cursor.execute("ALTER TABLE sentry_grouprelease ALTER COLUMN release_id TYPE bigint")

    def tearDown(self) -> None:
        super().tearDown()
        # Later test classes expect the canonical integer column.
        with connection.cursor() as cursor:
            cursor.execute(
                "ALTER TABLE sentry_grouprelease ALTER COLUMN new_release_id TYPE integer"
            )


class SwapGroupReleaseInvalidTwinTest(TestMigrations):
    app = "sentry"
    # Both before the swap, so the table is left unswapped and the test runs SWAP_SQL itself.
    migrate_from = "1251_add_apisetupcode"
    migrate_to = "1251_add_apisetupcode"

    def test_invalid_twin_index_aborts_the_swap(self) -> None:
        snapshot_before = fetch_catalog_snapshot()

        with connection.cursor() as cursor:
            # What an interrupted CREATE INDEX CONCURRENTLY leaves behind.
            cursor.execute(
                "UPDATE pg_index SET indisvalid = false "
                "WHERE indexrelid = 'sentry_grouprelease_new_release_id'::regclass"
            )
            try:
                with pytest.raises(InternalError, match="is missing or invalid"):
                    cursor.execute(migration.SWAP_SQL)
            finally:
                cursor.execute(
                    "UPDATE pg_index SET indisvalid = true "
                    "WHERE indexrelid = 'sentry_grouprelease_new_release_id'::regclass"
                )

        assert fetch_catalog_snapshot() == snapshot_before

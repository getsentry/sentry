import importlib

from django.db import connection

from sentry.testutils.cases import TestMigrations

# An import statement can't name a module that starts with a digit.
migration = importlib.import_module("sentry.migrations.1234_grouprelease_new_release_id_indexes")


def fetch_index(name):
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT i.indexrelid, i.indisvalid, i.indisunique, pg_get_indexdef(i.indexrelid) "
            "FROM pg_index i WHERE i.indexrelid = to_regclass(%s)",
            [name],
        )
        return cursor.fetchone()


def count_constraints_owning(index_oid):
    with connection.cursor() as cursor:
        cursor.execute("SELECT count(*) FROM pg_constraint WHERE conindid = %s", [index_oid])
        row = cursor.fetchone()
    return row[0]


class GroupReleaseNewReleaseIdIndexesTest(TestMigrations):
    app = "sentry"
    migrate_from = "1233_backfill_grouprelease_new_release_id"
    migrate_to = "1234_grouprelease_new_release_id_indexes"

    def test_builds_both_indexes(self):
        unique_oid, unique_valid, is_unique, unique_def = fetch_index(migration.UNIQUE_INDEX_NAME)
        assert unique_valid
        assert is_unique
        assert unique_def.endswith("(group_id, new_release_id, environment)")
        assert count_constraints_owning(unique_oid) == 0

        _, plain_valid, plain_is_unique, plain_def = fetch_index(migration.INDEX_NAME)
        assert plain_valid
        assert not plain_is_unique
        assert plain_def.endswith("(new_release_id)")

    def test_guard_keeps_valid_indexes_and_drops_invalid_ones(self):
        unique_oid, *_ = fetch_index(migration.UNIQUE_INDEX_NAME)
        plain_oid, *_ = fetch_index(migration.INDEX_NAME)

        with connection.schema_editor(atomic=False) as editor:
            migration.drop_invalid_indexes(None, editor)

        unique_after = fetch_index(migration.UNIQUE_INDEX_NAME)
        plain_after = fetch_index(migration.INDEX_NAME)
        assert unique_after[0] == unique_oid
        assert plain_after[0] == plain_oid

        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE pg_index SET indisvalid = false WHERE indexrelid = to_regclass(%s)",
                [migration.UNIQUE_INDEX_NAME],
            )

        with connection.schema_editor(atomic=False) as editor:
            migration.drop_invalid_indexes(None, editor)

        unique_after = fetch_index(migration.UNIQUE_INDEX_NAME)
        plain_after = fetch_index(migration.INDEX_NAME)
        assert unique_after is None
        assert plain_after[0] == plain_oid

        with connection.schema_editor(atomic=False) as editor:
            migration.drop_invalid_indexes(None, editor)

from django.db import connection

from sentry.testutils.cases import TestMigrations


def fetch_release_foreign_keys():
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT conrelid::regclass::text, conname, convalidated
            FROM pg_constraint
            WHERE contype = 'f'
              AND confrelid = 'sentry_release'::regclass
            ORDER BY 1, 2
            """
        )
        return cursor.fetchall()


class ValidateReleaseForeignKeysTest(TestMigrations):
    app = "sentry"
    # Starts before 1207 so its replay re-adds the keys NOT VALID; reversing 1210 cannot
    # unvalidate them.
    migrate_from = "1206_add_dashboard_create_scope"
    migrate_to = "1210_release_validate_foreign_keys"

    def test_every_foreign_key_is_validated(self):
        foreign_keys = fetch_release_foreign_keys()
        assert foreign_keys
        unvalidated = [(table, name) for table, name, validated in foreign_keys if not validated]
        assert unvalidated == []

import importlib

import pytest
from django.db import InternalError, connection

from sentry.testutils.cases import TestMigrations

swap_migration = importlib.import_module("sentry.migrations.1252_grouprelease_swap_release_id")
migration = importlib.import_module(
    "sentry.migrations.1253_grouprelease_drop_new_release_id_pending"
)


class RequireSwapTest(TestMigrations):
    app = "sentry"
    # Both before the swap, so the table is left unswapped and the test swaps it itself.
    migrate_from = "1251_add_apisetupcode"
    migrate_to = "1251_add_apisetupcode"

    def test_refuses_to_run_until_the_table_is_swapped(self) -> None:
        with connection.cursor() as cursor:
            with pytest.raises(InternalError, match="is not swapped"):
                cursor.execute(migration.REQUIRE_SWAP_SQL)

            cursor.execute(swap_migration.SWAP_SQL)
            cursor.execute(migration.REQUIRE_SWAP_SQL)

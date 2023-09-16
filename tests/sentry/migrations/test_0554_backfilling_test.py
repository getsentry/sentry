from sentry.constants import ObjectStatus
from sentry.testutils.cases import TestMigrations


class MigrateNoActionDupleIssueAlerts(TestMigrations):
    migrate_from = "0553_add_new_index_to_groupedmessage_table"
    migrate_to = "0554_backfilling_test"

    def setup_initial_state(self):
        print("setup")

    def test(self):
        print("test")

import pytest

from sentry.testutils.cases import TestMigrations


@pytest.mark.skip(reason="group.priority_locked is removed in the next migration")
class AddPriorityColumnTests(TestMigrations):
    migrate_from = "0630_better_monitor_latest_index"
    migrate_to = "0631_add_priority_columns_to_groupedmessage"

    def setup_initial_state(self):
        self.group = self.create_group()

    def test(self):
        self.group.refresh_from_db()
        assert self.group.priority is None
        assert not self.group.priority_locked

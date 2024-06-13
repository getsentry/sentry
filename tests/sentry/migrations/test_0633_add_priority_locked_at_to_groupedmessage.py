import pytest

from sentry.testutils.cases import TestMigrations
from sentry.testutils.silo import no_silo_test


@pytest.mark.skip("Migration is no longer runnable. Retain until migration is removed.")
@no_silo_test
class AddPriorityColumnTests(TestMigrations):
    migrate_from = "0632_apitoken_backfill_last_chars"
    migrate_to = "0633_add_priority_locked_at_to_groupedmessage"

    def setup_initial_state(self):
        self.group = self.create_group()

    def test(self):
        self.group.refresh_from_db()
        assert self.group.priority is None
        with pytest.raises(AttributeError):
            assert not self.group.priority_locked
        assert not self.group.priority_locked_at

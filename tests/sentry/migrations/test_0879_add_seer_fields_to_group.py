from sentry.testutils.cases import TestMigrations


class TestAddSeerFieldsToGroup(TestMigrations):
    migrate_from = "0878_backfill_open_periods"
    migrate_to = "0879_add_seer_fields_to_group"

    def setup_initial_state(self):
        self.group = self.create_group()

    def test(self):
        self.group.refresh_from_db()
        assert self.group.seer_fixability_score is None
        assert self.group.seer_autofix_last_triggered is None

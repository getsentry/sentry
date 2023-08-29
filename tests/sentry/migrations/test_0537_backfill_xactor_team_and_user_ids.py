from sentry.testutils.cases import TestMigrations


class BackfillTombstones(TestMigrations):
    migrate_from = "0536_backfill_tombstones"
    migrate_to = "0537_backfill_xactor_team_and_user_ids"

    def setup_initial_state(self):
        self.xu = xu = self.create_external_user()
        self.xt = xt = self.create_external_team()

        assert xu.user_id is None
        assert xt.team_id is None

    def test_duplicated_all_tombstones(self):
        self.xu.refresh_from_db()
        self.xt.refresh_from_db()
        assert self.xu.user_id == self.xu.actor.user_id
        assert self.xt.team_id == self.xt.actor.team_id

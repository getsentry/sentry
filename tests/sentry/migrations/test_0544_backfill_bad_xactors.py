from sentry.models import ExternalActor
from sentry.testutils.cases import TestMigrations


class BackfillTombstones(TestMigrations):
    migrate_from = "0543_add_last_verified_auth_ident_replica"
    migrate_to = "0544_backfill_fix_bad_xactors"

    def setup_initial_state(self):
        self.xu = xu = self.create_external_user()
        self.xt = xt = self.create_external_team()
        self.xx = xx = self.create_external_team(team=self.create_team(self.create_organization()))

        xu.user_id = None
        xu.team_id = None
        xu.save()
        xt.team_id = None
        xt.user_id = None
        xt.save()
        xx.team_id = None
        xx.user_id = None
        xx.save()
        xx.actor.team_id = None
        xx.actor.user_id = None
        xx.actor.save()

    def test_duplicated_all_tombstones(self):
        self.xu.refresh_from_db()
        self.xt.refresh_from_db()
        assert self.xu.user_id == self.xu.actor.user_id
        assert self.xt.team_id == self.xt.actor.team_id

        assert not ExternalActor.objects.filter(id=self.xx.id).exists()

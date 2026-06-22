from django.db.migrations.state import StateApps
from django.utils import timezone

from sentry.testutils.cases import TestMigrations


class BackfillNightShiftRunShardsTest(TestMigrations):
    app = "seer"
    migrate_from = "0019_add_night_shift_run_shard"
    migrate_to = "0020_backfill_night_shift_run_shards"

    def setup_before_migration(self, apps: StateApps) -> None:
        SeerRun = apps.get_model("seer", "SeerRun")
        SeerNightShiftRun = apps.get_model("seer", "SeerNightShiftRun")
        SeerNightShiftRunShard = apps.get_model("seer", "SeerNightShiftRunShard")

        org_id = self.organization.id

        # Pre-shard run: scalar seer_run, no shard -> should get a shard.
        self.pre_shard_seer_run = SeerRun.objects.create(
            organization_id=org_id, type="feature_run", last_triggered_at=timezone.now()
        )
        self.pre_shard_run = SeerNightShiftRun.objects.create(
            organization_id=org_id, seer_run=self.pre_shard_seer_run
        )

        # No seer_run -> skipped.
        self.no_seer_run = SeerNightShiftRun.objects.create(organization_id=org_id)

        # Already sharded -> not duplicated (idempotent).
        already_seer_run = SeerRun.objects.create(
            organization_id=org_id, type="feature_run", last_triggered_at=timezone.now()
        )
        self.already_sharded_run = SeerNightShiftRun.objects.create(
            organization_id=org_id, seer_run=already_seer_run
        )
        SeerNightShiftRunShard.objects.create(
            run=self.already_sharded_run, seer_run=already_seer_run
        )

    def test_backfill(self) -> None:
        SeerNightShiftRunShard = self.apps.get_model("seer", "SeerNightShiftRunShard")

        shards = list(SeerNightShiftRunShard.objects.filter(run_id=self.pre_shard_run.id))
        assert len(shards) == 1
        assert shards[0].seer_run_id == self.pre_shard_seer_run.id

        assert not SeerNightShiftRunShard.objects.filter(run_id=self.no_seer_run.id).exists()

        assert (
            SeerNightShiftRunShard.objects.filter(run_id=self.already_sharded_run.id).count() == 1
        )

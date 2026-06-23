import importlib

from django.apps import apps as global_apps

from sentry.seer.models.night_shift import SeerNightShiftRun, SeerNightShiftRunShard
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all

# Module name starts with a digit, so it can't be imported with `import`.
_migration = importlib.import_module("sentry.seer.migrations.0020_backfill_night_shift_run_shards")


@django_db_all
class BackfillNightShiftRunShardsTest(TestCase):
    def _backfill(self) -> None:
        _migration.backfill_night_shift_run_shards(global_apps, None)

    def test_backfills_pre_shard_run(self) -> None:
        org = self.create_organization()
        seer_run = self.create_seer_run(organization=org)
        run = SeerNightShiftRun.objects.create(organization=org, seer_run=seer_run)

        self._backfill()

        shard = SeerNightShiftRunShard.objects.get(run=run)
        assert shard.seer_run_id == seer_run.id

    def test_skips_run_without_seer_run(self) -> None:
        org = self.create_organization()
        run = SeerNightShiftRun.objects.create(organization=org)

        self._backfill()

        assert not SeerNightShiftRunShard.objects.filter(run=run).exists()

    def test_idempotent_for_already_sharded_run(self) -> None:
        org = self.create_organization()
        seer_run = self.create_seer_run(organization=org)
        run = SeerNightShiftRun.objects.create(organization=org, seer_run=seer_run)
        existing = SeerNightShiftRunShard.objects.create(run=run, seer_run=seer_run)

        self._backfill()

        shards = list(SeerNightShiftRunShard.objects.filter(run=run))
        assert [s.id for s in shards] == [existing.id]

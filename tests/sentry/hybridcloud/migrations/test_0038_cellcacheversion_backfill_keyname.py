from django.db.migrations.state import StateApps

from sentry.testutils.cases import TestMigrations
from sentry.testutils.silo import cell_silo_test


@cell_silo_test
class CellCacheVersionBackfillKeynameTest(TestMigrations):
    app = "hybridcloud"
    migrate_from = "0037_create_outbox_backfill_watermark"
    migrate_to = "0038_cellcacheversion_backfill_keyname"

    def setup_before_migration(self, apps: StateApps) -> None:
        CellCacheVersion = apps.get_model("hybridcloud", "CellCacheVersion")
        self.to_update = CellCacheVersion.objects.create(
            key="no_keyname",
            version=1,
        )
        assert self.to_update.keyname is None, "no keyname to start with"

        self.no_touch = CellCacheVersion.objects.create(
            key="has_keyname",
            keyname="has_keyname",
            version=1,
        )
        assert self.no_touch.keyname is not None, "initialized"

    def test(self) -> None:
        CellCacheVersion = self.apps.get_model("hybridcloud", "CellCacheVersion")

        updated = CellCacheVersion.objects.get(id=self.to_update.id)
        assert updated.keyname == updated.key
        assert updated.keyname == "no_keyname"

        noop = CellCacheVersion.objects.get(id=self.no_touch.id)
        assert noop.keyname == noop.key
        assert noop.keyname == "has_keyname"

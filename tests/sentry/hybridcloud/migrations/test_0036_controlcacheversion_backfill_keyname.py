from sentry.testutils.cases import TestMigrations
from sentry.testutils.silo import control_silo_test


@control_silo_test
class ControlCacheVersionBackfillKeynameTest(TestMigrations):
    app = "hybridcloud"
    connection = "control"
    migrate_from = "0035_add_cacheversion_keyname"
    migrate_to = "0036_controlcacheversion_backfill_keyname"

    def setup_before_migration(self, apps):
        ControlCacheVersion = apps.get_model("hybridcloud", "ControlCacheVersion")
        self.to_update = ControlCacheVersion.objects.create(
            key="no_keyname",
            version=1,
        )
        assert self.to_update.keyname is None, "no keyname to start with"

        self.no_touch = ControlCacheVersion.objects.create(
            key="has_keyname",
            keyname="has_keyname",
            version=1,
        )
        assert self.no_touch.keyname is not None, "initialized"

    def test(self):
        ControlCacheVersion = self.apps.get_model("hybridcloud", "ControlCacheVersion")

        updated = ControlCacheVersion.objects.get(id=self.to_update.id)
        assert updated.keyname == updated.key
        assert updated.keyname == "no_keyname"

        noop = ControlCacheVersion.objects.get(id=self.no_touch.id)
        assert noop.keyname == noop.key
        assert noop.keyname == "has_keyname"

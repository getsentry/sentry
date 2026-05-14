from datetime import timedelta
from unittest.mock import MagicMock, patch

from sentry.models.options.option_seen import OptionSeen
from sentry.options import UnknownOption, default_manager, default_store
from sentry.tasks.options import sync_options
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test


@all_silo_test
class SyncOptionsTest(TestCase):
    _TEST_KEY = "foo"

    def tearDown(self) -> None:
        super().tearDown()
        try:
            default_manager.unregister(self._TEST_KEY)
        except UnknownOption:
            pass

    def test_task_persistent_name(self) -> None:
        assert sync_options.name == "sentry.tasks.options.sync_options"

    def test_option_seen_records_first_access_and_short_circuits(self) -> None:
        key = "test.option-seen"
        default_manager.register(key, default="x")

        # Isolate this test from any prior state on the singleton.
        default_manager._seen.discard(key)
        default_manager._seen_loaded = False

        # First read: writes the row and caches the key on the manager.
        default_manager.get(key)
        assert OptionSeen.objects.filter(key=key).exists()
        assert key in default_manager._seen

        # Second read: short-circuits — no DB writes at all.
        with self.assertNumQueries(0):
            default_manager.get(key)

        assert OptionSeen.objects.filter(key=key).count() == 1

    @patch.object(default_store, "set_cache")
    def test_simple(self, mock_set_cache: MagicMock) -> None:
        default_manager.register(self._TEST_KEY)
        option = default_store.model.objects.create(key=self._TEST_KEY, value="bar")
        sync_options(cutoff=60)

        assert mock_set_cache.called
        mock_set_cache.reset_mock()

        option.update(last_updated=option.last_updated - timedelta(days=1))

        sync_options(cutoff=60)

        assert not mock_set_cache.called

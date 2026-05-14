from datetime import timedelta
from unittest.mock import MagicMock, patch

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

    def test_option_seen_logs_first_access_and_short_circuits(self) -> None:
        key = "test.option-seen"
        default_manager.register(key, default="x")
        default_manager._seen.discard(key)

        with self.assertLogs("sentry.options.manager", level="INFO") as cm:
            default_manager.get(key)

        assert any("option.seen" in line and key in line for line in cm.output)
        assert key in default_manager._seen

        # Second read must not log again — short-circuit fires.
        with self.assertNoLogs("sentry.options.manager", level="INFO"):
            default_manager.get(key)

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

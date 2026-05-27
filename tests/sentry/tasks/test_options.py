from datetime import timedelta
from unittest.mock import MagicMock, patch

from sentry.options import UnknownOption, default_manager, default_store
from sentry.tasks.options import sync_options
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test


@all_silo_test
class SyncOptionsTest(TestCase):
    _TEST_KEY = "foo"

    _SEEN_TEST_KEY = "test.option-seen"

    def tearDown(self) -> None:
        super().tearDown()
        for key in (self._TEST_KEY, self._SEEN_TEST_KEY):
            try:
                default_manager.unregister(key)
            except UnknownOption:
                pass

    def test_task_persistent_name(self) -> None:
        assert sync_options.name == "sentry.tasks.options.sync_options"

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

    def test_option_seen_logs_first_access_and_short_circuits(self) -> None:
        default_manager.register(self._SEEN_TEST_KEY, default="x")
        default_manager._seen.discard(self._SEEN_TEST_KEY)

        # First read: must emit exactly one log record with the key in extra.
        with self.assertLogs("sentry", level="INFO") as cm:
            default_manager.get(self._SEEN_TEST_KEY)

        assert any(
            r.getMessage() == "option.seen"
            and getattr(r, "option_key", None) == self._SEEN_TEST_KEY
            for r in cm.records
        )
        assert self._SEEN_TEST_KEY in default_manager._seen

        # Second read: short-circuit — _record_seen must not be called again.
        with self.assertNoLogs("sentry", level="INFO"):
            default_manager.get(self._SEEN_TEST_KEY)

from datetime import timedelta
from unittest.mock import patch

from sentry.options import UnknownOption, default_manager, default_store
from sentry.tasks.options import sync_options
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test


@all_silo_test
class SyncOptionsTest(TestCase):
    _TEST_KEY = "foo"

    def tearDown(self):
        super().tearDown()
        try:
            default_manager.unregister(self._TEST_KEY)
        except UnknownOption:
            pass

    def test_task_persistent_name(self):
        assert sync_options.name == "sentry.tasks.options.sync_options"

    @patch.object(default_store, "set_cache")
    def test_simple(self, mock_set_cache):
        default_manager.register(self._TEST_KEY)
        option = default_store.model.objects.create(key=self._TEST_KEY, value="bar")
        sync_options(cutoff=60)

        assert mock_set_cache.called
        mock_set_cache.reset_mock()

        option.update(last_updated=option.last_updated - timedelta(days=1))

        sync_options(cutoff=60)

        assert not mock_set_cache.called

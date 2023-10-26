from datetime import timedelta
from unittest.mock import patch

from sentry.options import default_manager, default_store, load_defaults
from sentry.tasks.options import sync_options
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test


@all_silo_test(stable=True)
class SyncOptionsTest(TestCase):
    @staticmethod
    def _reset_options():
        for key in list(default_manager.registry):
            default_manager.unregister(key)
        load_defaults()

    def setUp(self):
        super().setUp()
        self._reset_options()

    def tearDown(self):
        super().tearDown()
        self._reset_options()

    def test_task_persistent_name(self):
        assert sync_options.name == "sentry.tasks.options.sync_options"

    @patch.object(default_store, "set_cache")
    def test_simple(self, mock_set_cache):
        default_manager.register("foo")
        option = default_store.model.objects.create(key="foo", value="bar")
        sync_options(cutoff=60)

        assert mock_set_cache.called
        mock_set_cache.reset_mock()

        option.update(last_updated=option.last_updated - timedelta(days=1))

        sync_options(cutoff=60)

        assert not mock_set_cache.called

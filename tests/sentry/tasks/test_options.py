from mock import patch

from datetime import timedelta

from sentry.models import Option
from sentry.options import default_manager
from sentry.tasks.options import sync_options
from sentry.testutils import TestCase


class SyncOptionsTest(TestCase):
    def test_task_persistent_name(self):
        assert sync_options.name == 'sentry.tasks.options.sync_options'

    @patch.object(default_manager, 'update_cached_value')
    def test_simple(self, mock_update_cached_value):
        option = Option.objects.create(
            key='foo',
            value='bar',
        )
        sync_options(cutoff=60)

        mock_update_cached_value.assert_called_once_with(key='foo', value='bar')

        mock_update_cached_value.reset_mock()

        option.update(last_updated=option.last_updated - timedelta(days=1))

        sync_options(cutoff=60)

        assert not mock_update_cached_value.called

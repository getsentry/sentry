from __future__ import absolute_import

from mock import patch

from datetime import timedelta

from sentry.models import Option
from sentry.options import default_store, default_manager
from sentry.tasks.options import sync_options
from sentry.testutils import TestCase


class SyncOptionsTest(TestCase):
    def test_task_persistent_name(self):
        assert sync_options.name == 'sentry.tasks.options.sync_options'

    @patch.object(default_store, 'set_cache')
    def test_simple(self, mock_set_cache):
        default_manager.register('foo')
        option = Option.objects.create(
            key='foo',
            value='bar',
        )
        sync_options(cutoff=60)

        assert mock_set_cache.called
        mock_set_cache.reset_mock()

        option.update(last_updated=option.last_updated - timedelta(days=1))

        sync_options(cutoff=60)

        assert not mock_set_cache.called

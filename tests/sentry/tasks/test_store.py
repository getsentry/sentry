from __future__ import absolute_import

import mock

from sentry.plugins import Plugin2
from sentry.tasks.store import preprocess_event
from sentry.testutils import PluginTestCase


class BasicPreprocessorPlugin(Plugin2):
    def get_event_preprocessors(self):
        def remove_extra(data):
            del data['extra']
            return data

        return [remove_extra, lambda x: None]

    def is_enabled(self, project=None):
        return True


class PreprocessEventTest(PluginTestCase):
    plugin = BasicPreprocessorPlugin

    @mock.patch('sentry.tasks.store.save_event')
    def test_simple(self, mock_save_event):
        project = self.create_project()

        data = {
            'project': project.id,
            'message': 'test',
            'extra': {'foo': 'bar'},
        }

        preprocess_event(data=data)

        assert mock_save_event.delay.call_count == 1

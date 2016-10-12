from __future__ import absolute_import

import mock

from sentry.plugins import Plugin2
from sentry.tasks.store import preprocess_event, process_event
from sentry.testutils import PluginTestCase


class BasicPreprocessorPlugin(Plugin2):
    def get_event_preprocessors(self, data):
        def remove_extra(data):
            del data['extra']
            return data

        if data.get('platform') == 'mattlang':
            return [remove_extra, lambda x: None]

        if data.get('platform') == 'noop':
            return [lambda data: data]

        return []

    def is_enabled(self, project=None):
        return True


class StoreTasksTest(PluginTestCase):
    plugin = BasicPreprocessorPlugin

    @mock.patch('sentry.tasks.store.save_event')
    @mock.patch('sentry.tasks.store.process_event')
    def test_move_to_process_event(self, mock_process_event, mock_save_event):
        project = self.create_project()

        data = {
            'project': project.id,
            'platform': 'mattlang',
            'message': 'test',
            'extra': {'foo': 'bar'},
        }

        preprocess_event(data=data)

        assert mock_process_event.delay.call_count == 1
        assert mock_save_event.delay.call_count == 0

    @mock.patch('sentry.tasks.store.save_event')
    @mock.patch('sentry.tasks.store.process_event')
    def test_move_to_save_event(self, mock_process_event, mock_save_event):
        project = self.create_project()

        data = {
            'project': project.id,
            'platform': 'NOTMATTLANG',
            'message': 'test',
            'extra': {'foo': 'bar'},
        }

        preprocess_event(data=data)

        assert mock_process_event.delay.call_count == 0
        assert mock_save_event.delay.call_count == 1

    @mock.patch('sentry.tasks.store.save_event')
    @mock.patch('sentry.tasks.store.default_cache')
    def test_process_event_mutate_and_save(self, mock_default_cache, mock_save_event):
        project = self.create_project()

        data = {
            'project': project.id,
            'platform': 'mattlang',
            'message': 'test',
            'extra': {'foo': 'bar'},
        }

        mock_default_cache.get.return_value = data

        process_event(cache_key='e:1', start_time=1)

        # The event mutated, so make sure we save it back
        mock_default_cache.set.assert_called_once_with(
            'e:1', {
                'project': project.id,
                'platform': 'mattlang',
                'message': 'test',
            }, 3600,
        )

        mock_save_event.delay.assert_called_once_with(
            cache_key='e:1', data=None, start_time=1,
        )

    @mock.patch('sentry.tasks.store.save_event')
    @mock.patch('sentry.tasks.store.default_cache')
    def test_process_event_no_mutate_and_save(self, mock_default_cache, mock_save_event):
        project = self.create_project()

        data = {
            'project': project.id,
            'platform': 'noop',
            'message': 'test',
            'extra': {'foo': 'bar'},
        }

        mock_default_cache.get.return_value = data

        process_event(cache_key='e:1', start_time=1)

        # The event did not mutate, so we shouldn't reset it in cache
        mock_default_cache.set.call_count == 0

        mock_save_event.delay.assert_called_once_with(
            cache_key='e:1', data=None, start_time=1,
        )

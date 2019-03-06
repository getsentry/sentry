from __future__ import absolute_import, print_function

from mock import patch

from sentry.consumer import ConsumerWorker
from sentry.coreapi import ClientApiHelper
from sentry.models import Event
from sentry.plugins import Plugin2
from sentry.testutils import PluginTestCase
from sentry.utils import json


class BasicPreprocessorPlugin(Plugin2):
    def add_foo(self, data):
        data['foo'] = 'bar'
        return data

    def get_event_preprocessors(self, data):
        if data.get('platform') == 'needs_process':
            return [self.add_foo]

        return []

    def is_enabled(self, project=None):
        return True


class TestConsumer(PluginTestCase):
    plugin = BasicPreprocessorPlugin

    def _call_consumer(self, mock_produce):
        args, kwargs = list(mock_produce.call_args)
        mock_produce.call_args = None
        topic = args[0]
        value = json.loads(kwargs['value'])

        consumer = ConsumerWorker()
        consumer._handle(topic, value)

    def _create_event_with_platform(self, project, platform):
        from sentry.event_manager import EventManager
        em = EventManager({}, project=project)
        em.normalize()
        data = em.get_data()
        data['platform'] = platform
        return data

    @patch('sentry.tasks.store.save_event')
    @patch('sentry.tasks.store.preprocess_event')
    @patch('sentry.utils.kafka.produce_sync')
    def test_process_path(self, mock_produce, mock_preprocess_event, mock_save_event):
        with self.feature('projects:kafka-ingest'):
            project = self.create_project()
            data = self._create_event_with_platform(project, 'needs_process')

            helper = ClientApiHelper(project_id=self.project.id)
            helper.context.bind_project(project)
            helper.insert_data_to_database(data)

            # preprocess
            self._call_consumer(mock_produce)
            # process
            with self.tasks():
                self._call_consumer(mock_produce)
            # save
            self._call_consumer(mock_produce)

            assert mock_preprocess_event.delay.call_count == 0
            assert mock_save_event.delay.call_count == 0

            event = Event.objects.get(project_id=project.id, event_id=data['event_id'])
            saved_data = event.get_raw_data()
            assert saved_data['foo'] == 'bar'
            assert saved_data['platform'] == 'needs_process'

    @patch('sentry.tasks.store.save_event')
    @patch('sentry.tasks.store.process_event')
    @patch('sentry.tasks.store.preprocess_event')
    @patch('sentry.utils.kafka.produce_sync')
    def test_save_path(self, mock_produce, mock_preprocess_event,
                       mock_process_event, mock_save_event):
        with self.feature('projects:kafka-ingest'):
            project = self.create_project()
            data = self._create_event_with_platform(project, 'doesnt_need_process')

            helper = ClientApiHelper(project_id=self.project.id)
            helper.context.bind_project(project)
            helper.insert_data_to_database(data)

            # preprocess
            self._call_consumer(mock_produce)
            # save
            self._call_consumer(mock_produce)

            assert mock_preprocess_event.delay.call_count == 0
            assert mock_process_event.delay.call_count == 0
            assert mock_save_event.delay.call_count == 0

            event = Event.objects.get(project_id=project.id, event_id=data['event_id'])
            saved_data = event.get_raw_data()
            assert 'foo' not in saved_data
            assert saved_data['platform'] == 'doesnt_need_process'

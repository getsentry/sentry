from __future__ import absolute_import, print_function

import mock

from sentry.event_consumer import process_event_from_kafka
from sentry.signals import event_accepted
from sentry.testutils import (assert_mock_called_once_with_partial, TestCase)
from sentry.utils import json


class EventConsumerTest(TestCase):
    @mock.patch('sentry.web.api.kafka_publisher')
    def test_event_consumer(self, mock_kafka_publisher):
        with self.options({
            'store.kafka-sample-rate': 1.0,
            'store.process-in-kafka': True,
            'kafka-publisher.raw-event-sample-rate': 0.0,
        }):
            mock_event_accepted = mock.Mock()
            event_accepted.connect(mock_event_accepted)

            resp = self._postWithHeader({'logentry': {'message': u'hello'}})
            assert resp.status_code == 200, resp.content

            publish_args, publish_kwargs = list(mock_kafka_publisher.publish.call_args)
            kafka_message_value = publish_kwargs['value']
            process_event_from_kafka(json.loads(kafka_message_value))

            assert_mock_called_once_with_partial(
                mock_event_accepted,
                ip='127.0.0.1',
                project=self.project,
                signal=event_accepted,
            )

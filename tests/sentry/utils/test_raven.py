from __future__ import absolute_import, print_function

from mock import Mock, patch
from raven.contrib.django.models import client
from raven.base import Client

from sentry.models import Event
from sentry.testutils import TestCase
from sentry.utils.raven import SentryInternalClient


class SentryInternalClientTest(TestCase):
    @patch.object(SentryInternalClient, 'is_enabled', Mock(return_value=True))
    @patch.object(Client, 'send')
    def test_simple(self, send):
        assert client.__class__ is SentryInternalClient

        with self.tasks():
            client.captureMessage('internal client test')

        event = Event.objects.get()
        assert event.data['sentry.interfaces.Message']['message'] == \
            'internal client test'
        assert send.call_count == 0

    @patch.object(SentryInternalClient, 'is_enabled', Mock(return_value=True))
    @patch.object(Client, 'send')
    def test_upstream(self, send):
        with self.dsn('http://foo:bar@example.com/1'):
            with self.options({'sentry:install-id': 'abc123'}):
                with self.tasks():
                    client.captureMessage('internal client test')

                event = Event.objects.get()
                assert event.data['sentry.interfaces.Message']['message'] == \
                    'internal client test'

                # Make sure that the event also got sent upstream
                assert send.call_count == 1
                _, kwargs = send.call_args
                # and got tagged properly
                assert kwargs['tags']['install-id'] == 'abc123'

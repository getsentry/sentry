from __future__ import absolute_import, print_function

from mock import Mock, patch
from raven.contrib.django.models import client

from sentry.models import Event
from sentry.testutils import TestCase
from sentry.utils.raven import SentryInternalClient


class SentryInternalClientTest(TestCase):
    @patch.object(SentryInternalClient, 'is_enabled', Mock(return_value=True))
    def test_simple(self):
        assert client.__class__ is SentryInternalClient

        with self.tasks():
            client.captureMessage('internal client test')

        event = Event.objects.get()
        assert event.message == 'internal client test'

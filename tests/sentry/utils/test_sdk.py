from __future__ import absolute_import, print_function

from sentry_sdk import Hub

from django.conf import settings
from sentry.utils.sdk import configure_sdk
from sentry.app import raven

from sentry.models import Event
from sentry.testutils import TestCase
from sentry import nodestore


class SentryInternalClientTest(TestCase):
    def test_simple(self):
        configure_sdk()
        Hub.current.bind_client(Hub.main.client)

        with self.tasks():
            event_id = raven.captureMessage("internal client test")

        event = nodestore.get(Event.generate_node_id(settings.SENTRY_PROJECT, event_id))

        assert event['project'] == settings.SENTRY_PROJECT
        assert event['event_id'] == event_id
        assert event['logentry']['formatted'] == 'internal client test'

    def test_encoding(self):
        configure_sdk()
        Hub.current.bind_client(Hub.main.client)

        class NotJSONSerializable:
            pass

        with self.tasks():
            event_id = raven.captureMessage('check the req', extra={
                'request': NotJSONSerializable()
            })

        event = nodestore.get(Event.generate_node_id(settings.SENTRY_PROJECT, event_id))

        assert event['project'] == settings.SENTRY_PROJECT
        assert event['logentry']['formatted'] == 'check the req'
        assert 'NotJSONSerializable' in event['extra']['request']

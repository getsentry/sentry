from __future__ import absolute_import, print_function

from sentry_sdk import Hub

from django.conf import settings
from sentry.utils.sdk import configure_sdk
from sentry.app import raven

from sentry.models import Event
from sentry.testutils import TestCase


class SentryInternalClientTest(TestCase):
    def test_simple(self):
        configure_sdk()
        Hub.current.bind_client(Hub.main.client)

        with self.tasks():
            event_id = raven.captureMessage('internal client test')

        event = Event.objects.get()
        assert event.project_id == settings.SENTRY_PROJECT
        assert event.event_id == event_id
        assert event.data['sentry.interfaces.Message']['message'] == \
            'internal client test'

    def test_encoding(self):
        configure_sdk()
        Hub.current.bind_client(Hub.main.client)

        class NotJSONSerializable():
            pass

        with self.tasks():
            raven.captureMessage('check the req', extra={
                'request': NotJSONSerializable()
            })

        event = Event.objects.get()
        assert event.project_id == settings.SENTRY_PROJECT
        assert event.data['sentry.interfaces.Message']['message'] == 'check the req'
        assert 'NotJSONSerializable' in event.data['extra']['request']

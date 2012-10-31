# -*- coding: utf-8 -*-

from __future__ import absolute_import

from mock import Mock

from sentry.conf import settings
from sentry.models import Event
from sentry.views import View, Exception, Query, Message

from tests.base import TestCase


class ViewIntegrationTest(TestCase):
    def setUp(self):
        self.orig = settings.VIEWS
        View.objects.update((
            'sentry.views.Exception',
            'sentry.views.Query',
            'sentry.views.Message',
        ))
        assert len(View.objects.all()) == 3

    def tearDown(self):
        settings.VIEWS = self.orig
        View.objects.update(settings.VIEWS)

    def create_event(self, data):
        kwargs = {'message': 'hello', 'server_name': 'not_dcramer.local', 'level': 40, 'site': 'not_a_real_site'}
        kwargs.update(data)
        resp = self._postWithSignature(kwargs)
        self.assertEquals(resp.status_code, 200, resp.content)

    def test_single_content(self):
        self.create_event({
            'sentry.interfaces.Message': {
                'message': 'this is a message',
                'params': [],
            },
        })

        instance = Event.objects.get()
        group = instance.group
        views = list(group.views.all())
        self.assertEquals(len(views), 1)
        self.assertEquals(views[0].path, 'sentry.views.message.Message')

    def test_multi_content(self):
        self.create_event({
            'sentry.interfaces.Message': {
                'message': 'this is a message',
                'params': [],
            },
            'sentry.interfaces.Query': {
                'query': 'SELECT 1 FROM foo',
            },
        })

        instance = Event.objects.get()
        group = instance.group
        views = list(group.views.all())
        self.assertEquals(len(views), 2)
        paths = [v.path for v in views]
        self.assertTrue('sentry.views.message.Message' in paths)
        self.assertTrue('sentry.views.query.Query' in paths)


class ExceptionViewTest(TestCase):
    def test_should_store_response(self):
        event = Mock()
        event.interfaces = {
            'sentry.interfaces.Exception': {}
        }
        resp = Exception().should_store(event)
        self.assertTrue(resp)

    def test_should_not_store_response(self):
        event = Mock()
        event.interfaces = {}
        resp = Exception().should_store(event)
        self.assertFalse(resp)


class QueryViewTest(TestCase):
    def test_should_store_response(self):
        event = Mock()
        event.interfaces = {
            'sentry.interfaces.Query': {}
        }
        resp = Query().should_store(event)
        self.assertTrue(resp)

    def test_should_not_store_response(self):
        event = Mock()
        event.interfaces = {}
        resp = Query().should_store(event)
        self.assertFalse(resp)


class MessageViewTest(TestCase):
    def test_should_store_response(self):
        event = Mock()
        event.interfaces = {
            'sentry.interfaces.Message': {}
        }
        resp = Message().should_store(event)
        self.assertTrue(resp)

    def test_should_not_store_response(self):
        event = Mock()
        event.interfaces = {}
        resp = Message().should_store(event)
        self.assertFalse(resp)

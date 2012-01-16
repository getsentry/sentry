# -*- coding: utf-8 -*-

from __future__ import absolute_import

import datetime
import logging

from django.core.urlresolvers import reverse

from sentry.conf import settings
from sentry.models import Event

from tests.base import TestCase


class SentryRemoteTest(TestCase):
    def setUp(self):
        settings.REMOTE_URL = ['http://localhost:8000%s' % reverse('sentry-api-store')]
        logger = logging.getLogger('sentry')
        for h in logger.handlers:
            logger.removeHandler(h)
        logger.addHandler(logging.StreamHandler())

    def tearDown(self):
        settings.REMOTE_URL = None

    def test_no_key(self):
        resp = self.client.post(reverse('sentry-api-store'))
        self.assertEquals(resp.status_code, 401)

    # def test_no_data(self):
    #     resp = self.client.post(reverse('sentry-api-store'), {
    #         'key': settings.KEY,
    #     })
    #     self.assertEquals(resp.status_code, 400)

    # def test_bad_data(self):
    #     resp = self.client.post(reverse('sentry-api-store'), {
    #         'key': settings.KEY,
    #         'data': 'hello world',
    #     })
    #     self.assertEquals(resp.status_code, 401)
        # self.assertEquals(resp.content, 'Bad data decoding request (TypeError, Incorrect padding)')

    def test_correct_data(self):
        kwargs = {'message': 'hello', 'server_name': 'not_dcramer.local', 'level': 40, 'site': 'not_a_real_site'}
        resp = self._postWithSignature(kwargs)
        self.assertEquals(resp.status_code, 200)
        instance = Event.objects.get()
        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.server_name, 'not_dcramer.local')
        self.assertEquals(instance.level, 40)
        self.assertEquals(instance.site, 'not_a_real_site')

    def test_unicode_keys(self):
        kwargs = {u'message': 'hello', u'server_name': 'not_dcramer.local', u'level': 40, u'site': 'not_a_real_site'}
        resp = self._postWithSignature(kwargs)
        self.assertEquals(resp.status_code, 200, resp.content)
        instance = Event.objects.get()
        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.server_name, 'not_dcramer.local')
        self.assertEquals(instance.level, 40)
        self.assertEquals(instance.site, 'not_a_real_site')

    def test_timestamp(self):
        timestamp = datetime.datetime.utcnow() - datetime.timedelta(hours=1)
        kwargs = {u'message': 'hello', 'timestamp': timestamp.strftime('%s.%f')}
        resp = self._postWithSignature(kwargs)
        self.assertEquals(resp.status_code, 200, resp.content)
        instance = Event.objects.get()
        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.datetime, timestamp)
        group = instance.group
        self.assertEquals(group.first_seen, timestamp)
        self.assertEquals(group.last_seen, timestamp)

    def test_timestamp_as_iso(self):
        timestamp = datetime.datetime.utcnow() - datetime.timedelta(hours=1)
        kwargs = {u'message': 'hello', 'timestamp': timestamp.strftime('%Y-%m-%dT%H:%M:%S.%f')}
        resp = self._postWithSignature(kwargs)
        self.assertEquals(resp.status_code, 200, resp.content)
        instance = Event.objects.get()
        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.datetime, timestamp)
        group = instance.group
        self.assertEquals(group.first_seen, timestamp)
        self.assertEquals(group.last_seen, timestamp)

    def test_ungzipped_data(self):
        kwargs = {'message': 'hello', 'server_name': 'not_dcramer.local', 'level': 40, 'site': 'not_a_real_site'}
        resp = self._postWithSignature(kwargs)
        self.assertEquals(resp.status_code, 200)
        instance = Event.objects.get()
        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.server_name, 'not_dcramer.local')
        self.assertEquals(instance.site, 'not_a_real_site')
        self.assertEquals(instance.level, 40)

    # def test_byte_sequence(self):
    #     """
    #     invalid byte sequence for encoding "UTF8": 0xedb7af
    #     """
    #     # TODO:
    #     # add 'site' to data in fixtures/bad_data.json, then assert it's set correctly below

    #     fname = os.path.join(os.path.dirname(__file__), 'fixtures/bad_data.json')
    #     data = open(fname).read()

    #     resp = self.client.post(reverse('sentry-api-store'), {
    #         'data': data,
    #         'key': settings.KEY,
    #     })

    #     self.assertEquals(resp.status_code, 200)

    #     self.assertEquals(Event.objects.count(), 1)

    #     instance = Event.objects.get()

    #     self.assertEquals(instance.message, 'DatabaseError: invalid byte sequence for encoding "UTF8": 0xeda4ac\nHINT:  This error can also happen if the byte sequence does not match the encoding expected by the server, which is controlled by "client_encoding".\n')
    #     self.assertEquals(instance.server_name, 'shilling.disqus.net')
    #     self.assertEquals(instance.level, 40)

    def test_signature(self):
        kwargs = {'message': 'hello', 'server_name': 'not_dcramer.local', 'level': 40, 'site': 'not_a_real_site'}

        resp = self._postWithSignature(kwargs)

        self.assertEquals(resp.status_code, 200, resp.content)

        instance = Event.objects.get()

        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.server_name, 'not_dcramer.local')
        self.assertEquals(instance.site, 'not_a_real_site')
        self.assertEquals(instance.level, 40)


# -*- coding: utf-8 -*-

from __future__ import absolute_import, print_function

import datetime
import json
import logging
import mock
import zlib

from django.conf import settings
from django.core.urlresolvers import reverse
from django.test.utils import override_settings
from django.utils import timezone
from gzip import GzipFile
from exam import fixture
from raven import Client

from sentry.models import Group, Event
from sentry.testutils import TestCase, TransactionTestCase
from sentry.testutils.helpers import get_auth_header
from sentry.utils.compat import StringIO
from sentry.utils.settings import (
    validate_settings, ConfigurationError, import_string)


DEPENDENCY_TEST_DATA = {
    "postgresql": ('DATABASES', 'psycopg2.extensions', "database engine", "django.db.backends.postgresql_psycopg2", {
        'default': {
            'ENGINE': "django.db.backends.postgresql_psycopg2",
            'NAME': 'test',
            'USER': 'root',
            'PASSWORD': '',
            'HOST': 'localhost',
            'PORT': ''
        }
    }),
    "mysql": ('DATABASES', 'MySQLdb', "database engine", "django.db.backends.mysql", {
        'default': {
            'ENGINE': "django.db.backends.mysql",
            'NAME': 'test',
            'USER': 'root',
            'PASSWORD': '',
            'HOST': 'localhost',
            'PORT': ''
        }
    }),
    "oracle": ('DATABASES', 'cx_Oracle', "database engine", "django.db.backends.oracle", {
        'default': {
            'ENGINE': "django.db.backends.oracle",
            'NAME': 'test',
            'USER': 'root',
            'PASSWORD': '',
            'HOST': 'localhost',
            'PORT': ''
        }
    }),
    "memcache": ('CACHES', 'memcache', "caching backend", "django.core.cache.backends.memcached.MemcachedCache", {
        'default': {
            'BACKEND': "django.core.cache.backends.memcached.MemcachedCache",
            'LOCATION': '127.0.0.1:11211',
        }
    }),
    "pylibmc": ('CACHES', 'pylibmc', "caching backend", "django.core.cache.backends.memcached.PyLibMCCache", {
        'default': {
            'BACKEND': "django.core.cache.backends.memcached.PyLibMCCache",
            'LOCATION': '127.0.0.1:11211',
        }
    }),
}


class AssertHandler(logging.Handler):
    def emit(self, entry):
        raise AssertionError(entry.message)


class RavenIntegrationTest(TransactionTestCase):
    """
    This mocks the test server and specifically tests behavior that would
    happen between Raven <--> Sentry over HTTP communication.
    """
    def setUp(self):
        self.user = self.create_user('coreapi@example.com')
        self.project = self.create_project()
        self.pm = self.project.team.member_set.get_or_create(user=self.user)[0]
        self.pk = self.project.key_set.get_or_create()[0]

        self.configure_sentry_errors()

    def configure_sentry_errors(self):
        assert_handler = AssertHandler()
        sentry_errors = logging.getLogger('sentry.errors')
        sentry_errors.addHandler(assert_handler)
        sentry_errors.setLevel(logging.DEBUG)

        def remove_handler():
            sentry_errors.handlers.pop(sentry_errors.handlers.index(assert_handler))
        self.addCleanup(remove_handler)

    def sendRemote(self, url, data, headers={}):
        content_type = headers.pop('Content-Type', None)
        headers = dict(('HTTP_' + k.replace('-', '_').upper(), v) for k, v in headers.iteritems())
        resp = self.client.post(
            reverse('sentry-api-store', args=[self.pk.project_id]),
            data=data,
            content_type=content_type,
            **headers)
        self.assertEquals(resp.status_code, 200, resp.content)

    @mock.patch('raven.base.Client.send_remote')
    def test_basic(self, send_remote):
        send_remote.side_effect = self.sendRemote
        client = Client(
            dsn='http://%s:%s@localhost:8000/%s' % (
                self.pk.public_key, self.pk.secret_key, self.pk.project_id)
        )

        with self.tasks():
            client.capture('Message', message='foo')

        send_remote.assert_called_once()
        self.assertEquals(Group.objects.count(), 1)
        group = Group.objects.get()
        self.assertEquals(group.event_set.count(), 1)
        instance = group.event_set.get()
        self.assertEquals(instance.message, 'foo')


class SentryRemoteTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-api-store')

    def test_minimal(self):
        kwargs = {'message': 'hello'}

        resp = self._postWithHeader(kwargs)

        assert resp.status_code == 200, resp.content

        event_id = json.loads(resp.content)['id']
        instance = Event.objects.get(event_id=event_id)

        assert instance.message == 'hello'

    def test_timestamp(self):
        timestamp = timezone.now().replace(microsecond=0, tzinfo=timezone.utc) - datetime.timedelta(hours=1)
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
        timestamp = timezone.now().replace(microsecond=0, tzinfo=timezone.utc) - datetime.timedelta(hours=1)
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
        kwargs = {'message': 'hello'}
        resp = self._postWithSignature(kwargs)
        self.assertEquals(resp.status_code, 200)
        instance = Event.objects.get()
        self.assertEquals(instance.message, 'hello')

    @override_settings(SENTRY_ALLOW_ORIGIN='getsentry.com')
    def test_correct_data_with_get(self):
        kwargs = {'message': 'hello'}
        resp = self._getWithReferer(kwargs)
        self.assertEquals(resp.status_code, 200, resp.content)
        instance = Event.objects.get()
        self.assertEquals(instance.message, 'hello')

    @override_settings(SENTRY_ALLOW_ORIGIN='getsentry.com')
    def test_get_without_referer(self):
        kwargs = {'message': 'hello'}
        resp = self._getWithReferer(kwargs, referer=None, protocol='4')
        self.assertEquals(resp.status_code, 400, resp.content)

    @override_settings(SENTRY_ALLOW_ORIGIN='*')
    def test_get_without_referer_allowed(self):
        kwargs = {'message': 'hello'}
        resp = self._getWithReferer(kwargs, referer=None, protocol='4')
        self.assertEquals(resp.status_code, 200, resp.content)

    def test_signature(self):
        kwargs = {'message': 'hello'}

        resp = self._postWithSignature(kwargs)

        self.assertEquals(resp.status_code, 200, resp.content)

        instance = Event.objects.get()

        self.assertEquals(instance.message, 'hello')

    def test_content_encoding_deflate(self):
        kwargs = {'message': 'hello'}

        message = zlib.compress(json.dumps(kwargs))

        key = self.projectkey.public_key
        secret = self.projectkey.secret_key

        with self.tasks():
            resp = self.client.post(
                self.path, message,
                content_type='application/octet-stream',
                HTTP_CONTENT_ENCODING='deflate',
                HTTP_X_SENTRY_AUTH=get_auth_header('_postWithHeader', key, secret),
            )

        assert resp.status_code == 200, resp.content

        event_id = json.loads(resp.content)['id']
        instance = Event.objects.get(event_id=event_id)

        assert instance.message == 'hello'

    def test_content_encoding_gzip(self):
        kwargs = {'message': 'hello'}

        message = json.dumps(kwargs)

        fp = StringIO()

        try:
            f = GzipFile(fileobj=fp, mode='w')
            f.write(message)
        finally:
            f.close()

        key = self.projectkey.public_key
        secret = self.projectkey.secret_key

        with self.tasks():
            resp = self.client.post(
                self.path, fp.getvalue(),
                content_type='application/octet-stream',
                HTTP_CONTENT_ENCODING='gzip',
                HTTP_X_SENTRY_AUTH=get_auth_header('_postWithHeader', key, secret),
            )

        assert resp.status_code == 200, resp.content

        event_id = json.loads(resp.content)['id']
        instance = Event.objects.get(event_id=event_id)

        assert instance.message == 'hello'


class DepdendencyTest(TestCase):
    def raise_import_error(self, package):
        def callable(package_name):
            if package_name != package:
                return import_string(package_name)
            raise ImportError("No module named %s" % (package,))
        return callable

    @mock.patch('django.conf.settings', mock.Mock())
    @mock.patch('sentry.utils.settings.import_string')
    def validate_dependency(self, key, package, dependency_type, dependency,
                            setting_value, import_string):

        import_string.side_effect = self.raise_import_error(package)

        with self.settings(**{key: setting_value}):
            with self.assertRaises(ConfigurationError):
                validate_settings(settings)

    def test_validate_fails_on_postgres(self):
        self.validate_dependency(*DEPENDENCY_TEST_DATA['postgresql'])

    def test_validate_fails_on_mysql(self):
        self.validate_dependency(*DEPENDENCY_TEST_DATA['mysql'])

    def test_validate_fails_on_oracle(self):
        self.validate_dependency(*DEPENDENCY_TEST_DATA['oracle'])

    def test_validate_fails_on_memcache(self):
        self.validate_dependency(*DEPENDENCY_TEST_DATA['memcache'])

    def test_validate_fails_on_pylibmc(self):
        self.validate_dependency(*DEPENDENCY_TEST_DATA['pylibmc'])

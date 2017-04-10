# -*- coding: utf-8 -*-

from __future__ import absolute_import, print_function

import os
import datetime
import json
import logging
import mock
import six
import zlib

from django.conf import settings
from django.core.urlresolvers import reverse
from django.test.utils import override_settings
from django.utils import timezone
from exam import fixture
from gzip import GzipFile
from raven import Client
from six import StringIO

from sentry.models import (
    Group, GroupTagKey, GroupTagValue, Event, TagKey, TagValue
)
from sentry.testutils import TestCase, TransactionTestCase
from sentry.testutils.helpers import get_auth_header
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


def get_fixture_path(name):
    return os.path.join(os.path.dirname(__file__), 'fixtures', name)


def load_fixture(name):
    with open(get_fixture_path(name)) as fp:
        return fp.read()


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
        headers = dict(('HTTP_' + k.replace('-', '_').upper(), v) for k, v in six.iteritems(headers))
        if isinstance(data, six.text_type):
            data = data.encode('utf-8')
        resp = self.client.post(
            reverse('sentry-api-store', args=[self.pk.project_id]),
            data=data,
            content_type=content_type,
            **headers)
        assert resp.status_code == 200, resp.content

    @mock.patch('raven.base.Client.send_remote')
    def test_basic(self, send_remote):
        send_remote.side_effect = self.sendRemote
        client = Client(
            dsn='http://%s:%s@localhost:8000/%s' % (
                self.pk.public_key, self.pk.secret_key, self.pk.project_id)
        )

        with self.tasks():
            client.captureMessage(message='foo')

        assert send_remote.call_count is 1
        assert Group.objects.count() == 1
        group = Group.objects.get()
        assert group.event_set.count() == 1
        instance = group.event_set.get()
        assert instance.data['sentry.interfaces.Message']['message'] == 'foo'


class SentryRemoteTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-api-store')

    def test_minimal(self):
        kwargs = {'message': 'hello', 'tags': {'foo': 'bar'}}

        resp = self._postWithHeader(kwargs)

        assert resp.status_code == 200, resp.content

        event_id = json.loads(resp.content)['id']
        instance = Event.objects.get(event_id=event_id)

        assert instance.message == 'hello'

        assert TagKey.objects.filter(
            key='foo', project=self.project,
        ).exists()
        assert TagValue.objects.filter(
            key='foo', value='bar', project=self.project,
        ).exists()
        assert GroupTagKey.objects.filter(
            key='foo', group=instance.group_id, project=self.project,
        ).exists()
        assert GroupTagValue.objects.filter(
            key='foo', value='bar', group=instance.group_id,
            project=self.project,
        ).exists()

    def test_timestamp(self):
        timestamp = timezone.now().replace(microsecond=0, tzinfo=timezone.utc) - datetime.timedelta(hours=1)
        kwargs = {u'message': 'hello', 'timestamp': timestamp.strftime('%s.%f')}
        resp = self._postWithSignature(kwargs)
        assert resp.status_code == 200, resp.content
        instance = Event.objects.get()
        assert instance.message == 'hello'
        assert instance.datetime == timestamp
        group = instance.group
        assert group.first_seen == timestamp
        assert group.last_seen == timestamp

    def test_timestamp_as_iso(self):
        timestamp = timezone.now().replace(microsecond=0, tzinfo=timezone.utc) - datetime.timedelta(hours=1)
        kwargs = {u'message': 'hello', 'timestamp': timestamp.strftime('%Y-%m-%dT%H:%M:%S.%f')}
        resp = self._postWithSignature(kwargs)
        assert resp.status_code == 200, resp.content
        instance = Event.objects.get()
        assert instance.message == 'hello'
        assert instance.datetime == timestamp
        group = instance.group
        assert group.first_seen == timestamp
        assert group.last_seen == timestamp

    def test_ungzipped_data(self):
        kwargs = {'message': 'hello'}
        resp = self._postWithSignature(kwargs)
        assert resp.status_code == 200
        instance = Event.objects.get()
        assert instance.message == 'hello'

    @override_settings(SENTRY_ALLOW_ORIGIN='sentry.io')
    def test_correct_data_with_get(self):
        kwargs = {'message': 'hello'}
        resp = self._getWithReferer(kwargs)
        assert resp.status_code == 200, resp.content
        instance = Event.objects.get()
        assert instance.message == 'hello'

    @override_settings(SENTRY_ALLOW_ORIGIN='sentry.io')
    def test_get_without_referer(self):
        self.project.update_option('sentry:origins', '')
        kwargs = {'message': 'hello'}
        resp = self._getWithReferer(kwargs, referer=None, protocol='4')
        assert resp.status_code == 403, (resp.status_code, resp.get('X-Sentry-Error'))

    @override_settings(SENTRY_ALLOW_ORIGIN='*')
    def test_get_without_referer_allowed(self):
        self.project.update_option('sentry:origins', '')
        kwargs = {'message': 'hello'}
        resp = self._getWithReferer(kwargs, referer=None, protocol='4')
        assert resp.status_code == 200, (resp.status_code, resp.get('X-Sentry-Error'))

    @override_settings(SENTRY_ALLOW_ORIGIN='sentry.io')
    def test_correct_data_with_post_referer(self):
        kwargs = {'message': 'hello'}
        resp = self._postWithReferer(kwargs)
        assert resp.status_code == 200, resp.content
        instance = Event.objects.get()
        assert instance.message == 'hello'

    @override_settings(SENTRY_ALLOW_ORIGIN='sentry.io')
    def test_post_without_referer(self):
        self.project.update_option('sentry:origins', '')
        kwargs = {'message': 'hello'}
        resp = self._postWithReferer(kwargs, referer=None, protocol='4')
        assert resp.status_code == 403, (resp.status_code, resp.get('X-Sentry-Error'))

    @override_settings(SENTRY_ALLOW_ORIGIN='*')
    def test_post_without_referer_allowed(self):
        self.project.update_option('sentry:origins', '')
        kwargs = {'message': 'hello'}
        resp = self._postWithReferer(kwargs, referer=None, protocol='4')
        assert resp.status_code == 403, (resp.status_code, resp.get('X-Sentry-Error'))

    def test_signature(self):
        kwargs = {'message': 'hello'}

        resp = self._postWithSignature(kwargs)

        assert resp.status_code == 200, resp.content

        instance = Event.objects.get()

        assert instance.message == 'hello'

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

    def test_protocol_v2_0_without_secret_key(self):
        kwargs = {'message': 'hello'}

        resp = self._postWithHeader(
            data=kwargs,
            key=self.projectkey.public_key,
            protocol='2.0',
        )

        assert resp.status_code == 200, resp.content

        event_id = json.loads(resp.content)['id']
        instance = Event.objects.get(event_id=event_id)

        assert instance.message == 'hello'

    def test_protocol_v3(self):
        kwargs = {'message': 'hello'}

        resp = self._postWithHeader(
            data=kwargs,
            key=self.projectkey.public_key,
            secret=self.projectkey.secret_key,
            protocol='3',
        )

        assert resp.status_code == 200, resp.content

        event_id = json.loads(resp.content)['id']
        instance = Event.objects.get(event_id=event_id)

        assert instance.message == 'hello'

    def test_protocol_v4(self):
        kwargs = {'message': 'hello'}

        resp = self._postWithHeader(
            data=kwargs,
            key=self.projectkey.public_key,
            secret=self.projectkey.secret_key,
            protocol='4',
        )

        assert resp.status_code == 200, resp.content

        event_id = json.loads(resp.content)['id']
        instance = Event.objects.get(event_id=event_id)

        assert instance.message == 'hello'

    def test_protocol_v5(self):
        kwargs = {'message': 'hello'}

        resp = self._postWithHeader(
            data=kwargs,
            key=self.projectkey.public_key,
            secret=self.projectkey.secret_key,
            protocol='5',
        )

        assert resp.status_code == 200, resp.content

        event_id = json.loads(resp.content)['id']
        instance = Event.objects.get(event_id=event_id)

        assert instance.message == 'hello'

    def test_protocol_v6(self):
        kwargs = {'message': 'hello'}

        resp = self._postWithHeader(
            data=kwargs,
            key=self.projectkey.public_key,
            secret=self.projectkey.secret_key,
            protocol='6',
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


def get_fixtures(name):
    path = os.path.join(os.path.dirname(__file__), 'fixtures/csp', name)
    try:
        with open(path + '_input.json', 'rb') as fp1:
            input = fp1.read()
    except IOError:
        input = None

    try:
        with open(path + '_output.json', 'rb') as fp2:
            output = json.load(fp2)
    except IOError:
        output = None

    return input, output


class CspReportTest(TestCase):
    def assertReportCreated(self, input, output):
        resp = self._postCspWithHeader(input)
        assert resp.status_code == 201, resp.content
        assert Event.objects.count() == 1
        e = Event.objects.all()[0]
        Event.objects.bind_nodes([e], 'data')
        assert output['message'] == e.data['sentry.interfaces.Message']['message']
        for key, value in six.iteritems(output['tags']):
            assert e.get_tag(key) == value
        self.assertDictContainsSubset(output['data'], e.data.data, e.data.data)

    def assertReportRejected(self, input):
        resp = self._postCspWithHeader(input)
        assert resp.status_code == 403, resp.content

    def test_chrome_blocked_asset(self):
        self.assertReportCreated(*get_fixtures('chrome_blocked_asset'))

    def test_firefox_missing_effective_uri(self):
        input, _ = get_fixtures('firefox_blocked_asset')
        self.assertReportRejected(input)

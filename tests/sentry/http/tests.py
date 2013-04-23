# -*- coding: utf-8 -*-

from __future__ import absolute_import

import datetime
import mock

from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from django.utils import timezone

from raven import Client
from sentry.models import Group, Event, Project
from sentry.testutils import TestCase
from sentry.services.http import SentryHTTPServer
from sentry.utils.settings import ConfigurationError


class RavenIntegrationTest(TestCase):
    """
    This mocks the test server and specifically tests behavior that would
    happen between Raven <--> Sentry over HTTP communication.
    """
    def setUp(self):
        self.user = User.objects.create(username='coreapi')
        self.project = Project.objects.create(owner=self.user, name='Foo', slug='bar')
        self.pm = self.project.team.member_set.get_or_create(user=self.user)[0]
        self.pk = self.project.key_set.get_or_create(user=self.user)[0]

    def sendRemote(self, url, data, headers={}):
        # TODO: make this install a temporary handler which raises an assertion error
        import logging
        sentry_errors = logging.getLogger('sentry.errors')
        sentry_errors.addHandler(logging.StreamHandler())
        sentry_errors.setLevel(logging.DEBUG)

        content_type = headers.pop('Content-Type', None)
        headers = dict(('HTTP_' + k.replace('-', '_').upper(), v) for k, v in headers.iteritems())
        resp = self.client.post(reverse('sentry-api-store', args=[self.pk.project_id]),
            data=data,
            content_type=content_type,
            **headers)
        self.assertEquals(resp.status_code, 200, resp.content)

    @mock.patch('raven.base.Client.send_remote')
    def test_basic(self, send_remote):
        send_remote.side_effect = self.sendRemote
        client = Client(
            project=self.pk.project_id,
            servers=['http://localhost:8000%s' % reverse('sentry-api-store', args=[self.pk.project_id])],
            public_key=self.pk.public_key,
            secret_key=self.pk.secret_key,
        )
        client.capture('Message', message='foo')

        send_remote.assert_called_once()
        self.assertEquals(Group.objects.count(), 1)
        group = Group.objects.get()
        self.assertEquals(group.event_set.count(), 1)
        instance = group.event_set.get()
        self.assertEquals(instance.message, 'foo')


class SentryRemoteTest(TestCase):
    def test_correct_data(self):
        kwargs = {'message': 'hello', 'server_name': 'not_dcramer.local', 'level': 40, 'site': 'not_a_real_site'}
        resp = self._postWithHeader(kwargs)
        self.assertEquals(resp.status_code, 200, resp.content)
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

TEST_DATA = {
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


class HttpServiceTest(TestCase):
    def raise_import_error(self, package):
        def callable(package_name):
            if package_name != package:
                raise RuntimeError("Package being tested differs from expected in test case")
            msg = "No module named %s" % package
            raise ImportError(msg)
        return callable

    def validate_dependency(self, import_string, settings, key, package, dependency_type, dependency, setting_value):
        import_string.side_effect = self.raise_import_error(package)

        settings.get = lambda setting, default: setting == key and setting_value or {}

        try:
            SentryHTTPServer()
        except ConfigurationError, err:
            self.assertEquals(str(err), "Python could not find %s in your current environment (required by %s %s). If you have it installed, maybe you are using the wrong python binary to run sentry?" % (package, dependency_type, dependency))
            return

        assert False, "Should not have gotten this far"

    @mock.patch('sentry.conf.settings')
    @mock.patch('sentry.utils.imports.import_string')
    def test_validate_fails_on_postgres(self, import_string, settings):
        self.validate_dependency(import_string, settings, *TEST_DATA['postgresql'])

    @mock.patch('sentry.conf.settings')
    @mock.patch('sentry.utils.imports.import_string')
    def test_validate_fails_on_mysql(self, import_string, settings):
        self.validate_dependency(import_string, settings, *TEST_DATA['mysql'])

    @mock.patch('sentry.conf.settings')
    @mock.patch('sentry.utils.imports.import_string')
    def test_validate_fails_on_oracle(self, import_string, settings):
        self.validate_dependency(import_string, settings, *TEST_DATA['oracle'])

    @mock.patch('sentry.conf.settings')
    @mock.patch('sentry.utils.imports.import_string')
    def test_validate_fails_on_memcache(self, import_string, settings):
        self.validate_dependency(import_string, settings, *TEST_DATA['memcache'])

    @mock.patch('sentry.conf.settings')
    @mock.patch('sentry.utils.imports.import_string')
    def test_validate_fails_on_pylibmc(self, import_string, settings):
        self.validate_dependency(import_string, settings, *TEST_DATA['pylibmc'])

# -*- coding: utf-8 -*-

from __future__ import absolute_import

import datetime
import logging
import mock

from exam import before, after

from django.conf import settings as django_settings
from django.core.urlresolvers import reverse
from django.utils import timezone

from raven import Client
from sentry.models import Group, Event, Project, User
from sentry.testutils import TestCase, with_eager_tasks
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


class RavenIntegrationTest(TestCase):
    """
    This mocks the test server and specifically tests behavior that would
    happen between Raven <--> Sentry over HTTP communication.
    """
    @before
    def setup_fixtures(self):
        self.user = User.objects.create(username='coreapi')
        self.project = Project.objects.create(owner=self.user, name='Foo', slug='bar')
        self.pm = self.project.team.member_set.get_or_create(user=self.user)[0]
        self.pk = self.project.key_set.get_or_create(user=self.user)[0]

    @before
    def wire_logging(self):
        class AssertHandler(logging.Handler):
            def emit(self, record):
                print record
                self.format(record)
                raise AssertionError(record.msg)

        self.handler = AssertHandler()
        for logger_name in ('root', 'sentry.errors'):
            logger = logging.getLogger(logger_name)
            logger.addHandler(self.handler)
            logger.setLevel(logging.DEBUG)

    @after
    def unwire_logging(self):
        for logger_name in ('root', 'sentry.errors'):
            logger = logging.getLogger(logger_name)
            logger.handlers.remove(self.handler)

    @with_eager_tasks
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
    @with_eager_tasks
    def test_correct_data(self):
        kwargs = {'message': 'hello', 'server_name': 'not_dcramer.local', 'level': 40, 'site': 'not_a_real_site'}
        resp = self._postWithHeader(kwargs)
        self.assertEquals(resp.status_code, 200, resp.content)
        instance = Event.objects.get()
        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.server_name, 'not_dcramer.local')
        self.assertEquals(instance.level, 40)
        self.assertEquals(instance.site, 'not_a_real_site')

    @with_eager_tasks
    def test_unicode_keys(self):
        kwargs = {u'message': 'hello', u'server_name': 'not_dcramer.local', u'level': 40, u'site': 'not_a_real_site'}
        resp = self._postWithSignature(kwargs)
        self.assertEquals(resp.status_code, 200, resp.content)
        instance = Event.objects.get()
        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.server_name, 'not_dcramer.local')
        self.assertEquals(instance.level, 40)
        self.assertEquals(instance.site, 'not_a_real_site')

    @with_eager_tasks
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

    @with_eager_tasks
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

    @with_eager_tasks
    def test_ungzipped_data(self):
        kwargs = {'message': 'hello', 'server_name': 'not_dcramer.local', 'level': 40, 'site': 'not_a_real_site'}
        resp = self._postWithSignature(kwargs)
        self.assertEquals(resp.status_code, 200)
        instance = Event.objects.get()
        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.server_name, 'not_dcramer.local')
        self.assertEquals(instance.site, 'not_a_real_site')
        self.assertEquals(instance.level, 40)

    @with_eager_tasks
    def test_signature(self):
        kwargs = {'message': 'hello', 'server_name': 'not_dcramer.local', 'level': 40, 'site': 'not_a_real_site'}

        resp = self._postWithSignature(kwargs)

        self.assertEquals(resp.status_code, 200, resp.content)

        instance = Event.objects.get()

        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.server_name, 'not_dcramer.local')
        self.assertEquals(instance.site, 'not_a_real_site')
        self.assertEquals(instance.level, 40)


class DepdendencyTest(TestCase):
    def raise_import_error(self, package):
        def callable(package_name):
            if package_name != package:
                return import_string(package_name)
            raise ImportError("No module named %s" % (package,))
        return callable

    @mock.patch('sentry.conf.settings')
    @mock.patch('sentry.utils.settings.import_string')
    def validate_dependency(self, key, package, dependency_type, dependency,
                            setting_value, import_string, settings):

        import_string.side_effect = self.raise_import_error(package)

        with self.Settings(**{key: setting_value}):
            with self.assertRaises(ConfigurationError):
                validate_settings(django_settings)

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

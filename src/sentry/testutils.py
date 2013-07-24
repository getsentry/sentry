"""
sentry.testutils
~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import base64
from exam import Exam, fixture, before  # NOQA
from functools import wraps

from sentry.utils import json

from django.conf import settings
from django.contrib.auth import login
from django.core.cache import cache
from django.core.management import call_command
from django.core.urlresolvers import reverse
from django.db import connections, DEFAULT_DB_ALIAS
from django.http import HttpRequest
from django.test import TestCase, TransactionTestCase
from django.test.client import Client
from django.utils.importlib import import_module

from sentry.models import (
    Project, ProjectOption, Option, Team, Group, Event, User)
from sentry.utils.compat import pickle
from sentry.utils.strings import decompress

# an example data blog from Sentry 5.4.1 (db level)
LEGACY_DATA = pickle.loads(decompress("""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"""))


def get_auth_header(client, api_key=None, secret_key=None):
    header = [
        ('sentry_client', client),
        ('sentry_version', '4'),
    ]

    if api_key:
        header.append(('sentry_key', api_key))
    if secret_key:
        header.append(('sentry_secret', secret_key))

    return 'Sentry %s' % ', '.join('%s=%s' % (k, v) for k, v in header)


def with_settings(**mapping):
    def wrapped(func):
        @wraps(func)
        def _wrapped(*args, **kwargs):
            with Settings(**mapping):
                return func(*args, **kwargs)
        return _wrapped
    return wrapped


class Settings(object):
    """
    Allows you to define settings that are required for this function to work.

    >>> with Settings(SENTRY_LOGIN_URL='foo'): #doctest: +SKIP
    >>>     print settings.SENTRY_LOGIN_URL #doctest: +SKIP
    """

    NotDefined = object()

    def __init__(self, **overrides):
        self.overrides = overrides
        self._orig = {}

    def __enter__(self):
        for k, v in self.overrides.iteritems():
            self._orig[k] = getattr(settings, k, self.NotDefined)
            setattr(settings, k, v)

    def __exit__(self, exc_type, exc_value, traceback):
        for k, v in self._orig.iteritems():
            if v is self.NotDefined:
                delattr(settings, k)
            else:
                setattr(settings, k, v)


class BaseTestCase(Exam):
    urls = 'tests.sentry.web.urls'

    Settings = Settings

    @fixture
    def projectkey(self):
        return self.project.key_set.get_or_create(user=self.user)[0]

    @fixture
    def user(self):
        user = User(username="admin", email="admin@localhost", is_staff=True, is_superuser=True)
        user.set_password('admin')
        user.save()
        return user

    @fixture
    def team(self):
        return Team.objects.create(
            name='foo',
            slug='foo',
            owner=self.user,
        )

    @fixture
    def project(self):
        return Project.objects.create(
            owner=self.user,
            name='Bar',
            slug='bar',
            team=self.team,
        )

    @fixture
    def group(self):
        return Group.objects.create(
            message='Foo bar',
            project=self.project,
        )

    @fixture
    def event(self):
        return Event.objects.create(
            event_id='a' * 32,
            group=self.group,
            message='Foo bar',
            project=self.project,
            data=LEGACY_DATA,
        )

    def assertRequiresAuthentication(self, path, method='GET'):
        resp = getattr(self.client, method.lower())(path)
        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + reverse('sentry-login')

    def login_as(self, user):
        user.backend = settings.AUTHENTICATION_BACKENDS[0]

        engine = import_module(settings.SESSION_ENGINE)

        request = HttpRequest()
        if self.client.session:
            request.session = self.client.session
        else:
            request.session = engine.SessionStore()

        login(request, user)

        # Save the session values.
        request.session.save()

        # Set the cookie to represent the session.
        session_cookie = settings.SESSION_COOKIE_NAME
        self.client.cookies[session_cookie] = request.session.session_key
        cookie_data = {
            'max-age': None,
            'path': '/',
            'domain': settings.SESSION_COOKIE_DOMAIN,
            'secure': settings.SESSION_COOKIE_SECURE or None,
            'expires': None,
        }
        self.client.cookies[session_cookie].update(cookie_data)

    def login(self):
        self.login_as(self.user)

    def _pre_setup(self):
        cache.clear()
        ProjectOption.objects.clear_cache()
        Option.objects.clear_cache()
        super(BaseTestCase, self)._pre_setup()

    def _makeMessage(self, data):
        return base64.b64encode(json.dumps(data))

    def _postWithKey(self, data, key=None):
        resp = self.client.post(reverse('sentry-api-store'), {
            'data': self._makeMessage(data),
            'key': settings.SENTRY_KEY,
        })
        return resp

    def _postWithHeader(self, data, key=None, secret=None):
        if key is None:
            key = self.projectkey.public_key
            secret = self.projectkey.secret_key

        message = self._makeMessage(data)
        resp = self.client.post(reverse('sentry-api-store'), message,
            content_type='application/octet-stream',
            HTTP_X_SENTRY_AUTH=get_auth_header('_postWithHeader', key, secret),
        )
        return resp

    _postWithSignature = _postWithHeader
    _postWithNewSignature = _postWithHeader


class TestCase(BaseTestCase, TestCase):
    pass


class TransactionTestCase(BaseTestCase, TransactionTestCase):
    """
    Subclass of ``django.test.TransactionTestCase`` that quickly tears down
    fixtures and doesn't `flush` on setup.  This enables tests to be run in
    any order.
    """
    urls = 'tests.urls'

    def __call__(self, result=None):
        """
        Wrapper around default __call__ method to perform common Django test
        set up. This means that user-defined Test Cases aren't required to
        include a call to super().setUp().
        """
        self.client = getattr(self, 'client_class', Client)()
        try:
            self._pre_setup()
        except (KeyboardInterrupt, SystemExit):
            raise
        except Exception:
            import sys
            result.addError(self, sys.exc_info())
            return
        try:
            super(TransactionTestCase, self).__call__(result)
        finally:
            try:
                self._post_teardown()
            except (KeyboardInterrupt, SystemExit):
                raise
            except Exception:
                import sys
                result.addError(self, sys.exc_info())

    def _get_databases(self):
        if getattr(self, 'multi_db', False):
            return connections
        return [DEFAULT_DB_ALIAS]

    def _fixture_setup(self):
        for db in self._get_databases():
            if hasattr(self, 'fixtures') and self.fixtures:
                # We have to use this slightly awkward syntax due to the fact
                # that we're using *args and **kwargs together.
                call_command('loaddata', *self.fixtures, **{'verbosity': 0, 'database': db})

    def _fixture_teardown(self):
        for db in self._get_databases():
            call_command('flush', verbosity=0, interactive=False, database=db)


def with_eager_tasks(func):
    @wraps(func)
    def wrapped(*args, **kwargs):
        from celery.app import app_or_default

        app = app_or_default()
        prev = app.conf.CELERY_ALWAYS_EAGER
        app.conf.CELERY_ALWAYS_EAGER = True

        try:
            return func(*args, **kwargs)
        finally:
            app.conf.CELERY_ALWAYS_EAGER = prev
    return wrapped

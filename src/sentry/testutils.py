"""
sentry.testutils
~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import base64
from exam import Exam, fixture, before  # NOQA
from functools import wraps

from sentry.conf import settings
from sentry.utils import json
from sentry.utils.auth import get_auth_header

from django.conf import settings as django_settings
from django.contrib.auth import login
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.management import call_command
from django.core.urlresolvers import reverse
from django.db import connections, DEFAULT_DB_ALIAS
from django.http import HttpRequest
from django.test import TestCase, TransactionTestCase
from django.test.client import Client
from django.utils.importlib import import_module

from sentry.models import (Project, ProjectOption, Option, Team, Group,
    Event)


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
        self._orig_sentry = {}

    def __enter__(self):
        for k, v in self.overrides.iteritems():
            self._orig[k] = getattr(django_settings, k, self.NotDefined)
            setattr(django_settings, k, v)
            if k.startswith('SENTRY_'):
                nk = k.split('SENTRY_', 1)[1]
                self._orig_sentry[nk] = getattr(settings, nk, self.NotDefined)
                setattr(settings, nk, v)

    def __exit__(self, exc_type, exc_value, traceback):
        for k, v in self._orig.iteritems():
            if v is self.NotDefined:
                delattr(django_settings, k)
            else:
                setattr(django_settings, k, v)
        for k, v in self._orig_sentry.iteritems():
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
        )

    def assertRequiresAuthentication(self, path, method='GET'):
        resp = getattr(self.client, method.lower())(path)
        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + reverse('sentry-login')

    def login_as(self, user):
        user.backend = django_settings.AUTHENTICATION_BACKENDS[0]

        engine = import_module(django_settings.SESSION_ENGINE)

        request = HttpRequest()
        if self.client.session:
            request.session = self.client.session
        else:
            request.session = engine.SessionStore()

        login(request, user)

        # Save the session values.
        request.session.save()

        # Set the cookie to represent the session.
        session_cookie = django_settings.SESSION_COOKIE_NAME
        self.client.cookies[session_cookie] = request.session.session_key
        cookie_data = {
            'max-age': None,
            'path': '/',
            'domain': django_settings.SESSION_COOKIE_DOMAIN,
            'secure': django_settings.SESSION_COOKIE_SECURE or None,
            'expires': None,
        }
        self.client.cookies[session_cookie].update(cookie_data)

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
            'key': settings.KEY,
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

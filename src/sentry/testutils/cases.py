"""
sentry.testutils.cases
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

__all__ = ('TestCase', 'TransactionTestCase', 'APITestCase')

import base64
import os.path
import urllib

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
from exam import Exam
from nydus.db import create_cluster
from rest_framework.test import APITestCase as BaseAPITestCase

from sentry.constants import MODULE_ROOT
from sentry.models import GroupMeta, ProjectOption
from sentry.rules import EventState
from sentry.utils import json

from .fixtures import Fixtures
from .helpers import get_auth_header


def create_redis_conn():
    options = {
        'engine': 'nydus.db.backends.redis.Redis',
    }
    options.update(settings.SENTRY_REDIS_OPTIONS)

    return create_cluster(options)

_redis_conn = create_redis_conn()


def flush_redis():
    _redis_conn.flushdb()


class BaseTestCase(Fixtures, Exam):
    urls = 'tests.sentry.web.urls'

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
        request.user = user

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

    def load_fixture(self, filepath):
        filepath = os.path.join(
            MODULE_ROOT,
            'tests',
            'fixtures',
            filepath,
        )
        with open(filepath, 'rb') as fp:
            return fp.read()

    def _pre_setup(self):
        cache.clear()
        ProjectOption.objects.clear_local_cache()
        GroupMeta.objects.clear_local_cache()
        super(BaseTestCase, self)._pre_setup()

    def _post_teardown(self):
        flush_redis()
        super(BaseTestCase, self)._post_teardown()

    def _makeMessage(self, data):
        return json.dumps(data)

    def _makePostMessage(self, data):
        return base64.b64encode(self._makeMessage(data))

    def _postWithKey(self, data, key=None):
        resp = self.client.post(reverse('sentry-api-store'), {
            'data': self._makePostMessage(data),
            'key': settings.SENTRY_KEY,
        })
        return resp

    def _postWithHeader(self, data, key=None, secret=None):
        if key is None:
            key = self.projectkey.public_key
            secret = self.projectkey.secret_key

        message = self._makePostMessage(data)
        resp = self.client.post(
            reverse('sentry-api-store'), message,
            content_type='application/octet-stream',
            HTTP_X_SENTRY_AUTH=get_auth_header('_postWithHeader', key, secret),
        )
        return resp

    def _getWithReferer(self, data, key=None, referer='getsentry.com', protocol='4'):
        if key is None:
            key = self.projectkey.public_key

        headers = {}
        if referer is not None:
            headers['HTTP_REFERER'] = referer

        message = self._makeMessage(data)
        qs = {
            'sentry_version': protocol,
            'sentry_client': 'raven-js/lol',
            'sentry_key': key,
            'sentry_data': message,
        }
        resp = self.client.get(
            '%s?%s' % (reverse('sentry-api-store', args=(self.project.pk,)), urllib.urlencode(qs)),
            **headers
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


class APITestCase(BaseTestCase, BaseAPITestCase):
    pass


class RuleTestCase(TestCase):
    rule_cls = None

    def get_event(self):
        return self.event

    def get_rule(self, data=None):
        return self.rule_cls(
            project=self.project,
            data=data or {},
        )

    def get_state(self, **kwargs):
        kwargs.setdefault('is_new', True)
        kwargs.setdefault('is_regression', True)
        kwargs.setdefault('is_sample', True)
        kwargs.setdefault('rule_is_active', False)
        return EventState(**kwargs)

    def assertPasses(self, rule, event=None, **kwargs):
        if event is None:
            event = self.event
        state = self.get_state(**kwargs)
        assert rule.passes(event, state) is True

    def assertDoesNotPass(self, rule, event=None, **kwargs):
        if event is None:
            event = self.event
        state = self.get_state(**kwargs)
        assert rule.passes(event, state) is False

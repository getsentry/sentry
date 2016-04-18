"""
sentry.testutils.cases
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

__all__ = (
    'TestCase', 'TransactionTestCase', 'APITestCase', 'AuthProviderTestCase',
    'RuleTestCase', 'PermissionTestCase', 'PluginTestCase', 'CliTestCase',
)

import base64
import os.path
import urllib
from contextlib import contextmanager

from click.testing import CliRunner
from django.conf import settings
from django.contrib.auth import login
from django.core.cache import cache
from django.core.urlresolvers import reverse
from django.http import HttpRequest
from django.test import TestCase, TransactionTestCase
from django.utils.importlib import import_module
from exam import before, fixture, Exam
from rest_framework.test import APITestCase as BaseAPITestCase

from sentry import auth
from sentry.auth.providers.dummy import DummyProvider
from sentry.constants import MODULE_ROOT
from sentry.models import GroupMeta, ProjectOption
from sentry.plugins import plugins
from sentry.rules import EventState
from sentry.utils import json

from .fixtures import Fixtures
from .helpers import AuthProvider, Feature, get_auth_header, TaskRunner, override_options


class BaseTestCase(Fixtures, Exam):
    urls = 'sentry.web.urls'

    def assertRequiresAuthentication(self, path, method='GET'):
        resp = getattr(self.client, method.lower())(path)
        assert resp.status_code == 302
        assert resp['Location'].startswith('http://testserver' + reverse('sentry-login'))

    @before
    def setup_session(self):
        engine = import_module(settings.SESSION_ENGINE)

        session = engine.SessionStore()
        session.save()

        self.session = session

    def tasks(self):
        return TaskRunner()

    def feature(self, name, active=True):
        """
        >>> with self.feature('feature:name')
        >>>     # ...
        """
        return Feature(name, active)

    def auth_provider(self, name, cls):
        """
        >>> with self.auth_provider('name', Provider)
        >>>     # ...
        """
        return AuthProvider(name, cls)

    def save_session(self):
        self.session.save()

        cookie_data = {
            'max-age': None,
            'path': '/',
            'domain': settings.SESSION_COOKIE_DOMAIN,
            'secure': settings.SESSION_COOKIE_SECURE or None,
            'expires': None,
        }

        session_cookie = settings.SESSION_COOKIE_NAME
        self.client.cookies[session_cookie] = self.session.session_key
        self.client.cookies[session_cookie].update(cookie_data)

    def login_as(self, user):
        user.backend = settings.AUTHENTICATION_BACKENDS[0]

        request = HttpRequest()
        request.session = self.session

        login(request, user)
        request.user = user

        # Save the session values.
        self.save_session()

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
        super(BaseTestCase, self)._pre_setup()

        cache.clear()
        ProjectOption.objects.clear_local_cache()
        GroupMeta.objects.clear_local_cache()

    def _post_teardown(self):
        super(BaseTestCase, self)._post_teardown()

    def _makeMessage(self, data):
        return json.dumps(data)

    def _makePostMessage(self, data):
        return base64.b64encode(self._makeMessage(data))

    def _postWithHeader(self, data, key=None, secret=None, protocol=None):
        if key is None:
            key = self.projectkey.public_key
            secret = self.projectkey.secret_key

        message = self._makePostMessage(data)
        with self.tasks():
            resp = self.client.post(
                reverse('sentry-api-store'), message,
                content_type='application/octet-stream',
                HTTP_X_SENTRY_AUTH=get_auth_header(
                    '_postWithHeader/0.0.0',
                    key,
                    secret,
                    protocol,
                ),
            )
        return resp

    def _postCspWithHeader(self, data, key=None, **extra):
        if isinstance(data, dict):
            body = json.dumps({'csp-report': data})
        elif isinstance(data, basestring):
            body = data
        path = reverse('sentry-api-csp-report', kwargs={'project_id': self.project.id})
        path += '?sentry_key=%s' % self.projectkey.public_key
        with self.tasks():
            return self.client.post(
                path, data=body,
                content_type='application/csp-report',
                HTTP_USER_AGENT='awesome',
                **extra
            )

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
        with self.tasks():
            resp = self.client.get(
                '%s?%s' % (reverse('sentry-api-store', args=(self.project.pk,)), urllib.urlencode(qs)),
                **headers
            )
        return resp

    def _postWithReferer(self, data, key=None, referer='getsentry.com', protocol='4'):
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
        }
        with self.tasks():
            resp = self.client.post(
                '%s?%s' % (reverse('sentry-api-store', args=(self.project.pk,)), urllib.urlencode(qs)),
                data=message,
                content_type='application/json',
                **headers
            )
        return resp

    def options(self, options):
        """
        A context manager that temporarily sets a global option and reverts
        back to the original value when exiting the context.
        """
        return override_options(options)

    @contextmanager
    def dsn(self, dsn):
        """
        A context manager that temporarily sets the internal client's DSN
        """
        from raven.contrib.django.models import client

        try:
            client.set_dsn(dsn)
            yield
        finally:
            client.set_dsn(None)

    _postWithSignature = _postWithHeader
    _postWithNewSignature = _postWithHeader


class TestCase(BaseTestCase, TestCase):
    pass


class TransactionTestCase(BaseTestCase, TransactionTestCase):
    pass


class APITestCase(BaseTestCase, BaseAPITestCase):
    pass


class AuthProviderTestCase(TestCase):
    provider = DummyProvider
    provider_name = 'dummy'

    def setUp(self):
        super(AuthProviderTestCase, self).setUp()
        auth.register(self.provider_name, self.provider)
        self.addCleanup(auth.unregister, self.provider_name, self.provider)


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
        kwargs.setdefault('rule_last_active', None)
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


class PermissionTestCase(TestCase):
    def setUp(self):
        super(PermissionTestCase, self).setUp()
        self.owner = self.create_user(is_superuser=False)
        self.organization = self.create_organization(
            owner=self.owner,
            flags=0,  # disable default allow_joinleave access
        )
        self.team = self.create_team(organization=self.organization)

    def assert_can_access(self, user, path, method='GET'):
        self.login_as(user)
        resp = getattr(self.client, method.lower())(path)
        assert resp.status_code >= 200 and resp.status_code < 300

    def assert_cannot_access(self, user, path, method='GET'):
        self.login_as(user)
        resp = getattr(self.client, method.lower())(path)
        assert resp.status_code >= 300

    def assert_member_can_access(self, path):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization,
            role='member', teams=[self.team],
        )

        self.assert_can_access(user, path)

    def assert_teamless_member_can_access(self, path):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization,
            role='member', teams=[],
        )

        self.assert_can_access(user, path)

    def assert_member_cannot_access(self, path):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization,
            role='member', teams=[self.team],
        )

        self.assert_cannot_access(user, path)

    def assert_teamless_member_cannot_access(self, path):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization,
            role='member', teams=[],
        )

        self.assert_cannot_access(user, path)

    def assert_team_admin_can_access(self, path):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization,
            teams=[self.team], role='admin',
        )

        self.assert_can_access(user, path)

    def assert_teamless_admin_can_access(self, path):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization,
            role='admin', teams=[],
        )

        self.assert_can_access(user, path)

    def assert_team_admin_cannot_access(self, path):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization,
            teams=[self.team], role='admin',
        )

        self.assert_cannot_access(user, path)

    def assert_teamless_admin_cannot_access(self, path):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization,
            role='admin', teams=[],
        )

        self.assert_cannot_access(user, path)

    def assert_team_owner_can_access(self, path):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization,
            teams=[self.team], role='owner',
        )

        self.assert_can_access(user, path)

    def assert_owner_can_access(self, path):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization,
            role='owner', teams=[self.team],
        )

        self.assert_can_access(user, path)

    def assert_owner_cannot_access(self, path):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization,
            role='owner', teams=[self.team],
        )

        self.assert_cannot_access(user, path)

    def assert_non_member_cannot_access(self, path):
        user = self.create_user(is_superuser=False)
        self.assert_cannot_access(user, path)


class PluginTestCase(TestCase):
    plugin = None

    def setUp(self):
        super(PluginTestCase, self).setUp()
        plugins.register(self.plugin)
        self.addCleanup(plugins.unregister, self.plugin)


class CliTestCase(TestCase):
    runner = fixture(CliRunner)
    command = None
    default_args = []

    def invoke(self, *args):
        args += tuple(self.default_args)
        return self.runner.invoke(self.command, args, obj={})

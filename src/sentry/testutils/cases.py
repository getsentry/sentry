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
    'AcceptanceTestCase',
)

import base64
import os
import os.path
import pytest
import six
import types

from click.testing import CliRunner
from contextlib import contextmanager
from django.conf import settings
from django.contrib.auth import login
from django.core.cache import cache
from django.core.urlresolvers import reverse
from django.http import HttpRequest
from django.test import TestCase, TransactionTestCase
from django.utils.importlib import import_module
from exam import before, fixture, Exam
from pkg_resources import iter_entry_points
from rest_framework.test import APITestCase as BaseAPITestCase
from six.moves.urllib.parse import urlencode

from sentry import auth
from sentry.auth.providers.dummy import DummyProvider
from sentry.constants import MODULE_ROOT
from sentry.models import GroupMeta, ProjectOption
from sentry.plugins import plugins
from sentry.rules import EventState
from sentry.utils import json
from sentry.utils.auth import SSO_SESSION_KEY

from .fixtures import Fixtures
from .helpers import AuthProvider, Feature, get_auth_header, TaskRunner, override_options

DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'


class BaseTestCase(Fixtures, Exam):
    urls = 'sentry.web.urls'

    def assertRequiresAuthentication(self, path, method='GET'):
        resp = getattr(self.client, method.lower())(path)
        assert resp.status_code == 302
        assert resp['Location'].startswith('http://testserver' + reverse('sentry-login'))

    @before
    def setup_dummy_auth_provider(self):
        auth.register('dummy', DummyProvider)
        self.addCleanup(auth.unregister, 'dummy', DummyProvider)

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

    def login_as(self, user, organization_id=None):
        user.backend = settings.AUTHENTICATION_BACKENDS[0]

        request = HttpRequest()
        request.session = self.session

        login(request, user)
        request.user = user
        if organization_id:
            request.session[SSO_SESSION_KEY] = six.text_type(organization_id)

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
        return json.dumps(data).encode('utf-8')

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
        elif isinstance(data, six.string_types):
            body = data
        path = reverse('sentry-api-csp-report', kwargs={'project_id': self.project.id})
        path += '?sentry_key=%s' % self.projectkey.public_key
        with self.tasks():
            return self.client.post(
                path, data=body,
                content_type='application/csp-report',
                HTTP_USER_AGENT=DEFAULT_USER_AGENT,
                **extra
            )

    def _getWithReferer(self, data, key=None, referer='sentry.io', protocol='4'):
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
                '%s?%s' % (reverse('sentry-api-store', args=(self.project.pk,)), urlencode(qs)),
                **headers
            )
        return resp

    def _postWithReferer(self, data, key=None, referer='sentry.io', protocol='4'):
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
                '%s?%s' % (reverse('sentry-api-store', args=(self.project.pk,)), urlencode(qs)),
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
        # TestCase automatically sets up dummy provider
        if self.provider_name != 'dummy' or self.provider != DummyProvider:
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
        return self.assert_role_can_access(path, 'member')

    def assert_teamless_member_can_access(self, path):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization,
            role='member', teams=[],
        )

        self.assert_can_access(user, path)

    def assert_member_cannot_access(self, path):
        return self.assert_role_cannot_access(path, 'member')

    def assert_manager_cannot_access(self, path):
        return self.assert_role_cannot_access(path, 'manager')

    def assert_teamless_member_cannot_access(self, path):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization,
            role='member', teams=[],
        )

        self.assert_cannot_access(user, path)

    def assert_team_admin_can_access(self, path):
        return self.assert_role_can_access(path, 'owner')

    def assert_teamless_admin_can_access(self, path):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization,
            role='admin', teams=[],
        )

        self.assert_can_access(user, path)

    def assert_team_admin_cannot_access(self, path):
        return self.assert_role_cannot_access(path, 'admin')

    def assert_teamless_admin_cannot_access(self, path):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization,
            role='admin', teams=[],
        )

        self.assert_cannot_access(user, path)

    def assert_team_owner_can_access(self, path):
        return self.assert_role_can_access(path, 'owner')

    def assert_owner_can_access(self, path):
        return self.assert_role_can_access(path, 'owner')

    def assert_owner_cannot_access(self, path):
        return self.assert_role_cannot_access(path, 'owner')

    def assert_non_member_cannot_access(self, path):
        user = self.create_user(is_superuser=False)
        self.assert_cannot_access(user, path)

    def assert_role_can_access(self, path, role):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization,
            role=role, teams=[self.team],
        )

        self.assert_can_access(user, path)

    def assert_role_cannot_access(self, path, role):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user, organization=self.organization,
            role=role, teams=[self.team],
        )

        self.assert_cannot_access(user, path)


class PluginTestCase(TestCase):
    plugin = None

    def setUp(self):
        super(PluginTestCase, self).setUp()

        # Old plugins, plugin is a class, new plugins, it's an instance
        # New plugins don't need to be registered
        if isinstance(self.plugin, (type, types.ClassType)):
            plugins.register(self.plugin)
            self.addCleanup(plugins.unregister, self.plugin)

    def assertAppInstalled(self, name, path):
        for ep in iter_entry_points('sentry.apps'):
            if ep.name == name:
                ep_path = ep.module_name
                if ep_path == path:
                    return
                self.fail('Found app in entry_points, but wrong class. Got %r, expected %r' % (ep_path, path))
        self.fail('Missing app from entry_points: %r' % (name,))

    def assertPluginInstalled(self, name, plugin):
        path = type(plugin).__module__ + ':' + type(plugin).__name__
        for ep in iter_entry_points('sentry.plugins'):
            if ep.name == name:
                ep_path = ep.module_name + ':' + '.'.join(ep.attrs)
                if ep_path == path:
                    return
                self.fail('Found plugin in entry_points, but wrong class. Got %r, expected %r' % (ep_path, path))
        self.fail('Missing plugin from entry_points: %r' % (name,))


class CliTestCase(TestCase):
    runner = fixture(CliRunner)
    command = None
    default_args = []

    def invoke(self, *args):
        args += tuple(self.default_args)
        return self.runner.invoke(self.command, args, obj={})


@pytest.mark.usefixtures('browser')
class AcceptanceTestCase(TransactionTestCase):
    def save_session(self):
        self.session.save()
        self.browser.save_cookie(
            name=settings.SESSION_COOKIE_NAME,
            value=self.session.session_key,
        )

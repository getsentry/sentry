"""
sentry.testutils.cases
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

__all__ = ('TestCase', 'TransactionTestCase', 'APITestCase', 'RuleTestCase',
           'PermissionTestCase', 'PluginTestCase')

import base64
import os.path
import urllib

from django.conf import settings
from django.contrib.auth import login
from django.core.cache import cache
from django.core.urlresolvers import reverse
from django.http import HttpRequest
from django.test import TestCase, TransactionTestCase
from django.utils.importlib import import_module
from exam import before, Exam
from nydus.db import create_cluster
from rest_framework.test import APITestCase as BaseAPITestCase

from sentry.constants import MODULE_ROOT
from sentry.models import GroupMeta, OrganizationMemberType, ProjectOption
from sentry.plugins import plugins
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

    @before
    def setup_session(self):
        engine = import_module(settings.SESSION_ENGINE)

        session = engine.SessionStore()
        session.save()

        self.session = session

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

        flush_redis()

    def _makeMessage(self, data):
        return json.dumps(data)

    def _makePostMessage(self, data):
        return base64.b64encode(self._makeMessage(data))

    def _postWithHeader(self, data, key=None, secret=None):
        if key is None:
            key = self.projectkey.public_key
            secret = self.projectkey.secret_key

        message = self._makePostMessage(data)
        with self.settings(CELERY_ALWAYS_EAGER=True):
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
        with self.settings(CELERY_ALWAYS_EAGER=True):
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
    pass


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
        self.owner = self.create_user()
        self.organization = self.create_organization(owner=self.owner)
        self.team = self.create_team(organization=self.organization)

    def assert_can_access(self, user, path, method='GET'):
        self.login_as(user)
        resp = getattr(self.client, method.lower())(path)
        assert resp.status_code >= 200 and resp.status_code < 300

    def assert_cannot_access(self, user, path, method='GET'):
        self.login_as(user)
        resp = getattr(self.client, method.lower())(path)
        assert resp.status_code >= 300

    def assert_team_member_can_access(self, path):
        user = self.create_user()
        self.create_member(
            user=user, organization=self.organization,
            has_global_access=False, teams=[self.team],
        )

        self.assert_can_access(user, path)

    def assert_org_member_can_access(self, path):
        user = self.create_user()
        self.create_member(
            user=user, organization=self.organization,
            has_global_access=True,
        )

        self.assert_can_access(user, path)

    def assert_teamless_member_can_access(self, path):
        user = self.create_user()
        self.create_member(
            user=user, organization=self.organization,
            has_global_access=False,
        )

        self.assert_can_access(user, path)

    def assert_team_member_cannot_access(self, path):
        user = self.create_user()
        self.create_member(
            user=user, organization=self.organization,
            has_global_access=False, teams=[self.team],
        )

        self.assert_cannot_access(user, path)

    def assert_org_member_cannot_access(self, path):
        user = self.create_user()
        self.create_member(
            user=user, organization=self.organization,
            has_global_access=True,
        )

        self.assert_cannot_access(user, path)

    def assert_teamless_member_cannot_access(self, path):
        user = self.create_user()
        self.create_member(
            user=user, organization=self.organization,
            has_global_access=False,
        )

        self.assert_cannot_access(user, path)

    def assert_team_admin_can_access(self, path):
        user = self.create_user()
        self.create_member(
            user=user, organization=self.organization,
            has_global_access=False, teams=[self.team],
            type=OrganizationMemberType.ADMIN,
        )

        self.assert_can_access(user, path)

    def assert_org_admin_can_access(self, path):
        user = self.create_user()
        self.create_member(
            user=user, organization=self.organization,
            has_global_access=True,
            type=OrganizationMemberType.ADMIN,
        )

        self.assert_can_access(user, path)

    def assert_teamless_admin_can_access(self, path):
        user = self.create_user()
        self.create_member(
            user=user, organization=self.organization,
            has_global_access=False,
            type=OrganizationMemberType.ADMIN,
        )

        self.assert_can_access(user, path)

    def assert_team_admin_cannot_access(self, path):
        user = self.create_user()
        self.create_member(
            user=user, organization=self.organization,
            has_global_access=False, teams=[self.team],
            type=OrganizationMemberType.ADMIN,
        )

        self.assert_cannot_access(user, path)

    def assert_org_admin_cannot_access(self, path):
        user = self.create_user()
        self.create_member(
            user=user, organization=self.organization,
            has_global_access=True,
            type=OrganizationMemberType.ADMIN,
        )

        self.assert_cannot_access(user, path)

    def assert_teamless_admin_cannot_access(self, path):
        user = self.create_user()
        self.create_member(
            user=user, organization=self.organization,
            has_global_access=False,
            type=OrganizationMemberType.ADMIN,
        )

        self.assert_cannot_access(user, path)

    def assert_team_owner_can_access(self, path):
        user = self.create_user()
        self.create_member(
            user=user, organization=self.organization,
            has_global_access=False, teams=[self.team],
            type=OrganizationMemberType.OWNER,
        )

        self.assert_can_access(user, path)

    def assert_org_owner_can_access(self, path):
        user = self.create_user()
        self.create_member(
            user=user, organization=self.organization,
            has_global_access=True,
            type=OrganizationMemberType.OWNER,
        )

        self.assert_can_access(user, path)

    def assert_teamless_owner_can_access(self, path):
        user = self.create_user()
        self.create_member(
            user=user, organization=self.organization,
            has_global_access=False,
            type=OrganizationMemberType.OWNER,
        )

        self.assert_can_access(user, path)

    def assert_team_owner_cannot_access(self, path):
        user = self.create_user()
        self.create_member(
            user=user, organization=self.organization,
            has_global_access=False, teams=[self.team],
            type=OrganizationMemberType.OWNER,
        )

        self.assert_cannot_access(user, path)

    def assert_org_owner_cannot_access(self, path):
        user = self.create_user()
        self.create_member(
            user=user, organization=self.organization,
            has_global_access=True,
            type=OrganizationMemberType.OWNER,
        )

        self.assert_cannot_access(user, path)

    def assert_teamless_owner_cannot_access(self, path):
        user = self.create_user()
        self.create_member(
            user=user, organization=self.organization,
            has_global_access=False,
            type=OrganizationMemberType.OWNER,
        )

        self.assert_cannot_access(user, path)

    def assert_non_member_cannot_access(self, path):
        user = self.create_user()
        self.assert_cannot_access(user, path)


class PluginTestCase(TestCase):
    plugin = None

    def setUp(self):
        super(PluginTestCase, self).setUp()
        plugins.register(self.plugin)
        self.addCleanup(plugins.unregister, self.plugin)

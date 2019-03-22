"""
sentry.testutils.cases
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

__all__ = (
    'TestCase', 'TransactionTestCase', 'APITestCase', 'TwoFactorAPITestCase', 'AuthProviderTestCase', 'RuleTestCase',
    'PermissionTestCase', 'PluginTestCase', 'CliTestCase', 'AcceptanceTestCase',
    'IntegrationTestCase', 'UserReportEnvironmentTestCase', 'SnubaTestCase', 'IntegrationRepositoryTestCase',
    'ReleaseCommitPatchTest', 'SetRefsTestCase', 'OrganizationDashboardWidgetTestCase'
)

import base64
import calendar
import contextlib
import os
import os.path
import pytest
import requests
import six
import types
import logging
import mock

from click.testing import CliRunner
from datetime import datetime
from django.conf import settings
from django.contrib.auth import login
from django.contrib.auth.models import AnonymousUser
from django.core import signing
from django.core.cache import cache
from django.core.urlresolvers import reverse
from django.db import connections, DEFAULT_DB_ALIAS
from django.http import HttpRequest
from django.test import TestCase, TransactionTestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from exam import before, fixture, Exam
from mock import patch
from pkg_resources import iter_entry_points
from rest_framework.test import APITestCase as BaseAPITestCase
from six.moves.urllib.parse import urlencode

from sentry import auth
from sentry.auth.providers.dummy import DummyProvider
from sentry.auth.superuser import (
    Superuser, COOKIE_SALT as SU_COOKIE_SALT, COOKIE_NAME as SU_COOKIE_NAME, ORG_ID as SU_ORG_ID,
    COOKIE_SECURE as SU_COOKIE_SECURE, COOKIE_DOMAIN as SU_COOKIE_DOMAIN, COOKIE_PATH as SU_COOKIE_PATH
)
from sentry.constants import MODULE_ROOT
from sentry.eventstream.snuba import SnubaEventStream
from sentry.models import (
    GroupEnvironment, GroupHash, GroupMeta, ProjectOption, Repository, DeletedOrganization,
    Environment, GroupStatus, Organization, TotpInterface, UserReport,
    Dashboard, ObjectStatus, WidgetDataSource, WidgetDataSourceTypes
)
from sentry.plugins import plugins
from sentry.rules import EventState
from sentry.tagstore.snuba import SnubaCompatibilityTagStorage
from sentry.utils import json
from sentry.utils.auth import SSO_SESSION_KEY

from .fixtures import Fixtures
from .helpers import (
    AuthProvider, Feature, get_auth_header, TaskRunner, override_options, parse_queries
)

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

    def tasks(self):
        return TaskRunner()

    def feature(self, names):
        """
        >>> with self.feature({'feature:name': True})
        >>>     # ...
        """
        return Feature(names)

    def auth_provider(self, name, cls):
        """
        >>> with self.auth_provider('name', Provider)
        >>>     # ...
        """
        return AuthProvider(name, cls)

    def save_session(self):
        self.session.save()
        self.save_cookie(
            name=settings.SESSION_COOKIE_NAME,
            value=self.session.session_key,
            max_age=None,
            path='/',
            domain=settings.SESSION_COOKIE_DOMAIN,
            secure=settings.SESSION_COOKIE_SECURE or None,
            expires=None
        )

    def save_cookie(self, name, value, **params):
        self.client.cookies[name] = value
        self.client.cookies[name].update({
            k.replace('_', '-'): v
            for k, v in six.iteritems(params)
        })

    def make_request(self, user=None, auth=None, method=None):
        request = HttpRequest()
        if method:
            request.method = method
        request.META['REMOTE_ADDR'] = '127.0.0.1'
        request.META['SERVER_NAME'] = 'testserver'
        request.META['SERVER_PORT'] = 80
        request.REQUEST = {}

        # order matters here, session -> user -> other things
        request.session = self.session
        request.auth = auth
        request.user = user or AnonymousUser()
        request.superuser = Superuser(request)
        request.is_superuser = lambda: request.superuser.is_active
        request.successful_authenticator = None
        return request

    # TODO(dcramer): ideally superuser_sso would be False by default, but that would require
    # a lot of tests changing
    def login_as(self, user, organization_id=None, organization_ids=None,
                 superuser=False, superuser_sso=True):
        user.backend = settings.AUTHENTICATION_BACKENDS[0]

        request = self.make_request()
        login(request, user)
        request.user = user

        if organization_ids is None:
            organization_ids = set()
        else:
            organization_ids = set(organization_ids)
        if superuser and superuser_sso is not False:
            if SU_ORG_ID:
                organization_ids.add(SU_ORG_ID)
        if organization_id:
            organization_ids.add(organization_id)

        # TODO(dcramer): ideally this would get abstracted
        if organization_ids:
            request.session[SSO_SESSION_KEY] = ','.join(
                six.text_type(o) for o in organization_ids)

        # logging in implicitly binds superuser, but for test cases we
        # want that action to be explicit to avoid accidentally testing
        # superuser-only code
        if not superuser:
            # XXX(dcramer): we're calling the internal method to avoid logging
            request.superuser._set_logged_out()
        elif request.user.is_superuser and superuser:
            request.superuser.set_logged_in(request.user)
            # XXX(dcramer): awful hack to ensure future attempts to instantiate
            # the Superuser object are successful
            self.save_cookie(
                name=SU_COOKIE_NAME,
                value=signing.get_cookie_signer(
                    salt=SU_COOKIE_NAME + SU_COOKIE_SALT,
                ).sign(request.superuser.token),
                max_age=None,
                path=SU_COOKIE_PATH,
                domain=SU_COOKIE_DOMAIN,
                secure=SU_COOKIE_SECURE or None,
                expires=None,
            )
        # Save the session values.
        self.save_session()

    def load_fixture(self, filepath):
        filepath = os.path.join(
            MODULE_ROOT,
            os.pardir,
            os.pardir,
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
                reverse('sentry-api-store'),
                message,
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
                path,
                data=body,
                content_type='application/csp-report',
                HTTP_USER_AGENT=DEFAULT_USER_AGENT,
                **extra
            )

    def _postMinidumpWithHeader(self, upload_file_minidump, data=None, key=None, **extra):
        data = dict(data or {})
        data['upload_file_minidump'] = upload_file_minidump
        path = reverse('sentry-api-minidump', kwargs={'project_id': self.project.id})
        path += '?sentry_key=%s' % self.projectkey.public_key
        with self.tasks():
            return self.client.post(
                path,
                data=data,
                HTTP_USER_AGENT=DEFAULT_USER_AGENT,
                **extra
            )

    def _postUnrealWithHeader(self, upload_unreal_crash, data=None, key=None, **extra):
        path = reverse(
            'sentry-api-unreal',
            kwargs={
                'project_id': self.project.id,
                'sentry_key': self.projectkey.public_key})
        with self.tasks():
            return self.client.post(
                path,
                data=upload_unreal_crash,
                content_type='application/octet-stream',
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
                '%s?%s' % (reverse('sentry-api-store', args=(self.project.pk, )), urlencode(qs)),
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
                '%s?%s' % (reverse('sentry-api-store', args=(self.project.pk, )), urlencode(qs)),
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

    _postWithSignature = _postWithHeader
    _postWithNewSignature = _postWithHeader

    def assert_valid_deleted_log(self, deleted_log, original_object):
        assert deleted_log is not None
        assert original_object.name == deleted_log.name

        assert deleted_log.name == original_object.name
        assert deleted_log.slug == original_object.slug

        if not isinstance(deleted_log, DeletedOrganization):
            assert deleted_log.organization_id == original_object.organization.id
            assert deleted_log.organization_name == original_object.organization.name
            assert deleted_log.organization_slug == original_object.organization.slug

        # Truncating datetime for mysql compatibility
        assert deleted_log.date_created.replace(
            microsecond=0) == original_object.date_added.replace(microsecond=0)
        assert deleted_log.date_deleted >= deleted_log.date_created

    def assertWriteQueries(self, queries, debug=False, *args, **kwargs):
        func = kwargs.pop('func', None)
        using = kwargs.pop("using", DEFAULT_DB_ALIAS)
        conn = connections[using]

        context = _AssertQueriesContext(self, queries, debug, conn)
        if func is None:
            return context

        with context:
            func(*args, **kwargs)


class _AssertQueriesContext(CaptureQueriesContext):
    def __init__(self, test_case, queries, debug, connection):
        self.test_case = test_case
        self.queries = queries
        self.debug = debug
        super(_AssertQueriesContext, self).__init__(connection)

    def __exit__(self, exc_type, exc_value, traceback):
        super(_AssertQueriesContext, self).__exit__(exc_type, exc_value, traceback)
        if exc_type is not None:
            return

        parsed_queries = parse_queries(self.captured_queries)

        if (self.debug):
            import pprint
            pprint.pprint("====================== Raw Queries ======================")
            pprint.pprint(self.captured_queries)
            pprint.pprint("====================== Table writes ======================")
            pprint.pprint(parsed_queries)

        for table, num in parsed_queries.items():
            expected = self.queries.get(table, 0)
            if expected == 0:
                import pprint
                pprint.pprint("WARNING: no query against %s emitted, add debug=True to see all the queries" % (
                    table
                ))
            else:
                self.test_case.assertTrue(
                    num == expected, "%d write queries expected on `%s`, got %d, add debug=True to see all the queries" % (
                        expected, table, num
                    )
                )

        for table, num in self.queries.items():
            executed = parsed_queries.get(table, None)
            self.test_case.assertFalse(
                executed is None, "no query against %s emitted, add debug=True to see all the queries" % (
                    table
                )
            )


class TestCase(BaseTestCase, TestCase):
    pass


class TransactionTestCase(BaseTestCase, TransactionTestCase):
    pass


class APITestCase(BaseTestCase, BaseAPITestCase):
    endpoint = None
    method = 'get'

    def get_response(self, *args, **params):
        if self.endpoint is None:
            raise Exception('Implement self.endpoint to use this method.')

        url = reverse(self.endpoint, args=args)
        # In some cases we want to pass querystring params to put/post, handle
        # this here.
        if 'qs_params' in params:
            query_string = urlencode(params.pop('qs_params'), doseq=True)
            url = u'{}?{}'.format(url, query_string)

        method = params.pop('method', self.method)

        return getattr(self.client, method)(
            url,
            format='json',
            data=params,
        )

    def get_valid_response(self, *args, **params):
        status_code = params.pop('status_code', 200)
        resp = self.get_response(*args, **params)
        assert resp.status_code == status_code, resp.content
        return resp


class TwoFactorAPITestCase(APITestCase):
    @fixture
    def path_2fa(self):
        return reverse('sentry-account-settings-security')

    def enable_org_2fa(self, organization):
        organization.flags.require_2fa = True
        organization.save()

    def api_enable_org_2fa(self, organization, user):
        self.login_as(user)
        url = reverse('sentry-api-0-organization-details', kwargs={
            'organization_slug': organization.slug
        })
        return self.client.put(url, data={'require2FA': True})

    def api_disable_org_2fa(self, organization, user):
        url = reverse('sentry-api-0-organization-details', kwargs={
            'organization_slug': organization.slug,
        })
        return self.client.put(url, data={'require2FA': False})

    def assert_can_enable_org_2fa(self, organization, user, status_code=200):
        self.__helper_enable_organization_2fa(organization, user, status_code)

    def assert_cannot_enable_org_2fa(self, organization, user, status_code, err_msg=None):
        self.__helper_enable_organization_2fa(organization, user, status_code, err_msg)

    def __helper_enable_organization_2fa(self, organization, user, status_code, err_msg=None):
        response = self.api_enable_org_2fa(organization, user)
        assert response.status_code == status_code
        if err_msg:
            assert err_msg in response.content
        organization = Organization.objects.get(id=organization.id)

        if status_code >= 200 and status_code < 300:
            assert organization.flags.require_2fa
        else:
            assert not organization.flags.require_2fa

    def add_2fa_users_to_org(self, organization, num_of_users=10, num_with_2fa=5):
        non_compliant_members = []
        for num in range(0, num_of_users):
            user = self.create_user('foo_%s@example.com' % num)
            self.create_member(organization=organization, user=user)
            if num_with_2fa:
                TotpInterface().enroll(user)
                num_with_2fa -= 1
            else:
                non_compliant_members.append(user.email)
        return non_compliant_members


class UserReportEnvironmentTestCase(APITestCase):
    def setUp(self):

        self.project = self.create_project()
        self.env1 = self.create_environment(self.project, 'production')
        self.env2 = self.create_environment(self.project, 'staging')

        self.group = self.create_group(project=self.project, status=GroupStatus.UNRESOLVED)

        self.env1_events = self.create_events_for_environment(self.group, self.env1, 5)
        self.env2_events = self.create_events_for_environment(self.group, self.env2, 5)

        self.env1_userreports = self.create_user_report_for_events(
            self.project, self.group, self.env1_events, self.env1)
        self.env2_userreports = self.create_user_report_for_events(
            self.project, self.group, self.env2_events, self.env2)

    def make_event(self, **kwargs):
        result = {
            'event_id': 'a' * 32,
            'message': 'foo',
            'timestamp': 1403007314.570599,
            'level': logging.ERROR,
            'logger': 'default',
            'tags': [],
        }
        result.update(kwargs)
        return result

    def create_environment(self, project, name):
        env = Environment.objects.create(
            project_id=project.id,
            organization_id=project.organization_id,
            name=name,
        )
        env.add_project(project)
        return env

    def create_events_for_environment(self, group, environment, num_events):
        return [self.create_event(group=group, tags={
            'environment': environment.name}) for __i in range(num_events)]

    def create_user_report_for_events(self, project, group, events, environment):
        reports = []
        for i, event in enumerate(events):
            reports.append(UserReport.objects.create(
                group=group,
                project=project,
                event_id=event.event_id,
                name='foo%d' % i,
                email='bar%d@example.com' % i,
                comments='It Broke!!!',
                environment=environment,
            ))
        return reports

    def assert_same_userreports(self, response_data, userreports):
        assert sorted(int(r.get('id')) for r in response_data) == sorted(
            r.id for r in userreports)
        assert sorted(r.get('eventID') for r in response_data) == sorted(
            r.event_id for r in userreports)


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

    def get_rule(self, **kwargs):
        kwargs.setdefault('project', self.project)
        kwargs.setdefault('data', {})
        return self.rule_cls(**kwargs)

    def get_state(self, **kwargs):
        kwargs.setdefault('is_new', True)
        kwargs.setdefault('is_regression', True)
        kwargs.setdefault('is_new_group_environment', True)
        kwargs.setdefault('has_reappeared', True)
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

    def assert_can_access(self, user, path, method='GET', **kwargs):
        self.login_as(user)
        resp = getattr(self.client, method.lower())(path, **kwargs)
        assert resp.status_code >= 200 and resp.status_code < 300

    def assert_cannot_access(self, user, path, method='GET', **kwargs):
        self.login_as(user)
        resp = getattr(self.client, method.lower())(path, **kwargs)
        assert resp.status_code >= 300

    def assert_member_can_access(self, path, **kwargs):
        return self.assert_role_can_access(path, 'member', **kwargs)

    def assert_teamless_member_can_access(self, path, **kwargs):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.organization,
            role='member',
            teams=[],
        )

        self.assert_can_access(user, path, **kwargs)

    def assert_member_cannot_access(self, path, **kwargs):
        return self.assert_role_cannot_access(path, 'member', **kwargs)

    def assert_manager_cannot_access(self, path, **kwargs):
        return self.assert_role_cannot_access(path, 'manager', **kwargs)

    def assert_teamless_member_cannot_access(self, path, **kwargs):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.organization,
            role='member',
            teams=[],
        )

        self.assert_cannot_access(user, path, **kwargs)

    def assert_team_admin_can_access(self, path, **kwargs):
        return self.assert_role_can_access(path, 'owner', **kwargs)

    def assert_teamless_admin_can_access(self, path, **kwargs):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.organization,
            role='admin',
            teams=[],
        )

        self.assert_can_access(user, path, **kwargs)

    def assert_team_admin_cannot_access(self, path, **kwargs):
        return self.assert_role_cannot_access(path, 'admin', **kwargs)

    def assert_teamless_admin_cannot_access(self, path, **kwargs):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.organization,
            role='admin',
            teams=[],
        )

        self.assert_cannot_access(user, path, **kwargs)

    def assert_team_owner_can_access(self, path, **kwargs):
        return self.assert_role_can_access(path, 'owner', **kwargs)

    def assert_owner_can_access(self, path, **kwargs):
        return self.assert_role_can_access(path, 'owner', **kwargs)

    def assert_owner_cannot_access(self, path, **kwargs):
        return self.assert_role_cannot_access(path, 'owner', **kwargs)

    def assert_non_member_cannot_access(self, path, **kwargs):
        user = self.create_user(is_superuser=False)
        self.assert_cannot_access(user, path, **kwargs)

    def assert_role_can_access(self, path, role, **kwargs):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.organization,
            role=role,
            teams=[self.team],
        )

        self.assert_can_access(user, path, **kwargs)

    def assert_role_cannot_access(self, path, role, **kwargs):
        user = self.create_user(is_superuser=False)
        self.create_member(
            user=user,
            organization=self.organization,
            role=role,
            teams=[self.team],
        )

        self.assert_cannot_access(user, path, **kwargs)


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
                self.fail(
                    'Found app in entry_points, but wrong class. Got %r, expected %r' %
                    (ep_path, path)
                )
        self.fail('Missing app from entry_points: %r' % (name, ))

    def assertPluginInstalled(self, name, plugin):
        path = type(plugin).__module__ + ':' + type(plugin).__name__
        for ep in iter_entry_points('sentry.plugins'):
            if ep.name == name:
                ep_path = ep.module_name + ':' + '.'.join(ep.attrs)
                if ep_path == path:
                    return
                self.fail(
                    'Found plugin in entry_points, but wrong class. Got %r, expected %r' %
                    (ep_path, path)
                )
        self.fail('Missing plugin from entry_points: %r' % (name, ))


class CliTestCase(TestCase):
    runner = fixture(CliRunner)
    command = None
    default_args = []

    def invoke(self, *args):
        args += tuple(self.default_args)
        return self.runner.invoke(self.command, args, obj={})


@pytest.mark.usefixtures('browser')
class AcceptanceTestCase(TransactionTestCase):
    def setUp(self):
        patcher = patch(
            'django.utils.timezone.now',
            return_value=(datetime(2013, 5, 18, 15, 13, 58, 132928, tzinfo=timezone.utc))
        )
        patcher.start()
        self.addCleanup(patcher.stop)
        super(AcceptanceTestCase, self).setUp()

    def save_cookie(self, name, value, **params):
        self.browser.save_cookie(
            name=name,
            value=value,
            **params
        )

    def save_session(self):
        self.session.save()
        self.save_cookie(
            name=settings.SESSION_COOKIE_NAME,
            value=self.session.session_key,
        )


class IntegrationTestCase(TestCase):
    provider = None

    def setUp(self):
        from sentry.integrations.pipeline import IntegrationPipeline

        super(IntegrationTestCase, self).setUp()

        self.organization = self.create_organization(name='foo', owner=self.user)
        self.login_as(self.user)
        self.request = self.make_request(self.user)
        # XXX(dcramer): this is a bit of a hack, but it helps contain this test
        self.pipeline = IntegrationPipeline(
            request=self.request,
            organization=self.organization,
            provider_key=self.provider.key,
        )

        self.init_path = reverse('sentry-organization-integrations-setup', kwargs={
            'organization_slug': self.organization.slug,
            'provider_id': self.provider.key,
        })

        self.setup_path = reverse('sentry-extension-setup', kwargs={
            'provider_id': self.provider.key,
        })

        self.pipeline.initialize()
        self.save_session()

    def assertDialogSuccess(self, resp):
        assert 'window.opener.postMessage(' in resp.content


class SnubaTestCase(TestCase):
    def setUp(self):
        super(SnubaTestCase, self).setUp()
        self.snuba_eventstream = SnubaEventStream()
        self.snuba_tagstore = SnubaCompatibilityTagStorage()
        assert requests.post(settings.SENTRY_SNUBA + '/tests/drop').status_code == 200

    def store_event(self, *args, **kwargs):
        with contextlib.nested(
            mock.patch('sentry.eventstream.insert',
                       self.snuba_eventstream.insert),
            mock.patch('sentry.tagstore.delay_index_event_tags',
                       self.snuba_tagstore.delay_index_event_tags),
            mock.patch('sentry.tagstore.incr_tag_value_times_seen',
                       self.snuba_tagstore.incr_tag_value_times_seen),
            mock.patch('sentry.tagstore.incr_group_tag_value_times_seen',
                       self.snuba_tagstore.incr_group_tag_value_times_seen),
        ):
            return super(SnubaTestCase, self).store_event(*args, **kwargs)

    def __wrap_event(self, event, data, primary_hash):
        # TODO: Abstract and combine this with the stream code in
        #       getsentry once it is merged, so that we don't alter one
        #       without updating the other.
        return {
            'group_id': event.group_id,
            'event_id': event.event_id,
            'project_id': event.project_id,
            'message': event.real_message,
            'platform': event.platform,
            'datetime': event.datetime,
            'data': dict(data),
            'primary_hash': primary_hash,
        }

    def create_event(self, *args, **kwargs):
        """\
        Takes the results from the existing `create_event` method and
        inserts into the local test Snuba cluster so that tests can be
        run against the same event data.

        Note that we create a GroupHash as necessary because `create_event`
        doesn't run them through the 'real' event pipeline. In a perfect
        world all test events would go through the full regular pipeline.
        """
        # XXX: Use `store_event` instead of this!

        event = super(SnubaTestCase, self).create_event(*args, **kwargs)

        data = event.data.data
        tags = dict(data.get('tags', []))

        if not data.get('received'):
            data['received'] = calendar.timegm(event.datetime.timetuple())

        if 'environment' in tags:
            environment = Environment.get_or_create(
                event.project,
                tags['environment'],
            )

            GroupEnvironment.objects.get_or_create(
                environment_id=environment.id,
                group_id=event.group_id,
            )

        primary_hash = event.get_primary_hash()

        grouphash, _ = GroupHash.objects.get_or_create(
            project=event.project,
            group=event.group,
            hash=primary_hash,
        )

        self.snuba_insert(self.__wrap_event(event, data, grouphash.hash))

        return event

    def snuba_insert(self, events):
        "Write a (wrapped) event (or events) to Snuba."

        if not isinstance(events, list):
            events = [events]

        assert requests.post(
            settings.SENTRY_SNUBA + '/tests/insert',
            data=json.dumps(events)
        ).status_code == 200


class IntegrationRepositoryTestCase(APITestCase):
    def setUp(self):
        super(IntegrationRepositoryTestCase, self).setUp()
        self.login_as(self.user)

    def add_create_repository_responses(self, repository_config):
        raise NotImplementedError

    def create_repository(self, repository_config, integration_id,
                          organization_slug=None, add_responses=True):
        if add_responses:
            self.add_create_repository_responses(repository_config)
        with self.feature({'organizations:repos': True}):
            if not integration_id:
                data = {
                    'provider': self.provider_name,
                    'identifier': repository_config['id'],
                }
            else:
                data = {
                    'provider': self.provider_name,
                    'installation': integration_id,
                    'identifier': repository_config['id'],
                }

            response = self.client.post(
                path=reverse(
                    'sentry-api-0-organization-repositories',
                    args=[organization_slug or self.organization.slug]
                ),
                data=data
            )
        return response

    def assert_error_message(self, response, error_type, error_message):
        assert response.data['error_type'] == error_type
        assert error_message in response.data['errors']['__all__']


class ReleaseCommitPatchTest(APITestCase):
    def setUp(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        self.org = self.create_organization()
        self.org.save()

        team = self.create_team(organization=self.org)
        self.project = self.create_project(name='foo', organization=self.org, teams=[team])

        self.create_member(teams=[team], user=user, organization=self.org)
        self.login_as(user=user)

    @fixture
    def url(self):
        raise NotImplementedError

    def assert_commit(self, commit, repo_id, key, author_id, message):
        assert commit.organization_id == self.org.id
        assert commit.repository_id == repo_id
        assert commit.key == key
        assert commit.author_id == author_id
        assert commit.message == message

    def assert_file_change(self, file_change, type, filename, commit_id):
        assert file_change.type == type
        assert file_change.filename == filename
        assert file_change.commit_id == commit_id


class SetRefsTestCase(APITestCase):
    def setUp(self):
        super(SetRefsTestCase, self).setUp()
        self.user = self.create_user(is_staff=False, is_superuser=False)
        self.org = self.create_organization()

        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(name='foo', organization=self.org, teams=[self.team])
        self.create_member(teams=[self.team], user=self.user, organization=self.org)
        self.login_as(user=self.user)

        self.group = self.create_group(project=self.project)
        self.repo = Repository.objects.create(
            organization_id=self.org.id,
            name='test/repo',
        )

    def assert_fetch_commits(self, mock_fetch_commit, prev_release_id, release_id, refs):
        assert len(mock_fetch_commit.method_calls) == 1
        kwargs = mock_fetch_commit.method_calls[0][2]['kwargs']
        assert kwargs == {
            'prev_release_id': prev_release_id,
            'refs': refs,
            'release_id': release_id,
            'user_id': self.user.id,
        }

    def assert_head_commit(self, head_commit, commit_key, release_id=None):
        assert self.org.id == head_commit.organization_id
        assert self.repo.id == head_commit.repository_id
        if release_id:
            assert release_id == head_commit.release_id
        else:
            assert self.release.id == head_commit.release_id
        self.assert_commit(head_commit.commit, commit_key)

    def assert_commit(self, commit, key):
        assert self.org.id == commit.organization_id
        assert self.repo.id == commit.repository_id
        assert commit.key == key


class OrganizationDashboardWidgetTestCase(APITestCase):
    def setUp(self):
        super(OrganizationDashboardWidgetTestCase, self).setUp()
        self.login_as(self.user)
        self.dashboard = Dashboard.objects.create(
            title='Dashboard 1',
            created_by=self.user,
            organization=self.organization,
        )
        self.anon_users_query = {
            'name': 'anonymousUsersAffectedQuery',
            'fields': [],
            'conditions': [['user.email', 'IS NULL', None]],
            'aggregations': [['count()', None, 'Anonymous Users']],
            'limit': 1000,
            'orderby': '-time',
            'groupby': ['time'],
            'rollup': 86400,
        }
        self.known_users_query = {
            'name': 'knownUsersAffectedQuery',
            'fields': [],
            'conditions': [['user.email', 'IS NOT NULL', None]],
            'aggregations': [['uniq', 'user.email', 'Known Users']],
            'limit': 1000,
            'orderby': '-time',
            'groupby': ['time'],
            'rollup': 86400,
        }
        self.geo_erorrs_query = {
            'name': 'errorsByGeo',
            'fields': ['geo.country_code'],
            'conditions': [['geo.country_code', 'IS NOT NULL', None]],
            'aggregations': [['count()', None, 'count']],
            'limit': 10,
            'orderby': '-count',
            'groupby': ['geo.country_code'],
        }

    def assert_widget_data_sources(self, widget_id, data):
        result_data_sources = sorted(
            WidgetDataSource.objects.filter(
                widget_id=widget_id,
                status=ObjectStatus.VISIBLE
            ),
            key=lambda x: x.order
        )
        data.sort(key=lambda x: x['order'])
        for ds, expected_ds in zip(result_data_sources, data):
            assert ds.name == expected_ds['name']
            assert ds.type == WidgetDataSourceTypes.get_id_for_type_name(expected_ds['type'])
            assert ds.order == expected_ds['order']
            assert ds.data == expected_ds['data']

    def assert_widget(self, widget, order, title, display_type,
                      display_options=None, data_sources=None):
        assert widget.order == order
        assert widget.display_type == display_type
        if display_options:
            assert widget.display_options == display_options
        assert widget.title == title

        if not data_sources:
            return

        self.assert_widget_data_sources(widget.id, data_sources)

    def assert_widget_data(self, data, order, title, display_type,
                           display_options=None, data_sources=None):
        assert data['order'] == order
        assert data['displayType'] == display_type
        if display_options:
            assert data['displayOptions'] == display_options
        assert data['title'] == title

        if not data_sources:
            return

        self.assert_widget_data_sources(data['id'], data_sources)

from __future__ import annotations

import responses

from sentry.utils.compat import zip

__all__ = (
    "TestCase",
    "TransactionTestCase",
    "APITestCase",
    "TwoFactorAPITestCase",
    "AuthProviderTestCase",
    "RuleTestCase",
    "PermissionTestCase",
    "PluginTestCase",
    "CliTestCase",
    "AcceptanceTestCase",
    "IntegrationTestCase",
    "SnubaTestCase",
    "BaseIncidentsTest",
    "IntegrationRepositoryTestCase",
    "ReleaseCommitPatchTest",
    "SetRefsTestCase",
    "OrganizationDashboardWidgetTestCase",
    "SCIMTestCase",
    "SCIMAzureTestCase",
    "MetricsEnhancedPerformanceTestCase",
)

import hashlib
import inspect
import os
import os.path
import time
from contextlib import contextmanager
from datetime import datetime
from typing import Dict, List, Optional
from unittest import mock
from unittest.mock import patch
from urllib.parse import urlencode
from uuid import uuid4

import pytest
import requests
from click.testing import CliRunner
from django.conf import settings
from django.contrib.auth import login
from django.contrib.auth.models import AnonymousUser
from django.core import signing
from django.core.cache import cache
from django.db import DEFAULT_DB_ALIAS, connection, connections
from django.db.migrations.executor import MigrationExecutor
from django.http import HttpRequest
from django.test import TestCase, TransactionTestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from django.utils.functional import cached_property
from exam import Exam, before, fixture
from pkg_resources import iter_entry_points
from rest_framework.test import APITestCase as BaseAPITestCase
from sentry_relay.consts import SPAN_STATUS_NAME_TO_CODE

from sentry import auth, eventstore
from sentry.auth.authenticators import TotpInterface
from sentry.auth.providers.dummy import DummyProvider
from sentry.auth.providers.saml2.activedirectory.apps import ACTIVE_DIRECTORY_PROVIDER_NAME
from sentry.auth.superuser import COOKIE_DOMAIN as SU_COOKIE_DOMAIN
from sentry.auth.superuser import COOKIE_NAME as SU_COOKIE_NAME
from sentry.auth.superuser import COOKIE_PATH as SU_COOKIE_PATH
from sentry.auth.superuser import COOKIE_SALT as SU_COOKIE_SALT
from sentry.auth.superuser import COOKIE_SECURE as SU_COOKIE_SECURE
from sentry.auth.superuser import ORG_ID as SU_ORG_ID
from sentry.auth.superuser import Superuser
from sentry.constants import MODULE_ROOT
from sentry.eventstream.snuba import SnubaEventStream
from sentry.mail import mail_adapter
from sentry.models import AuthProvider as AuthProviderModel
from sentry.models import (
    Commit,
    CommitAuthor,
    Dashboard,
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetQuery,
    DeletedOrganization,
    Deploy,
    GroupMeta,
    Identity,
    IdentityProvider,
    IdentityStatus,
    NotificationSetting,
    Organization,
    ProjectOption,
    Release,
    ReleaseCommit,
    Repository,
    UserEmail,
    UserOption,
)
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.plugins.base import plugins
from sentry.rules import EventState
from sentry.search.events.constants import METRICS_MAP
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.indexer.postgres import PGStringIndexer
from sentry.sentry_metrics.sessions import SessionMetricKey
from sentry.tagstore.snuba import SnubaTagStorage
from sentry.testutils.helpers.datetime import iso_format
from sentry.testutils.helpers.slack import install_slack
from sentry.types.integrations import ExternalProviders
from sentry.utils import json
from sentry.utils.auth import SsoSession
from sentry.utils.pytest.selenium import Browser
from sentry.utils.retries import TimedRetryPolicy
from sentry.utils.snuba import _snuba_pool

from . import assert_status_code
from .factories import Factories
from .fixtures import Fixtures
from .helpers import AuthProvider, Feature, TaskRunner, override_options, parse_queries
from .skips import requires_snuba

DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36"


class BaseTestCase(Fixtures, Exam):
    def assertRequiresAuthentication(self, path, method="GET"):
        resp = getattr(self.client, method.lower())(path)
        assert resp.status_code == 302
        assert resp["Location"].startswith("http://testserver" + reverse("sentry-login"))

    @before
    def setup_dummy_auth_provider(self):
        auth.register("dummy", DummyProvider)
        self.addCleanup(auth.unregister, "dummy", DummyProvider)

    def tasks(self):
        return TaskRunner()

    @classmethod
    @contextmanager
    def capture_on_commit_callbacks(cls, using=DEFAULT_DB_ALIAS, execute=False):
        """
        Context manager to capture transaction.on_commit() callbacks.
        Backported from Django:
        https://github.com/django/django/pull/12944
        """
        callbacks = []
        start_count = len(connections[using].run_on_commit)
        try:
            yield callbacks
        finally:
            run_on_commit = connections[using].run_on_commit[start_count:]
            callbacks[:] = [func for sids, func in run_on_commit]
            if execute:
                for callback in callbacks:
                    callback()

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
            path="/",
            domain=settings.SESSION_COOKIE_DOMAIN,
            secure=settings.SESSION_COOKIE_SECURE or None,
            expires=None,
        )

    def save_cookie(self, name, value, **params):
        self.client.cookies[name] = value
        self.client.cookies[name].update({k.replace("_", "-"): v for k, v in params.items()})

    def make_request(self, user=None, auth=None, method=None, is_superuser=False):
        request = HttpRequest()
        if method:
            request.method = method
        request.META["REMOTE_ADDR"] = "127.0.0.1"
        request.META["SERVER_NAME"] = "testserver"
        request.META["SERVER_PORT"] = 80

        # order matters here, session -> user -> other things
        request.session = self.session
        request.auth = auth
        request.user = user or AnonymousUser()
        # must happen after request.user/request.session is populated
        request.superuser = Superuser(request)
        if is_superuser:
            # XXX: this is gross, but its a one off and apis change only once in a great while
            request.superuser.set_logged_in(user)
        request.is_superuser = lambda: request.superuser.is_active
        request.successful_authenticator = None
        return request

    # TODO(dcramer): ideally superuser_sso would be False by default, but that would require
    # a lot of tests changing
    @TimedRetryPolicy.wrap(timeout=5)
    def login_as(
        self, user, organization_id=None, organization_ids=None, superuser=False, superuser_sso=True
    ):
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
            for o in organization_ids:
                sso_session = SsoSession.create(o)
                self.session[sso_session.session_key] = sso_session.to_dict()

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
                value=signing.get_cookie_signer(salt=SU_COOKIE_NAME + SU_COOKIE_SALT).sign(
                    request.superuser.token
                ),
                max_age=None,
                path=SU_COOKIE_PATH,
                domain=SU_COOKIE_DOMAIN,
                secure=SU_COOKIE_SECURE or None,
                expires=None,
            )
        # Save the session values.
        self.save_session()

    def load_fixture(self, filepath):
        filepath = os.path.join(MODULE_ROOT, os.pardir, os.pardir, "tests", "fixtures", filepath)
        with open(filepath, "rb") as fp:
            return fp.read()

    def _pre_setup(self):
        super()._pre_setup()

        cache.clear()
        ProjectOption.objects.clear_local_cache()
        GroupMeta.objects.clear_local_cache()

    def _post_teardown(self):
        super()._post_teardown()

    def options(self, options):
        """
        A context manager that temporarily sets a global option and reverts
        back to the original value when exiting the context.
        """
        return override_options(options)

    def assert_valid_deleted_log(self, deleted_log, original_object):
        assert deleted_log is not None
        assert original_object.name == deleted_log.name

        assert deleted_log.name == original_object.name
        assert deleted_log.slug == original_object.slug

        if not isinstance(deleted_log, DeletedOrganization):
            assert deleted_log.organization_id == original_object.organization.id
            assert deleted_log.organization_name == original_object.organization.name
            assert deleted_log.organization_slug == original_object.organization.slug

        assert deleted_log.date_created == original_object.date_added
        assert deleted_log.date_deleted >= deleted_log.date_created

    def assertWriteQueries(self, queries, debug=False, *args, **kwargs):
        func = kwargs.pop("func", None)
        using = kwargs.pop("using", DEFAULT_DB_ALIAS)
        conn = connections[using]

        context = _AssertQueriesContext(self, queries, debug, conn)
        if func is None:
            return context

        with context:
            func(*args, **kwargs)

    def get_mock_uuid(self):
        class uuid:
            hex = "abc123"
            bytes = b"\x00\x01\x02"

        return uuid


class _AssertQueriesContext(CaptureQueriesContext):
    def __init__(self, test_case, queries, debug, connection):
        self.test_case = test_case
        self.queries = queries
        self.debug = debug
        super().__init__(connection)

    def __exit__(self, exc_type, exc_value, traceback):
        super().__exit__(exc_type, exc_value, traceback)
        if exc_type is not None:
            return

        parsed_queries = parse_queries(self.captured_queries)

        if self.debug:
            import pprint

            pprint.pprint("====================== Raw Queries ======================")
            pprint.pprint(self.captured_queries)
            pprint.pprint("====================== Table writes ======================")
            pprint.pprint(parsed_queries)

        for table, num in parsed_queries.items():
            expected = self.queries.get(table, 0)
            if expected == 0:
                import pprint

                pprint.pprint(
                    "WARNING: no query against %s emitted, add debug=True to see all the queries"
                    % (table)
                )
            else:
                self.test_case.assertTrue(
                    num == expected,
                    "%d write queries expected on `%s`, got %d, add debug=True to see all the queries"
                    % (expected, table, num),
                )

        for table, num in self.queries.items():
            executed = parsed_queries.get(table, None)
            self.test_case.assertFalse(
                executed is None,
                "no query against %s emitted, add debug=True to see all the queries" % (table),
            )


@override_settings(ROOT_URLCONF="sentry.web.urls")
class TestCase(BaseTestCase, TestCase):
    pass


class TransactionTestCase(BaseTestCase, TransactionTestCase):
    pass


class APITestCase(BaseTestCase, BaseAPITestCase):
    """
    Extend APITestCase to inherit access to `client`, an object with methods
    that simulate API calls to Sentry, and the helper `get_response`, which
    combines and simplify a lot of tedious parts of making API calls in tests.
    When creating API tests, use a new class per endpoint-method pair. The class
    must set the string `endpoint`.
    """

    endpoint = None
    method = "get"

    def get_response(self, *args, **params):
        """
        Simulate an API call to the test case's URI and method.

        :param params:
            Note: These names are intentionally a little funny to prevent name
             collisions with real API arguments.
            * extra_headers: (Optional) Dict mapping keys to values that will be
             passed as request headers.
            * qs_params: (Optional) Dict mapping keys to values that will be
             url-encoded into a API call's query string.
            * raw_data: (Optional) Sometimes we want to precompute the JSON body.
        :returns Response object
        """
        if self.endpoint is None:
            raise Exception("Implement self.endpoint to use this method.")

        url = reverse(self.endpoint, args=args)
        # In some cases we want to pass querystring params to put/post, handle
        # this here.
        if "qs_params" in params:
            query_string = urlencode(params.pop("qs_params"), doseq=True)
            url = f"{url}?{query_string}"

        headers = params.pop("extra_headers", {})
        raw_data = params.pop("raw_data", None)
        if raw_data and isinstance(raw_data, bytes):
            raw_data = raw_data.decode("utf-8")
        if raw_data and isinstance(raw_data, str):
            raw_data = json.loads(raw_data)
        data = raw_data or params
        method = params.pop("method", self.method).lower()

        return getattr(self.client, method)(url, format="json", data=data, **headers)

    def get_valid_response(self, *args, **params):
        """Deprecated. Calls `get_response` (see above) and asserts a specific status code."""
        status_code = params.pop("status_code", 200)
        resp = self.get_response(*args, **params)
        assert resp.status_code == status_code, (resp.status_code, resp.content)
        return resp

    def get_success_response(self, *args, **params):
        """
        Call `get_response` (see above) and assert the response's status code.

        :param params:
            * status_code: (Optional) Assert that the response's status code is
            a specific code. Omit to assert any successful status_code.
        :returns Response object
        """
        status_code = params.pop("status_code", None)

        if status_code and status_code >= 400:
            raise Exception("status_code must be < 400")

        response = self.get_response(*args, **params)

        if status_code:
            assert_status_code(response, status_code)
        else:
            assert_status_code(response, 200, 300)

        return response

    def get_error_response(self, *args, **params):
        """
        Call `get_response` (see above) and assert that the response's status
        code is an error code. Basically it's syntactic sugar.

        :param params:
            * status_code: (Optional) Assert that the response's status code is
            a specific error code. Omit to assert any error status_code.
        :returns Response object
        """
        status_code = params.pop("status_code", None)

        if status_code and status_code < 400:
            raise Exception("status_code must be >= 400 (an error status code)")

        response = self.get_response(*args, **params)

        if status_code:
            assert_status_code(response, status_code)
        else:
            assert_status_code(response, 400, 600)

        return response

    def get_cursor_headers(self, response):
        return [
            link["cursor"]
            for link in requests.utils.parse_header_links(
                response.get("link").rstrip(">").replace(">,<", ",<")
            )
        ]


class TwoFactorAPITestCase(APITestCase):
    @fixture
    def path_2fa(self):
        return reverse("sentry-account-settings-security")

    def enable_org_2fa(self, organization):
        organization.flags.require_2fa = True
        organization.save()

    def api_enable_org_2fa(self, organization, user):
        self.login_as(user)
        url = reverse(
            "sentry-api-0-organization-details", kwargs={"organization_slug": organization.slug}
        )
        return self.client.put(url, data={"require2FA": True})

    def api_disable_org_2fa(self, organization, user):
        url = reverse(
            "sentry-api-0-organization-details", kwargs={"organization_slug": organization.slug}
        )
        return self.client.put(url, data={"require2FA": False})

    def assert_can_enable_org_2fa(self, organization, user, status_code=200):
        self.__helper_enable_organization_2fa(organization, user, status_code)

    def assert_cannot_enable_org_2fa(self, organization, user, status_code, err_msg=None):
        self.__helper_enable_organization_2fa(organization, user, status_code, err_msg)

    def __helper_enable_organization_2fa(self, organization, user, status_code, err_msg=None):
        response = self.api_enable_org_2fa(organization, user)
        assert response.status_code == status_code
        if err_msg:
            assert err_msg.encode("utf-8") in response.content
        organization = Organization.objects.get(id=organization.id)

        if 200 <= status_code < 300:
            assert organization.flags.require_2fa
        else:
            assert not organization.flags.require_2fa

    def add_2fa_users_to_org(self, organization, num_of_users=10, num_with_2fa=5):
        non_compliant_members = []
        for num in range(0, num_of_users):
            user = self.create_user("foo_%s@example.com" % num)
            self.create_member(organization=organization, user=user)
            if num_with_2fa:
                TotpInterface().enroll(user)
                num_with_2fa -= 1
            else:
                non_compliant_members.append(user.email)
        return non_compliant_members


class AuthProviderTestCase(TestCase):
    provider = DummyProvider
    provider_name = "dummy"

    def setUp(self):
        super().setUp()
        # TestCase automatically sets up dummy provider
        if self.provider_name != "dummy" or self.provider != DummyProvider:
            auth.register(self.provider_name, self.provider)
            self.addCleanup(auth.unregister, self.provider_name, self.provider)


class RuleTestCase(TestCase):
    rule_cls = None

    def get_event(self):
        return self.event

    def get_rule(self, **kwargs):
        kwargs.setdefault("project", self.project)
        kwargs.setdefault("data", {})
        return self.rule_cls(**kwargs)

    def get_state(self, **kwargs):
        kwargs.setdefault("is_new", True)
        kwargs.setdefault("is_regression", True)
        kwargs.setdefault("is_new_group_environment", True)
        kwargs.setdefault("has_reappeared", True)
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
        super().setUp()
        self.owner = self.create_user(is_superuser=False)
        self.organization = self.create_organization(
            owner=self.owner, flags=0  # disable default allow_joinleave access
        )
        self.team = self.create_team(organization=self.organization)

    def assert_can_access(self, user, path, method="GET", **kwargs):
        self.login_as(user, superuser=user.is_superuser)
        resp = getattr(self.client, method.lower())(path, **kwargs)
        assert resp.status_code >= 200 and resp.status_code < 300

    def assert_cannot_access(self, user, path, method="GET", **kwargs):
        self.login_as(user, superuser=user.is_superuser)
        resp = getattr(self.client, method.lower())(path, **kwargs)
        assert resp.status_code >= 300

    def assert_member_can_access(self, path, **kwargs):
        return self.assert_role_can_access(path, "member", **kwargs)

    def assert_teamless_member_can_access(self, path, **kwargs):
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.organization, role="member", teams=[])

        self.assert_can_access(user, path, **kwargs)

    def assert_member_cannot_access(self, path, **kwargs):
        return self.assert_role_cannot_access(path, "member", **kwargs)

    def assert_manager_cannot_access(self, path, **kwargs):
        return self.assert_role_cannot_access(path, "manager", **kwargs)

    def assert_teamless_member_cannot_access(self, path, **kwargs):
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.organization, role="member", teams=[])

        self.assert_cannot_access(user, path, **kwargs)

    def assert_team_admin_can_access(self, path, **kwargs):
        return self.assert_role_can_access(path, "admin", **kwargs)

    def assert_teamless_admin_can_access(self, path, **kwargs):
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.organization, role="admin", teams=[])

        self.assert_can_access(user, path, **kwargs)

    def assert_team_admin_cannot_access(self, path, **kwargs):
        return self.assert_role_cannot_access(path, "admin", **kwargs)

    def assert_teamless_admin_cannot_access(self, path, **kwargs):
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.organization, role="admin", teams=[])

        self.assert_cannot_access(user, path, **kwargs)

    def assert_team_owner_can_access(self, path, **kwargs):
        return self.assert_role_can_access(path, "owner", **kwargs)

    def assert_owner_can_access(self, path, **kwargs):
        return self.assert_role_can_access(path, "owner", **kwargs)

    def assert_owner_cannot_access(self, path, **kwargs):
        return self.assert_role_cannot_access(path, "owner", **kwargs)

    def assert_non_member_cannot_access(self, path, **kwargs):
        user = self.create_user(is_superuser=False)
        self.assert_cannot_access(user, path, **kwargs)

    def assert_role_can_access(self, path, role, **kwargs):
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.organization, role=role, teams=[self.team])

        self.assert_can_access(user, path, **kwargs)

    def assert_role_cannot_access(self, path, role, **kwargs):
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.organization, role=role, teams=[self.team])

        self.assert_cannot_access(user, path, **kwargs)


class PluginTestCase(TestCase):
    plugin = None

    def setUp(self):
        super().setUp()

        # Old plugins, plugin is a class, new plugins, it's an instance
        # New plugins don't need to be registered
        if inspect.isclass(self.plugin):
            plugins.register(self.plugin)
            self.addCleanup(plugins.unregister, self.plugin)

    def assertAppInstalled(self, name, path):
        for ep in iter_entry_points("sentry.apps"):
            if ep.name == name:
                ep_path = ep.module_name
                if ep_path == path:
                    return
                self.fail(
                    "Found app in entry_points, but wrong class. Got %r, expected %r"
                    % (ep_path, path)
                )
        self.fail(f"Missing app from entry_points: {name!r}")

    def assertPluginInstalled(self, name, plugin):
        path = type(plugin).__module__ + ":" + type(plugin).__name__
        for ep in iter_entry_points("sentry.plugins"):
            if ep.name == name:
                ep_path = ep.module_name + ":" + ".".join(ep.attrs)
                if ep_path == path:
                    return
                self.fail(
                    "Found plugin in entry_points, but wrong class. Got %r, expected %r"
                    % (ep_path, path)
                )
        self.fail(f"Missing plugin from entry_points: {name!r}")


class CliTestCase(TestCase):
    runner = fixture(CliRunner)
    command = None

    default_args = []

    def invoke(self, *args, **kwargs):
        args += tuple(self.default_args)
        return self.runner.invoke(self.command, args, obj={}, **kwargs)


@pytest.mark.usefixtures("browser")
class AcceptanceTestCase(TransactionTestCase):
    browser: Browser

    def setUp(self):
        patcher = patch(
            "django.utils.timezone.now",
            return_value=(datetime(2013, 5, 18, 15, 13, 58, 132928, tzinfo=timezone.utc)),
        )
        patcher.start()
        self.addCleanup(patcher.stop)
        super().setUp()

    def save_cookie(self, name, value, **params):
        self.browser.save_cookie(name=name, value=value, **params)

    def save_session(self):
        self.session.save()
        self.save_cookie(name=settings.SESSION_COOKIE_NAME, value=self.session.session_key)
        # Forward session cookie to django client.
        self.client.cookies[settings.SESSION_COOKIE_NAME] = self.session.session_key

    def dismiss_assistant(self, which=None):
        if which is None:
            which = ("issue", "issue_stream")
        if isinstance(which, str):
            which = [which]

        for item in which:
            res = self.client.put(
                "/api/0/assistant/?v2",
                content_type="application/json",
                data=json.dumps({"guide": item, "status": "viewed", "useful": True}),
            )
            assert res.status_code == 201, res.content


class IntegrationTestCase(TestCase):
    provider = None

    def setUp(self):
        from sentry.integrations.pipeline import IntegrationPipeline

        super().setUp()

        self.organization = self.create_organization(name="foo", owner=self.user)
        self.login_as(self.user)
        self.request = self.make_request(self.user)
        # XXX(dcramer): this is a bit of a hack, but it helps contain this test
        self.pipeline = IntegrationPipeline(
            request=self.request, organization=self.organization, provider_key=self.provider.key
        )

        self.init_path = reverse(
            "sentry-organization-integrations-setup",
            kwargs={"organization_slug": self.organization.slug, "provider_id": self.provider.key},
        )

        self.setup_path = reverse(
            "sentry-extension-setup", kwargs={"provider_id": self.provider.key}
        )
        self.configure_path = f"/extensions/{self.provider.key}/configure/"

        self.pipeline.initialize()
        self.save_session()

    def assertDialogSuccess(self, resp):
        assert b'window.opener.postMessage({"success":true' in resp.content


@pytest.mark.snuba
@requires_snuba
class SnubaTestCase(BaseTestCase):
    """
    Mixin for enabling test case classes to talk to snuba
    Useful when you are working on acceptance tests or integration
    tests that require snuba.
    """

    def setUp(self):
        super().setUp()
        self.init_snuba()

    @pytest.fixture(autouse=True)
    def initialize(self, reset_snuba, call_snuba):
        self.call_snuba = call_snuba

    @contextmanager
    def disable_snuba_query_cache(self):
        self.snuba_update_config({"use_readthrough_query_cache": 0, "use_cache": 0})
        yield
        self.snuba_update_config({"use_readthrough_query_cache": None, "use_cache": None})

    @classmethod
    def snuba_get_config(cls):
        return _snuba_pool.request("GET", "/config.json").data

    @classmethod
    def snuba_update_config(cls, config_vals):
        return _snuba_pool.request("POST", "/config.json", body=json.dumps(config_vals))

    def init_snuba(self):
        self.snuba_eventstream = SnubaEventStream()
        self.snuba_tagstore = SnubaTagStorage()

    def store_event(self, *args, **kwargs):
        with mock.patch("sentry.eventstream.insert", self.snuba_eventstream.insert):
            stored_event = Factories.store_event(*args, **kwargs)
            stored_group = stored_event.group
            if stored_group is not None:
                self.store_group(stored_group)
            return stored_event

    def wait_for_event_count(self, project_id, total, attempts=2):
        """
        Wait until the event count reaches the provided value or until attempts is reached.

        Useful when you're storing several events and need to ensure that snuba/clickhouse
        state has settled.
        """
        # Verify that events have settled in snuba's storage.
        # While snuba is synchronous, clickhouse isn't entirely synchronous.
        attempt = 0
        snuba_filter = eventstore.Filter(project_ids=[project_id])
        last_events_seen = 0

        while attempt < attempts:
            events = eventstore.get_events(snuba_filter)
            last_events_seen = len(events)
            if len(events) >= total:
                break
            attempt += 1
            time.sleep(0.05)
        if attempt == attempts:
            assert (
                False
            ), f"Could not ensure that {total} event(s) were persisted within {attempt} attempt(s). Event count is instead currently {last_events_seen}."

    def bulk_store_sessions(self, sessions):
        assert (
            requests.post(
                settings.SENTRY_SNUBA + "/tests/sessions/insert", data=json.dumps(sessions)
            ).status_code
            == 200
        )

    def build_session(self, **kwargs):
        session = {
            "session_id": str(uuid4()),
            "distinct_id": str(uuid4()),
            "status": "ok",
            "seq": 0,
            "retention_days": 90,
            "duration": 60.0,
            "errors": 0,
            "started": time.time() // 60 * 60,
            "received": time.time(),
        }
        # Support both passing the values for these field directly, and the full objects
        translators = [
            ("release", "version", "release"),
            ("environment", "name", "environment"),
            ("project_id", "id", "project"),
            ("org_id", "id", "organization"),
        ]
        for key, attr, default_attr in translators:
            if key not in kwargs:
                kwargs[key] = getattr(self, default_attr)
            val = kwargs[key]
            kwargs[key] = getattr(val, attr, val)
        session.update(kwargs)
        return session

    def store_session(self, session):
        self.bulk_store_sessions([session])

    def store_group(self, group):
        data = [self.__wrap_group(group)]
        assert (
            requests.post(
                settings.SENTRY_SNUBA + "/tests/groupedmessage/insert", data=json.dumps(data)
            ).status_code
            == 200
        )

    def store_outcome(self, group):
        data = [self.__wrap_group(group)]
        assert (
            requests.post(
                settings.SENTRY_SNUBA + "/tests/outcomes/insert", data=json.dumps(data)
            ).status_code
            == 200
        )

    def to_snuba_time_format(self, datetime_value):
        date_format = "%Y-%m-%d %H:%M:%S%z"
        return datetime_value.strftime(date_format)

    def __wrap_group(self, group):
        return {
            "event": "change",
            "kind": "insert",
            "table": "sentry_groupedmessage",
            "columnnames": [
                "id",
                "logger",
                "level",
                "message",
                "status",
                "times_seen",
                "last_seen",
                "first_seen",
                "data",
                "score",
                "project_id",
                "time_spent_total",
                "time_spent_count",
                "resolved_at",
                "active_at",
                "is_public",
                "platform",
                "num_comments",
                "first_release_id",
                "short_id",
            ],
            "columnvalues": [
                group.id,
                group.logger,
                group.level,
                group.message,
                group.status,
                group.times_seen,
                self.to_snuba_time_format(group.last_seen),
                self.to_snuba_time_format(group.first_seen),
                group.data,
                group.score,
                group.project.id,
                group.time_spent_total,
                group.time_spent_count,
                group.resolved_at,
                self.to_snuba_time_format(group.active_at),
                group.is_public,
                group.platform,
                group.num_comments,
                group.first_release.id if group.first_release else None,
                group.short_id,
            ],
        }

    def snuba_insert(self, events):
        "Write a (wrapped) event (or events) to Snuba."

        if not isinstance(events, list):
            events = [events]

        assert (
            requests.post(
                settings.SENTRY_SNUBA + "/tests/events/insert", data=json.dumps(events)
            ).status_code
            == 200
        )


class SessionMetricsTestCase(SnubaTestCase):
    """Store metrics instead of sessions"""

    snuba_endpoint = "/tests/entities/{entity}/insert"

    def store_session(self, session):
        """Mimic relays behavior of always emitting a metric for a started session,
        and emitting an additional one if the session is fatal
        https://github.com/getsentry/relay/blob/e3c064e213281c36bde5d2b6f3032c6d36e22520/relay-server/src/actors/envelopes.rs#L357
        """
        user = session.get("distinct_id")

        # This check is not yet reflected in relay, see https://getsentry.atlassian.net/browse/INGEST-464
        user_is_nil = user is None or user == "00000000-0000-0000-0000-000000000000"

        # seq=0 is equivalent to relay's session.init, init=True is transformed
        # to seq=0 in Relay.
        if session["seq"] == 0:  # init
            self._push_metric(
                session, "counter", SessionMetricKey.SESSION, {"session.status": "init"}, +1
            )
            if not user_is_nil:
                self._push_metric(
                    session, "set", SessionMetricKey.USER, {"session.status": "init"}, user
                )

        status = session["status"]

        # Mark the session as errored, which includes fatal sessions.
        if session.get("errors", 0) > 0 or status not in ("ok", "exited"):
            self._push_metric(
                session, "set", SessionMetricKey.SESSION_ERROR, {}, session["session_id"]
            )
            if not user_is_nil:
                self._push_metric(
                    session, "set", SessionMetricKey.USER, {"session.status": "errored"}, user
                )

        if status in ("abnormal", "crashed"):  # fatal
            self._push_metric(
                session, "counter", SessionMetricKey.SESSION, {"session.status": status}, +1
            )
            if not user_is_nil:
                self._push_metric(
                    session, "set", SessionMetricKey.USER, {"session.status": status}, user
                )

        if status != "ok":  # terminal
            if session["duration"] is not None:
                self._push_metric(
                    session,
                    "distribution",
                    SessionMetricKey.SESSION_DURATION,
                    {"session.status": status},
                    session["duration"],
                )

    def bulk_store_sessions(self, sessions):
        for session in sessions:
            self.store_session(session)

    @classmethod
    def _push_metric(cls, session, type, key: SessionMetricKey, tags, value):
        def metric_id(key: SessionMetricKey):
            res = indexer.record(key.value)
            assert res is not None, key
            return res

        def tag_key(name):
            res = indexer.record(name)
            assert res is not None, name
            return res

        def tag_value(name):
            res = indexer.record(name)
            assert res is not None, name
            return res

        base_tags = {
            tag_key(tag): tag_value(session[tag])
            for tag in (
                "release",
                "environment",
            )
        }

        extra_tags = {tag_key(k): tag_value(v) for k, v in tags.items()}

        if type == "set":
            # Relay uses a different hashing algorithm, but that's ok
            value = [int.from_bytes(hashlib.md5(value.encode()).digest()[:8], "big")]
        elif type == "distribution":
            value = [value]

        msg = {
            "org_id": session["org_id"],
            "project_id": session["project_id"],
            "metric_id": metric_id(key),
            "timestamp": session["started"],
            "tags": {**base_tags, **extra_tags},
            "type": {"counter": "c", "set": "s", "distribution": "d"}[type],
            "value": value,
            "retention_days": 90,
        }

        cls._send_buckets([msg], entity=f"metrics_{type}s")

    @classmethod
    def _send_buckets(cls, buckets, entity):
        assert (
            requests.post(
                settings.SENTRY_SNUBA + cls.snuba_endpoint.format(entity=entity),
                data=json.dumps(buckets),
            ).status_code
            == 200
        )


class MetricsEnhancedPerformanceTestCase(SessionMetricsTestCase, TestCase):
    TYPE_MAP = {
        "metrics_distributions": "d",
        "metrics_sets": "s",
        "metrics_counters": "c",
    }
    ENTITY_MAP = {
        "transaction.duration": "metrics_distributions",
        "measurements.lcp": "metrics_distributions",
        "user": "metrics_sets",
    }
    METRIC_STRINGS = []
    DEFAULT_METRIC_TIMESTAMP = datetime(2015, 1, 1, 10, 15, 0, tzinfo=timezone.utc)

    def setUp(self):
        super().setUp()
        self._index_metric_strings()

    def _index_metric_strings(self):
        PGStringIndexer().bulk_record(
            strings=[
                "transaction",
                "transaction.status",
                *self.METRIC_STRINGS,
                *list(SPAN_STATUS_NAME_TO_CODE.keys()),
                *list(METRICS_MAP.values()),
            ]
        )

    def store_metric(
        self,
        value: List[int] | int,
        metric: str = "transaction.duration",
        tags: Optional[Dict[str, str]] = None,
        timestamp: Optional[datetime] = None,
    ):
        internal_metric = METRICS_MAP[metric]
        entity = self.ENTITY_MAP[metric]
        if tags is None:
            tags = {}
        else:
            tags = {indexer.resolve(key): indexer.resolve(value) for key, value in tags.items()}

        if timestamp is None:
            metric_timestamp = self.DEFAULT_METRIC_TIMESTAMP.timestamp()
        else:
            metric_timestamp = timestamp.timestamp()

        if not isinstance(value, list):
            value = [value]

        self._send_buckets(
            [
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "metric_id": indexer.resolve(internal_metric),
                    "timestamp": metric_timestamp,
                    "tags": tags,
                    "type": self.TYPE_MAP[entity],
                    "value": value,
                    "retention_days": 90,
                }
            ],
            entity=entity,
        )


class BaseIncidentsTest(SnubaTestCase):
    def create_event(self, timestamp, fingerprint=None, user=None):
        event_id = uuid4().hex
        if fingerprint is None:
            fingerprint = event_id

        data = {
            "event_id": event_id,
            "fingerprint": [fingerprint],
            "timestamp": iso_format(timestamp),
            "type": "error",
            # This is necessary because event type error should not exist without
            # an exception being in the payload
            "exception": [{"type": "Foo"}],
        }
        if user:
            data["user"] = user
        return self.store_event(data=data, project_id=self.project.id)

    @cached_property
    def now(self):
        return timezone.now().replace(minute=0, second=0, microsecond=0)


@pytest.mark.snuba
@requires_snuba
class OutcomesSnubaTest(TestCase):
    def setUp(self):
        super().setUp()
        assert requests.post(settings.SENTRY_SNUBA + "/tests/outcomes/drop").status_code == 200

    def store_outcomes(self, outcome, num_times=1):
        outcomes = []
        for _ in range(num_times):
            outcome_copy = outcome.copy()
            outcome_copy["timestamp"] = outcome_copy["timestamp"].strftime("%Y-%m-%dT%H:%M:%S.%fZ")
            outcomes.append(outcome_copy)

        assert (
            requests.post(
                settings.SENTRY_SNUBA + "/tests/outcomes/insert", data=json.dumps(outcomes)
            ).status_code
            == 200
        )


class IntegrationRepositoryTestCase(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def add_create_repository_responses(self, repository_config):
        raise NotImplementedError

    def create_repository(
        self, repository_config, integration_id, organization_slug=None, add_responses=True
    ):
        if add_responses:
            self.add_create_repository_responses(repository_config)
        if not integration_id:
            data = {"provider": self.provider_name, "identifier": repository_config["id"]}
        else:
            data = {
                "provider": self.provider_name,
                "installation": integration_id,
                "identifier": repository_config["id"],
            }

        response = self.client.post(
            path=reverse(
                "sentry-api-0-organization-repositories",
                args=[organization_slug or self.organization.slug],
            ),
            data=data,
        )
        return response

    def assert_error_message(self, response, error_type, error_message):
        assert response.data["error_type"] == error_type
        assert error_message in response.data["errors"]["__all__"]


class ReleaseCommitPatchTest(APITestCase):
    def setUp(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        self.org = self.create_organization()
        self.org.save()

        team = self.create_team(organization=self.org)
        self.project = self.create_project(name="foo", organization=self.org, teams=[team])

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
        super().setUp()
        self.user = self.create_user(is_staff=False, is_superuser=False)
        self.org = self.create_organization()

        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(name="foo", organization=self.org, teams=[self.team])
        self.create_member(teams=[self.team], user=self.user, organization=self.org)
        self.login_as(user=self.user)

        self.group = self.create_group(project=self.project)
        self.repo = Repository.objects.create(organization_id=self.org.id, name="test/repo")

    def assert_fetch_commits(self, mock_fetch_commit, prev_release_id, release_id, refs):
        assert len(mock_fetch_commit.method_calls) == 1
        kwargs = mock_fetch_commit.method_calls[0][2]["kwargs"]
        assert kwargs == {
            "prev_release_id": prev_release_id,
            "refs": refs,
            "release_id": release_id,
            "user_id": self.user.id,
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
        super().setUp()
        self.login_as(self.user)
        self.dashboard = Dashboard.objects.create(
            title="Dashboard 1", created_by=self.user, organization=self.organization
        )
        self.anon_users_query = {
            "name": "Anonymous Users",
            "fields": ["count()"],
            "conditions": "!has:user.email",
        }
        self.known_users_query = {
            "name": "Known Users",
            "fields": ["count_unique(user.email)"],
            "conditions": "has:user.email",
        }
        self.geo_errors_query = {
            "name": "Errors by Geo",
            "fields": ["count()", "geo.country_code"],
            "conditions": "has:geo.country_code",
        }

    def do_request(self, method, url, data=None):
        func = getattr(self.client, method)
        return func(url, data=data)

    def assert_widget_queries(self, widget_id, data):
        result_queries = DashboardWidgetQuery.objects.filter(widget_id=widget_id).order_by("order")
        for ds, expected_ds in zip(result_queries, data):
            assert ds.name == expected_ds["name"]
            assert ds.fields == expected_ds["fields"]
            assert ds.conditions == expected_ds["conditions"]

    def assert_widget(self, widget, order, title, display_type, queries=None):
        assert widget.order == order
        assert widget.display_type == display_type
        assert widget.title == title

        if not queries:
            return

        self.assert_widget_queries(widget.id, queries)

    def assert_widget_data(self, data, title, display_type, queries=None):
        assert data["displayType"] == display_type
        assert data["title"] == title

        if not queries:
            return

        self.assert_widget_queries(data["id"], queries)

    def assert_serialized_widget_query(self, data, widget_data_source):
        if "id" in data:
            assert data["id"] == str(widget_data_source.id)
        if "name" in data:
            assert data["name"] == widget_data_source.name
        if "fields" in data:
            assert data["fields"] == widget_data_source.fields
        if "conditions" in data:
            assert data["conditions"] == widget_data_source.conditions
        if "orderby" in data:
            assert data["orderby"] == widget_data_source.orderby
        if "aggregates" in data:
            assert data["aggregates"] == widget_data_source.aggregates
        if "columns" in data:
            assert data["columns"] == widget_data_source.columns

    def get_widgets(self, dashboard_id):
        return DashboardWidget.objects.filter(dashboard_id=dashboard_id).order_by("order")

    def assert_serialized_widget(self, data, expected_widget):
        if "id" in data:
            assert data["id"] == str(expected_widget.id)
        if "title" in data:
            assert data["title"] == expected_widget.title
        if "interval" in data:
            assert data["interval"] == expected_widget.interval
        if "displayType" in data:
            assert data["displayType"] == DashboardWidgetDisplayTypes.get_type_name(
                expected_widget.display_type
            )
        if "layout" in data:
            assert data["layout"] == expected_widget.detail["layout"]

    def create_user_member_role(self):
        self.user = self.create_user(is_superuser=False)
        self.create_member(
            user=self.user, organization=self.organization, role="member", teams=[self.team]
        )
        self.login_as(self.user)


class TestMigrations(TestCase):
    """
    From https://www.caktusgroup.com/blog/2016/02/02/writing-unit-tests-django-migrations/
    """

    @property
    def app(self):
        return "sentry"

    migrate_from = None
    migrate_to = None

    def setUp(self):
        assert (
            self.migrate_from and self.migrate_to
        ), "TestCase '{}' must define migrate_from and migrate_to properties".format(
            type(self).__name__
        )
        self.migrate_from = [(self.app, self.migrate_from)]
        self.migrate_to = [(self.app, self.migrate_to)]
        executor = MigrationExecutor(connection)
        old_apps = executor.loader.project_state(self.migrate_from).apps

        # Reverse to the original migration
        executor.migrate(self.migrate_from)

        self.setup_before_migration(old_apps)

        # Run the migration to test
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()  # reload.
        executor.migrate(self.migrate_to)

        self.apps = executor.loader.project_state(self.migrate_to).apps

    def setup_before_migration(self, apps):
        pass


class SCIMTestCase(APITestCase):
    def setUp(self, provider="dummy"):
        super().setUp()
        self.auth_provider = AuthProviderModel(organization=self.organization, provider=provider)
        self.auth_provider.enable_scim(self.user)
        self.auth_provider.save()
        self.login_as(user=self.user)


class SCIMAzureTestCase(SCIMTestCase):
    def setUp(self):
        auth.register(ACTIVE_DIRECTORY_PROVIDER_NAME, DummyProvider)
        super().setUp(provider=ACTIVE_DIRECTORY_PROVIDER_NAME)
        self.addCleanup(auth.unregister, ACTIVE_DIRECTORY_PROVIDER_NAME, DummyProvider)


class ActivityTestCase(TestCase):
    def another_user(self, email_string, team=None, alt_email_string=None):
        user = self.create_user(email_string)
        if alt_email_string:
            UserEmail.objects.create(email=alt_email_string, user=user)

            assert UserEmail.objects.filter(user=user, email=alt_email_string).update(
                is_verified=True
            )

        assert UserEmail.objects.filter(user=user, email=user.email).update(is_verified=True)

        self.create_member(user=user, organization=self.org, teams=[team] if team else None)

        return user

    def another_commit(self, order, name, user, repository, alt_email_string=None):
        commit = Commit.objects.create(
            key=name * 40,
            repository_id=repository.id,
            organization_id=self.org.id,
            author=CommitAuthor.objects.create(
                organization_id=self.org.id,
                name=user.name,
                email=alt_email_string or user.email,
            ),
        )
        ReleaseCommit.objects.create(
            organization_id=self.org.id,
            release=self.release,
            commit=commit,
            order=order,
        )

        return commit

    def another_release(self, name):
        release = Release.objects.create(
            version=name * 40,
            organization_id=self.project.organization_id,
            date_released=timezone.now(),
        )
        release.add_project(self.project)
        release.add_project(self.project2)
        deploy = Deploy.objects.create(
            release=release, organization_id=self.org.id, environment_id=self.environment.id
        )

        return release, deploy


class SlackActivityNotificationTest(ActivityTestCase):
    @fixture
    def adapter(self):
        return mail_adapter

    def setUp(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.DEPLOY,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )
        UserOption.objects.create(user=self.user, key="self_notifications", value="1")
        self.integration = install_slack(self.organization)
        self.idp = IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX1", config={})
        self.identity = Identity.objects.create(
            external_id="UXXXXXXX1",
            idp=self.idp,
            user=self.user,
            status=IdentityStatus.VALID,
            scopes=[],
        )
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )
        self.name = self.user.get_display_name()
        self.short_id = self.group.qualified_short_id

from __future__ import annotations

import hashlib
import importlib.metadata
import inspect
import os.path
import random
import re
import time
import uuid
from collections.abc import Mapping, Sequence
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from io import BytesIO
from typing import Any, TypedDict, Union
from unittest import mock
from urllib.parse import urlencode
from uuid import uuid4
from zlib import compress

import pytest
import requests
import responses
from click.testing import CliRunner
from django.conf import settings
from django.contrib.auth import login
from django.contrib.auth.models import AnonymousUser
from django.core import signing
from django.core.cache import cache
from django.db import DEFAULT_DB_ALIAS, connection, connections
from django.db.migrations.executor import MigrationExecutor
from django.http import HttpRequest
from django.test import RequestFactory
from django.test import TestCase as DjangoTestCase
from django.test import TransactionTestCase as DjangoTransactionTestCase
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from django.urls import resolve, reverse
from django.utils import timezone
from django.utils.functional import cached_property
from requests.utils import CaseInsensitiveDict, get_encoding_from_headers
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.test import APITestCase as BaseAPITestCase
from rest_framework.test import APITransactionTestCase as BaseAPITransactionTestCase
from sentry_kafka_schemas.schema_types.uptime_results_v1 import (
    CHECKSTATUS_FAILURE,
    CHECKSTATUSREASONTYPE_TIMEOUT,
    REQUESTTYPE_HEAD,
    CheckResult,
)
from sentry_relay.consts import SPAN_STATUS_NAME_TO_CODE
from slack_sdk.web import SlackResponse
from snuba_sdk import Granularity, Limit, Offset
from snuba_sdk.conditions import BooleanCondition, Condition, ConditionGroup

from sentry import auth, eventstore
from sentry.api.serializers.models.dashboard import DATASET_SOURCES
from sentry.auth.authenticators.totp import TotpInterface
from sentry.auth.provider import Provider
from sentry.auth.providers.dummy import DummyProvider
from sentry.auth.providers.saml2.activedirectory.apps import ACTIVE_DIRECTORY_PROVIDER_NAME
from sentry.auth.staff import COOKIE_DOMAIN as STAFF_COOKIE_DOMAIN
from sentry.auth.staff import COOKIE_NAME as STAFF_COOKIE_NAME
from sentry.auth.staff import COOKIE_PATH as STAFF_COOKIE_PATH
from sentry.auth.staff import COOKIE_SALT as STAFF_COOKIE_SALT
from sentry.auth.staff import COOKIE_SECURE as STAFF_COOKIE_SECURE
from sentry.auth.staff import STAFF_ORG_ID, Staff
from sentry.auth.superuser import COOKIE_DOMAIN as SU_COOKIE_DOMAIN
from sentry.auth.superuser import COOKIE_NAME as SU_COOKIE_NAME
from sentry.auth.superuser import COOKIE_PATH as SU_COOKIE_PATH
from sentry.auth.superuser import COOKIE_SALT as SU_COOKIE_SALT
from sentry.auth.superuser import COOKIE_SECURE as SU_COOKIE_SECURE
from sentry.auth.superuser import SUPERUSER_ORG_ID, Superuser
from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.event_manager import EventManager
from sentry.eventstore.models import Event
from sentry.eventstream.snuba import SnubaEventStream
from sentry.issues.grouptype import (
    NoiseConfig,
    PerformanceFileIOMainThreadGroupType,
    PerformanceNPlusOneGroupType,
    PerformanceSlowDBQueryGroupType,
)
from sentry.issues.ingest import send_issue_occurrence_to_eventstream
from sentry.mail import mail_adapter
from sentry.models.apitoken import ApiToken
from sentry.models.authprovider import AuthProvider as AuthProviderModel
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.dashboard import Dashboard
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetQuery,
)
from sentry.models.deletedorganization import DeletedOrganization
from sentry.models.deploy import Deploy
from sentry.models.environment import Environment
from sentry.models.files.file import File
from sentry.models.groupmeta import GroupMeta
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository
from sentry.models.rule import RuleSource
from sentry.monitors.models import Monitor, MonitorEnvironment, MonitorType, ScheduleType
from sentry.notifications.models.notificationsettingoption import NotificationSettingOption
from sentry.notifications.models.notificationsettingprovider import NotificationSettingProvider
from sentry.notifications.notifications.base import alert_page_needs_org_id
from sentry.notifications.types import FineTuningAPIKey
from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.plugins.base import plugins
from sentry.projects.project_rules.creator import ProjectRuleCreator
from sentry.replays.lib.event_linking import transform_event_for_linking_payload
from sentry.replays.models import ReplayRecordingSegment
from sentry.rules.base import RuleBase
from sentry.search.events.constants import (
    METRIC_FRUSTRATED_TAG_VALUE,
    METRIC_SATISFACTION_TAG_KEY,
    METRIC_SATISFIED_TAG_VALUE,
    METRIC_TOLERATED_TAG_VALUE,
    METRICS_MAP,
    SPAN_METRICS_MAP,
)
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.aggregation_option_registry import AggregationOption
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.use_case_id_registry import METRIC_PATH_MAPPING, UseCaseID
from sentry.silo.base import SiloMode, SingleProcessSiloModeState
from sentry.snuba.dataset import EntityKey
from sentry.snuba.metrics.datasource import get_series
from sentry.snuba.metrics.extraction import OnDemandMetricSpec
from sentry.snuba.metrics.naming_layer.public import TransactionMetricKey
from sentry.tagstore.snuba.backend import SnubaTagStorage
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.notifications import TEST_ISSUE_OCCURRENCE
from sentry.testutils.helpers.slack import install_slack
from sentry.testutils.pytest.selenium import Browser
from sentry.types.condition_activity import ConditionActivity, ConditionActivityType
from sentry.users.models.identity import Identity, IdentityProvider, IdentityStatus
from sentry.users.models.user import User
from sentry.users.models.user_option import UserOption
from sentry.users.models.useremail import UserEmail
from sentry.utils import json
from sentry.utils.auth import SsoSession
from sentry.utils.json import dumps_htmlsafe
from sentry.utils.performance_issues.performance_detection import detect_performance_problems
from sentry.utils.retries import TimedRetryPolicy
from sentry.utils.samples import load_data
from sentry.utils.snuba import _snuba_pool

from ..shared_integrations.client.proxy import IntegrationProxyClient
from ..snuba.metrics import (
    DeprecatingMetricsQuery,
    MetricConditionField,
    MetricField,
    MetricGroupByField,
    MetricOrderByField,
    get_date_range,
)
from ..snuba.metrics.naming_layer.mri import SessionMRI, TransactionMRI, parse_mri
from .asserts import assert_status_code
from .factories import Factories
from .fixtures import Fixtures
from .helpers import AuthProvider, Feature, TaskRunner, override_options, parse_queries
from .silo import assume_test_silo_mode
from .skips import requires_snuba

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
    "BaseMetricsTestCase",
    "BaseMetricsLayerTestCase",
    "BaseIncidentsTest",
    "IntegrationRepositoryTestCase",
    "ReleaseCommitPatchTest",
    "SetRefsTestCase",
    "OrganizationDashboardWidgetTestCase",
    "SCIMTestCase",
    "SCIMAzureTestCase",
    "MetricsEnhancedPerformanceTestCase",
    "MetricsAPIBaseTestCase",
    "OrganizationMetricsIntegrationTestCase",
    "ProfilesSnubaTestCase",
    "ReplaysAcceptanceTestCase",
    "ReplaysSnubaTestCase",
    "MonitorTestCase",
    "MonitorIngestTestCase",
)

from ..types.region import get_region_by_name

DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36"

DETECT_TESTCASE_MISUSE = os.environ.get("SENTRY_DETECT_TESTCASE_MISUSE") == "1"
SILENCE_MIXED_TESTCASE_MISUSE = os.environ.get("SENTRY_SILENCE_MIXED_TESTCASE_MISUSE") == "1"

SessionOrTransactionMRI = Union[SessionMRI, TransactionMRI]


class BaseTestCase(Fixtures):
    def assertRequiresAuthentication(self, path, method="GET"):
        resp = getattr(self.client, method.lower())(path)
        assert resp.status_code == 302
        assert resp["Location"].startswith("http://testserver" + reverse("sentry-login"))

    @pytest.fixture(autouse=True)
    def setup_dummy_auth_provider(self):
        auth.register("dummy", DummyProvider)
        self.addCleanup(auth.unregister, "dummy", DummyProvider)

    def tasks(self):
        return TaskRunner()

    @pytest.fixture(autouse=True)
    def polyfill_capture_on_commit_callbacks(self, django_capture_on_commit_callbacks):
        """
        https://pytest-django.readthedocs.io/en/latest/helpers.html#django_capture_on_commit_callbacks

        pytest-django comes with its own polyfill of this Django helper for
        older Django versions, so we're using that.
        """
        self.capture_on_commit_callbacks = django_capture_on_commit_callbacks

    @pytest.fixture(autouse=True)
    def expose_stale_database_reads(self, stale_database_reads):
        self.stale_database_reads = stale_database_reads

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

    def make_request(
        self,
        user=None,
        auth=None,
        method="get",
        is_superuser=False,
        is_staff=False,
        path="/",
        secure_scheme=False,
        subdomain=None,
        *,
        GET: dict[str, str] | None = None,
    ) -> HttpRequest:
        request = getattr(RequestFactory(), method.lower())(path, query_params=GET)
        if subdomain:
            setattr(request, "subdomain", subdomain)
        request.META["REMOTE_ADDR"] = "127.0.0.1"
        request.META["SERVER_NAME"] = "testserver"
        request.META["SERVER_PORT"] = 80
        if secure_scheme:
            secure_header = settings.SECURE_PROXY_SSL_HEADER
            request.META[secure_header[0]] = secure_header[1]

        # order matters here, session -> user -> other things
        request.session = self.session
        request.auth = auth
        request.user = user or AnonymousUser()
        # must happen after request.user/request.session is populated
        request.superuser = Superuser(request)
        request.staff = Staff(request)
        if is_superuser:
            # XXX: this is gross, but it's a one-off and apis change only once in a great while
            request.superuser.set_logged_in(user)
        request.is_superuser = lambda: request.superuser.is_active

        if is_staff:
            request.staff.set_logged_in(user)
        request.successful_authenticator = None
        return request

    # TODO(dcramer): ideally superuser_sso would be False by default, but that would require
    # a lot of tests changing
    @TimedRetryPolicy.wrap(timeout=5)
    def login_as(
        self,
        user,
        organization_id=None,
        organization_ids=None,
        superuser=False,
        staff=False,
        staff_sso=True,
        superuser_sso=True,
    ):
        if isinstance(user, OrganizationMember):
            with assume_test_silo_mode(SiloMode.CONTROL):
                user = User.objects.get(id=user.user_id)

        user.backend = settings.AUTHENTICATION_BACKENDS[0]

        request = self.make_request()
        with assume_test_silo_mode(SiloMode.CONTROL):
            login(request, user)
        request.user = user

        if organization_ids is None:
            organization_ids = set()
        else:
            organization_ids = set(organization_ids)
        if superuser and superuser_sso is not False:
            if SUPERUSER_ORG_ID:
                organization_ids.add(SUPERUSER_ORG_ID)
        if staff and staff_sso is not False:
            if STAFF_ORG_ID:
                organization_ids.add(SUPERUSER_ORG_ID)
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
        # XXX(schew2381): Same as above, but for staff
        if not staff:
            request.staff._set_logged_out()
        elif request.user.is_staff and staff:
            request.staff.set_logged_in(request.user)
            self.save_cookie(
                name=STAFF_COOKIE_NAME,
                value=signing.get_cookie_signer(salt=STAFF_COOKIE_NAME + STAFF_COOKIE_SALT).sign(
                    request.staff.token
                ),
                max_age=None,
                path=STAFF_COOKIE_PATH,
                domain=STAFF_COOKIE_DOMAIN,
                secure=STAFF_COOKIE_SECURE or None,
                expires=None,
            )
        # Save the session values.
        self.save_session()

    def load_fixture(self, filepath):
        with open(get_fixture_path(filepath), "rb") as fp:
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
class TestCase(BaseTestCase, DjangoTestCase):
    # We need Django to flush all databases.
    databases: set[str] | str = "__all__"

    @contextmanager
    def auto_select_silo_mode_on_redirects(self):
        """
        Tests that utilize follow=True may follow redirects between silo modes.  This isn't ideal but convenient for
        testing certain work flows.  Using this context manager, the silo mode in the test will swap automatically
        for each view's decorator in order to prevent otherwise unavoidable SiloAvailability errors.
        """
        old_request = self.client.request

        def request(**request: Any) -> Any:
            resolved = resolve(request["PATH_INFO"])
            view_class = getattr(resolved.func, "view_class", None)
            if view_class is not None:
                endpoint_silo_limit = getattr(view_class, "silo_limit", None)
                if endpoint_silo_limit:
                    for mode in endpoint_silo_limit.modes:
                        if mode is SiloMode.MONOLITH or mode is SiloMode.get_current_mode():
                            continue
                        region = None
                        if mode is SiloMode.REGION:
                            # TODO: Can we infer the correct region here?  would need to package up the
                            # the request dictionary into a higher level object, which also involves invoking
                            # _base_environ and maybe other logic buried in Client.....
                            region = get_region_by_name(settings.SENTRY_MONOLITH_REGION)
                        with (
                            SingleProcessSiloModeState.exit(),
                            SingleProcessSiloModeState.enter(mode, region),
                        ):
                            return old_request(**request)
            return old_request(**request)

        with mock.patch.object(self.client, "request", new=request):
            yield

    # Ensure that testcases that ask for DB setup actually make use of the
    # DB. If they don't, they're wasting CI time.
    if DETECT_TESTCASE_MISUSE:

        @pytest.fixture(autouse=True, scope="class")
        def _require_db_usage(self, request):
            class State:
                used_db = {}
                base = request.cls

            state = State()

            yield state

            did_not_use = set()
            did_use = set()
            for name, used in state.used_db.items():
                if used:
                    did_use.add(name)
                else:
                    did_not_use.add(name)

            if did_not_use and not did_use:
                pytest.fail(
                    f"none of the test functions in {state.base} used the DB! Use `unittest.TestCase` "
                    f"instead of `sentry.testutils.TestCase` for those kinds of tests."
                )
            elif did_not_use and did_use and not SILENCE_MIXED_TESTCASE_MISUSE:
                pytest.fail(
                    f"Some of the test functions in {state.base} used the DB and some did not! "
                    f"test functions using the db: {did_use}\n"
                    f"Use `unittest.TestCase` instead of `sentry.testutils.TestCase` for the tests not using the db."
                )

        @pytest.fixture(autouse=True, scope="function")
        def _check_function_for_db(self, request, monkeypatch, _require_db_usage):
            from django.db.backends.base.base import BaseDatabaseWrapper

            real_ensure_connection = BaseDatabaseWrapper.ensure_connection

            state = _require_db_usage

            def ensure_connection(*args, **kwargs):
                for info in inspect.stack():
                    frame = info.frame
                    try:
                        first_arg_name = frame.f_code.co_varnames[0]
                        first_arg = frame.f_locals[first_arg_name]
                    except LookupError:
                        continue

                    # make an exact check here for two reasons.  One is that this is
                    # good enough as we do not expect subclasses, secondly however because
                    # it turns out doing an isinstance check on untrusted input can cause
                    # bad things to happen because it's hookable.  In particular this
                    # blows through max recursion limits here if it encounters certain types
                    # of broken lazy proxy objects.
                    if type(first_arg) is state.base and info.function in state.used_db:
                        state.used_db[info.function] = True
                        break

                return real_ensure_connection(*args, **kwargs)

            monkeypatch.setattr(BaseDatabaseWrapper, "ensure_connection", ensure_connection)
            state.used_db[request.function.__name__] = False
            yield


class TransactionTestCase(BaseTestCase, DjangoTransactionTestCase):
    # We need Django to flush all databases.
    databases: set[str] | str = "__all__"


class PerformanceIssueTestCase(BaseTestCase):
    # We need Django to flush all databases.
    databases: set[str] | str = "__all__"

    def create_performance_issue(
        self,
        tags=None,
        contexts=None,
        fingerprint=None,
        transaction=None,
        event_data=None,
        issue_type=None,
        noise_limit=0,
        project_id=None,
        detector_option="performance.issues.n_plus_one_db.problem-creation",
        user_data=None,
    ):
        if issue_type is None:
            issue_type = PerformanceNPlusOneGroupType
        if event_data is None:
            event_data = load_data(
                "transaction-n-plus-one",
                timestamp=before_now(minutes=10),
            )
        if tags is not None:
            event_data["tags"] = tags
        if contexts is not None:
            event_data["contexts"] = contexts
        if transaction:
            event_data["transaction"] = transaction
        if project_id is None:
            project_id = self.project.id
        if user_data:
            event_data["user"] = user_data

        perf_event_manager = EventManager(event_data)
        perf_event_manager.normalize()

        def detect_performance_problems_interceptor(
            data: Event, project: Project, is_standalone_spans: bool = False
        ):
            perf_problems = detect_performance_problems(
                data, project, is_standalone_spans=is_standalone_spans
            )
            if fingerprint:
                for perf_problem in perf_problems:
                    perf_problem.fingerprint = fingerprint
            return perf_problems

        with (
            mock.patch(
                "sentry.issues.ingest.send_issue_occurrence_to_eventstream",
                side_effect=send_issue_occurrence_to_eventstream,
            ) as mock_eventstream,
            mock.patch(
                "sentry.event_manager.detect_performance_problems",
                side_effect=detect_performance_problems_interceptor,
            ),
            mock.patch.object(
                issue_type,
                "noise_config",
                new=NoiseConfig(noise_limit, timedelta(minutes=1)),
            ),
            override_options(
                {"performance.issues.all.problem-detection": 1.0, detector_option: 1.0}
            ),
        ):
            event = perf_event_manager.save(project_id)
            if mock_eventstream.call_args:
                event = event.for_group(mock_eventstream.call_args[0][2].group)
                event.occurrence = mock_eventstream.call_args[0][1]
            return event


class APITestCaseMixin:
    """
    Extend APITestCase to inherit access to `client`, an object with methods
    that simulate API calls to Sentry, and the helper `get_response`, which
    combines and simplifies a lot of tedious parts of making API calls in tests.
    When creating API tests, use a new class per endpoint-method pair.

    The class must set the string `endpoint`.
    If your endpoint requires kwargs implement the `reverse_url` method.
    """

    @property
    def endpoint(self):
        raise NotImplementedError(f"implement for {type(self).__module__}.{type(self).__name__}")

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
        url = (
            self.reverse_url()
            if hasattr(self, "reverse_url")
            else reverse(self.endpoint, args=args)
        )
        # In some cases we want to pass querystring params to put/post, handle this here.
        if "qs_params" in params:
            query_string = urlencode(params.pop("qs_params"), doseq=True)
            url = f"{url}?{query_string}"

        headers = params.pop("extra_headers", {})
        format = params.pop("format", "json")
        raw_data = params.pop("raw_data", None)
        if raw_data and isinstance(raw_data, bytes):
            raw_data = raw_data.decode("utf-8")
        if raw_data and isinstance(raw_data, str):
            raw_data = json.loads(raw_data)
        data = raw_data or params
        method = params.pop("method", self.method).lower()

        return getattr(self.client, method)(url, format=format, data=data, **headers)

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

        method = params.pop("method", self.method).lower()

        response = self.get_response(*args, method=method, **params)

        if status_code:
            assert_status_code(response, status_code)
        elif method == "get":
            assert_status_code(response, status.HTTP_200_OK)
        # TODO(mgaeta): Add the other methods.
        # elif method == "post":
        #     assert_status_code(response, status.HTTP_201_CREATED)
        elif method == "put":
            assert_status_code(response, status.HTTP_200_OK)
        elif method == "delete":
            assert_status_code(response, status.HTTP_204_NO_CONTENT)
        else:
            # TODO(mgaeta): Add other methods.
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

    # The analytics event `name` was called with `kwargs` being a subset of its properties
    def analytics_called_with_args(self, fn, name, **kwargs):
        for call_args, call_kwargs in fn.call_args_list:
            event_name = call_args[0]
            if event_name == name:
                assert all(call_kwargs.get(key, None) == val for key, val in kwargs.items())
                return True
        return False

    @contextmanager
    def api_gateway_proxy_stubbed(self):
        """Mocks a fake api gateway proxy that redirects via Client objects"""

        def proxy_raw_request(
            method: str,
            url: str,
            headers: Mapping[str, str],
            params: Mapping[str, str] | None,
            data: Any,
            **kwds: Any,
        ) -> requests.Response:
            from django.test.client import Client

            client = Client()
            extra: Mapping[str, Any] = {
                f"HTTP_{k.replace('-', '_').upper()}": v for k, v in headers.items()
            }
            if params:
                url += "?" + urlencode(params)
            with assume_test_silo_mode(SiloMode.REGION):
                resp = getattr(client, method.lower())(
                    url, b"".join(data), headers["Content-Type"], **extra
                )
            response = requests.Response()
            response.status_code = resp.status_code
            response.headers = CaseInsensitiveDict(resp.headers)
            response.encoding = get_encoding_from_headers(response.headers)
            response.raw = BytesIO(resp.content)
            return response

        with mock.patch(
            "sentry.hybridcloud.apigateway.proxy.external_request",
            new=proxy_raw_request,
        ):
            yield


class APITestCase(BaseTestCase, BaseAPITestCase, APITestCaseMixin):
    # We need Django to flush all databases.
    databases: set[str] | str = "__all__"

    method = "get"


class APITransactionTestCase(BaseTestCase, BaseAPITransactionTestCase, APITestCaseMixin):
    # We need Django to flush all databases.
    databases: set[str] | str = "__all__"

    method = "get"


class TwoFactorAPITestCase(APITestCase):
    @cached_property
    def path_2fa(self):
        return reverse("sentry-account-settings-security")

    def enable_org_2fa(self, organization):
        organization.flags.require_2fa = True
        organization.save()

    def api_enable_org_2fa(self, organization, user):
        self.login_as(user)
        url = reverse(
            "sentry-api-0-organization-details",
            kwargs={"organization_id_or_slug": organization.slug},
        )
        return self.client.put(url, data={"require2FA": True})

    def api_disable_org_2fa(self, organization, user):
        url = reverse(
            "sentry-api-0-organization-details",
            kwargs={"organization_id_or_slug": organization.slug},
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
    provider: type[Provider] = DummyProvider
    provider_name = "dummy"

    def setUp(self):
        super().setUp()
        # TestCase automatically sets up dummy provider
        if self.provider_name != "dummy" or self.provider != DummyProvider:
            auth.register(self.provider_name, self.provider)
            self.addCleanup(auth.unregister, self.provider_name, self.provider)


class RuleTestCase(TestCase):
    @property
    def rule_cls(self):
        raise NotImplementedError(f"implement for {type(self).__module__}.{type(self).__name__}")

    def get_event(self):
        return self.event

    def get_rule(self, **kwargs):
        kwargs.setdefault("project", self.project)
        kwargs.setdefault("data", {})
        return self.rule_cls(**kwargs)

    def get_state(self, **kwargs):
        from sentry.rules import EventState

        kwargs.setdefault("is_new", True)
        kwargs.setdefault("is_regression", True)
        kwargs.setdefault("is_new_group_environment", True)
        kwargs.setdefault("has_reappeared", True)
        kwargs.setdefault("has_escalated", False)
        return EventState(**kwargs)

    def get_condition_activity(self, **kwargs) -> ConditionActivity:
        kwargs.setdefault("group_id", self.event.group.id)
        kwargs.setdefault("type", ConditionActivityType.CREATE_ISSUE)
        kwargs.setdefault("timestamp", self.event.datetime)
        return ConditionActivity(**kwargs)

    def passes_activity(
        self,
        rule: RuleBase,
        condition_activity: ConditionActivity | None = None,
        event_map: dict[str, Any] | None = None,
    ):
        if condition_activity is None:
            condition_activity = self.get_condition_activity()
        if event_map is None:
            event_map = {}
        return rule.passes_activity(condition_activity, event_map)

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


class DRFPermissionTestCase(TestCase):
    def make_request(self, *arg, **kwargs) -> Request:
        """
        Override the return type of make_request b/c DRF permission classes
        expect a DRF request (go figure)
        """
        drf_request: Request = super().make_request(*arg, **kwargs)  # type: ignore[assignment]
        return drf_request

    def setUp(self):
        self.superuser = self.create_user(is_superuser=True, is_staff=False)
        self.staff_user = self.create_user(is_staff=True, is_superuser=False)
        self.superuser_request = self.make_request(user=self.superuser, is_superuser=True)
        self.staff_request = self.make_request(user=self.staff_user, method="GET", is_staff=True)


class PermissionTestCase(TestCase):
    def setUp(self):
        super().setUp()
        self.owner = self.create_user(is_superuser=False)
        self.organization = self.create_organization(
            owner=self.owner,
            flags=0,  # disable default allow_joinleave access
        )
        self.team = self.create_team(organization=self.organization)

    def assert_can_access(self, user, path, method="GET", **kwargs):
        self.login_as(user, superuser=user.is_superuser)
        resp = getattr(self.client, method.lower())(path, **kwargs)
        assert resp.status_code >= 200 and resp.status_code < 300
        return resp

    def assert_cannot_access(self, user, path, method="GET", **kwargs):
        self.login_as(user, superuser=user.is_superuser)
        resp = getattr(self.client, method.lower())(path, **kwargs)
        assert resp.status_code >= 300

    def assert_member_can_access(self, path, **kwargs):
        return self.assert_role_can_access(path, "member", **kwargs)

    def assert_manager_can_access(self, path, **kwargs):
        return self.assert_role_can_access(path, "manager", **kwargs)

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

        return self.assert_can_access(user, path, **kwargs)

    def assert_role_cannot_access(self, path, role, **kwargs):
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.organization, role=role, teams=[self.team])

        self.assert_cannot_access(user, path, **kwargs)


@requires_snuba
class PluginTestCase(TestCase):
    @property
    def plugin(self):
        raise NotImplementedError(f"implement for {type(self).__module__}.{type(self).__name__}")

    def setUp(self):
        super().setUp()

        # Old plugins, plugin is a class, new plugins, it's an instance
        # New plugins don't need to be registered
        if inspect.isclass(self.plugin):
            plugins.register(self.plugin)
            self.addCleanup(plugins.unregister, self.plugin)

    def assertAppInstalled(self, name, path):
        for ep in importlib.metadata.distribution("sentry").entry_points:
            if ep.group == "sentry.apps" and ep.name == name:
                assert ep.value == path
                return
        else:
            self.fail(f"Missing app from entry_points: {name!r}")

    def assertPluginInstalled(self, name, plugin):
        path = type(plugin).__module__ + ":" + type(plugin).__name__
        for ep in importlib.metadata.distribution("sentry").entry_points:
            if ep.group == "sentry.plugins" and ep.name == name:
                assert ep.value == path
                return
        else:
            self.fail(f"Missing plugin from entry_points: {name!r}")


class CliTestCase(TestCase):
    @cached_property
    def runner(self) -> CliRunner:
        return CliRunner()

    @property
    def command(self):
        raise NotImplementedError(f"implement for {type(self).__module__}.{type(self).__name__}")

    default_args = []

    def invoke(self, *args, **kwargs):
        args += tuple(self.default_args)
        return self.runner.invoke(self.command, args, obj={}, **kwargs)


@pytest.mark.usefixtures("browser")
# Assume acceptance tests are not using self-hosted, since most devs are developing for SaaS and
# generally self-hosted specific pages should not appear during acceptance tests
@override_settings(SENTRY_SELF_HOSTED=False)
class AcceptanceTestCase(TransactionTestCase):
    browser: Browser

    @pytest.fixture(autouse=True)
    def _setup_today(self):
        with mock.patch(
            "django.utils.timezone.now",
            return_value=(datetime(2013, 5, 18, 15, 13, 58, 132928, tzinfo=UTC)),
        ):
            yield

    def wait_for_loading(self):
        # NOTE: [data-test-id="loading-placeholder"] is not used here as
        # some dashboards have placeholders that never complete.
        self.browser.wait_until_not('[data-test-id="events-request-loading"]')
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
        self.browser.wait_until_not(".loading")

    def tearDown(self):
        # Avoid tests finishing before their API calls have finished.
        # NOTE: This is not fool-proof, it requires loading indicators to be
        # used when API requests are made.
        self.wait_for_loading()
        super().tearDown()

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
                "/api/0/assistant/",
                content_type="application/json",
                data=json.dumps({"guide": item, "status": "viewed", "useful": True}),
            )
            assert res.status_code == 201, res.content


class IntegrationTestCase(TestCase):
    @property
    def provider(self):
        raise NotImplementedError(f"implement for {type(self).__module__}.{type(self).__name__}")

    def setUp(self):
        from sentry.integrations.pipeline import IntegrationPipeline

        super().setUp()

        self.organization = self.create_organization(name="foo", owner=self.user)
        with assume_test_silo_mode(SiloMode.REGION):
            rpc_organization = serialize_rpc_organization(self.organization)

        self.login_as(self.user)
        self.request = self.make_request(self.user)
        # XXX(dcramer): this is a bit of a hack, but it helps contain this test
        self.pipeline = IntegrationPipeline(
            request=self.request,
            organization=rpc_organization,
            provider_key=self.provider.key,
        )

        self.init_path = reverse(
            "sentry-organization-integrations-setup",
            kwargs={
                "organization_slug": self.organization.slug,
                "provider_id": self.provider.key,
            },
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

    # We need Django to flush all databases.
    databases: set[str] | str = "__all__"

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

    def create_project(self, **kwargs) -> Project:
        if "flags" not in kwargs:
            # We insert events directly into snuba in tests, so we need to set has_transactions to True so the
            # application knows that events have been sent
            kwargs["flags"] = Project.flags.has_transactions
        return super().create_project(**kwargs)

    def init_snuba(self):
        self.snuba_eventstream = SnubaEventStream()
        self.snuba_tagstore = SnubaTagStorage()

    def store_event(self, *args, **kwargs):
        """
        Simulates storing an event for testing.

        To set event title:
        - use "message": "{title}" field for errors
        - use "transaction": "{title}" field for transactions
        More info on event payloads: https://develop.sentry.dev/sdk/event-payloads/
        """
        with mock.patch("sentry.eventstream.insert", self.snuba_eventstream.insert):
            stored_event = Factories.store_event(*args, **kwargs)

            # Error groups
            stored_group = stored_event.group
            if stored_group is not None:
                self.store_group(stored_group)

            # Performance groups
            stored_groups = stored_event.groups
            if stored_groups is not None:
                for group in stored_groups:
                    self.store_group(group)
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
            events = eventstore.backend.get_events(
                snuba_filter, referrer="test.wait_for_event_count"
            )
            last_events_seen = len(events)
            if len(events) >= total:
                break
            attempt += 1
            time.sleep(0.05)
        if attempt == attempts:
            assert (
                False
            ), f"Could not ensure that {total} event(s) were persisted within {attempt} attempt(s). Event count is instead currently {last_events_seen}."

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

    def store_group(self, group):
        data = [self.__wrap_group(group)]
        assert (
            _snuba_pool.urlopen(
                "POST",
                "/tests/entities/groupedmessage/insert",
                body=json.dumps(data),
                headers={},
            ).status
            == 200
        )

    def store_outcome(self, group):
        data = [self.__wrap_group(group)]
        assert (
            requests.post(
                settings.SENTRY_SNUBA + "/tests/entities/outcomes/insert",
                data=json.dumps(data),
            ).status_code
            == 200
        )

    def store_span(self, span, is_eap=False):
        span["ingest_in_eap"] = is_eap
        assert (
            requests.post(
                settings.SENTRY_SNUBA + f"/tests/entities/{'eap_' if is_eap else ''}spans/insert",
                data=json.dumps([span]),
            ).status_code
            == 200
        )

    def store_spans(self, spans, is_eap=False):
        for span in spans:
            span["ingest_in_eap"] = is_eap
        assert (
            requests.post(
                settings.SENTRY_SNUBA + f"/tests/entities/{'eap_' if is_eap else ''}spans/insert",
                data=json.dumps(spans),
            ).status_code
            == 200
        )

    def store_issues(self, issues):
        assert (
            requests.post(
                settings.SENTRY_SNUBA + "/tests/entities/search_issues/insert",
                data=json.dumps(issues),
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
                settings.SENTRY_SNUBA + "/tests/entities/events/insert",
                data=json.dumps(events),
            ).status_code
            == 200
        )


class BaseSpansTestCase(SnubaTestCase):
    def _random_span_id(self):
        random_number = random.randint(0, 100000000)
        return hex(random_number)[2:]

    def store_segment(
        self,
        project_id: int,
        trace_id: str,
        transaction_id: str,
        span_id: str | None = None,
        parent_span_id: str | None = None,
        profile_id: str | None = None,
        transaction: str | None = None,
        duration: int = 10,
        exclusive_time: int = 5,
        tags: Mapping[str, Any] | None = None,
        measurements: Mapping[str, int | float] | None = None,
        timestamp: datetime | None = None,
        sdk_name: str | None = None,
        op: str | None = None,
        status: str | None = None,
        organization_id: int = 1,
        is_eap: bool = False,
    ):
        if span_id is None:
            span_id = self._random_span_id()
        if timestamp is None:
            timestamp = timezone.now()

        payload = {
            "project_id": project_id,
            "organization_id": organization_id,
            "span_id": span_id,
            "trace_id": trace_id,
            "duration_ms": int(duration),
            "start_timestamp_precise": timestamp.timestamp(),
            "end_timestamp_precise": timestamp.timestamp() + duration / 1000,
            "exclusive_time_ms": int(exclusive_time),
            "is_segment": True,
            "received": timezone.now().timestamp(),
            "start_timestamp_ms": int(timestamp.timestamp() * 1000),
            "sentry_tags": {"transaction": transaction or "/hello"},
            "retention_days": 90,
        }

        if tags:
            payload["tags"] = tags
        if transaction_id:
            payload["event_id"] = transaction_id
            payload["segment_id"] = transaction_id[:16]
        if profile_id:
            payload["profile_id"] = profile_id
        if measurements:
            payload["measurements"] = {
                measurement: {"value": value} for measurement, value in measurements.items()
            }
        if parent_span_id:
            payload["parent_span_id"] = parent_span_id
        if sdk_name is not None:
            payload["sentry_tags"]["sdk.name"] = sdk_name
        if op is not None:
            payload["sentry_tags"]["op"] = op
        if status is not None:
            payload["sentry_tags"]["status"] = status

        self.store_span(payload, is_eap=is_eap)

    def store_indexed_span(
        self,
        project_id: int,
        trace_id: str,
        transaction_id: str | None,  # Nones are permitted for INP spans
        span_id: str | None = None,
        parent_span_id: str | None = None,
        profile_id: str | None = None,
        transaction: str | None = None,
        op: str | None = None,
        duration: int = 10,
        exclusive_time: int = 5,
        tags: Mapping[str, Any] | None = None,
        measurements: Mapping[str, int | float] | None = None,
        timestamp: datetime | None = None,
        store_only_summary: bool = False,
        group: str = "00",
        category: str | None = None,
        organization_id: int = 1,
        is_eap: bool = False,
    ):
        if span_id is None:
            span_id = self._random_span_id()
        if timestamp is None:
            timestamp = timezone.now()

        payload = {
            "project_id": project_id,
            "organization_id": organization_id,
            "span_id": span_id,
            "trace_id": trace_id,
            "duration_ms": int(duration),
            "exclusive_time_ms": exclusive_time,
            "is_segment": False,
            "received": timezone.now().timestamp(),
            "start_timestamp_ms": int(timestamp.timestamp() * 1000),
            "start_timestamp_precise": timestamp.timestamp(),
            "end_timestamp_precise": timestamp.timestamp() + duration / 1000,
            "sentry_tags": {
                "transaction": transaction or "/hello",
                "op": op or "http",
                "group": group,
            },
            "retention_days": 90,
        }

        if tags:
            payload["tags"] = tags
        if measurements:
            payload["measurements"] = {
                measurement: {"value": value} for measurement, value in measurements.items()
            }
        if transaction_id:
            payload["event_id"] = transaction_id
            payload["segment_id"] = transaction_id[:16]
        if profile_id:
            payload["profile_id"] = profile_id
        if parent_span_id:
            payload["parent_span_id"] = parent_span_id
        if category is not None:
            payload["sentry_tags"]["category"] = category

        # We want to give the caller the possibility to store only a summary since the database does not deduplicate
        # on the span_id which makes the assumptions of a unique span_id in the database invalid.
        if not store_only_summary:
            self.store_span(payload, is_eap=is_eap)


class BaseMetricsTestCase(SnubaTestCase):
    ENTITY_SHORTHANDS = {
        "c": "counter",
        "s": "set",
        "d": "distribution",
        "g": "gauge",
    }

    snuba_endpoint = "/tests/entities/{entity}/insert"

    def store_session(self, session):
        """Mimic relays behavior of always emitting a metric for a started session,
        and emitting an additional one if the session is fatal
        https://github.com/getsentry/relay/blob/e3c064e213281c36bde5d2b6f3032c6d36e22520/relay-server/src/actors/envelopes.rs#L357
        """
        user = session.get("distinct_id")
        org_id = session["org_id"]
        project_id = session["project_id"]
        base_tags = {}
        if session.get("release") is not None:
            base_tags["release"] = session["release"]
        if session.get("environment") is not None:
            base_tags["environment"] = session["environment"]
        if session.get("abnormal_mechanism") is not None:
            base_tags["abnormal_mechanism"] = session["abnormal_mechanism"]

        # This check is not yet reflected in relay, see https://getsentry.atlassian.net/browse/INGEST-464
        user_is_nil = user is None or user == "00000000-0000-0000-0000-000000000000"

        def push(mri: str, tags, value):
            self.store_metric(
                org_id,
                project_id,
                mri,
                {**tags, **base_tags},
                int(
                    session["started"]
                    if isinstance(session["started"], (int, float))
                    else session["started"].timestamp()
                ),
                value,
            )

        # seq=0 is equivalent to relay's session.init, init=True is transformed
        # to seq=0 in Relay.
        if session["seq"] == 0:  # init
            push(SessionMRI.RAW_SESSION.value, {"session.status": "init"}, +1)

        status = session["status"]

        # Mark the session as errored, which includes fatal sessions.
        if session.get("errors", 0) > 0 or status not in ("ok", "exited"):
            push(SessionMRI.RAW_ERROR.value, {}, session["session_id"])
            if not user_is_nil:
                push(SessionMRI.RAW_USER.value, {"session.status": "errored"}, user)
        elif not user_is_nil:
            push(SessionMRI.RAW_USER.value, {}, user)

        if status in ("abnormal", "crashed"):  # fatal
            push(SessionMRI.RAW_SESSION.value, {"session.status": status}, +1)
            if not user_is_nil:
                push(SessionMRI.RAW_USER.value, {"session.status": status}, user)

        if status == "exited":
            if session["duration"] is not None:
                push(
                    SessionMRI.RAW_DURATION.value,
                    {"session.status": status},
                    session["duration"],
                )

    def bulk_store_sessions(self, sessions):
        for session in sessions:
            self.store_session(session)

    @classmethod
    def store_metric(
        cls,
        org_id: int,
        project_id: int,
        mri: str,
        tags: dict[str, str],
        timestamp: int,
        value: Any,
        aggregation_option: AggregationOption | None = None,
        sampling_weight: int | None = None,
    ) -> None:
        parsed = parse_mri(mri)
        metric_type = parsed.entity
        use_case_id = UseCaseID(parsed.namespace)

        mapping_meta = {}

        def metric_id(key: str):
            assert isinstance(key, str)
            res = indexer.record(
                use_case_id=use_case_id,
                org_id=org_id,
                string=key,
            )
            assert res is not None, key
            mapping_meta[str(res)] = key
            return res

        def tag_key(name):
            assert isinstance(name, str)
            res = indexer.record(
                use_case_id=use_case_id,
                org_id=org_id,
                string=name,
            )
            assert res is not None, name
            mapping_meta[str(res)] = name
            return str(res)

        def tag_value(name):
            assert isinstance(name, str)

            if METRIC_PATH_MAPPING[use_case_id] == UseCaseKey.PERFORMANCE:
                return name

            res = indexer.record(
                use_case_id=use_case_id,
                org_id=org_id,
                string=name,
            )
            assert res is not None, name
            mapping_meta[str(res)] = name
            return res

        assert not isinstance(value, list)

        if metric_type == "s":
            # Relay uses a different hashing algorithm, but that's ok
            value = [int.from_bytes(hashlib.md5(str(value).encode()).digest()[:4], "big")]
        elif metric_type == "d":
            value = [value]
        elif metric_type == "g":
            # In case we pass either an int or float, we will emit a gauge with all the same values.
            if not isinstance(value, dict):
                value = {
                    "min": value,
                    "max": value,
                    "sum": value,
                    "count": int(value),
                    "last": value,
                }

        msg = {
            "org_id": org_id,
            "project_id": project_id,
            "metric_id": metric_id(mri),
            "timestamp": timestamp,
            "tags": {tag_key(key): tag_value(value) for key, value in tags.items()},
            "type": metric_type,
            "value": value,
            "retention_days": 90,
            "use_case_id": use_case_id.value,
            # making up a sentry_received_timestamp, but it should be sometime
            # after the timestamp of the event
            "sentry_received_timestamp": timestamp + 10,
            "version": 2 if METRIC_PATH_MAPPING[use_case_id] == UseCaseKey.PERFORMANCE else 1,
        }

        msg["mapping_meta"] = {}
        msg["mapping_meta"][msg["type"]] = mapping_meta

        if aggregation_option:
            msg["aggregation_option"] = aggregation_option.value

        if sampling_weight:
            msg["sampling_weight"] = sampling_weight

        if METRIC_PATH_MAPPING[use_case_id] == UseCaseKey.PERFORMANCE:
            entity = f"generic_metrics_{cls.ENTITY_SHORTHANDS[metric_type]}s"
        else:
            entity = f"metrics_{cls.ENTITY_SHORTHANDS[metric_type]}s"

        cls.__send_buckets([msg], entity)

    @classmethod
    def __send_buckets(cls, buckets, entity):
        # DO NOT USE THIS METHOD IN YOUR TESTS, use store_metric instead. we
        # need to be able to make changes to the indexer's output protocol
        # without having to update a million tests
        if entity.startswith("generic_"):
            codec = get_topic_codec(Topic.SNUBA_GENERIC_METRICS)
        else:
            codec = get_topic_codec(Topic.SNUBA_METRICS)

        for bucket in buckets:
            codec.validate(bucket)

        assert (
            requests.post(
                settings.SENTRY_SNUBA + cls.snuba_endpoint.format(entity=entity),
                data=json.dumps(buckets),
            ).status_code
            == 200
        )


class BaseMetricsLayerTestCase(BaseMetricsTestCase):
    # In order to avoid complexity and edge cases while working on tests, all children of this class should use
    # this mocked time, except in case in which a specific time is required. This is suggested because working
    # with time ranges in metrics is very error-prone and requires an in-depth knowledge of the underlying
    # implementation.
    #
    # This time has been specifically chosen to be 10:00:00 so that all tests will automatically have the data inserted
    # and queried with automatically inferred timestamps (e.g., usage of - 1 second, get_date_range()...) without
    # incurring into problems.
    MOCK_DATETIME = (timezone.now() - timedelta(days=1)).replace(
        hour=10, minute=0, second=0, microsecond=0
    )

    @property
    def now(self):
        """
        Returns the current time instance that will be used throughout the tests of the metrics layer.

        This method has to be implemented in all the children classes because it serves as a way to standardize
        access to time.
        """
        raise NotImplementedError

    def _store_metric(
        self,
        mri: str,
        tags: dict[str, str],
        value: int | float | dict[str, int | float],
        org_id: int | None = None,
        project_id: int | None = None,
        days_before_now: int = 0,
        hours_before_now: int = 0,
        minutes_before_now: int = 0,
        seconds_before_now: int = 0,
        aggregation_option: AggregationOption | None = None,
    ):
        # We subtract one second in order to account for right non-inclusivity in the query. If we wouldn't do this
        # some data won't be returned (this applies only if we use self.now() in the "end" bound of the query).
        #
        # Use SENTRY_SNUBA_INFO=true while running queries in tests to know more about how data is actually queried
        # at the clickhouse level.
        #
        # The solution proposed aims at solving the problem of flaky tests that occurred during CI at specific times.
        self.store_metric(
            org_id=self.organization.id if org_id is None else org_id,
            project_id=self.project.id if project_id is None else project_id,
            mri=mri,
            tags=tags,
            timestamp=int(
                (
                    self.adjust_timestamp(
                        self.now
                        - timedelta(
                            days=days_before_now,
                            hours=hours_before_now,
                            minutes=minutes_before_now,
                            seconds=seconds_before_now,
                        )
                    )
                ).timestamp()
            ),
            value=value,
            aggregation_option=aggregation_option,
        )

    @staticmethod
    def adjust_timestamp(time: datetime) -> datetime:
        # We subtract 1 second -(+1) in order to account for right non-inclusivity in the queries.
        #
        # E.g.: if we save at 10:00:00, and we have as "end" of the query that time, we must store our
        # value with a timestamp less than 10:00:00 so that irrespectively of the bucket we will have
        # the value in the query result set. This is because when we save 10:00:00 - 1 second in the db it
        # will be saved under different granularities as (09:59:59, 09:59:00, 09:00:00) and these are the
        # actual timestamps that will be compared to the bounds "start" and "end".
        # Supposing we store 09:59:59, and we have "start"=09:00:00 and "end"=10:00:00, and we want to query
        # by granularity (60 = minutes) then we look at entries with timestamp = 09:59:00 which is
        # >= "start" and < "end" thus all these records will be returned.
        # Of course this - 1 second "trick" is just to abstract away this complexity, but it can also be
        # avoided by being more mindful when it comes to using the "end" bound, however because we would
        # like our tests to be deterministic we would like to settle on this approach. This - 1 can also
        # be avoided by choosing specific frozen times depending on granularities and stored data but
        # as previously mentioned we would like to standardize the time we choose unless there are specific
        # cases.
        #
        # This solution helps to abstract away this edge case but one needs to be careful to not use it with times
        # between XX:00:00:000000 and XX:00:999999 because this will result in a time like (XX)-1:AA:BBBBBB which
        # will mess up with the get_date_range function.
        # E.g.: if we have time 10:00:00:567894 and we have statsPeriod = 1h and the interval=1h this will result in the
        # interval being from 10:00:00:000000 to 11:00:00:000000 but the data being saved will be saved with date
        # 09:59:59:567894 thus being outside the query range.
        #
        # All of these considerations must be done only if using directly the time managed by this abstraction, an
        # alternative solution would be to avoid it at all, but for standardization purposes we would prefer to keep
        # using it.
        return time - timedelta(seconds=1)

    def store_performance_metric(
        self,
        name: str,
        tags: dict[str, str],
        value: int | float | dict[str, int | float],
        type: str | None = None,
        org_id: int | None = None,
        project_id: int | None = None,
        days_before_now: int = 0,
        hours_before_now: int = 0,
        minutes_before_now: int = 0,
        seconds_before_now: int = 0,
        aggregation_option: AggregationOption | None = None,
    ):
        self._store_metric(
            mri=name,
            tags=tags,
            value=value,
            org_id=org_id,
            project_id=project_id,
            days_before_now=days_before_now,
            hours_before_now=hours_before_now,
            minutes_before_now=minutes_before_now,
            seconds_before_now=seconds_before_now,
            aggregation_option=aggregation_option,
        )

    def store_release_health_metric(
        self,
        name: str,
        tags: dict[str, str],
        value: int,
        type: str | None = None,
        org_id: int | None = None,
        project_id: int | None = None,
        days_before_now: int = 0,
        hours_before_now: int = 0,
        minutes_before_now: int = 0,
        seconds_before_now: int = 0,
    ):
        self._store_metric(
            mri=name,
            tags=tags,
            value=value,
            org_id=org_id,
            project_id=project_id,
            days_before_now=days_before_now,
            hours_before_now=hours_before_now,
            minutes_before_now=minutes_before_now,
            seconds_before_now=seconds_before_now,
        )

    def store_custom_metric(
        self,
        name: str,
        tags: dict[str, str],
        value: int | float | dict[str, int | float],
        type: str | None = None,
        org_id: int | None = None,
        project_id: int | None = None,
        days_before_now: int = 0,
        hours_before_now: int = 0,
        minutes_before_now: int = 0,
        seconds_before_now: int = 0,
        aggregation_option: AggregationOption | None = None,
    ):
        self._store_metric(
            mri=name,
            tags=tags,
            value=value,
            org_id=org_id,
            project_id=project_id,
            days_before_now=days_before_now,
            hours_before_now=hours_before_now,
            minutes_before_now=minutes_before_now,
            seconds_before_now=seconds_before_now,
            aggregation_option=aggregation_option,
        )

    def build_metrics_query(
        self,
        select: Sequence[MetricField],
        project_ids: Sequence[int] | None = None,
        where: Sequence[BooleanCondition | Condition | MetricConditionField] | None = None,
        having: ConditionGroup | None = None,
        groupby: Sequence[MetricGroupByField] | None = None,
        orderby: Sequence[MetricOrderByField] | None = None,
        limit: Limit | None = None,
        offset: Offset | None = None,
        include_totals: bool = True,
        include_series: bool = True,
        before_now: str | None = None,
        granularity: str | None = None,
    ):
        # TODO: fix this method which gets the range after now instead of before now.
        (start, end, granularity_in_seconds) = get_date_range(
            {"statsPeriod": before_now, "interval": granularity}
        )

        return DeprecatingMetricsQuery(
            org_id=self.organization.id,
            project_ids=[self.project.id] + (project_ids if project_ids is not None else []),
            select=select,
            start=start,
            end=end,
            granularity=Granularity(granularity=granularity_in_seconds),
            where=where,
            having=having,
            groupby=groupby,
            orderby=orderby,
            limit=limit,
            offset=offset,
            include_totals=include_totals,
            include_series=include_series,
        )


class MetricsEnhancedPerformanceTestCase(BaseMetricsLayerTestCase, TestCase):
    TYPE_MAP = {
        "metrics_distributions": "distribution",
        "metrics_sets": "set",
        "metrics_counters": "counter",
        "metrics_gauges": "gauge",
    }
    ENTITY_MAP = {
        "transaction.duration": "metrics_distributions",
        "span.duration": "metrics_distributions",
        "span.self_time": "metrics_distributions",
        "http.response_content_length": "metrics_distributions",
        "http.decoded_response_content_length": "metrics_distributions",
        "cache.item_size": "metrics_distributions",
        "http.response_transfer_size": "metrics_distributions",
        "measurements.lcp": "metrics_distributions",
        "measurements.fp": "metrics_distributions",
        "measurements.fcp": "metrics_distributions",
        "measurements.fid": "metrics_distributions",
        "measurements.cls": "metrics_distributions",
        "measurements.frames_frozen_rate": "metrics_distributions",
        "measurements.time_to_initial_display": "metrics_distributions",
        "measurements.score.lcp": "metrics_distributions",
        "measurements.score.fcp": "metrics_distributions",
        "measurements.score.fid": "metrics_distributions",
        "measurements.score.cls": "metrics_distributions",
        "measurements.score.ttfb": "metrics_distributions",
        "measurements.score.inp": "metrics_distributions",
        "measurements.score.total": "metrics_distributions",
        "measurements.score.weight.lcp": "metrics_distributions",
        "measurements.score.weight.fcp": "metrics_distributions",
        "measurements.score.weight.fid": "metrics_distributions",
        "measurements.score.weight.cls": "metrics_distributions",
        "measurements.score.weight.ttfb": "metrics_distributions",
        "measurements.score.weight.inp": "metrics_distributions",
        "measurements.app_start_cold": "metrics_distributions",
        "measurements.app_start_warm": "metrics_distributions",
        "spans.http": "metrics_distributions",
        "user": "metrics_sets",
        "function.duration": "metrics_distributions",
        "measurements.inp": "metrics_distributions",
        "messaging.message.receive.latency": "metrics_gauges",
    }
    ON_DEMAND_KEY_MAP = {
        "c": TransactionMetricKey.COUNT_ON_DEMAND.value,
        "d": TransactionMetricKey.DIST_ON_DEMAND.value,
        "s": TransactionMetricKey.SET_ON_DEMAND.value,
    }
    ON_DEMAND_MRI_MAP = {
        "c": TransactionMRI.COUNT_ON_DEMAND.value,
        "d": TransactionMRI.DIST_ON_DEMAND.value,
        "s": TransactionMRI.SET_ON_DEMAND.value,
    }
    ON_DEMAND_ENTITY_MAP = {
        "c": EntityKey.MetricsCounters.value,
        "d": EntityKey.MetricsDistributions.value,
        "s": EntityKey.MetricsSets.value,
    }
    METRIC_STRINGS = []
    DEFAULT_METRIC_TIMESTAMP = datetime(2015, 1, 1, 10, 15, 0, tzinfo=UTC)

    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)
        self.two_min_ago = before_now(minutes=2)
        self.login_as(user=self.user)
        self._index_metric_strings()

    def do_request(self, data: dict[str, Any], features: dict[str, bool] | None = None) -> Response:
        """Set up self.features and self.url in the inheriting classes.
        You can pass your own features if you do not want to use the default used by the subclass.
        """
        with self.feature(features or self.features):
            return self.client.get(self.url, data=data, format="json")

    def _index_metric_strings(self):
        strings = [
            "transaction",
            "environment",
            "http.status",
            "transaction.status",
            METRIC_TOLERATED_TAG_VALUE,
            METRIC_SATISFIED_TAG_VALUE,
            METRIC_FRUSTRATED_TAG_VALUE,
            METRIC_SATISFACTION_TAG_KEY,
            *self.METRIC_STRINGS,
            *list(SPAN_STATUS_NAME_TO_CODE.keys()),
            *list(METRICS_MAP.values()),
        ]
        org_strings = {self.organization.id: set(strings)}
        indexer.bulk_record({UseCaseID.TRANSACTIONS: org_strings})

    def store_transaction_metric(
        self,
        value: list[Any] | Any,
        metric: str = "transaction.duration",
        internal_metric: str | None = None,
        entity: str | None = None,
        tags: dict[str, str] | None = None,
        timestamp: datetime | None = None,
        project: int | None = None,
        use_case_id: UseCaseID = UseCaseID.TRANSACTIONS,
        aggregation_option: AggregationOption | None = None,
    ) -> None:
        internal_metric = METRICS_MAP[metric] if internal_metric is None else internal_metric
        entity = self.ENTITY_MAP[metric] if entity is None else entity
        org_id = self.organization.id

        if tags is None:
            tags = {}

        if timestamp is None:
            metric_timestamp = self.DEFAULT_METRIC_TIMESTAMP.timestamp()
        else:
            metric_timestamp = timestamp.timestamp()

        if project is None:
            project = self.project.id

        if not isinstance(value, list):
            value = [value]
        for subvalue in value:
            self.store_metric(
                org_id,
                project,
                internal_metric,
                tags,
                int(metric_timestamp),
                subvalue,
                aggregation_option=aggregation_option,
            )

    def store_on_demand_metric(
        self,
        value: int | float | str,
        spec: OnDemandMetricSpec,
        additional_tags: dict[str, str] | None = None,
        timestamp: datetime | None = None,
    ) -> None:
        """Convert on-demand metric and store it.

        For sets, value needs to be a unique identifier while for counters it is a count."""
        relay_metric_spec = spec.to_metric_spec(self.project)
        metric_spec_tags = relay_metric_spec["tags"] or [] if relay_metric_spec else []
        tags = {i["key"]: i.get("value") or i.get("field") for i in metric_spec_tags}

        metric_type = spec.metric_type
        if additional_tags:
            # Additional tags might be needed to override field values from the spec.
            tags.update(additional_tags)

        self.store_transaction_metric(
            value,
            metric=self.ON_DEMAND_KEY_MAP[metric_type],
            internal_metric=self.ON_DEMAND_MRI_MAP[metric_type],
            entity=self.ON_DEMAND_ENTITY_MAP[metric_type],
            tags=tags,
            timestamp=timestamp,
        )

    def store_span_metric(
        self,
        value: dict[str, int] | list[int] | list[dict[str, int]] | int,
        metric: str = "span.self_time",
        internal_metric: str | None = None,
        entity: str | None = None,
        tags: dict[str, str] | None = None,
        timestamp: datetime | None = None,
        project: int | None = None,
        use_case_id: UseCaseID = UseCaseID.SPANS,
    ):
        internal_metric = SPAN_METRICS_MAP[metric] if internal_metric is None else internal_metric
        entity = self.ENTITY_MAP[metric] if entity is None else entity
        org_id = self.organization.id

        if tags is None:
            tags = {}

        if timestamp is None:
            metric_timestamp = self.DEFAULT_METRIC_TIMESTAMP.timestamp()
        else:
            metric_timestamp = timestamp.timestamp()

        if project is None:
            project = self.project.id

        if not isinstance(value, list):
            value = [value]
        for subvalue in value:
            self.store_metric(
                org_id,
                project,
                internal_metric,
                tags,
                int(metric_timestamp),
                subvalue,
            )

    def wait_for_metric_count(
        self,
        project,
        total,
        metric="transaction.duration",
        mri=TransactionMRI.DURATION.value,
        attempts=2,
    ):
        attempt = 0
        metrics_query = self.build_metrics_query(
            before_now="1d",
            granularity="1d",
            select=[
                MetricField(
                    op="count",
                    metric_mri=mri,
                ),
            ],
            include_series=False,
        )
        while attempt < attempts:
            data = get_series(
                [project],
                metrics_query=metrics_query,
                use_case_id=UseCaseID.TRANSACTIONS,
            )
            count = data["groups"][0]["totals"][f"count({metric})"]
            if count >= total:
                break
            attempt += 1
            time.sleep(0.05)

        if attempt == attempts:
            assert (
                False
            ), f"Could not ensure that {total} metric(s) were persisted within {attempt} attempt(s)."


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
                settings.SENTRY_SNUBA + "/tests/entities/outcomes/insert",
                data=json.dumps(outcomes),
            ).status_code
            == 200
        )


@pytest.mark.snuba
@requires_snuba
@pytest.mark.usefixtures("reset_snuba")
class ProfilesSnubaTestCase(
    TestCase,
    BaseTestCase,  # forcing this to explicitly inherit BaseTestCase addresses some type hint issues
):
    def store_functions(
        self,
        functions,
        project,
        transaction=None,
        extras=None,
        timestamp=None,
    ):
        if transaction is None:
            transaction = load_data("transaction", timestamp=timestamp or before_now(minutes=10))

        profile_context = transaction.setdefault("contexts", {}).setdefault("profile", {})
        if profile_context.get("profile_id") is None:
            profile_context["profile_id"] = uuid4().hex
        profile_id = profile_context.get("profile_id")

        self.store_event(transaction, project_id=project.id)

        timestamp = transaction["timestamp"]
        functions = [
            {
                **function,
                "self_times_ns": list(map(int, function["self_times_ns"])),
                "fingerprint": self.function_fingerprint(function),
            }
            for function in functions
        ]

        functions_payload = {
            "functions": functions,
            # the transaction platform doesn't quite match the
            # profile platform, but should be fine for tests
            "platform": transaction["platform"],
            "profile_id": profile_id,
            "project_id": project.id,
            "received": int(timezone.now().timestamp()),
            "retention_days": 90,
            "timestamp": int(timestamp),
            "transaction_name": transaction["transaction"],
            "materialization_version": 1,
        }

        if extras is not None:
            functions_payload.update(extras)

        response = requests.post(
            settings.SENTRY_SNUBA + "/tests/entities/functions/insert",
            json=[functions_payload],
        )
        assert response.status_code == 200

        return {
            "transaction": transaction,
            "functions": functions,
        }

    def store_functions_chunk(
        self,
        functions,
        project,
        profiler_id=None,
        extras=None,
        timestamp=None,
    ):
        if profiler_id is None:
            profiler_id = uuid4().hex

        # TODO: also write to chunks dataset
        chunk_id = uuid4().hex

        functions = [
            {
                **function,
                "self_times_ns": list(map(int, function["self_times_ns"])),
                "fingerprint": self.function_fingerprint(function),
            }
            for function in functions
        ]

        timestamp = (timestamp or timezone.now()).timestamp()

        max_duration = max(
            duration for function in functions for duration in function["self_times_ns"]
        )

        start = timestamp
        end = timestamp + max_duration / 1e9

        functions_payload = {
            "functions": functions,
            "platform": "",
            "transaction_name": "",
            "profile_id": profiler_id,
            "project_id": project.id,
            "received": int(timestamp),
            "retention_days": 90,
            "timestamp": int(timestamp),
            "start_timestamp": start,
            "end_timestamp": end,
            "profiling_type": "continuous",
            "materialization_version": 1,
        }
        if extras is not None:
            functions_payload.update(extras)

        response = requests.post(
            settings.SENTRY_SNUBA + "/tests/entities/functions/insert",
            json=[functions_payload],
        )
        assert response.status_code == 200

        return {
            "profiler_id": profiler_id,
            "chunk_id": chunk_id,
            "functions": functions,
        }

    def function_fingerprint(self, function):
        # this is a different hashing algorithm than is used by vroom
        # but it's not a big deal
        hasher = hashlib.md5()
        if function.get("package") is not None:
            hasher.update(function["package"].encode())
        else:
            hasher.update(b"")
        hasher.update(b":")
        hasher.update(function["function"].encode())
        return int(hasher.hexdigest()[:8], 16)


@pytest.mark.snuba
@requires_snuba
class ReplaysSnubaTestCase(TestCase):
    def setUp(self):
        super().setUp()
        assert requests.post(settings.SENTRY_SNUBA + "/tests/replays/drop").status_code == 200

    def store_replays(self, replay):
        response = requests.post(
            settings.SENTRY_SNUBA + "/tests/entities/replays/insert", json=[replay]
        )
        assert response.status_code == 200

    def mock_event_links(self, timestamp, project_id, level, replay_id, event_id):
        event = self.store_event(
            data={
                "timestamp": int(timestamp.timestamp()),
                "event_id": event_id,
                "level": level,
                "message": "testing",
                "contexts": {"replay": {"replay_id": replay_id}},
            },
            project_id=project_id,
        )
        return transform_event_for_linking_payload(replay_id, event)


# AcceptanceTestCase and TestCase are mutually exclusive base classses
class ReplaysAcceptanceTestCase(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        self.now = datetime.now(UTC)
        super().setUp()
        self.drop_replays()
        patcher = mock.patch("django.utils.timezone.now", return_value=self.now)
        patcher.start()
        self.addCleanup(patcher.stop)

    def drop_replays(self):
        assert requests.post(settings.SENTRY_SNUBA + "/tests/replays/drop").status_code == 200

    def store_replays(self, replays):
        assert (
            len(replays) >= 2
        ), "You need to store at least 2 replay events for the replay to be considered valid"
        response = requests.post(
            settings.SENTRY_SNUBA + "/tests/entities/replays/insert", json=replays
        )
        assert response.status_code == 200

    def store_replay_segments(
        self,
        replay_id: str,
        project_id: int,
        segment_id: int,
        segment,
    ) -> None:
        f = File.objects.create(name="rr:{segment_id}", type="replay.recording")
        f.putfile(BytesIO(compress(dumps_htmlsafe(segment).encode())))
        ReplayRecordingSegment.objects.create(
            replay_id=replay_id,
            project_id=project_id,
            segment_id=segment_id,
            file_id=f.id,
        )


class IntegrationRepositoryTestCase(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    @pytest.fixture(autouse=True)
    def responses_context(self):
        with responses.mock:
            yield

    def add_create_repository_responses(self, repository_config):
        raise NotImplementedError(f"implement for {type(self).__module__}.{type(self).__name__}")

    @assume_test_silo_mode(SiloMode.REGION)
    def create_repository(
        self,
        repository_config,
        integration_id,
        organization_slug=None,
        add_responses=True,
    ):
        if add_responses:
            self.add_create_repository_responses(repository_config)
        if not integration_id:
            data = {
                "provider": self.provider_name,
                "identifier": repository_config["id"],
            }
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

    @cached_property
    def url(self):
        raise NotImplementedError(f"implement for {type(self).__module__}.{type(self).__name__}")

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


class _QueryDict(TypedDict):
    name: str
    fields: list[str]
    aggregates: list[str]
    columns: list[str]
    fieldAliases: list[str]
    conditions: str


class OrganizationDashboardWidgetTestCase(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.dashboard = Dashboard.objects.create(
            title="Dashboard 1",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        self.anon_users_query: _QueryDict = {
            "name": "Anonymous Users",
            "fields": ["count()"],
            "aggregates": ["count()"],
            "columns": [],
            "fieldAliases": ["Count Alias"],
            "conditions": "!has:user.email",
        }
        self.known_users_query: _QueryDict = {
            "name": "Known Users",
            "fields": ["count_unique(user.email)"],
            "aggregates": ["count_unique(user.email)"],
            "columns": [],
            "fieldAliases": [],
            "conditions": "has:user.email",
        }
        self.geo_errors_query: _QueryDict = {
            "name": "Errors by Geo",
            "fields": ["count()", "geo.country_code"],
            "aggregates": ["count()"],
            "columns": ["geo.country_code"],
            "fieldAliases": [],
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
        if "fieldAliases" in data:
            assert data["fieldAliases"] == widget_data_source.field_aliases
        if "selectedAggregate" in data:
            assert data["selectedAggregate"] == widget_data_source.selected_aggregate

    def get_widgets(self, dashboard_id):
        return DashboardWidget.objects.filter(dashboard_id=dashboard_id).order_by("order")

    def assert_serialized_widget(self, data, expected_widget):
        if "id" in data:
            assert data["id"] == str(expected_widget.id)
        if "title" in data:
            assert data["title"] == expected_widget.title
        if "interval" in data:
            assert data["interval"] == expected_widget.interval
        if "limit" in data:
            assert data["limit"] == expected_widget.limit
        if "displayType" in data:
            assert data["displayType"] == DashboardWidgetDisplayTypes.get_type_name(
                expected_widget.display_type
            )
        if "layout" in data:
            assert data["layout"] == expected_widget.detail["layout"]
        if "datasetSource" in data:
            assert data["datasetSource"] == DATASET_SOURCES[expected_widget.dataset_source]

    def create_user_member_role(self):
        self.user = self.create_user(is_superuser=False)
        self.create_member(
            user=self.user,
            organization=self.organization,
            role="member",
            teams=[self.team],
        )
        self.login_as(self.user)


@pytest.mark.migrations
class TestMigrations(TransactionTestCase):
    """
    From https://www.caktusgroup.com/blog/2016/02/02/writing-unit-tests-django-migrations/

    Note that when running these tests locally you will need to use the `--migrations` flag
    """

    @property
    def app(self):
        return "sentry"

    @property
    def migrate_from(self):
        raise NotImplementedError(f"implement for {type(self).__module__}.{type(self).__name__}")

    @property
    def migrate_to(self):
        raise NotImplementedError(f"implement for {type(self).__module__}.{type(self).__name__}")

    @property
    def connection(self):
        return "default"

    def setUp(self):
        super().setUp()

        migrate_from = [(self.app, self.migrate_from)]
        migrate_to = [(self.app, self.migrate_to)]

        connection = connections[self.connection]

        self.setup_initial_state()

        executor = MigrationExecutor(connection)
        matching_migrations = [m for m in executor.loader.applied_migrations if m[0] == self.app]
        self.current_migration = [max(matching_migrations)]
        old_apps = executor.loader.project_state(migrate_from).apps

        # Reverse to the original migration
        executor.migrate(migrate_from)

        self.setup_before_migration(old_apps)

        # Run the migration to test
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()  # reload.
        executor.migrate(migrate_to)

        self.apps = executor.loader.project_state(migrate_to).apps

    def tearDown(self):
        super().tearDown()
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()  # reload.
        executor.migrate(self.current_migration)

    def setup_initial_state(self):
        # Add code here that will run before we roll back the database to the `migrate_from`
        # migration. This can be useful to allow us to use the various `self.create_*` convenience
        # methods.
        # Any objects created here will need to be converted over to migration models if any further
        # database operations are required.
        pass

    def setup_before_migration(self, apps):
        # Add code here to run after we have rolled the database back to the `migrate_from`
        # migration. This code must use `apps` to create any database models, and not directly
        # access Django models.
        # It's preferable to create models here, when not overly complex to do so.
        pass


class SCIMTestCase(APITestCase):
    provider = "dummy"

    def setUp(self):
        super().setUp()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.auth_provider_inst = AuthProviderModel(
                organization_id=self.organization.id, provider=self.provider
            )
            self.auth_provider_inst.enable_scim(self.user)
            self.auth_provider_inst.save()
            self.scim_user = ApiToken.objects.get(
                token=self.auth_provider_inst.get_scim_token()
            ).user
        self.login_as(user=self.scim_user)


class SCIMAzureTestCase(SCIMTestCase):
    provider = ACTIVE_DIRECTORY_PROVIDER_NAME

    def setUp(self):
        auth.register(ACTIVE_DIRECTORY_PROVIDER_NAME, DummyProvider)
        super().setUp()
        self.addCleanup(auth.unregister, ACTIVE_DIRECTORY_PROVIDER_NAME, DummyProvider)


class ActivityTestCase(TestCase):
    @assume_test_silo_mode(SiloMode.CONTROL)
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
            release=release,
            organization_id=self.org.id,
            environment_id=self.environment.id,
        )

        return release, deploy

    def get_notification_uuid(self, text: str) -> str:
        # Allow notification\\_uuid and notification_uuid
        result = re.search("notification.*_uuid=([a-zA-Z0-9-]+)", text)
        assert result is not None
        return result[1]


class SlackActivityNotificationTest(ActivityTestCase):
    @cached_property
    def adapter(self):
        return mail_adapter

    def setUp(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            base_params = {
                "user_id": self.user.id,
                "scope_identifier": self.user.id,
                "scope_type": "user",
                "value": "always",
            }
            for type in ["workflow", "deploy", "alerts"]:
                NotificationSettingOption.objects.create(
                    type=type,
                    **base_params,
                )
            UserOption.objects.create(user=self.user, key="self_notifications", value="1")
            self.integration = install_slack(self.organization)
            self.idp = IdentityProvider.objects.create(
                type="slack", external_id="TXXXXXXX1", config={}
            )
            self.identity = Identity.objects.create(
                external_id="UXXXXXXX1",
                idp=self.idp,
                user=self.user,
                status=IdentityStatus.VALID,
                scopes=[],
            )
        self.name = self.user.get_display_name()
        self.short_id = self.group.qualified_short_id

    @pytest.fixture(autouse=True)
    def responses_context(self):
        with responses.mock:
            yield

    @pytest.fixture(autouse=True)
    def mock_chat_postMessage(self):
        with mock.patch(
            "slack_sdk.web.client.WebClient.chat_postMessage",
            return_value=SlackResponse(
                client=None,
                http_verb="POST",
                api_url="https://slack.com/api/chat.postMessage",
                req_args={},
                data={"ok": True},
                headers={},
                status_code=200,
            ),
        ) as self.mock_post:
            yield

    def assert_performance_issue_attachments(
        self, attachment, project_slug, referrer, alert_type="workflow"
    ):
        assert "N+1 Query" in attachment["text"]
        assert (
            "db - SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21"
            in attachment["blocks"][1]["text"]["text"]
        )
        title_link = attachment["blocks"][0]["text"]["text"][13:][1:-1]
        notification_uuid = self.get_notification_uuid(title_link)
        assert (
            attachment["blocks"][-2]["elements"][0]["text"]
            == f"{project_slug} | production | <http://testserver/settings/account/notifications/{alert_type}/?referrer={referrer}&notification_uuid={notification_uuid}|Notification Settings>"
        )

    def assert_performance_issue_blocks(
        self,
        blocks,
        org: Organization,
        project_slug: str,
        group,
        referrer,
        alert_type: FineTuningAPIKey = FineTuningAPIKey.WORKFLOW,
        issue_link_extra_params=None,
    ):
        notification_uuid = self.get_notification_uuid(blocks[1]["text"]["text"])
        issue_link = f"http://testserver/organizations/{org.slug}/issues/{group.id}/?referrer={referrer}&notification_uuid={notification_uuid}"
        if issue_link_extra_params is not None:
            issue_link += issue_link_extra_params
        assert (
            blocks[1]["text"]["text"]
            == f":large_blue_circle: :chart_with_upwards_trend: <{issue_link}|*N+1 Query*>"
        )
        assert (
            blocks[2]["text"]["text"]
            == "```db - SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21```"
        )
        assert blocks[3]["elements"][0]["text"] == "State: *New*   First Seen: *10\xa0minutes ago*"
        optional_org_id = f"&organizationId={org.id}" if alert_page_needs_org_id(alert_type) else ""
        assert (
            blocks[4]["elements"][0]["text"]
            == f"{project_slug} | production | <http://testserver/settings/account/notifications/{alert_type}/?referrer={referrer}-user&notification_uuid={notification_uuid}{optional_org_id}|Notification Settings>"
        )

    def assert_performance_issue_blocks_with_culprit_blocks(
        self,
        blocks,
        org: Organization,
        project_slug: str,
        group,
        referrer,
        alert_type: FineTuningAPIKey = FineTuningAPIKey.WORKFLOW,
        issue_link_extra_params=None,
    ):
        notification_uuid = self.get_notification_uuid(blocks[1]["text"]["text"])
        issue_link = f"http://testserver/organizations/{org.slug}/issues/{group.id}/?referrer={referrer}&notification_uuid={notification_uuid}"
        if issue_link_extra_params is not None:
            issue_link += issue_link_extra_params
        assert (
            blocks[1]["text"]["text"]
            == f":large_blue_circle: :chart_with_upwards_trend: <{issue_link}|*N+1 Query*>"
        )
        assert blocks[2]["elements"][0]["text"] == "/books/"
        assert (
            blocks[3]["text"]["text"]
            == "```db - SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21```"
        )
        assert blocks[4]["elements"][0]["text"] == "State: *New*   First Seen: *10\xa0minutes ago*"
        optional_org_id = f"&organizationId={org.id}" if alert_page_needs_org_id(alert_type) else ""
        assert (
            blocks[5]["elements"][0]["text"]
            == f"{project_slug} | production | <http://testserver/settings/account/notifications/{alert_type}/?referrer={referrer}-user&notification_uuid={notification_uuid}{optional_org_id}|Notification Settings>"
        )

    def assert_generic_issue_attachments(
        self, attachment, project_slug, referrer, alert_type="workflow"
    ):
        assert attachment["title"] == TEST_ISSUE_OCCURRENCE.issue_title
        assert attachment["text"] == TEST_ISSUE_OCCURRENCE.evidence_display[0].value
        notification_uuid = self.get_notification_uuid(attachment["title_link"])
        assert (
            attachment["footer"]
            == f"{project_slug} | <http://testserver/settings/account/notifications/{alert_type}/?referrer={referrer}&notification_uuid={notification_uuid}|Notification Settings>"
        )

    def assert_generic_issue_blocks(
        self,
        blocks,
        org: Organization,
        project_slug: str,
        group,
        referrer,
        alert_type="workflow",
        issue_link_extra_params=None,
        with_culprit=False,
    ):
        notification_uuid = self.get_notification_uuid(blocks[1]["text"]["text"])
        issue_link = f"http://testserver/organizations/{org.slug}/issues/{group.id}/?referrer={referrer}&notification_uuid={notification_uuid}"
        if issue_link_extra_params is not None:
            issue_link += issue_link_extra_params
        assert (
            blocks[1]["text"]["text"]
            == f":red_circle: <{issue_link}|*{TEST_ISSUE_OCCURRENCE.issue_title}*>"
        )
        if with_culprit:
            assert blocks[2]["elements"][0]["text"] == "raven.tasks.run_a_test"
            evidence_index = 3
        else:
            evidence_index = 2

        assert (
            blocks[evidence_index]["text"]["text"]
            == "```" + TEST_ISSUE_OCCURRENCE.evidence_display[0].value + "```"
        )

        optional_org_id = f"&organizationId={org.id}" if alert_page_needs_org_id(alert_type) else ""
        assert (
            blocks[-2]["elements"][0]["text"]
            == f"{project_slug} | <http://testserver/settings/account/notifications/{alert_type}/?referrer={referrer}-user&notification_uuid={notification_uuid}{optional_org_id}|Notification Settings>"
        )


class MSTeamsActivityNotificationTest(ActivityTestCase):
    def setUp(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            base_params = {
                "user_id": self.user.id,
                "scope_identifier": self.user.id,
                "scope_type": "user",
                "value": "always",
            }
            for type in ["workflow", "deploy", "alerts"]:
                NotificationSettingOption.objects.create(
                    type=type,
                    **base_params,
                )
                # need to enable the provider options since msteams is disabled by default
                NotificationSettingProvider.objects.create(
                    provider="msteams",
                    type=type,
                    **base_params,
                )

            UserOption.objects.create(user=self.user, key="self_notifications", value="1")

        self.tenant_id = "50cccd00-7c9c-4b32-8cda-58a084f9334a"
        self.integration = self.create_integration(
            self.organization,
            self.tenant_id,
            metadata={
                "access_token": "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "service_url": "https://testserviceurl.com/testendpoint/",
                "installation_type": "tenant",
                "expires_at": 1234567890,
                "tenant_id": self.tenant_id,
            },
            name="Personal Installation",
            provider="msteams",
        )
        self.idp = self.create_identity_provider(integration=self.integration)
        self.user_id_1 = "29:1XJKJMvc5GBtc2JwZq0oj8tHZmzrQgFmB39ATiQWA85gQtHieVkKilBZ9XHoq9j7Zaqt7CZ-NJWi7me2kHTL3Bw"
        self.user_1 = self.user
        self.identity_1 = self.create_identity(
            user=self.user_1, identity_provider=self.idp, external_id=self.user_id_1
        )


@pytest.mark.usefixtures("reset_snuba")
class MetricsAPIBaseTestCase(BaseMetricsLayerTestCase, APITestCase):
    def build_and_store_session(
        self,
        days_before_now: int = 0,
        hours_before_now: int = 0,
        minutes_before_now: int = 0,
        seconds_before_now: int = 0,
        **kwargs,
    ):
        # We perform also here the same - 1 seconds transformation as in the _store_metric() method.
        kwargs["started"] = self.adjust_timestamp(
            self.now
            - timedelta(
                days=days_before_now,
                hours=hours_before_now,
                minutes=minutes_before_now,
                seconds=seconds_before_now,
            )
        ).timestamp()

        self.store_session(self.build_session(**kwargs))


class OrganizationMetricsIntegrationTestCase(MetricsAPIBaseTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        now = int(time.time())

        org_id = self.organization.id
        self.store_metric(
            org_id=org_id,
            project_id=self.project.id,
            mri="c:sessions/metric1@none",
            timestamp=now,
            tags={
                "tag1": "value1",
                "tag2": "value2",
            },
            value=1,
        )
        self.store_metric(
            org_id=org_id,
            project_id=self.project.id,
            mri="c:sessions/metric1@none",
            timestamp=now,
            tags={"tag3": "value3"},
            value=1,
        )
        self.store_metric(
            org_id=org_id,
            project_id=self.project.id,
            mri="c:sessions/metric2@none",
            timestamp=now,
            tags={
                "tag4": "value3",
                "tag1": "value2",
                "tag2": "value1",
            },
            value=123,
        )
        self.store_metric(
            org_id=org_id,
            project_id=self.project.id,
            mri="c:sessions/metric3@none",
            timestamp=now,
            tags={},
            value=123,
        )


class MonitorTestCase(APITestCase):
    def _create_monitor(self, **kwargs):
        if "owner_user_id" not in kwargs:
            kwargs["owner_user_id"] = self.user.id

        return Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule": "* * * * *",
                "schedule_type": ScheduleType.CRONTAB,
                "checkin_margin": None,
                "max_runtime": None,
            },
            **kwargs,
        )

    def _create_monitor_environment(self, monitor, name="production", **kwargs):
        environment = Environment.get_or_create(project=self.project, name=name)

        monitorenvironment_defaults = {
            "status": monitor.status,
            **kwargs,
        }

        return MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=environment.id,
            **monitorenvironment_defaults,
        )

    def _create_issue_alert_rule(self, monitor, exclude_slug_filter=False):
        conditions = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
            },
            {
                "id": "sentry.rules.conditions.regression_event.RegressionEventCondition",
            },
        ]
        if not exclude_slug_filter:
            conditions.append(
                {
                    "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                    "key": "monitor.slug",
                    "match": "eq",
                    "value": monitor.slug,
                },
            )
        actions = [
            {
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": self.user.id,
                "targetType": "Member",
                "uuid": str(uuid4()),
            },
        ]
        rule = ProjectRuleCreator(
            name="New Cool Rule",
            project=self.project,
            conditions=conditions,
            filter_match="all",
            action_match="any",
            actions=actions,
            frequency=5,
            environment=self.environment.id,
        ).run()
        rule.update(source=RuleSource.CRON_MONITOR)

        config = monitor.config
        config["alert_rule_id"] = rule.id
        monitor.config = config
        monitor.save()

        return rule


class MonitorIngestTestCase(MonitorTestCase):
    """
    Base test case which provides support for both styles of legacy ingestion
    endpoints, as well as sets up token and DSN authentication helpers
    """

    @property
    def token_auth_headers(self):
        return {"HTTP_AUTHORIZATION": f"Bearer {self.token.token}"}

    def setUp(self):
        super().setUp()
        # DSN based auth
        self.project_key = self.create_project_key()

        # Token based auth
        sentry_app = self.create_sentry_app(
            organization=self.organization,
            scopes=["project:write"],
        )
        app = self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization
        )
        self.token = self.create_internal_integration_token(install=app, user=self.user)


class UptimeTestCaseMixin:
    def setUp(self):
        super().setUp()
        self.mock_resolve_hostname_ctx = mock.patch(
            "sentry.uptime.rdap.query.resolve_hostname", return_value="192.168.0.1"
        )
        self.mock_resolve_rdap_provider_ctx = mock.patch(
            "sentry.uptime.rdap.query.resolve_rdap_provider",
            return_value="https://fake.com/",
        )
        self.mock_requests_get_ctx = mock.patch("sentry.uptime.rdap.query.requests.get")
        self.mock_resolve_hostname = self.mock_resolve_hostname_ctx.__enter__()
        self.mock_resolve_rdap_provider = self.mock_resolve_rdap_provider_ctx.__enter__()
        self.mock_requests_get = self.mock_requests_get_ctx.__enter__()
        self.mock_requests_get.return_value.json.return_value = {"entities": [{"handle": "hi"}]}

    def tearDown(self):
        super().tearDown()
        self.mock_resolve_hostname_ctx.__exit__(None, None, None)
        self.mock_resolve_rdap_provider_ctx.__exit__(None, None, None)
        self.mock_requests_get_ctx.__exit__(None, None, None)


class UptimeTestCase(UptimeTestCaseMixin, TestCase):
    def create_uptime_result(
        self,
        subscription_id: str | None = None,
        status: str = CHECKSTATUS_FAILURE,
        scheduled_check_time: datetime | None = None,
    ) -> CheckResult:
        if subscription_id is None:
            subscription_id = uuid.uuid4().hex
        if scheduled_check_time is None:
            scheduled_check_time = datetime.now().replace(microsecond=0)
        return {
            "guid": uuid.uuid4().hex,
            "subscription_id": subscription_id,
            "status": status,
            "status_reason": {
                "type": CHECKSTATUSREASONTYPE_TIMEOUT,
                "description": "it timed out",
            },
            "span_id": uuid.uuid4().hex,
            "trace_id": uuid.uuid4().hex,
            "scheduled_check_time_ms": int(scheduled_check_time.timestamp() * 1000),
            "actual_check_time_ms": int(datetime.now().replace(microsecond=0).timestamp() * 1000),
            "duration_ms": 100,
            "request_info": {"request_type": REQUESTTYPE_HEAD, "http_status_code": 500},
        }


class IntegratedApiTestCase(BaseTestCase):
    def should_call_api_without_proxying(self) -> bool:
        return not IntegrationProxyClient.determine_whether_should_proxy_to_control()


class SpanTestCase(BaseTestCase):
    # Some base data for create_span
    base_span: dict[str, Any] = {
        "is_segment": False,
        "retention_days": 90,
        "tags": {},
        "sentry_tags": {},
        "measurements": {},
    }

    def load_data(
        self,
        platform: str = "transaction",
        timestamp: datetime | None = None,
        duration: timedelta | None = None,
        **kwargs: Any,
    ) -> dict[str | int, Any]:
        if timestamp is None:
            timestamp = self.ten_mins_ago

        min_age = before_now(minutes=10)
        if timestamp > min_age:
            # Sentry does some rounding of timestamps to improve cache hits in snuba.
            # This can result in events not being returns if the timestamps
            # are too recent.
            raise Exception(
                f"Please define a timestamp older than 10 minutes to avoid flakey tests. Want a timestamp before {min_age}, got: {timestamp} "
            )

        start_timestamp = None
        if duration is not None:
            start_timestamp = timestamp - duration
            start_timestamp = start_timestamp - timedelta(
                microseconds=start_timestamp.microsecond % 1000
            )

        return load_data(platform, timestamp=timestamp, start_timestamp=start_timestamp, **kwargs)

    def create_span(
        self,
        extra_data: dict[str, Any] | None = None,
        organization: Organization | None = None,
        project: Project | None = None,
        start_ts: datetime | None = None,
        duration: int = 1000,
        measurements: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Create span json, not required for store_span, but with no params passed should just work out of the box"""
        if organization is None:
            organization = self.organization
        if project is None:
            project = self.project
        if start_ts is None:
            start_ts = datetime.now() - timedelta(minutes=1)
        if extra_data is None:
            extra_data = {}
        span = self.base_span.copy()
        # Load some defaults
        span.update(
            {
                "event_id": uuid4().hex,
                "organization_id": organization.id,
                "project_id": project.id,
                "trace_id": uuid4().hex,
                "span_id": uuid4().hex[:16],
                "parent_span_id": uuid4().hex[:16],
                "segment_id": uuid4().hex[:16],
                "group_raw": uuid4().hex[:16],
                "profile_id": uuid4().hex,
                # Multiply by 1000 cause it needs to be ms
                "start_timestamp_ms": int(start_ts.timestamp() * 1000),
                "start_timestamp_precise": start_ts.timestamp(),
                "end_timestamp_precise": start_ts.timestamp() + duration / 1000,
                "timestamp": int(start_ts.timestamp() * 1000),
                "received": start_ts.timestamp(),
                "duration_ms": duration,
                "exclusive_time_ms": duration,
            }
        )
        # Load any specific custom data
        span.update(extra_data)
        # coerce to string
        for tag, value in dict(span["tags"]).items():
            span["tags"][tag] = str(value)
        if measurements:
            span["measurements"] = measurements
        return span


class TraceTestCase(SpanTestCase):
    def setUp(self):
        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.root_span_ids = [uuid4().hex[:16] for _ in range(3)]
        self.trace_id = uuid4().hex

    def get_start_end_from_day_ago(self, milliseconds: int) -> tuple[datetime, datetime]:
        return self.day_ago, self.day_ago + timedelta(milliseconds=milliseconds)

    def create_event(
        self,
        trace_id: str,
        transaction: str,
        spans: Sequence[dict[str, Any]],
        parent_span_id: str | None,
        project_id: int,
        tags: Sequence[list[str]] | None = None,
        milliseconds: int = 4000,
        span_id: str | None = None,
        measurements: dict[str, int | float] | None = None,
        file_io_performance_issue: bool = False,
        slow_db_performance_issue: bool = False,
        start_timestamp: datetime | None = None,
        store_event_kwargs: dict[str, Any] | None = None,
    ) -> Event:
        if not store_event_kwargs:
            store_event_kwargs = {}
        start, end = self.get_start_end_from_day_ago(milliseconds)
        if start_timestamp is not None:
            start = start_timestamp
        data = load_data(
            "transaction",
            trace=trace_id,
            spans=spans,
            timestamp=end,
            start_timestamp=start,
        )
        data["transaction"] = transaction
        data["contexts"]["trace"]["parent_span_id"] = parent_span_id
        data["contexts"]["profile"] = {"profile_id": uuid4().hex}
        data["sdk"] = {"name": "sentry.test.sdk", "version": "1.0"}
        if span_id:
            data["contexts"]["trace"]["span_id"] = span_id
        if measurements:
            for key, value in measurements.items():
                data["measurements"][key]["value"] = value
        if tags is not None:
            data["tags"] = tags
        if file_io_performance_issue:
            new_span = data["spans"][0].copy()
            if "data" not in new_span:
                new_span["data"] = {}
            new_span["op"] = "file.write"
            new_span["data"].update({"duration": 1, "blocked_main_thread": True})
            new_span["span_id"] = "0012" * 4
            data["spans"].append(new_span)
        if slow_db_performance_issue:
            new_span = data["spans"][0].copy()
            if "data" not in new_span:
                new_span["data"] = {}
            new_span["op"] = "db"
            new_span["description"] = "SELECT * FROM table"
            new_span["data"].update({"duration": 10_000})
            new_span["span_id"] = "0013" * 4
            data["spans"].append(new_span)
        with self.feature(self.FEATURES):
            with (
                mock.patch.object(
                    PerformanceFileIOMainThreadGroupType,
                    "noise_config",
                    new=NoiseConfig(0, timedelta(minutes=1)),
                ),
                mock.patch.object(
                    PerformanceSlowDBQueryGroupType,
                    "noise_config",
                    new=NoiseConfig(0, timedelta(minutes=1)),
                ),
                override_options(
                    {
                        "performance.issues.all.problem-detection": 1.0,
                        "performance-file-io-main-thread-creation": 1.0,
                        "performance.issues.slow_db_query.problem-creation": 1.0,
                    }
                ),
            ):
                event = self.store_event(data, project_id=project_id, **store_event_kwargs)
                for span in data["spans"]:
                    if span:
                        span.update({"event_id": event.event_id})
                        self.store_span(
                            self.create_span(
                                span,
                                start_ts=datetime.fromtimestamp(span["start_timestamp"]),
                                duration=int(span["timestamp"] - span["start_timestamp"]) * 1000,
                            )
                        )
                self.store_span(self.convert_event_data_to_span(event))
                return event

    def convert_event_data_to_span(self, event: Event) -> dict[str, Any]:
        trace_context = event.data["contexts"]["trace"]
        start_ts = event.data["start_timestamp"]
        end_ts = event.data["timestamp"]
        span_data = self.create_span(
            {
                "event_id": event.event_id,
                "organization_id": event.organization.id,
                "project_id": event.project.id,
                "trace_id": trace_context["trace_id"],
                "span_id": trace_context["span_id"],
                "parent_span_id": trace_context.get("parent_span_id", "0" * 12),
                "description": event.data["transaction"],
                "segment_id": uuid4().hex[:16],
                "group_raw": uuid4().hex[:16],
                "profile_id": uuid4().hex,
                "is_segment": True,
                # Multiply by 1000 cause it needs to be ms
                "start_timestamp_ms": int(start_ts * 1000),
                "timestamp": int(start_ts * 1000),
                "received": start_ts,
                "duration_ms": int(end_ts - start_ts),
            }
        )
        if "parent_span_id" in trace_context:
            span_data["parent_span_id"] = trace_context["parent_span_id"]
        else:
            del span_data["parent_span_id"]

        return span_data

    def load_errors(
        self,
        project: Project,
        span_id: str | None = None,
    ) -> list[Event]:
        """Generates trace with errors across two projects."""
        start, _ = self.get_start_end_from_day_ago(1000)
        error_data = load_data(
            "javascript",
            timestamp=start,
        )
        error_data["contexts"]["trace"] = {
            "type": "trace",
            "trace_id": self.trace_id,
            "span_id": span_id or uuid4().hex[:16],
        }
        error_data["level"] = "fatal"
        error = self.store_event(error_data, project_id=project.id)
        error_data["level"] = "warning"
        error1 = self.store_event(error_data, project_id=project.id)

        another_project = self.create_project(organization=self.organization)
        another_project_error = self.store_event(error_data, project_id=another_project.id)
        return [error, error1, another_project_error]

    def load_default(self) -> Event:
        start, _ = self.get_start_end_from_day_ago(1000)
        return self.store_event(
            {
                "timestamp": iso_format(start),
                "contexts": {
                    "trace": {
                        "type": "trace",
                        "trace_id": self.trace_id,
                        "span_id": self.root_span_ids[0],
                    },
                },
                "level": "debug",
                "message": "this is a log message",
            },
            project_id=self.gen1_project.id,
        )

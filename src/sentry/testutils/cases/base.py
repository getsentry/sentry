from __future__ import annotations

import inspect
import os
import os.path
from contextlib import contextmanager

import pytest
from django.conf import settings
from django.contrib.auth import login
from django.contrib.auth.models import AnonymousUser
from django.core import signing
from django.core.cache import cache
from django.db import DEFAULT_DB_ALIAS, connections
from django.http import HttpRequest
from django.test import TestCase, TransactionTestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from exam import Exam, before

from sentry import auth
from sentry.auth.providers.dummy import DummyProvider
from sentry.auth.superuser import COOKIE_DOMAIN as SU_COOKIE_DOMAIN
from sentry.auth.superuser import COOKIE_NAME as SU_COOKIE_NAME
from sentry.auth.superuser import COOKIE_PATH as SU_COOKIE_PATH
from sentry.auth.superuser import COOKIE_SALT as SU_COOKIE_SALT
from sentry.auth.superuser import COOKIE_SECURE as SU_COOKIE_SECURE
from sentry.auth.superuser import ORG_ID as SU_ORG_ID
from sentry.auth.superuser import Superuser
from sentry.constants import MODULE_ROOT
from sentry.models import DeletedOrganization, GroupMeta, ProjectOption
from sentry.utils.auth import SsoSession
from sentry.utils.retries import TimedRetryPolicy

from ..fixtures import Fixtures
from ..helpers import AuthProvider, Feature, TaskRunner, override_options, parse_queries

DETECT_TESTCASE_MISUSE = os.environ.get("SENTRY_DETECT_TESTCASE_MISUSE") == "1"
SILENCE_MIXED_TESTCASE_MISUSE = os.environ.get("SENTRY_SILENCE_MIXED_TESTCASE_MISUSE") == "1"


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


@override_settings(ROOT_URLCONF="sentry.web.urls")
class TestCase(BaseTestCase, TestCase):
    pass
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
                    # blows through max recursion limits here if it encounters certain
                    # types of broken lazy proxy objects.
                    if type(first_arg) is state.base and info.function in state.used_db:
                        state.used_db[info.function] = True
                        break

                return real_ensure_connection(*args, **kwargs)

            monkeypatch.setattr(BaseDatabaseWrapper, "ensure_connection", ensure_connection)
            state.used_db[request.function.__name__] = False
            yield


class TransactionTestCase(BaseTestCase, TransactionTestCase):
    pass

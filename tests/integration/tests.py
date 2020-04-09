# -*- coding: utf-8 -*-

from __future__ import absolute_import, print_function

import os
import datetime
import json
import logging
import six
from time import sleep
import zlib
import pytest

from sentry.utils.compat import mock
from sentry import eventstore, tagstore
from django.conf import settings
from django.core.urlresolvers import reverse
from django.test.utils import override_settings
from django.utils import timezone
from exam import fixture
from gzip import GzipFile
from sentry_sdk import Hub, Client
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.django import DjangoIntegration
from six import StringIO
from werkzeug.test import Client as WerkzeugClient

from sentry.models import Group
from sentry.testutils import SnubaTestCase, TestCase, TransactionTestCase
from sentry.testutils.helpers import get_auth_header
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.utils.settings import validate_settings, ConfigurationError, import_string
from sentry.utils.sdk import configure_scope
from sentry.web.api import disable_transaction_events
from sentry.wsgi import application

DEPENDENCY_TEST_DATA = {
    "postgresql": (
        "DATABASES",
        "psycopg2.extensions",
        "database engine",
        "django.db.backends.postgresql_psycopg2",
        {
            "default": {
                "ENGINE": "django.db.backends.postgresql_psycopg2",
                "NAME": "test",
                "USER": "root",
                "PASSWORD": "",
                "HOST": "127.0.0.1",
                "PORT": "",
            }
        },
    ),
    "memcache": (
        "CACHES",
        "memcache",
        "caching backend",
        "django.core.cache.backends.memcached.MemcachedCache",
        {
            "default": {
                "BACKEND": "django.core.cache.backends.memcached.MemcachedCache",
                "LOCATION": "127.0.0.1:11211",
            }
        },
    ),
    "pylibmc": (
        "CACHES",
        "pylibmc",
        "caching backend",
        "django.core.cache.backends.memcached.PyLibMCCache",
        {
            "default": {
                "BACKEND": "django.core.cache.backends.memcached.PyLibMCCache",
                "LOCATION": "127.0.0.1:11211",
            }
        },
    ),
}


def get_fixture_path(name):
    return os.path.join(os.path.dirname(__file__), "fixtures", name)


def load_fixture(name):
    with open(get_fixture_path(name)) as fp:
        return fp.read()


@pytest.mark.obsolete("Remove, behaviour changed, new behaviour tested in Relay")
class RavenIntegrationTest(TransactionTestCase):
    """
    This mocks the test server and specifically tests behavior that would
    happen between Raven <--> Sentry over HTTP communication.
    """

    def setUp(self):
        self.user = self.create_user("coreapi@example.com")
        self.project = self.create_project()
        self.pk = self.project.key_set.get_or_create()[0]

        self.configure_sentry_errors()

    def configure_sentry_errors(self):
        # delay raising of assertion errors to make sure they do not get
        # swallowed again
        failures = []

        class AssertHandler(logging.Handler):
            def emit(self, entry):
                failures.append(entry)

        assert_handler = AssertHandler()

        for name in "sentry.errors", "sentry_sdk.errors":
            sentry_errors = logging.getLogger(name)
            sentry_errors.addHandler(assert_handler)
            sentry_errors.setLevel(logging.DEBUG)

            @self.addCleanup
            def remove_handler(sentry_errors=sentry_errors):
                sentry_errors.handlers.pop(sentry_errors.handlers.index(assert_handler))

        @self.addCleanup
        def reraise_failures():
            for entry in failures:
                raise AssertionError(entry.message)

    def send_event(self, method, url, body, headers):
        from sentry.app import buffer

        with self.tasks():
            content_type = headers.pop("Content-Type", None)
            headers = {"HTTP_" + k.replace("-", "_").upper(): v for k, v in six.iteritems(headers)}
            resp = self.client.post(
                reverse("sentry-api-store", args=[self.pk.project_id]),
                data=body,
                content_type=content_type,
                **headers
            )
            assert resp.status_code == 200

            buffer.process_pending()

    @mock.patch("urllib3.PoolManager.request")
    def test_basic(self, request):
        requests = []

        def queue_event(method, url, body, headers):
            requests.append((method, url, body, headers))

        request.side_effect = queue_event

        hub = Hub(
            Client(
                "http://%s:%s@localhost:8000/%s"
                % (self.pk.public_key, self.pk.secret_key, self.pk.project_id),
                default_integrations=False,
            )
        )

        hub.capture_message("foo")
        hub.client.close()

        for _request in requests:
            self.send_event(*_request)

        assert request.call_count == 1
        assert Group.objects.count() == 1
        group = Group.objects.get()
        assert group.data["title"] == "foo"


class SentryRemoteTest(TestCase):
    @fixture
    def path(self):
        return reverse("sentry-api-store")

    def get_event(self, event_id):
        instance = eventstore.get_event_by_id(self.project.id, event_id)
        return instance

    def test_minimal(self):
        event_data = {
            "message": "hello",
            "tags": {"foo": "bar"},
            "timestamp": iso_format(before_now(seconds=1)),
        }

        event = self.store_event(event_data, self.project.id)

        assert event is not None
        instance = self.get_event(event.event_id)

        assert instance.message == "hello"
        assert instance.data["logentry"] == {"formatted": "hello"}
        assert instance.title == instance.data["title"] == "hello"
        assert instance.location is instance.data.get("location", None) is None

        assert tagstore.get_tag_key(self.project.id, None, "foo") is not None
        assert tagstore.get_tag_value(self.project.id, None, "foo", "bar") is not None
        assert (
            tagstore.get_group_tag_key(self.project.id, instance.group_id, None, "foo") is not None
        )
        assert (
            tagstore.get_group_tag_value(instance.project_id, instance.group_id, None, "foo", "bar")
            is not None
        )

    def test_exception(self):
        event_data = {
            "exception": {
                "type": "ZeroDivisionError",
                "value": "cannot divide by zero",
                "stacktrace": {
                    "frames": [
                        {
                            "filename": "utils.py",
                            "in_app": False,
                            "function": "raise_it",
                            "module": "utils",
                        },
                        {
                            "filename": "main.py",
                            "in_app": True,
                            "function": "fail_it",
                            "module": "main",
                        },
                    ]
                },
            },
            "tags": {"foo": "bar"},
            "timestamp": iso_format(before_now(seconds=1)),
        }

        event = self.store_event(event_data, self.project.id)

        assert event is not None
        instance = self.get_event(event.event_id)

        assert len(instance.data["exception"]) == 1
        assert (
            instance.title == instance.data["title"] == "ZeroDivisionError: cannot divide by zero"
        )
        assert instance.location == instance.data["location"] == "main.py"
        assert instance.culprit == instance.data["culprit"] == "main in fail_it"

        assert tagstore.get_tag_key(self.project.id, None, "foo") is not None
        assert tagstore.get_tag_value(self.project.id, None, "foo", "bar") is not None
        assert (
            tagstore.get_group_tag_key(self.project.id, instance.group_id, None, "foo") is not None
        )
        assert (
            tagstore.get_group_tag_value(instance.project_id, instance.group_id, None, "foo", "bar")
            is not None
        )

    def test_timestamp(self):
        timestamp = timezone.now().replace(microsecond=0, tzinfo=timezone.utc) - datetime.timedelta(
            hours=1
        )
        event_data = {u"message": "hello", "timestamp": float(timestamp.strftime("%s.%f"))}

        event = self.store_event(event_data, self.project.id)

        assert event is not None
        instance = self.get_event(event.event_id)

        assert instance.message == "hello"
        assert instance.datetime == timestamp
        group = instance.group
        assert group.first_seen == timestamp
        assert group.last_seen == timestamp

    @pytest.mark.obsolete("Test in relay")
    @override_settings(SENTRY_ALLOW_ORIGIN="sentry.io")
    def test_correct_data_with_get(self):
        kwargs = {"message": "hello", "timestamp": iso_format(before_now(seconds=1))}
        resp = self._getWithReferer(kwargs)
        assert resp.status_code == 200, resp.content
        event_id = resp["X-Sentry-ID"]
        instance = self.get_event(event_id)
        assert instance.message == "hello"

    @pytest.mark.obsolete("Test in relay")
    @override_settings(SENTRY_ALLOW_ORIGIN="*")
    def test_get_without_referer_allowed(self):
        self.project.update_option("sentry:origins", "")
        kwargs = {"message": "hello", "timestamp": iso_format(before_now(seconds=1))}
        resp = self._getWithReferer(kwargs, referer=None, protocol="4")
        assert resp.status_code == 200, resp.content

    @pytest.mark.obsolete("Test in relay")
    @override_settings(SENTRY_ALLOW_ORIGIN="sentry.io")
    def test_correct_data_with_post_referer(self):
        kwargs = {"message": "hello", "timestamp": iso_format(before_now(seconds=1))}
        resp = self._postWithReferer(kwargs)
        assert resp.status_code == 200, resp.content
        event_id = json.loads(resp.content)["id"]
        instance = self.get_event(event_id)
        assert instance.message == "hello"

    @pytest.mark.obsolete("Test in relay")
    @override_settings(SENTRY_ALLOW_ORIGIN="sentry.io")
    def test_post_without_referer(self):
        self.project.update_option("sentry:origins", "")
        kwargs = {"message": "hello", "timestamp": iso_format(before_now(seconds=1))}
        resp = self._postWithReferer(kwargs, referer=None, protocol="4")
        assert resp.status_code == 200, resp.content

    @pytest.mark.obsolete("Test in relay")
    @override_settings(SENTRY_ALLOW_ORIGIN="*")
    def test_post_without_referer_allowed(self):
        self.project.update_option("sentry:origins", "")
        kwargs = {"message": "hello", "timestamp": iso_format(before_now(seconds=1))}
        resp = self._postWithReferer(kwargs, referer=None, protocol="4")
        assert resp.status_code == 200, resp.content

    @pytest.mark.obsolete("Test in relay")
    @override_settings(SENTRY_ALLOW_ORIGIN="google.com")
    def test_post_with_invalid_origin(self):
        self.project.update_option("sentry:origins", "sentry.io")
        kwargs = {"message": "hello", "timestamp": iso_format(before_now(seconds=1))}
        resp = self._postWithReferer(kwargs, referer="https://getsentry.net", protocol="4")
        assert resp.status_code == 403, resp.content

    @pytest.mark.obsolete("Test in relay")
    def test_content_encoding_deflate(self):
        kwargs = {"message": "hello", "timestamp": iso_format(before_now(seconds=1))}
        message = zlib.compress(json.dumps(kwargs))

        key = self.projectkey.public_key
        secret = self.projectkey.secret_key

        with self.tasks():
            resp = self.client.post(
                self.path,
                message,
                content_type="application/octet-stream",
                HTTP_CONTENT_ENCODING="deflate",
                HTTP_X_SENTRY_AUTH=get_auth_header("_postWithHeader", key, secret),
            )

        assert resp.status_code == 200, resp.content

        event_id = json.loads(resp.content)["id"]
        instance = self.get_event(event_id)

        assert instance.message == "hello"

    @pytest.mark.obsolete("Test in relay")
    def test_content_encoding_gzip(self):
        kwargs = {"message": "hello", "timestamp": iso_format(before_now(seconds=1))}

        message = json.dumps(kwargs)

        fp = StringIO()

        try:
            f = GzipFile(fileobj=fp, mode="w")
            f.write(message)
        finally:
            f.close()

        key = self.projectkey.public_key
        secret = self.projectkey.secret_key

        with self.tasks():
            resp = self.client.post(
                self.path,
                fp.getvalue(),
                content_type="application/octet-stream",
                HTTP_CONTENT_ENCODING="gzip",
                HTTP_X_SENTRY_AUTH=get_auth_header("_postWithHeader", key, secret),
            )

        assert resp.status_code == 200, resp.content

        event_id = json.loads(resp.content)["id"]
        instance = self.get_event(event_id)

        assert instance.message == "hello"

    @pytest.mark.obsolete("Test in relay")
    def test_protocol_v2_0_without_secret_key(self):
        kwargs = {"message": "hello", "timestamp": iso_format(before_now(seconds=1))}

        resp = self._postWithHeader(data=kwargs, key=self.projectkey.public_key, protocol="2.0")

        assert resp.status_code == 200, resp.content

        event_id = json.loads(resp.content)["id"]
        instance = self.get_event(event_id)

        assert instance.message == "hello"

    @pytest.mark.obsolete("Test in relay")
    def test_protocol_v3(self):
        kwargs = {"message": "hello", "timestamp": iso_format(before_now(seconds=1))}

        resp = self._postWithHeader(
            data=kwargs,
            key=self.projectkey.public_key,
            secret=self.projectkey.secret_key,
            protocol="3",
        )

        assert resp.status_code == 200, resp.content

        event_id = json.loads(resp.content)["id"]
        instance = self.get_event(event_id)

        assert instance.message == "hello"

    @pytest.mark.obsolete("Test in relay")
    def test_protocol_v4(self):
        kwargs = {"message": "hello", "timestamp": iso_format(before_now(seconds=1))}

        resp = self._postWithHeader(
            data=kwargs,
            key=self.projectkey.public_key,
            secret=self.projectkey.secret_key,
            protocol="4",
        )

        assert resp.status_code == 200, resp.content

        event_id = json.loads(resp.content)["id"]
        instance = self.get_event(event_id)

        assert instance.message == "hello"

    @pytest.mark.obsolete("Test in relay")
    def test_protocol_v5(self):
        kwargs = {"message": "hello", "timestamp": iso_format(before_now(seconds=1))}

        resp = self._postWithHeader(
            data=kwargs,
            key=self.projectkey.public_key,
            secret=self.projectkey.secret_key,
            protocol="5",
        )

        assert resp.status_code == 200, resp.content

        event_id = json.loads(resp.content)["id"]
        instance = self.get_event(event_id)

        assert instance.message == "hello"

    @pytest.mark.obsolete("Test in relay")
    def test_protocol_v6(self):
        kwargs = {"message": "hello", "timestamp": iso_format(before_now(seconds=1))}

        resp = self._postWithHeader(
            data=kwargs,
            key=self.projectkey.public_key,
            secret=self.projectkey.secret_key,
            protocol="6",
        )

        assert resp.status_code == 200, resp.content

        event_id = json.loads(resp.content)["id"]
        instance = self.get_event(event_id)

        assert instance.message == "hello"


@pytest.mark.obsolete("Functionality not relevant in Relay store")
class SentryWsgiRemoteTest(TransactionTestCase):
    @override_settings(ALLOWED_HOSTS=["localhost"])
    def test_traceparent_header_wsgi(self):
        # Assert that posting something to store will not create another
        # (transaction) event under any circumstances.
        #
        # We use Werkzeug's test client because Django's test client bypasses a
        # lot of request handling code that we want to test implicitly (such as
        # all our WSGI middlewares and the entire Django instrumentation by
        # sentry-sdk).
        #
        # XXX(markus): Ideally methods such as `_postWithHeader` would always
        # call the WSGI application => swap out Django's test client with e.g.
        # Werkzeug's.
        client = WerkzeugClient(application)

        calls = []

        def new_disable_transaction_events():
            with configure_scope() as scope:
                assert scope.span.sampled
                assert scope.span.transaction
                disable_transaction_events()
                assert not scope.span.sampled

            calls.append(1)

        events = []

        auth = get_auth_header(
            "_postWithWerkzeug/0.0.0", self.projectkey.public_key, self.projectkey.secret_key, "7"
        )

        with mock.patch(
            "sentry.web.api.disable_transaction_events", new_disable_transaction_events
        ):
            with self.tasks():
                with Hub(
                    Client(
                        transport=events.append,
                        integrations=[CeleryIntegration(), DjangoIntegration()],
                    )
                ):
                    app_iter, status, headers = client.post(
                        reverse("sentry-api-store"),
                        data=b'{"message": "hello"}',
                        headers={
                            "x-sentry-auth": auth,
                            "sentry-trace": "1",
                            "content-type": "application/octet-stream",
                        },
                        environ_base={"REMOTE_ADDR": "127.0.0.1"},
                    )

                    body = "".join(app_iter)

        assert status == "200 OK", body
        assert set((e.get("type"), e.get("transaction")) for e in events) == {
            ("transaction", "rule_processor_apply")
        }
        assert calls == [1]


class DependencyTest(TestCase):
    def raise_import_error(self, package):
        def callable(package_name):
            if package_name != package:
                return import_string(package_name)
            raise ImportError("No module named %s" % (package,))

        return callable

    @mock.patch("django.conf.settings", mock.Mock())
    @mock.patch("sentry.utils.settings.import_string")
    def validate_dependency(
        self, key, package, dependency_type, dependency, setting_value, import_string
    ):
        import_string.side_effect = self.raise_import_error(package)

        with self.settings(**{key: setting_value}):
            with self.assertRaises(ConfigurationError):
                validate_settings(settings)

    def test_validate_fails_on_postgres(self):
        self.validate_dependency(*DEPENDENCY_TEST_DATA["postgresql"])

    def test_validate_fails_on_memcache(self):
        self.validate_dependency(*DEPENDENCY_TEST_DATA["memcache"])

    def test_validate_fails_on_pylibmc(self):
        self.validate_dependency(*DEPENDENCY_TEST_DATA["pylibmc"])


def get_fixtures(name):
    path = os.path.join(os.path.dirname(__file__), "fixtures/csp", name)
    try:
        with open(path + "_input.json", "rb") as fp1:
            input = fp1.read()
    except IOError:
        input = None

    try:
        with open(path + "_output.json", "rb") as fp2:
            output = json.load(fp2)
    except IOError:
        output = None

    return input, output


class CspReportTest(TestCase, SnubaTestCase):
    def assertReportCreated(self, input, output):
        resp = self._postCspWithHeader(input)
        assert resp.status_code == 201, resp.content
        # XXX: there appears to be a race condition between the 201 return and get_events,
        # leading this test to sometimes fail. .5s seems to be sufficient.
        # Modifying the timestamp of store_event, like how it's done in other snuba tests,
        # doesn't work here because the event isn't created directly by this test.
        sleep(0.5)
        events = eventstore.get_events(
            filter=eventstore.Filter(
                project_ids=[self.project.id], conditions=[["type", "=", "csp"]]
            )
        )
        assert len(events) == 1
        e = events[0]
        assert output["message"] == e.data["logentry"]["formatted"]
        for key, value in six.iteritems(output["tags"]):
            assert e.get_tag(key) == value
        for key, value in six.iteritems(output["data"]):
            assert e.data[key] == value

    def assertReportRejected(self, input):
        resp = self._postCspWithHeader(input)
        assert resp.status_code in (400, 403), resp.content

    def test_invalid_report(self):
        self.assertReportRejected("")

    def test_chrome_blocked_asset(self):
        self.assertReportCreated(*get_fixtures("chrome_blocked_asset"))

    def test_firefox_missing_effective_uri(self):
        self.assertReportCreated(*get_fixtures("firefox_blocked_asset"))

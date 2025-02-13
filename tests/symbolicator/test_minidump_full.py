import zipfile
from io import BytesIO
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from sentry import eventstore
from sentry.lang.native.utils import STORE_CRASH_REPORTS_ALL
from sentry.models.eventattachment import EventAttachment
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers.task_runner import BurstTaskRunner
from sentry.testutils.relay import RelayStoreHelper
from sentry.testutils.skips import requires_kafka, requires_symbolicator
from sentry.utils.safe import get_path
from tests.symbolicator import insta_snapshot_native_stacktrace_data, redact_location

# IMPORTANT:
#
# This test suite requires Symbolicator in order to run correctly.
# Set `symbolicator.enabled: true` in your `~/.sentry/config.yml` and run `devservices up --mode=symbolicator`
#
# If you are using a local instance of Symbolicator, you need to
# either change `system.url-prefix` option override inside `initialize` fixture to `system.internal-url-prefix`,
# or add `127.0.0.1 host.docker.internal` entry to your `/etc/hosts`


pytestmark = [requires_symbolicator, requires_kafka]


@pytest.mark.snuba
class SymbolicatorMinidumpIntegrationTest(RelayStoreHelper, TransactionTestCase):
    @pytest.fixture(autouse=True)
    def initialize(self, live_server, reset_snuba):
        self.project.update_option("sentry:builtin_symbol_sources", [])

        with (
            patch("sentry.auth.system.is_internal_ip", return_value=True),
            self.options({"system.url-prefix": live_server.url}),
        ):
            # Run test case
            yield

    def upload_symbols(self):
        url = reverse(
            "sentry-api-0-dsym-files",
            kwargs={
                "organization_id_or_slug": self.project.organization.slug,
                "project_id_or_slug": self.project.slug,
            },
        )

        self.login_as(user=self.user)

        out = BytesIO()
        f = zipfile.ZipFile(out, "w")
        f.write(get_fixture_path("native", "windows.sym"), "crash.sym")
        f.close()

        response = self.client.post(
            url,
            {
                "file": SimpleUploadedFile(
                    "symbols.zip", out.getvalue(), content_type="application/zip"
                )
            },
            format="multipart",
        )
        assert response.status_code == 201, response.content
        assert len(response.json()) == 1

    _FEATURES = {
        "organizations:event-attachments": True,
        "organizations:symbol-sources": False,
        "organizations:custom-symbol-sources": False,
    }

    def test_full_minidump(self):
        self.project.update_option("sentry:store_crash_reports", STORE_CRASH_REPORTS_ALL)
        self.upload_symbols()

        with self.feature(self._FEATURES):
            with open(get_fixture_path("native", "windows.dmp"), "rb") as f:
                event = self.post_and_retrieve_minidump(
                    {
                        "upload_file_minidump": f,
                        "some_file": ("hello.txt", BytesIO(b"Hello World!")),
                    },
                    {
                        "sentry[logger]": "test-logger",
                        "sentry[level]": "error",
                    },
                )

        candidates = event.data["debug_meta"]["images"][0]["candidates"]
        redact_location(candidates)
        event.data["debug_meta"]["images"][0]["candidates"] = candidates

        insta_snapshot_native_stacktrace_data(self, event.data)
        assert event.data.get("logger") == "test-logger"
        assert event.data.get("level") == "error"
        # assert event.data.get("extra") == {"foo": "bar"}

        attachments = sorted(
            EventAttachment.objects.filter(event_id=event.event_id), key=lambda x: x.name
        )
        hello, minidump = attachments

        assert hello.name == "hello.txt"
        assert hello.sha1 == "2ef7bde608ce5404e97d5f042f95f89f1c232871"

        assert minidump.name == "windows.dmp"
        assert minidump.sha1 == "74bb01c850e8d65d3ffbc5bad5cabc4668fce247"

    def test_full_minidump_json_extra(self):
        self.project.update_option("sentry:store_crash_reports", STORE_CRASH_REPORTS_ALL)
        self.upload_symbols()

        with self.feature("organizations:event-attachments"):
            with open(get_fixture_path("native", "windows.dmp"), "rb") as f:
                event = self.post_and_retrieve_minidump(
                    {"upload_file_minidump": f},
                    {"sentry": '{"logger":"test-logger"}', "foo": "bar"},
                )

        assert event.data.get("logger") == "test-logger"
        assert event.data.get("extra") == {"foo": "bar"}
        # Other assertions are performed by `test_full_minidump`

    def test_full_minidump_invalid_extra(self):
        self.project.update_option("sentry:store_crash_reports", STORE_CRASH_REPORTS_ALL)
        self.upload_symbols()

        with self.feature("organizations:event-attachments"):
            with open(get_fixture_path("native", "windows.dmp"), "rb") as f:
                event = self.post_and_retrieve_minidump(
                    {"upload_file_minidump": f},
                    {"sentry": "{{{{", "foo": "bar"},  # invalid sentry JSON
                )

        assert not event.data.get("logger")
        assert event.data.get("extra") == {"foo": "bar"}
        # Other assertions are performed by `test_full_minidump`

    def test_missing_dsym(self):
        with self.feature(self._FEATURES):
            with open(get_fixture_path("native", "windows.dmp"), "rb") as f:
                event = self.post_and_retrieve_minidump(
                    {"upload_file_minidump": f}, {"sentry[logger]": "test-logger"}
                )

        insta_snapshot_native_stacktrace_data(self, event.data)
        assert not EventAttachment.objects.filter(event_id=event.event_id)

    def test_reprocessing(self):
        # NOTE:
        # When running this test against a local symbolicator instance,
        # make sure that instance has its caches disabled. This test assumes
        # that a symbol upload has immediate effect, whereas in reality the
        # negative cache needs to expire first.

        self.project.update_option("sentry:store_crash_reports", STORE_CRASH_REPORTS_ALL)

        with self.feature(self._FEATURES):
            with open(get_fixture_path("native", "windows.dmp"), "rb") as f:
                event = self.post_and_retrieve_minidump(
                    {"upload_file_minidump": f}, {"sentry[logger]": "test-logger"}
                )

            insta_snapshot_native_stacktrace_data(self, event.data, subname="initial")

            self.upload_symbols()

            from sentry.tasks.reprocessing2 import reprocess_group

            with BurstTaskRunner() as burst:
                reprocess_group.delay(project_id=self.project.id, group_id=event.group_id)

                burst(max_jobs=100)

            new_event = eventstore.backend.get_event_by_id(self.project.id, event.event_id)
            assert new_event is not None
            assert new_event.event_id == event.event_id

        candidates = new_event.data["debug_meta"]["images"][0]["candidates"]
        redact_location(candidates)
        new_event.data["debug_meta"]["images"][0]["candidates"] = candidates

        insta_snapshot_native_stacktrace_data(self, new_event.data, subname="reprocessed")

        for event_id in (event.event_id, new_event.event_id):
            (minidump,) = sorted(
                EventAttachment.objects.filter(event_id=new_event.event_id), key=lambda x: x.name
            )

            assert minidump.name == "windows.dmp"
            assert minidump.sha1 == "74bb01c850e8d65d3ffbc5bad5cabc4668fce247"

    def test_minidump_threadnames(self):
        self.project.update_option("sentry:store_crash_reports", STORE_CRASH_REPORTS_ALL)

        with self.feature(self._FEATURES):
            with open(get_fixture_path("native", "threadnames.dmp"), "rb") as f:
                event = self.post_and_retrieve_minidump({"upload_file_minidump": f}, {})

        thread_name = get_path(event.data, "threads", "values", 1, "name")
        assert thread_name == "sentry-http"

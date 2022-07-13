import zipfile
from io import BytesIO
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from sentry import eventstore
from sentry.lang.native.utils import STORE_CRASH_REPORTS_ALL
from sentry.models import EventAttachment, File
from sentry.testutils import RelayStoreHelper
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers.features import Feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.helpers.task_runner import BurstTaskRunner
from sentry.utils.safe import get_path
from tests.symbolicator import insta_snapshot_stacktrace_data

# IMPORTANT:
# For these tests to run, write `symbolicator.enabled: true` into your
# `~/.sentry/config.yml` and run `sentry devservices up`


class TestSymbolicatorMinidumpIntegration(RelayStoreHelper):
    @pytest.fixture(autouse=True)
    def initialize(self, default_project, live_server, reset_snuba):
        default_project.update_option("sentry:builtin_symbol_sources", [])
        new_prefix = live_server.url

        with patch("sentry.auth.system.is_internal_ip", return_value=True), override_options(
            # Don't change this to internal-url-prefix, otherwise the tests
            # can't run with symbolicator-in-docker anymore
            {"system.url-prefix": new_prefix}
        ):

            # Run test case:
            yield

    @pytest.fixture
    def upload_symbols(self, default_project, default_user, login_as, client):
        def inner():
            url = reverse(
                "sentry-api-0-dsym-files",
                kwargs={
                    "organization_slug": default_project.organization.slug,
                    "project_slug": default_project.slug,
                },
            )

            login_as(user=default_user)

            out = BytesIO()
            f = zipfile.ZipFile(out, "w")
            f.write(get_fixture_path("native", "windows.sym"), "crash.sym")
            f.close()

            response = client.post(
                url,
                {
                    "file": SimpleUploadedFile(
                        "symbols.zip", out.getvalue(), content_type="application/zip"
                    )
                },
                format="multipart",
            )
            assert response.status_code == 201, response.content
            assert len(response.data) == 1

        return inner

    _FEATURES = {
        "organizations:event-attachments": True,
        "organizations:symbol-sources": False,
        "organizations:custom-symbol-sources": False,
        "organizations:images-loaded-v2": False,
    }

    @pytest.mark.snuba
    @pytest.mark.django_db(transaction=True)
    def test_full_minidump(self, insta_snapshot, default_project, default_user, upload_symbols):
        default_project.update_option("sentry:store_crash_reports", STORE_CRASH_REPORTS_ALL)
        upload_symbols()

        with Feature(self._FEATURES):
            with open(get_fixture_path("native", "windows.dmp"), "rb") as f:
                event = self.post_and_retrieve_minidump(
                    {
                        "upload_file_minidump": f,
                        "some_file": ("hello.txt", BytesIO(b"Hello World!")),
                    },
                    {"sentry[logger]": "test-logger"},
                )

        insta_snapshot_stacktrace_data(insta_snapshot, event.data)
        assert event.data.get("logger") == "test-logger"
        # assert event.data.get("extra") == {"foo": "bar"}

        attachments = sorted(
            EventAttachment.objects.filter(event_id=event.event_id), key=lambda x: x.name
        )
        hello, minidump = attachments

        assert hello.name == "hello.txt"
        hello_file = File.objects.get(id=hello.file_id)
        assert hello_file.type == "event.attachment"
        assert hello_file.checksum == "2ef7bde608ce5404e97d5f042f95f89f1c232871"

        assert minidump.name == "windows.dmp"
        minidump_file = File.objects.get(id=minidump.file_id)
        assert minidump_file.type == "event.minidump"
        assert minidump_file.checksum == "74bb01c850e8d65d3ffbc5bad5cabc4668fce247"

    @pytest.mark.snuba
    @pytest.mark.django_db(transaction=True)
    def test_full_minidump_json_extra(self, upload_symbols, default_project):
        default_project.update_option("sentry:store_crash_reports", STORE_CRASH_REPORTS_ALL)
        upload_symbols()

        with Feature("organizations:event-attachments"):
            with open(get_fixture_path("native", "windows.dmp"), "rb") as f:
                event = self.post_and_retrieve_minidump(
                    {"upload_file_minidump": f},
                    {"sentry": '{"logger":"test-logger"}', "foo": "bar"},
                )

        assert event.data.get("logger") == "test-logger"
        assert event.data.get("extra") == {"foo": "bar"}
        # Other assertions are performed by `test_full_minidump`

    @pytest.mark.snuba
    @pytest.mark.django_db(transaction=True)
    def test_full_minidump_invalid_extra(self, insta_snapshot, upload_symbols, default_project):
        default_project.update_option("sentry:store_crash_reports", STORE_CRASH_REPORTS_ALL)
        upload_symbols()

        with Feature("organizations:event-attachments"):
            with open(get_fixture_path("native", "windows.dmp"), "rb") as f:
                event = self.post_and_retrieve_minidump(
                    {"upload_file_minidump": f},
                    {"sentry": "{{{{", "foo": "bar"},  # invalid sentry JSON
                )

        assert not event.data.get("logger")
        assert event.data.get("extra") == {"foo": "bar"}
        # Other assertions are performed by `test_full_minidump`

    @pytest.mark.snuba
    @pytest.mark.django_db(transaction=True)
    def test_missing_dsym(self, upload_symbols, insta_snapshot):
        with Feature(self._FEATURES):
            with open(get_fixture_path("native", "windows.dmp"), "rb") as f:
                event = self.post_and_retrieve_minidump(
                    {"upload_file_minidump": f}, {"sentry[logger]": "test-logger"}
                )

        insta_snapshot_stacktrace_data(insta_snapshot, event.data)
        assert not EventAttachment.objects.filter(event_id=event.event_id)

    @pytest.mark.snuba
    @pytest.mark.django_db(transaction=True)
    def test_reprocessing(self, insta_snapshot, upload_symbols, default_project):
        # NOTE:
        # When running this test against a local symbolicator instance,
        # make sure that instance has its caches disabled. This test assumes
        # that a symbol upload has immediate effect, whereas in reality the
        # negative cache needs to expire first.

        default_project.update_option("sentry:store_crash_reports", STORE_CRASH_REPORTS_ALL)

        features = dict(self._FEATURES)
        features["organizations:reprocessing-v2"] = True
        with Feature(features):
            with open(get_fixture_path("native", "windows.dmp"), "rb") as f:
                event = self.post_and_retrieve_minidump(
                    {"upload_file_minidump": f}, {"sentry[logger]": "test-logger"}
                )

            insta_snapshot_stacktrace_data(insta_snapshot, event.data, subname="initial")

            upload_symbols()

            from sentry.tasks.reprocessing2 import reprocess_group

            with BurstTaskRunner() as burst:
                reprocess_group.delay(project_id=default_project.id, group_id=event.group_id)

            burst(max_jobs=100)

            new_event = eventstore.get_event_by_id(default_project.id, event.event_id)
            assert new_event is not None
            assert new_event.event_id == event.event_id

        insta_snapshot_stacktrace_data(insta_snapshot, new_event.data, subname="reprocessed")

        for event_id in (event.event_id, new_event.event_id):
            (minidump,) = sorted(
                EventAttachment.objects.filter(event_id=new_event.event_id), key=lambda x: x.name
            )

            assert minidump.name == "windows.dmp"
            minidump_file = File.objects.get(id=minidump.file_id)
            assert minidump_file.type == "event.minidump"
            assert minidump_file.checksum == "74bb01c850e8d65d3ffbc5bad5cabc4668fce247"

    @pytest.mark.snuba
    @pytest.mark.django_db(transaction=True)
    def test_minidump_threadnames(self, default_project):
        default_project.update_option("sentry:store_crash_reports", STORE_CRASH_REPORTS_ALL)

        with Feature(self._FEATURES):
            with open(get_fixture_path("native", "threadnames.dmp"), "rb") as f:
                event = self.post_and_retrieve_minidump({"upload_file_minidump": f}, {})

        thread_name = get_path(event.data, "threads", "values", 1, "name")
        assert thread_name == "sentry-http"

from __future__ import absolute_import

import pytest
import zipfile
from sentry.utils.compat.mock import patch

from six import BytesIO

from django.core.urlresolvers import reverse
from django.core.files.uploadedfile import SimpleUploadedFile

from sentry import eventstore
from sentry.testutils import TransactionTestCase, RelayStoreHelper
from sentry.testutils.helpers.task_runner import BurstTaskRunner
from sentry.models import EventAttachment
from sentry.lang.native.utils import STORE_CRASH_REPORTS_ALL

from tests.symbolicator import get_fixture_path, insta_snapshot_stacktrace_data


# IMPORTANT:
# For these tests to run, write `symbolicator.enabled: true` into your
# `~/.sentry/config.yml` and run `sentry devservices up`


class SymbolicatorMinidumpIntegrationTest(RelayStoreHelper, TransactionTestCase):
    @pytest.fixture(autouse=True)
    def initialize(self, live_server):
        self.project.update_option("sentry:builtin_symbol_sources", [])
        new_prefix = live_server.url

        with patch("sentry.auth.system.is_internal_ip", return_value=True), self.options(
            {"system.url-prefix": new_prefix}
        ):

            # Run test case:
            yield

    def upload_symbols(self):
        url = reverse(
            "sentry-api-0-dsym-files",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

        self.login_as(user=self.user)

        out = BytesIO()
        f = zipfile.ZipFile(out, "w")
        f.write(get_fixture_path("windows.sym"), "crash.sym")
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
        assert len(response.data) == 1

    def test_full_minidump(self):
        self.project.update_option("sentry:store_crash_reports", STORE_CRASH_REPORTS_ALL)
        self.upload_symbols()

        with self.feature("organizations:event-attachments"):
            with open(get_fixture_path("windows.dmp"), "rb") as f:
                event = self.post_and_retrieve_minidump(
                    {
                        "upload_file_minidump": f,
                        "some_file": ("hello.txt", BytesIO(b"Hello World!")),
                    },
                    {"sentry[logger]": "test-logger"},
                )

        insta_snapshot_stacktrace_data(self, event.data)
        assert event.data.get("logger") == "test-logger"
        # assert event.data.get("extra") == {"foo": "bar"}

        attachments = sorted(
            EventAttachment.objects.filter(event_id=event.event_id), key=lambda x: x.name
        )
        hello, minidump = attachments

        assert hello.name == "hello.txt"
        assert hello.file.type == "event.attachment"
        assert hello.file.checksum == "2ef7bde608ce5404e97d5f042f95f89f1c232871"

        assert minidump.name == "windows.dmp"
        assert minidump.file.type == "event.minidump"
        assert minidump.file.checksum == "74bb01c850e8d65d3ffbc5bad5cabc4668fce247"

    def test_full_minidump_json_extra(self):
        self.project.update_option("sentry:store_crash_reports", STORE_CRASH_REPORTS_ALL)
        self.upload_symbols()

        with self.feature("organizations:event-attachments"):
            with open(get_fixture_path("windows.dmp"), "rb") as f:
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
            with open(get_fixture_path("windows.dmp"), "rb") as f:
                event = self.post_and_retrieve_minidump(
                    {"upload_file_minidump": f},
                    {"sentry": "{{{{", "foo": "bar"},  # invalid sentry JSON
                )

        assert not event.data.get("logger")
        assert event.data.get("extra") == {"foo": "bar"}
        # Other assertions are performed by `test_full_minidump`

    def test_missing_dsym(self):
        with self.feature("organizations:event-attachments"):
            with open(get_fixture_path("windows.dmp"), "rb") as f:
                event = self.post_and_retrieve_minidump(
                    {"upload_file_minidump": f}, {"sentry[logger]": "test-logger"}
                )

        insta_snapshot_stacktrace_data(self, event.data)
        assert not EventAttachment.objects.filter(event_id=event.event_id)

    def test_reprocessing(self):
        self.project.update_option("sentry:store_crash_reports", STORE_CRASH_REPORTS_ALL)

        with self.feature(
            {"organizations:event-attachments": True, "projects:reprocessing-v2": True}
        ):
            with open(get_fixture_path("windows.dmp"), "rb") as f:
                event = self.post_and_retrieve_minidump(
                    {"upload_file_minidump": f}, {"sentry[logger]": "test-logger"}
                )

            insta_snapshot_stacktrace_data(self, event.data, subname="initial")

            self.upload_symbols()

            from sentry.tasks.reprocessing2 import reprocess_group

            with BurstTaskRunner() as burst:
                reprocess_group.delay(project_id=self.project.id, group_id=event.group_id)

            burst()

            (new_event,) = eventstore.get_events(
                eventstore.Filter(
                    project_ids=[self.project.id],
                    conditions=[["tags[original_event_id]", "=", event.event_id]],
                )
            )
            assert new_event is not None
            assert new_event.event_id != event.event_id

        insta_snapshot_stacktrace_data(self, new_event.data, subname="reprocessed")

        for event_id in (event.event_id, new_event.event_id):
            (minidump,) = sorted(
                EventAttachment.objects.filter(event_id=new_event.event_id), key=lambda x: x.name
            )

            assert minidump.name == "windows.dmp"
            assert minidump.file.type == "event.minidump"
            assert minidump.file.checksum == "74bb01c850e8d65d3ffbc5bad5cabc4668fce247"

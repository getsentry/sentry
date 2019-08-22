from __future__ import absolute_import

import pytest
import zipfile
from mock import patch

from six import BytesIO

from django.core.urlresolvers import reverse
from django.core.files.uploadedfile import SimpleUploadedFile

from sentry import eventstore
from sentry.testutils import TransactionTestCase
from sentry.models import EventAttachment

from tests.symbolicator import get_fixture_path, insta_snapshot_stacktrace_data


class SymbolicatorMinidumpIntegrationTest(TransactionTestCase):
    # For these tests to run, write `symbolicator.enabled: true` into your
    # `~/.sentry/config.yml` and run `sentry devservices up`

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
        self.project.update_option("sentry:store_crash_reports", True)
        self.upload_symbols()

        with self.feature("organizations:event-attachments"):
            attachment = BytesIO(b"Hello World!")
            attachment.name = "hello.txt"
            with open(get_fixture_path("windows.dmp"), "rb") as f:
                resp = self._postMinidumpWithHeader(
                    f, {"sentry[logger]": "test-logger", "some_file": attachment}
                )
                assert resp.status_code == 200

        event = eventstore.get_events(filter_keys={"project_id": [self.project.id]})[0]
        insta_snapshot_stacktrace_data(self, event.data)

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

    def test_raw_minidump(self):
        self.project.update_option("sentry:store_crash_reports", True)
        self.upload_symbols()

        with self.feature("organizations:event-attachments"):
            with open(get_fixture_path("windows.dmp"), "rb") as f:
                # Send as raw request body instead of multipart/form-data
                resp = self._postMinidumpWithHeader(f, raw=True)
                assert resp.status_code == 200

        event = eventstore.get_events(filter_keys={"project_id": [self.project.id]})[0]
        insta_snapshot_stacktrace_data(self, event.data)

    def test_missing_dsym(self):
        with self.feature("organizations:event-attachments"):
            with open(get_fixture_path("windows.dmp"), "rb") as f:
                resp = self._postMinidumpWithHeader(f, {"sentry[logger]": "test-logger"})
                assert resp.status_code == 200

        event = eventstore.get_events(filter_keys={"project_id": [self.project.id]})[0]
        insta_snapshot_stacktrace_data(self, event.data)
        assert not EventAttachment.objects.filter(event_id=event.event_id)

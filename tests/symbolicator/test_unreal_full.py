from __future__ import absolute_import

import pytest
import zipfile
from sentry.utils.compat.mock import patch

from six import BytesIO

from django.core.urlresolvers import reverse
from django.core.files.uploadedfile import SimpleUploadedFile

from sentry.testutils import TransactionTestCase, RelayStoreHelper
from sentry.models import EventAttachment
from sentry.lang.native.utils import STORE_CRASH_REPORTS_ALL

from tests.symbolicator import get_fixture_path


# IMPORTANT:
# For these tests to run, write `symbolicator.enabled: true` into your
# `~/.sentry/config.yml` and run `sentry devservices up`


def get_unreal_crash_file():
    return get_fixture_path("unreal_crash")


def get_unreal_crash_apple_file():
    return get_fixture_path("unreal_crash_apple")


class SymbolicatorUnrealIntegrationTest(RelayStoreHelper, TransactionTestCase):
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
        f.write(get_fixture_path("unreal_crash.sym"), "crash.sym")
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

    def unreal_crash_test_impl(self, filename):
        self.project.update_option("sentry:store_crash_reports", STORE_CRASH_REPORTS_ALL)
        self.upload_symbols()

        # attachments feature has to be on for the files extract stick around
        with self.feature("organizations:event-attachments"):
            with open(filename, "rb") as f:
                event = self.post_and_retrieve_unreal(f.read())

        self.insta_snapshot(
            {
                "contexts": event.data.get("contexts"),
                "exception": event.data.get("exception"),
                "stacktrace": event.data.get("stacktrace"),
                "threads": event.data.get("threads"),
                "extra": event.data.get("extra"),
            }
        )

        return sorted(EventAttachment.objects.filter(event_id=event.event_id), key=lambda x: x.name)

    def test_unreal_crash_with_attachments(self):
        attachments = self.unreal_crash_test_impl(get_unreal_crash_file())
        assert len(attachments) == 4
        context, config, minidump, log = attachments

        assert context.name == "CrashContext.runtime-xml"
        assert context.file.type == "unreal.context"
        assert context.file.checksum == "835d3e10db5d1799dc625132c819c047261ddcfb"

        assert config.name == "CrashReportClient.ini"
        assert config.file.type == "event.attachment"
        assert config.file.checksum == "5839c750bdde8cba4d2a979ea857b8154cffdab5"

        assert minidump.name == "UE4Minidump.dmp"
        assert minidump.file.type == "event.minidump"
        assert minidump.file.checksum == "089d9fd3b5c0cc4426339ab46ec3835e4be83c0f"

        assert log.name == "YetAnother.log"  # Log file is named after the project
        assert log.file.type == "unreal.logs"
        assert log.file.checksum == "24d1c5f75334cd0912cc2670168d593d5fe6c081"

    def test_unreal_apple_crash_with_attachments(self):
        attachments = self.unreal_crash_test_impl(get_unreal_crash_apple_file())

        assert len(attachments) == 6
        context, config, diagnostics, log, info, minidump = attachments

        assert context.name == "CrashContext.runtime-xml"
        assert context.file.type == "unreal.context"
        assert context.file.checksum == "5d2723a7d25111645702fcbbcb8e1d038db56c6e"

        assert config.name == "CrashReportClient.ini"
        assert config.file.type == "event.attachment"
        assert config.file.checksum == "4d6a2736e3e4969a68b7adbe197b05c171c29ea0"

        assert diagnostics.name == "Diagnostics.txt"
        assert diagnostics.file.type == "event.attachment"
        assert diagnostics.file.checksum == "aa271bf4e307a78005410234081945352e8fb236"

        assert log.name == "YetAnotherMac.log"  # Log file is named after the project
        assert log.file.type == "unreal.logs"
        assert log.file.checksum == "735e751a8b6b943dbc0abce0e6d096f4d48a0c1e"

        assert info.name == "info.txt"
        assert info.file.type == "event.attachment"
        assert info.file.checksum == "279b27ac5d0e6792d088e0662ce1a18413b772bc"

        assert minidump.name == "minidump.dmp"
        assert minidump.file.type == "event.applecrashreport"
        assert minidump.file.checksum == "728d0f4b09cf5a7942da3893b6db79ac842b701a"

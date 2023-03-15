import zipfile
from io import BytesIO
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from sentry.lang.native.utils import STORE_CRASH_REPORTS_ALL
from sentry.models import EventAttachment, File
from sentry.testutils import RelayStoreHelper, TransactionTestCase
from sentry.testutils.factories import get_fixture_path
from sentry.utils.safe import get_path
from tests.symbolicator import normalize_native_exception

# IMPORTANT:
# For these tests to run, write `symbolicator.enabled: true` into your
# `~/.sentry/config.yml` and run `sentry devservices up`


def get_unreal_crash_file():
    return get_fixture_path("native", "unreal_crash")


def get_unreal_crash_apple_file():
    return get_fixture_path("native", "unreal_crash_apple")


class SymbolicatorUnrealIntegrationTest(RelayStoreHelper, TransactionTestCase):
    # For these tests to run, write `symbolicator.enabled: true` into your
    # `~/.sentry/config.yml` and run `sentry devservices up`
    # Also running locally, it might be necessary to set the
    # `system.internal-url-prefix` option instead of `system.url-prefix`.

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
        f.write(get_fixture_path("native", "unreal_crash.sym"), "crash.sym")
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
                "exception": {
                    "values": [
                        normalize_native_exception(x)
                        for x in get_path(event.data, "exception", "values") or ()
                    ]
                },
                "stacktrace": event.data.get("stacktrace"),
                "threads": event.data.get("threads"),
                "extra": event.data.get("extra"),
                "sdk": event.data.get("sdk"),
            }
        )

        return sorted(EventAttachment.objects.filter(event_id=event.event_id), key=lambda x: x.name)

    def test_unreal_crash_with_attachments(self):
        attachments = self.unreal_crash_test_impl(get_unreal_crash_file())
        assert len(attachments) == 4
        context, config, minidump, log = attachments

        assert context.name == "CrashContext.runtime-xml"
        context_file = File.objects.get(id=context.file_id)
        assert context_file.type == "unreal.context"
        assert context_file.checksum == "835d3e10db5d1799dc625132c819c047261ddcfb"

        assert config.name == "CrashReportClient.ini"
        config_file = File.objects.get(id=config.file_id)
        assert config_file.type == "event.attachment"
        assert config_file.checksum == "5839c750bdde8cba4d2a979ea857b8154cffdab5"

        assert minidump.name == "UE4Minidump.dmp"
        minidump_file = File.objects.get(id=minidump.file_id)
        assert minidump_file.type == "event.minidump"
        assert minidump_file.checksum == "089d9fd3b5c0cc4426339ab46ec3835e4be83c0f"

        assert log.name == "YetAnother.log"  # Log file is named after the project
        log_file = File.objects.get(id=log.file_id)
        assert log_file.type == "unreal.logs"
        assert log_file.checksum == "24d1c5f75334cd0912cc2670168d593d5fe6c081"

    def test_unreal_apple_crash_with_attachments(self):
        attachments = self.unreal_crash_test_impl(get_unreal_crash_apple_file())

        assert len(attachments) == 6
        context, config, diagnostics, log, info, minidump = attachments

        assert context.name == "CrashContext.runtime-xml"
        context_file = File.objects.get(id=context.file_id)
        assert context_file.type == "unreal.context"
        assert context_file.checksum == "5d2723a7d25111645702fcbbcb8e1d038db56c6e"

        assert config.name == "CrashReportClient.ini"
        config_file = File.objects.get(id=config.file_id)
        assert config_file.type == "event.attachment"
        assert config_file.checksum == "4d6a2736e3e4969a68b7adbe197b05c171c29ea0"

        assert diagnostics.name == "Diagnostics.txt"
        diagnostics_file = File.objects.get(id=diagnostics.file_id)
        assert diagnostics_file.type == "event.attachment"
        assert diagnostics_file.checksum == "aa271bf4e307a78005410234081945352e8fb236"

        assert log.name == "YetAnotherMac.log"  # Log file is named after the project
        log_file = File.objects.get(id=log.file_id)
        assert log_file.type == "unreal.logs"
        assert log_file.checksum == "735e751a8b6b943dbc0abce0e6d096f4d48a0c1e"

        assert info.name == "info.txt"
        info_file = File.objects.get(id=info.file_id)
        assert info_file.type == "event.attachment"
        assert info_file.checksum == "279b27ac5d0e6792d088e0662ce1a18413b772bc"

        assert minidump.name == "minidump.dmp"
        minidump_file = File.objects.get(id=minidump.file_id)
        assert minidump_file.type == "event.applecrashreport"
        assert minidump_file.checksum == "728d0f4b09cf5a7942da3893b6db79ac842b701a"

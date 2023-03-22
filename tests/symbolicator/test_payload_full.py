import zipfile
from io import BytesIO
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from sentry import eventstore
from sentry.models import File, ProjectDebugFile
from sentry.testutils import RelayStoreHelper, TransactionTestCase
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers.datetime import before_now, iso_format
from tests.symbolicator import insta_snapshot_native_stacktrace_data, redact_location

# IMPORTANT:
# For these tests to run, write `symbolicator.enabled: true` into your
# `~/.sentry/config.yml` and run `sentry devservices up`


REAL_RESOLVING_EVENT_DATA = {
    "platform": "cocoa",
    "debug_meta": {
        "images": [
            {
                "type": "apple",
                "arch": "x86_64",
                "uuid": "502fc0a5-1ec1-3e47-9998-684fa139dca7",
                "image_vmaddr": "0x0000000100000000",
                "image_size": 4096,
                "image_addr": "0x0000000100000000",
                "name": "Foo.app/Contents/Foo",
            }
        ],
        "sdk_info": {
            "dsym_type": "macho",
            "sdk_name": "macOS",
            "version_major": 10,
            "version_minor": 12,
            "version_patchlevel": 4,
        },
    },
    "exception": {
        "values": [
            {
                "stacktrace": {
                    "frames": [
                        {"platform": "foobar", "function": "hi"},
                        {"function": "unknown", "instruction_addr": "0x0000000100000fa0"},
                    ]
                },
                "type": "Fail",
                "value": "fail",
            }
        ]
    },
    "timestamp": iso_format(before_now(seconds=1)),
}


class SymbolicatorResolvingIntegrationTest(RelayStoreHelper, TransactionTestCase):
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

    def get_event(self, event_id):
        return eventstore.get_event_by_id(self.project.id, event_id)

    def test_real_resolving(self):
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
        f.write(get_fixture_path("native", "hello.dsym"), "dSYM/hello")
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

        event = self.post_and_retrieve_event(REAL_RESOLVING_EVENT_DATA)
        assert event.data["culprit"] == "main"

        candidates = event.data["debug_meta"]["images"][0]["candidates"]
        redact_location(candidates)
        event.data["debug_meta"]["images"][0]["candidates"] = candidates

        insta_snapshot_native_stacktrace_data(self, event.data)

    def test_debug_id_resolving(self):
        file = File.objects.create(
            name="crash.pdb", type="default", headers={"Content-Type": "text/x-breakpad"}
        )

        path = get_fixture_path("native", "windows.sym")
        with open(path, "rb") as f:
            file.putfile(f)

        ProjectDebugFile.objects.create(
            file=file,
            object_name="crash.pdb",
            cpu_name="x86",
            project_id=self.project.id,
            debug_id="3249d99d-0c40-4931-8610-f4e4fb0b6936-1",
            code_id="5AB380779000",
        )

        self.login_as(user=self.user)

        event_data = {
            "contexts": {
                "device": {"arch": "x86"},
                "os": {"build": "", "name": "Windows", "type": "os", "version": "10.0.14393"},
            },
            "debug_meta": {
                "images": [
                    {
                        "id": "3249d99d-0c40-4931-8610-f4e4fb0b6936-1",
                        "image_addr": "0x2a0000",
                        "image_size": 36864,
                        "name": "C:\\projects\\breakpad-tools\\windows\\Release\\crash.exe",
                        "type": "symbolic",
                    }
                ]
            },
            "exception": {
                "stacktrace": {
                    "frames": [
                        {
                            "function": "<unknown>",
                            "instruction_addr": "0x2a2a3d",
                            "package": "C:\\projects\\breakpad-tools\\windows\\Release\\crash.exe",
                        }
                    ]
                },
                "thread_id": 1636,
                "type": "EXCEPTION_ACCESS_VIOLATION_WRITE",
                "value": "Fatal Error: EXCEPTION_ACCESS_VIOLATION_WRITE",
            },
            "platform": "native",
            "timestamp": iso_format(before_now(seconds=1)),
        }

        event = self.post_and_retrieve_event(event_data)
        assert event.data["culprit"] == "main"

        candidates = event.data["debug_meta"]["images"][0]["candidates"]
        redact_location(candidates)
        event.data["debug_meta"]["images"][0]["candidates"] = candidates

        insta_snapshot_native_stacktrace_data(self, event.data)

    def test_missing_dsym(self):
        self.login_as(user=self.user)

        event = self.post_and_retrieve_event(REAL_RESOLVING_EVENT_DATA)
        assert event.data["culprit"] == "unknown"
        insta_snapshot_native_stacktrace_data(self, event.data)

    def test_missing_debug_images(self):
        self.login_as(user=self.user)

        payload = dict(project=self.project.id, **REAL_RESOLVING_EVENT_DATA)
        del payload["debug_meta"]

        event = self.post_and_retrieve_event(payload)
        assert event.data["culprit"] == "unknown"
        insta_snapshot_native_stacktrace_data(self, event.data)

    def test_resolving_with_candidates_sentry_source(self):
        # Checks the candidates with a sentry source URI for location
        file = File.objects.create(
            name="crash.pdb", type="default", headers={"Content-Type": "text/x-breakpad"}
        )

        path = get_fixture_path("native", "windows.sym")
        with open(path, "rb") as f:
            file.putfile(f)

        ProjectDebugFile.objects.create(
            file=file,
            object_name="crash.pdb",
            cpu_name="x86",
            project_id=self.project.id,
            debug_id="3249d99d-0c40-4931-8610-f4e4fb0b6936-1",
            code_id="5AB380779000",
        )

        self.login_as(user=self.user)

        event_data = {
            "contexts": {
                "device": {"arch": "x86"},
            },
            "debug_meta": {
                "images": [
                    {
                        "id": "3249d99d-0c40-4931-8610-f4e4fb0b6936-1",
                        "image_addr": "0x2a0000",
                        "image_size": 36864,
                        "name": "C:\\projects\\breakpad-tools\\windows\\Release\\crash.exe",
                        "type": "symbolic",
                    }
                ]
            },
            "exception": {
                "stacktrace": {
                    "frames": [
                        {
                            "instruction_addr": "0x2a2a3d",
                        }
                    ]
                },
                "type": "EXCEPTION_ACCESS_VIOLATION_WRITE",
                "value": "Fatal Error: EXCEPTION_ACCESS_VIOLATION_WRITE",
            },
            "platform": "native",
            "timestamp": iso_format(before_now(seconds=1)),
        }

        event = self.post_and_retrieve_event(event_data)
        assert event.data["culprit"] == "main"

        candidates = event.data["debug_meta"]["images"][0]["candidates"]
        redact_location(candidates)
        self.insta_snapshot(candidates)

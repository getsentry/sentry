import os.path
import zipfile
from io import BytesIO
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from sentry import eventstore
from sentry.models.artifactbundle import (
    ArtifactBundle,
    DebugIdArtifactBundle,
    ProjectArtifactBundle,
    SourceFileType,
)
from sentry.models.debugfile import ProjectDebugFile
from sentry.models.files.file import File
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.factories import get_fixture_path
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.relay import RelayStoreHelper
from sentry.testutils.skips import requires_kafka, requires_symbolicator
from sentry.utils import json
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
    "timestamp": before_now(seconds=1).isoformat(),
}


def get_local_fixture_path(name):
    return os.path.join(os.path.dirname(__file__), "fixtures", name)


def load_fixture(name):
    with open(get_local_fixture_path(name), "rb") as fp:
        return fp.read()


class SymbolicatorResolvingIntegrationTest(RelayStoreHelper, TransactionTestCase):
    @pytest.fixture(autouse=True)
    def initialize(self, live_server):
        self.project.update_option("sentry:builtin_symbol_sources", [])
        self.min_ago = before_now(minutes=1).isoformat()

        with (
            patch("sentry.auth.system.is_internal_ip", return_value=True),
            self.options({"system.url-prefix": live_server.url}),
        ):
            # Run test case
            yield

    def get_event(self, event_id):
        return eventstore.backend.get_event_by_id(self.project.id, event_id)

    def test_real_resolving(self):
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
        assert len(response.json()) == 1

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
            "timestamp": before_now(seconds=1).isoformat(),
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
            "timestamp": before_now(seconds=1).isoformat(),
        }

        event = self.post_and_retrieve_event(event_data)
        assert event.data["culprit"] == "main"

        candidates = event.data["debug_meta"]["images"][0]["candidates"]
        redact_location(candidates)
        self.insta_snapshot(candidates)

    def test_resolve_mixed_stack_trace(self):
        # JS debug files:
        debug_id = "c941d872-af1f-4f0c-a7ff-ad3d295fe153"

        compressed = BytesIO(b"SYSB")
        with zipfile.ZipFile(compressed, "a") as zip_file:
            zip_file.writestr("files/_/_/test.min.js", load_fixture("test.min.js"))
            zip_file.writestr("files/_/_/test.map", load_fixture("test.map"))

            zip_file.writestr(
                "manifest.json",
                json.dumps(
                    {
                        "files": {
                            "files/_/_/test.min.js": {
                                "url": "~/test.min.js",
                                "type": "minified_source",
                                "headers": {
                                    "debug-id": debug_id,
                                    "sourcemap": "test.map",
                                },
                            },
                            "files/_/_/test.map": {
                                "url": "~/file.wc.sourcemap.js",
                                "type": "source_map",
                                "headers": {
                                    "debug-id": debug_id,
                                },
                            },
                        },
                    }
                ),
            )
        compressed.seek(0)
        bundle_file = File.objects.create(name="bundle.zip", type="artifact.bundle")
        bundle_file.putfile(compressed)

        artifact_bundle = ArtifactBundle.objects.create(
            organization_id=self.organization.id,
            bundle_id=uuid4(),
            file=bundle_file,
            artifact_count=2,
        )
        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            artifact_bundle=artifact_bundle,
        )
        DebugIdArtifactBundle.objects.create(
            organization_id=self.organization.id,
            debug_id=debug_id,
            artifact_bundle=artifact_bundle,
            source_file_type=SourceFileType.MINIFIED_SOURCE.value,
        )
        DebugIdArtifactBundle.objects.create(
            organization_id=self.organization.id,
            debug_id=debug_id,
            artifact_bundle=artifact_bundle,
            source_file_type=SourceFileType.SOURCE_MAP.value,
        )

        # native debug files:
        wasm_file = File.objects.create(
            name="test.wasm", type="default", headers={"Content-Type": "application/wasm"}
        )

        with open(get_local_fixture_path("a18fd85d4a4eb893022d6bfad846b1.debug"), "rb") as f:
            wasm_file.putfile(f)

        ProjectDebugFile.objects.create(
            file=wasm_file,
            object_name="test.wasm",
            cpu_name="wasm32",
            project_id=self.project.id,
            debug_id="bda18fd8-5d4a-4eb8-9302-2d6bfad846b1",
            code_id="bda18fd85d4a4eb893022d6bfad846b1",
        )

        data = {
            "timestamp": self.min_ago,
            "message": "hello",
            "platform": "javascript",
            "release": "abc",
            "exception": {
                "values": [
                    {
                        "type": "Error",
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "http://example.com/test.min.js",
                                    "lineno": 1,
                                    "colno": 183,
                                },
                                {
                                    "platform": "native",
                                    "instruction_addr": "0x8c",
                                    "addr_mode": "rel:0",
                                },
                            ]
                        },
                    }
                ]
            },
            "debug_meta": {
                "images": [
                    {
                        "type": "sourcemap",
                        "debug_id": debug_id,
                        "code_file": "http://example.com/test.min.js",
                    },
                    {
                        "type": "wasm",
                        "debug_id": "bda18fd8-5d4a-4eb8-9302-2d6bfad846b1",
                        "code_id": "bda18fd85d4a4eb893022d6bfad846b1",
                        "debug_file": "file://foo.invalid/demo.wasm",
                    },
                ]
            },
        }

        event = self.post_and_retrieve_event(data)

        exception = event.interfaces["exception"]
        frames = exception.values[0].stacktrace.frames
        assert frames[0].abs_path == "http://example.com/test.js"
        assert frames[0].lineno == 20
        assert frames[0].colno == 5
        assert frames[0].context_line == "    invoke(data);"

        assert frames[1].abs_path == "/Users/mitsuhiko/Development/wasm-example/simple/src/lib.rs"
        assert frames[1].lineno == 19
        assert frames[1].function == "internal_func"

        images = event.data["debug_meta"]["images"]
        assert images[1]["debug_status"] == "found"

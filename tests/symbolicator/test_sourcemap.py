import os.path
from unittest.mock import patch

import pytest
from django.conf import settings

from sentry.models import File, Release, ReleaseFile
from sentry.testutils import RelayStoreHelper, TransactionTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from tests.symbolicator import insta_snapshot_javascript_stacktrace_data

# IMPORTANT:
# For these tests to run, write `symbolicator.enabled: true` into your
# `~/.sentry/config.yml` and run `sentry devservices up`

# NOTE:
# Run with `pytest --reuse-db tests/symbolicator/test_sourcemap.py -s` until DB issues are resolved.


def get_fixture_path(name):
    return os.path.join(os.path.dirname(__file__), "fixtures", name)


class SymbolicatorSourceMapIntegrationTest(RelayStoreHelper, TransactionTestCase):
    @pytest.fixture(autouse=True)
    def initialize(self, live_server):
        self.debug = True

        new_options = settings.SENTRY_OPTIONS.copy()

        new_options["system.url-prefix"] = live_server.url
        new_options["system.internal-url-prefix"] = live_server.url
        new_options["symbolicator.sourcemaps-processing-internal-projects"] = True
        new_options["symbolicator.sourcemaps-processing-sample-rate"] = 1.0

        with patch("sentry.auth.system.is_internal_ip", return_value=True), self.settings(
            SENTRY_OPTIONS=new_options
        ):
            # Run test case:
            yield

    def test_symbolicator_roundtrip(self):
        project = self.project
        release_id = "abc"
        release = Release.objects.create(
            organization_id=project.organization_id, version=release_id
        )
        release.add_project(project)

        for file in ["test.min.js", "test.js", "test.map"]:
            with open(get_fixture_path(file), "rb") as f:
                f_minified = File.objects.create(
                    name=file,
                    type="release.file",
                    headers={"Content-Type": "application/json"},
                )
                f_minified.putfile(f)

            ReleaseFile.objects.create(
                name=f"~/{f_minified.name}",
                release_id=release.id,
                organization_id=project.organization_id,
                file=f_minified,
            )

        event_data = {
            "timestamp": iso_format(before_now(minutes=1)),
            "message": "hello",
            "platform": "javascript",
            "release": release_id,
            "exception": {
                "values": [
                    {
                        "type": "Error",
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "http://example.com/test.min.js",
                                    "filename": "test.min.js",
                                    "lineno": 1,
                                    "colno": 64,
                                    "function": "e",
                                },
                                {
                                    "abs_path": "http://example.com/test.min.js",
                                    "filename": "test.min.js",
                                    "lineno": 1,
                                    "colno": 136,
                                    "function": "r",
                                },
                                {
                                    "abs_path": "http://example.com/test.min.js",
                                    "filename": "test.min.js",
                                    "lineno": 1,
                                    "colno": 183,
                                    "function": "i",
                                },
                                {
                                    "abs_path": "http://example.com/index.html",
                                    "filename": "index.html",
                                    "lineno": 6,
                                    "colno": 7,
                                    "function": "produceStack",
                                },
                            ]
                        },
                    },
                ]
            },
        }

        event = self.post_and_retrieve_event(event_data)

        insta_snapshot_javascript_stacktrace_data(self, event.data)

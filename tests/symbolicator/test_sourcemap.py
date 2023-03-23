import os.path

import pytest

from sentry.models import File, Release, ReleaseFile
from sentry.testutils import RelayStoreHelper
from sentry.testutils.helpers.datetime import before_now, iso_format
from tests.symbolicator import insta_snapshot_javascript_stacktrace_data

# IMPORTANT:
#
# This test suite requires Symbolicator in order to run correctly.
# Set `symbolicator.enabled: true` in your `~/.sentry/config.yml` and run `sentry devservices up`
#
# If you are using a local instance of Symbolicator, you need to
# either change `system.url-prefix` option override inside `initialize` fixture to `system.internal-url-prefix`,
# or add `127.0.0.1 host.docker.internal` entry to your `/etc/hosts`


def get_fixture_path(name):
    return os.path.join(os.path.dirname(__file__), "fixtures", name)


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("use_symbolicator", [0, 1])
class TestSymbolicatorSourceMapIntegration(RelayStoreHelper):
    @pytest.fixture(autouse=True)
    def initialize(
        self, set_sentry_option, live_server, use_symbolicator, default_projectkey, default_project
    ):
        self.project = default_project
        self.projectkey = default_projectkey

        with set_sentry_option("system.url-prefix", live_server.url), set_sentry_option(
            "symbolicator.sourcemaps-processing-sample-rate", use_symbolicator
        ):
            yield

    def test_symbolicator_roundtrip(self, insta_snapshot):
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
                    headers={},
                )
                f_minified.putfile(f)

            ReleaseFile.objects.create(
                name=f"~/{f_minified.name}",
                release_id=release.id,
                organization_id=project.organization_id,
                file=f_minified,
            )

        project.update_option("sentry:scrape_javascript", False)

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

        insta_snapshot_javascript_stacktrace_data(insta_snapshot, event.data)

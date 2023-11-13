import os

import pytest

from sentry.models.files.file import File
from sentry.models.release import Release
from sentry.models.releasefile import ReleaseFile
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.relay import RelayStoreHelper
from sentry.testutils.skips import requires_kafka, requires_symbolicator

# IMPORTANT:
#
# This test suite requires Symbolicator in order to run correctly.
# Set `symbolicator.enabled: true` in your `~/.sentry/config.yml` and run `sentry devservices up`
#
# If you are using a local instance of Symbolicator, you need to either change `system.url-prefix`
# to `system.internal-url-prefix` inside `initialize` method below, or add `127.0.0.1 host.docker.internal`
# entry to your `/etc/hosts`


pytestmark = [requires_symbolicator, requires_kafka]


def get_fixture_path(name):
    return os.path.join(os.path.dirname(__file__), "fixtures/example", name)


def load_fixture(name):
    with open(get_fixture_path(name)) as f:
        return f.read()


@django_db_all(transaction=True)
class TestExample(RelayStoreHelper):
    @pytest.fixture(autouse=True)
    def initialize(
        self, default_projectkey, default_project, request, set_sentry_option, live_server
    ):
        self.project = default_project
        self.projectkey = default_projectkey
        self.project.update_option("sentry:scrape_javascript", False)

        with set_sentry_option("system.url-prefix", live_server.url):
            # Run test case
            yield

    @requires_symbolicator
    @pytest.mark.symbolicator
    def test_sourcemap_expansion(self):
        release = Release.objects.create(
            organization_id=self.project.organization_id, version="abc"
        )
        release.add_project(self.project)

        for file in ["test.min.js", "test.js", "test.min.js.map"]:
            with open(get_fixture_path(file), "rb") as f:
                f1 = File.objects.create(
                    name=file,
                    type="release.file",
                    headers={},
                )
                f1.putfile(f)

            ReleaseFile.objects.create(
                name=f"http://example.com/{f1.name}",
                release_id=release.id,
                organization_id=self.project.organization_id,
                file=f1,
            )

        data = {
            "timestamp": iso_format(before_now(minutes=1)),
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
                                    "abs_path": "http://example.com/index.html",
                                    "filename": "index.html",
                                    "lineno": 6,
                                    "colno": 7,
                                    "function": "produceStack",
                                },
                                {
                                    "abs_path": "http://example.com/test.min.js",
                                    "filename": "test.min.js",
                                    "lineno": 1,
                                    "colno": 183,
                                    "function": "i",
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
                                    "colno": 64,
                                    "function": "e",
                                },
                            ]
                        },
                    }
                ]
            },
        }

        event = self.post_and_retrieve_event(data)

        exception = event.interfaces["exception"]
        frame_list = exception.values[0].stacktrace.frames

        assert len(frame_list) == 4

        assert frame_list[0].function == "produceStack"
        assert frame_list[0].lineno == 6
        assert frame_list[0].filename == "index.html"

        assert frame_list[1].function == "test"
        assert frame_list[1].lineno == 20
        assert frame_list[1].filename == "test.js"

        assert frame_list[2].function == "invoke"
        assert frame_list[2].lineno == 15
        assert frame_list[2].filename == "test.js"

        assert frame_list[3].function == "onFailure"
        assert frame_list[3].lineno == 5
        assert frame_list[3].filename == "test.js"

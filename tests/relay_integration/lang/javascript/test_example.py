from __future__ import absolute_import

import os
import responses

from sentry.utils import json
from sentry.testutils import RelayStoreHelper, TransactionTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


def get_fixture_path(name):
    return os.path.join(os.path.dirname(__file__), "example-project", name)


def load_fixture(name):
    with open(get_fixture_path(name)) as f:
        return f.read()


class ExampleTestCase(RelayStoreHelper, TransactionTestCase):
    @responses.activate
    def test_sourcemap_expansion(self):
        responses.add(
            responses.GET,
            "http://example.com/test.js",
            body=load_fixture("test.js"),
            content_type="application/javascript",
        )
        responses.add(
            responses.GET,
            "http://example.com/test.min.js",
            body=load_fixture("test.min.js"),
            content_type="application/javascript",
        )
        responses.add(
            responses.GET,
            "http://example.com/test.map",
            body=load_fixture("test.map"),
            content_type="application/json",
        )
        responses.add(responses.GET, "http://example.com/index.html", body="Not Found", status=404)

        min_ago = iso_format(before_now(minutes=1))

        data = {
            "timestamp": min_ago,
            "message": "hello",
            "platform": "javascript",
            "exception": {
                "values": [
                    {
                        "type": "Error",
                        "stacktrace": {
                            "frames": json.loads(load_fixture("minifiedError.json"))[::-1]
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

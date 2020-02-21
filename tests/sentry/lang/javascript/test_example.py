# coding: utf-8

from __future__ import absolute_import

import os
import json
import responses
import pytest
import requests

from sentry import eventstore
from sentry.testutils import TestCase, TransactionTestCase, adjust_settings_for_relay_tests
from sentry.testutils.helpers import get_auth_header
from sentry.testutils.helpers.datetime import iso_format, before_now


def get_fixture_path(name):
    return os.path.join(os.path.dirname(__file__), "example-project", name)


def load_fixture(name):
    with open(get_fixture_path(name)) as f:
        return f.read()


@pytest.mark.uses_sentry_store
class ExampleTestCase_LEGACY(TestCase):
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

        resp = self._postWithHeader(data)
        assert resp.status_code == 200
        event_id = json.loads(resp.content)["id"]

        event = eventstore.get_event_by_id(self.project.id, event_id)

        exception = event.interfaces["exception"]
        frame_list = exception.values[0].stacktrace.frames

        assert len(frame_list) == 4

        import pprint

        pprint.pprint(frame_list)

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


@pytest.mark.uses_relay_store
class ExampleTestCase(TransactionTestCase):
    def setUp(self):  # NOQA
        self.auth_header = get_auth_header(
            "TEST_USER_AGENT/0.0.0", self.projectkey.public_key, self.projectkey.secret_key, "7"
        )
        adjust_settings_for_relay_tests(self.settings)

    @pytest.fixture(autouse=True)
    def setup_fixtures(self, settings, live_server, get_relay_store_url, wait_for_ingest_consumer):
        self.settings = settings
        self.get_relay_store_url = get_relay_store_url  # noqa
        self.wait_for_ingest_consumer = wait_for_ingest_consumer(settings)  # noqa

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

        # all requests are now passed through responses,
        # we need the store request to go to the actual Relay server
        # disable responses for the store URL
        url = self.get_relay_store_url(self.project.id)
        responses.add_passthru(url)
        resp = requests.post(
            url,
            headers={"x-sentry-auth": self.auth_header, "content-type": "application/json"},
            json=data,
        )

        assert resp.ok
        resp_body = resp.json()
        event_id = resp_body["id"]

        event = self.wait_for_ingest_consumer(
            lambda: eventstore.get_event_by_id(self.project.id, event_id)
        )

        exception = event.interfaces["exception"]
        frame_list = exception.values[0].stacktrace.frames

        assert len(frame_list) == 4

        import pprint

        pprint.pprint(frame_list)

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

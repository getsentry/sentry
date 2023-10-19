from unittest.mock import call, patch

import pytest
import responses

from sentry import eventstore
from sentry.tasks.recap_servers import (
    RECAP_SERVER_LATEST_ID,
    RECAP_SERVER_TOKEN_OPTION,
    RECAP_SERVER_URL_OPTION,
    poll_project_recap_server,
    poll_recap_servers,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.skips import requires_snuba
from sentry.utils import json

pytestmark = [requires_snuba]

crash_payload = {
    "_links": {
        "self": {"href": "ApiBaseUrl/burp/137?field=stopReason"},
        "files": {"href": "ApiBaseUrl/burp/137/files", "custom": True},
    },
    "id": 1,
    "uploadDate": "2018-11-06T21:19:55.271Z",
    "stopReason": "SEGFAULT",
    "detailedStackTrace": [
        {
            "sourceFile": "/usr/build/src/foo.c",
            "sourceLine": 42,
            "moduleName": "boot.bin",
            "moduleFingerprint": "iddqd",
            "moduleOffset": "0x1",
            "resolvedSymbol": "Foo::Run()+0x4",
            "absoluteAddress": "0xaa00bb4",
            "displayValue": "boot.bin!Foo::Update()+0x4",
        },
        {
            "sourceFile": "/usr/build/src/bar.c",
            "sourceLine": 1337,
            "moduleName": "boot.bin",
            "moduleFingerprint": "idkfa",
            "moduleOffset": "0x10",
            "resolvedSymbol": "Executor::Run()+0x30",
            "absoluteAddress": "0xbb11aa4",
            "displayValue": "boot.bin!Bar::Trigger()+0x30",
        },
    ],
    "userData": {
        "password": "should_be_redacted",
    },
}


@pytest.mark.django_db
@patch("sentry.tasks.recap_servers.poll_project_recap_server.delay")
class PollRecapServersTest(TestCase):
    def setUp(self):
        self.org = self.create_organization(owner=self.user)

    def test_poll_recap_servers_no_matches(
        self,
        poll_project_recap_server,
    ):
        poll_recap_servers()
        assert poll_project_recap_server.call_count == 0

    def test_poll_recap_servers_single_project(
        self,
        poll_project_recap_server,
    ):
        project = self.create_project(organization=self.org, name="foo")
        project.update_option(RECAP_SERVER_URL_OPTION, "http://example.com")

        poll_recap_servers()

        assert poll_project_recap_server.call_count == 1
        poll_project_recap_server.assert_has_calls([call(project.id)], any_order=True)

    def test_poll_recap_servers_multiple_projects(self, poll_project_recap_server):
        project = self.create_project(organization=self.org, name="foo")
        project.update_option(RECAP_SERVER_URL_OPTION, "http://example.com")
        project_dos = self.create_project(organization=self.org, name="bar")
        project_dos.update_option(RECAP_SERVER_URL_OPTION, "http://example-dos.com")
        project_tres = self.create_project(organization=self.org, name="baz")
        project_tres.update_option(RECAP_SERVER_URL_OPTION, "http://example-tres.com")

        poll_recap_servers()

        assert poll_project_recap_server.call_count == 3
        poll_project_recap_server.assert_has_calls(
            [call(project.id), call(project_dos.id), call(project_tres.id)], any_order=True
        )


@pytest.mark.django_db
class PollProjectRecapServerTest(TestCase):
    @pytest.fixture(autouse=True)
    def initialize(self):
        with Feature({"organizations:recap-server": True}):
            yield  # Run test case

    def setUp(self):
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org, name="foo")

    def get_crash_payload(self, id):
        crash = dict(crash_payload)
        crash["id"] = id
        return crash

    def test_poll_project_recap_server_incorrect_project(self):
        poll_project_recap_server(1337)  # should not error

    def test_poll_project_recap_server_missing_recap_url(self):
        poll_project_recap_server(self.project.id)  # should not error

    def test_poll_project_recap_server_disabled_feature(self):
        with Feature({"organizations:recap-server": False}):
            self.project.update_option(RECAP_SERVER_URL_OPTION, "http://example.com")
            poll_project_recap_server(self.project.id)  # should not error

    @patch("sentry.tasks.recap_servers.store_crash")
    @responses.activate
    def test_poll_project_recap_server_initial_request(self, store_crash):
        payload = {
            "results": 3,
            "_embedded": {
                "crash": [
                    {"id": 1},
                    {"id": 1337},
                    {"id": 42},
                ]
            },
        }
        outgoing_recap_request = responses.get(
            url="http://example.com/rest/v1/crashes;sort=id:ascending;limit=1000",
            body=json.dumps(payload),
            content_type="application/json",
        )

        self.project.update_option(RECAP_SERVER_URL_OPTION, "http://example.com")
        assert self.project.get_option(RECAP_SERVER_LATEST_ID) is None

        poll_project_recap_server(self.project.id)

        assert outgoing_recap_request.call_count == 1
        assert store_crash.call_count == 3
        assert self.project.get_option(RECAP_SERVER_LATEST_ID) == 1337

    @patch("sentry.tasks.recap_servers.store_crash")
    @responses.activate
    def test_poll_project_recap_server_following_request(self, store_crash):
        payload = {
            "results": 2,
            "_embedded": {
                "crash": [
                    {"id": 1337},
                    {"id": 42},
                ]
            },
        }
        # Encoded query: {8 TO *}
        outgoing_recap_request = responses.get(
            url="http://example.com/rest/v1/crashes;sort=id:ascending;q=id:%7B8%20TO%20%2A%7D",
            body=json.dumps(payload),
            content_type="application/json",
        )
        self.project.update_option(RECAP_SERVER_URL_OPTION, "http://example.com")
        self.project.update_option(RECAP_SERVER_LATEST_ID, 8)

        poll_project_recap_server(self.project.id)

        assert outgoing_recap_request.call_count == 1
        assert store_crash.call_count == 2
        assert self.project.get_option(RECAP_SERVER_LATEST_ID) == 1337

    @patch("sentry.tasks.recap_servers.store_crash")
    @responses.activate
    def test_poll_project_recap_server_auth_token_header(self, store_crash):
        outgoing_recap_request = responses.get(
            url="http://example.com/rest/v1/crashes;sort=id:ascending;limit=1000",
            body=json.dumps({"results": 0}),
            content_type="application/json",
            match=[responses.matchers.header_matcher({"Authorization": "Bearer mkey"})],
        )

        self.project.update_option(RECAP_SERVER_URL_OPTION, "http://example.com")
        self.project.update_option(RECAP_SERVER_TOKEN_OPTION, "mkey")

        poll_project_recap_server(self.project.id)

        assert outgoing_recap_request.call_count == 1

    # TODO(recap): Add more assetions on `event.data` when the time comes
    @responses.activate
    def test_poll_recap_servers_store_crash(self):
        payload = {
            "results": 2,
            "_embedded": {"crash": [self.get_crash_payload(1337), self.get_crash_payload(42)]},
        }
        responses.get(
            url="http://example.com/rest/v1/crashes;sort=id:ascending;limit=1000",
            body=json.dumps(payload),
            content_type="application/json",
        )
        self.project.update_option(RECAP_SERVER_URL_OPTION, "http://example.com")

        poll_project_recap_server(self.project.id)

        events = eventstore.backend.get_events(
            eventstore.Filter(project_ids=[self.project.id]),
            tenant_ids={"referrer": "relay-test", "organization_id": 123},
        )

        # Make sure that event went though the normalization and pii scrubbing process
        assert events[0].data["contexts"]["userData"]["password"] == "[Filtered]"
        assert events[1].data["contexts"]["userData"]["password"] == "[Filtered]"

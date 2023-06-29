from unittest.mock import call, patch

import pytest
import responses

from sentry import eventstore
from sentry.tasks.recap_servers import (
    RECAP_SERVER_MOST_RECENT_POLLED_ID_KEY,
    RECAP_SERVER_OPTION_KEY,
    poll_project_recap_server,
    poll_recap_servers,
)
from sentry.testutils import TestCase
from sentry.utils import json

crash_payload = {
    "_links": {
        "self": {"href": "ApiBaseUrl/burp/137?field=stopReason"},
        "files": {"href": "ApiBaseUrl/burp/137/files", "custom": True},
        "password": "should_be_redacted",
    },
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
}


class RecapServersTest(TestCase):
    def setUp(self):
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org, name="foo")
        self.project_dos = self.create_project(organization=self.org, name="bar")
        self.project_tres = self.create_project(organization=self.org, name="baz")

    def get_crash_payload(self, id):
        crash = dict(crash_payload)
        crash["id"] = id
        return crash

    @patch("sentry.tasks.recap_servers.poll_project_recap_server.delay")
    @pytest.mark.django_db
    def test_poll_recap_servers_no_matches(
        self,
        poll_project_recap_server,
    ):
        poll_recap_servers()
        assert poll_project_recap_server.call_count == 0

    @patch("sentry.tasks.recap_servers.poll_project_recap_server.delay")
    @pytest.mark.django_db
    def test_poll_recap_servers_single_project(
        self,
        poll_project_recap_server,
    ):
        self.project.update_option(RECAP_SERVER_OPTION_KEY, "http://example.com")

        poll_recap_servers()

        assert poll_project_recap_server.call_count == 1
        poll_project_recap_server.assert_has_calls([call(self.project.id)], any_order=True)

    @patch("sentry.tasks.recap_servers.poll_project_recap_server.delay")
    @pytest.mark.django_db
    def test_poll_recap_servers_multiple_projects(self, poll_project_recap_server):
        self.project.update_option(RECAP_SERVER_OPTION_KEY, "http://example.com")
        self.project_dos.update_option(RECAP_SERVER_OPTION_KEY, "http://example-dos.com")
        self.project_tres.update_option(RECAP_SERVER_OPTION_KEY, "http://example-tres.com")

        poll_recap_servers()

        assert poll_project_recap_server.call_count == 3
        poll_project_recap_server.assert_has_calls(
            [call(self.project.id), call(self.project_dos.id), call(self.project_tres.id)],
            any_order=True,
        )

    @pytest.mark.django_db
    def test_poll_project_recap_server_incorrect_project(self):
        poll_project_recap_server(1337)  # should not error

    @pytest.mark.django_db
    def test_poll_project_recap_server_missing_recap_url(self):
        poll_project_recap_server(self.project.id)  # should not error

    @pytest.mark.django_db
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

        self.project.update_option(RECAP_SERVER_OPTION_KEY, "http://example.com")
        assert self.project.get_option(RECAP_SERVER_MOST_RECENT_POLLED_ID_KEY) is None

        poll_project_recap_server(self.project.id)

        assert outgoing_recap_request.call_count == 1
        assert store_crash.call_count == 3
        assert self.project.get_option(RECAP_SERVER_MOST_RECENT_POLLED_ID_KEY) == 1337

    @pytest.mark.django_db
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
        self.project.update_option(RECAP_SERVER_OPTION_KEY, "http://example.com")
        self.project.update_option(RECAP_SERVER_MOST_RECENT_POLLED_ID_KEY, 8)

        poll_project_recap_server(self.project.id)

        assert outgoing_recap_request.call_count == 1
        assert store_crash.call_count == 2
        assert self.project.get_option(RECAP_SERVER_MOST_RECENT_POLLED_ID_KEY) == 1337

    @pytest.mark.django_db
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
        self.project.update_option(RECAP_SERVER_OPTION_KEY, "http://example.com")

        poll_project_recap_server(self.project.id)

        events = eventstore.backend.get_events(
            eventstore.Filter(project_ids=[self.project.id]),
            tenant_ids={"referrer": "relay-test", "organization_id": 123},
        )
        events_tags = [event.tags for event in events]

        # TODO(recap): Add more assetions on `event.data` when the time comes

        # Make sure that event went though the normalization and pii scrubbing process
        assert events[0].data["contexts"]["_links"]["password"] == "[Filtered]"
        assert events[1].data["contexts"]["_links"]["password"] == "[Filtered]"

        assert [
            ("crash_id", "42"),
            ("level", "error"),
            ("url", "http://example.com/rest/v1/crashes;sort=id:ascending;limit=1000"),
        ] in events_tags
        assert [
            ("crash_id", "1337"),
            ("level", "error"),
            ("url", "http://example.com/rest/v1/crashes;sort=id:ascending;limit=1000"),
        ] in events_tags

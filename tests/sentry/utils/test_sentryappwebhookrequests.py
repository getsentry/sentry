from unittest.mock import Mock

from requests.models import Response

from sentry.testutils.cases import TestCase
from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer


class TestSentryAppWebhookRequests(TestCase):
    def setUp(self) -> None:
        self.sentry_app = self.create_sentry_app(
            name="Test App", events=["issue.resolved", "issue.ignored", "issue.assigned"]
        )
        self.project = self.create_project()

        self.buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)

    def test_only_100_entries_in_buffer(self) -> None:
        for i in range(100):
            self.buffer.add_request(200, i, "issue.assigned", "https://example.com/hook")

        requests = self.buffer.get_requests()
        assert len(requests) == 100
        assert requests[0]["organization_id"] == 99
        assert requests[99]["organization_id"] == 0

        self.buffer.add_request(500, 100, "issue.assigned", "https://test.com/hook")

        requests = self.buffer.get_requests()
        assert len(requests) == 100
        assert requests[0]["organization_id"] == 100
        assert requests[0]["response_code"] == 500
        assert requests[99]["organization_id"] == 1
        assert requests[99]["response_code"] == 200

    def test_error_added(self) -> None:
        self.buffer.add_request(
            200,
            1,
            "issue.assigned",
            "https://example.com/hook",
            error_id="d5111da2c28645c5889d072017e3445d",
            project_id=1,
        )
        requests = self.buffer.get_requests()
        assert len(requests) == 1
        assert requests[0]["error_id"] == "d5111da2c28645c5889d072017e3445d"
        assert requests[0]["project_id"] == 1

    def test_error_not_added_if_project_id_missing(self) -> None:
        self.buffer.add_request(
            200,
            1,
            "issue.assigned",
            "https://example.com/hook",
            error_id="d5111da2c28645c5889d072017e3445d",
        )
        requests = self.buffer.get_requests()
        assert len(requests) == 1
        assert "error_id" not in requests[0]
        assert "project_id" not in requests[0]

    def test_error_not_added_if_error_id_missing(self) -> None:
        self.buffer.add_request(200, 1, "issue.assigned", "https://example.com/hook", project_id=1)
        requests = self.buffer.get_requests()
        assert len(requests) == 1
        assert "error_id" not in requests[0]
        assert "project_id" not in requests[0]

    def _error_response(self, content: str | bytes, body: str | bytes | None) -> Mock:
        response = Mock(spec=Response)
        response.content = content
        response.request = Mock()
        response.request.body = body
        return response

    def test_bodies_stored_verbatim(self) -> None:
        self.buffer.add_request(
            500,
            1,
            "issue.assigned",
            "https://example.com/hook",
            response=self._error_response(
                b'{"error": "boom"}', '{"installation": {"uuid": "abc"}}'
            ),
        )
        requests = self.buffer.get_requests(errors_only=True)
        assert requests[0]["response_body"] == '{"error": "boom"}'
        assert requests[0]["request_body"] == '{"installation": {"uuid": "abc"}}'

    def test_bodies_truncated_to_max_size(self) -> None:
        self.buffer.add_request(
            500,
            1,
            "issue.assigned",
            "https://example.com/hook",
            response=self._error_response(b"a" * 2000, "b" * 2000),
        )
        requests = self.buffer.get_requests(errors_only=True)
        assert requests[0]["response_body"] == "a" * 1024
        assert requests[0]["request_body"] == "b" * 1024

    def test_multibyte_body_truncated_on_a_character_boundary(self) -> None:
        self.buffer.add_request(
            500,
            1,
            "issue.assigned",
            "https://example.com/hook",
            response=self._error_response(("x" + "\u00e9" * 2000).encode("utf-8"), None),
        )
        requests = self.buffer.get_requests(errors_only=True)
        assert requests[0]["response_body"] == "x" + "\u00e9" * 1023

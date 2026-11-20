from unittest.mock import MagicMock, patch

import orjson
from django.test import override_settings
from urllib3 import HTTPResponse
from urllib3.exceptions import TimeoutError

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature

AGENT = "mini_assisted_query"
CONVERSATION_ID = "conv_abc123"
REQUEST_PATH = (
    "sentry.seer.endpoints.organization_seer_agent_conversations.make_agent_conversations_request"
)


def seer_response(data: object, status: int = 200) -> HTTPResponse:
    return HTTPResponse(body=orjson.dumps(data), status=status, preload_content=True)


@with_feature(["organizations:seer-explorer", "organizations:seer-agent-harness"])
@override_settings(SENTRY_SELF_HOSTED=False, SEER_AUTOFIX_URL="http://seer")
class OrganizationSeerAgentConversationsTestBase(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization.flags.allow_joinleave = True
        self.organization.save()
        self.login_as(user=self.user)

    def assert_viewer_context(self, mock_request: MagicMock) -> None:
        assert mock_request.call_args.kwargs["viewer_context"] == {
            "organization_id": self.organization.id,
            "user_id": self.user.id,
        }


class OrganizationSeerAgentConversationsEndpointTest(OrganizationSeerAgentConversationsTestBase):
    endpoint = "sentry-api-0-organization-seer-agent-conversations"

    @patch(REQUEST_PATH)
    def test_list_forwards_known_query_params(self, mock_request: MagicMock) -> None:
        page: dict[str, object] = {"conversations": [], "cursor": None, "hasMore": False}
        mock_request.return_value = seer_response(page)

        response = self.get_success_response(
            self.organization.slug, AGENT, qs_params={"mine": "true", "limit": "5", "other": "x"}
        )

        assert response.data == page
        assert mock_request.call_args.args == ("GET", AGENT, None)
        assert mock_request.call_args.kwargs["query"] == {"mine": "true", "limit": "5"}
        assert mock_request.call_args.kwargs["body"] is None
        self.assert_viewer_context(mock_request)

    @patch(REQUEST_PATH)
    def test_create_moves_idempotency_key_into_body(self, mock_request: MagicMock) -> None:
        created = {"conversation": {"id": CONVERSATION_ID}, "message": {"status": "queued"}}
        mock_request.return_value = seer_response(created, status=201)
        message = {"content": [{"type": "text", "text": "hello"}]}

        response = self.get_success_response(
            self.organization.slug,
            AGENT,
            method="post",
            status_code=201,
            message=message,
            extra_headers={"HTTP_IDEMPOTENCY_KEY": "key-1"},
        )

        assert response.data == created
        assert mock_request.call_args.args == ("POST", AGENT, None)
        assert mock_request.call_args.kwargs["body"] == {
            "message": message,
            "idempotencyKey": "key-1",
        }

    @patch(REQUEST_PATH)
    def test_create_requires_idempotency_key(self, mock_request: MagicMock) -> None:
        response = self.get_error_response(
            self.organization.slug, AGENT, method="post", status_code=400, message={}
        )

        assert response.data == {"detail": "The Idempotency-Key header is required."}
        assert not mock_request.called

    @patch(REQUEST_PATH)
    def test_unknown_agent_passes_through_seer_not_found(self, mock_request: MagicMock) -> None:
        mock_request.return_value = seer_response({"detail": "Not Found"}, status=404)

        response = self.get_error_response(self.organization.slug, "unknown_agent", status_code=404)

        assert response.data == {"detail": "Not Found"}
        assert mock_request.call_args.args == ("GET", "unknown_agent", None)

    @with_feature({"organizations:seer-agent-harness": False})
    @patch(REQUEST_PATH)
    def test_flag_off_is_not_found(self, mock_request: MagicMock) -> None:
        self.get_error_response(self.organization.slug, AGENT, status_code=404)
        assert not mock_request.called

    @with_feature({"organizations:seer-explorer": False})
    @patch(REQUEST_PATH)
    def test_no_seer_agent_access_is_forbidden(self, mock_request: MagicMock) -> None:
        self.get_error_response(self.organization.slug, AGENT, status_code=403)
        assert not mock_request.called

    @patch(REQUEST_PATH)
    def test_seer_client_error_passes_through(self, mock_request: MagicMock) -> None:
        mock_request.return_value = seer_response({"detail": "Unknown cursor"}, status=422)

        response = self.get_error_response(
            self.organization.slug, AGENT, status_code=422, qs_params={"after": "bad"}
        )

        assert response.data == {"detail": "Unknown cursor"}

    @patch(REQUEST_PATH)
    def test_seer_server_error_is_bad_gateway(self, mock_request: MagicMock) -> None:
        mock_request.return_value = seer_response({"detail": "boom"}, status=500)

        response = self.get_error_response(self.organization.slug, AGENT, status_code=502)

        assert response.data == {"detail": "Seer is unavailable."}

    @patch(REQUEST_PATH)
    def test_seer_non_json_success_is_bad_gateway(self, mock_request: MagicMock) -> None:
        mock_request.return_value = HTTPResponse(body=b"<html>", status=200, preload_content=True)

        response = self.get_error_response(self.organization.slug, AGENT, status_code=502)

        assert response.data == {"detail": "Seer is unavailable."}

    @patch(REQUEST_PATH)
    def test_seer_unreachable_is_bad_gateway(self, mock_request: MagicMock) -> None:
        mock_request.side_effect = TimeoutError()

        self.get_error_response(self.organization.slug, AGENT, status_code=502)


class OrganizationSeerAgentConversationDetailsEndpointTest(
    OrganizationSeerAgentConversationsTestBase
):
    endpoint = "sentry-api-0-organization-seer-agent-conversation-details"

    @patch(REQUEST_PATH)
    def test_load(self, mock_request: MagicMock) -> None:
        loaded = {"conversation": {"id": CONVERSATION_ID}, "messages": [], "cursor": 0}
        mock_request.return_value = seer_response(loaded)

        response = self.get_success_response(
            self.organization.slug, AGENT, CONVERSATION_ID, qs_params={"limit": "10"}
        )

        assert response.data == loaded
        assert mock_request.call_args.args == ("GET", AGENT, CONVERSATION_ID)
        assert mock_request.call_args.kwargs["query"] == {"limit": "10"}
        self.assert_viewer_context(mock_request)

    @patch(REQUEST_PATH)
    def test_missing_conversation_is_not_found(self, mock_request: MagicMock) -> None:
        mock_request.return_value = seer_response({"detail": "Not found"}, status=404)

        self.get_error_response(self.organization.slug, AGENT, CONVERSATION_ID, status_code=404)


class OrganizationSeerAgentConversationMessagesEndpointTest(
    OrganizationSeerAgentConversationsTestBase
):
    endpoint = "sentry-api-0-organization-seer-agent-conversation-messages"

    @patch(REQUEST_PATH)
    def test_read(self, mock_request: MagicMock) -> None:
        page = {"messages": [], "cursor": 3, "hasMore": False, "queuedMessages": []}
        mock_request.return_value = seer_response(page)

        response = self.get_success_response(
            self.organization.slug, AGENT, CONVERSATION_ID, qs_params={"after": "3"}
        )

        assert response.data == page
        assert mock_request.call_args.args == ("GET", AGENT, CONVERSATION_ID)
        assert mock_request.call_args.kwargs["messages"] is True
        assert mock_request.call_args.kwargs["query"] == {"after": "3"}

    @patch(REQUEST_PATH)
    def test_send(self, mock_request: MagicMock) -> None:
        queued = {"message": {"status": "queued"}}
        mock_request.return_value = seer_response(queued, status=202)
        content = [{"type": "text", "text": "and then?"}]

        response = self.get_success_response(
            self.organization.slug,
            AGENT,
            CONVERSATION_ID,
            method="post",
            status_code=202,
            content=content,
            extra_headers={"HTTP_IDEMPOTENCY_KEY": "key-2"},
        )

        assert response.data == queued
        assert mock_request.call_args.args == ("POST", AGENT, CONVERSATION_ID)
        assert mock_request.call_args.kwargs["messages"] is True
        assert mock_request.call_args.kwargs["body"] == {
            "content": content,
            "idempotencyKey": "key-2",
        }

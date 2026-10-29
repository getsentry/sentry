from unittest.mock import MagicMock, patch

import orjson
import pytest
from django.test import override_settings
from urllib3.response import HTTPResponse

from sentry.integrations.utils.external_issues import (
    MAX_CONTEXT_LENGTH,
    GeneratedExternalIssueDetails,
    _build_event_context,
    _make_generate_external_issue_details_request,
    maybe_generate_external_issue_details,
)
from sentry.testutils.cases import TestCase
from sentry.viewer_context import (
    Actor,
    ActorType,
    ViewerContext,
    decode_viewer_context,
    viewer_context_scope,
)


class MakeGenerateExternalIssueDetailsRequestTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()

    @override_settings(SEER_API_SHARED_SECRET="viewer-context-test-secret")
    @patch("sentry.seer.signed_seer_api.seer_autofix_default_connection_pool.urlopen")
    def test_successful_generation(self, mock_urlopen: MagicMock) -> None:
        event = MagicMock(interfaces={})
        context = _build_event_context(self.group, event=event)
        mock_urlopen.return_value = HTTPResponse(
            orjson.dumps(
                {
                    "result": {
                        "title": "Fix NullPointerException in UserService",
                        "description": (
                            "A NullPointerException occurs when accessing user profile data."
                        ),
                    }
                }
            ),
            status=200,
        )

        with viewer_context_scope(
            ViewerContext(
                actor=Actor(type=ActorType.USER, actor_id=self.user.id),
                organization_id=self.group.organization.id,
            )
        ):
            result = _make_generate_external_issue_details_request(
                self.group, event=event, user_id=self.user.id
            )

        assert result is not None
        assert result["title"] == "Fix NullPointerException in UserService"
        assert (
            result["description"]
            == "A NullPointerException occurs when accessing user profile data."
        )
        request = mock_urlopen.call_args
        assert request.args[:2] == ("POST", "/v1/automation/oneshot/run")
        assert request.kwargs["timeout"] == 10
        assert orjson.loads(request.kwargs["body"]) == {
            "oneshot_id": "external_issue_details",
            "payload": {"context": context},
        }
        viewer_context = decode_viewer_context(
            request.kwargs["headers"]["X-Viewer-Context"],
            key="viewer-context-test-secret",
        )
        assert viewer_context == ViewerContext(
            actor=Actor(type=ActorType.USER, actor_id=self.user.id),
            organization_id=self.group.organization.id,
        )

    @patch("sentry.integrations.utils.external_issues.run_oneshot")
    def test_values_are_stripped(self, mock_request: MagicMock) -> None:
        mock_request.return_value = {
            "title": "  Title  ",
            "description": "  Description  ",
        }

        result = _make_generate_external_issue_details_request(self.group)

        assert result is not None
        assert result["title"] == "Title"
        assert result["description"] == "Description"

    @patch("sentry.integrations.utils.external_issues.run_oneshot")
    def test_seer_api_error_raises(self, mock_request: MagicMock) -> None:
        mock_request.side_effect = Exception("Connection error")

        with pytest.raises(Exception, match="Connection error"):
            _make_generate_external_issue_details_request(self.group)

    @patch("sentry.integrations.utils.external_issues.run_oneshot")
    def test_empty_response_returns_none(self, mock_request: MagicMock) -> None:
        mock_request.return_value = {}

        result = _make_generate_external_issue_details_request(self.group)

        assert result is None

    @patch("sentry.integrations.utils.external_issues.run_oneshot")
    def test_context_is_truncated(self, mock_request: MagicMock) -> None:
        mock_request.return_value = {
            "title": "Generated Title",
            "description": "Generated Description",
        }

        group = self.create_group(message="x" * 3000)
        _make_generate_external_issue_details_request(group)

        payload = mock_request.call_args.args[1]
        assert len(payload["context"]) <= MAX_CONTEXT_LENGTH


@override_settings(SENTRY_SELF_HOSTED=False)
class GenerateExternalIssueDetailsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()

    @patch("sentry.integrations.utils.external_issues.run_oneshot")
    def test_feature_flag_disabled_returns_empty(self, mock_request: MagicMock) -> None:
        result = maybe_generate_external_issue_details(group=self.group, user=self.user)

        assert result == GeneratedExternalIssueDetails(title=None, description=None)
        mock_request.assert_not_called()

    @patch("sentry.integrations.utils.external_issues.run_oneshot")
    def test_hide_ai_features_returns_empty(self, mock_request: MagicMock) -> None:
        self.group.organization.update_option("sentry:hide_ai_features", True)

        with self.feature(["organizations:external-issues-ai-generate"]):
            result = maybe_generate_external_issue_details(group=self.group, user=self.user)

        assert result == GeneratedExternalIssueDetails(title=None, description=None)
        mock_request.assert_not_called()

    @override_settings(SENTRY_SELF_HOSTED=True)
    @patch("sentry.integrations.utils.external_issues.run_oneshot")
    def test_self_hosted_returns_empty(self, mock_request: MagicMock) -> None:
        with self.feature("organizations:external-issues-ai-generate"):
            result = maybe_generate_external_issue_details(group=self.group, user=self.user)

        assert result == GeneratedExternalIssueDetails(title=None, description=None)
        mock_request.assert_not_called()

    @patch("sentry.integrations.utils.external_issues.run_oneshot")
    def test_exception_returns_empty(self, mock_request: MagicMock) -> None:
        mock_request.side_effect = Exception("Connection error")

        with self.feature(["organizations:external-issues-ai-generate"]):
            result = maybe_generate_external_issue_details(group=self.group, user=self.user)

        assert result == GeneratedExternalIssueDetails(title=None, description=None)

    @patch("sentry.integrations.utils.external_issues.run_oneshot")
    def test_successful_returns_details(self, mock_request: MagicMock) -> None:
        mock_request.return_value = {"title": "AI Title", "description": "AI Description"}

        with self.feature(["organizations:external-issues-ai-generate"]):
            result = maybe_generate_external_issue_details(group=self.group, user=self.user)

        assert result == GeneratedExternalIssueDetails(
            title="AI Title", description="AI Description"
        )
        mock_request.assert_called_once_with(
            "external_issue_details",
            {"context": _build_event_context(self.group)},
            self.group.organization,
            user_id=self.user.id,
            timeout=10,
        )

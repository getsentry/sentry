from unittest.mock import MagicMock, patch

import pytest

from sentry.integrations.utils.external_issues import (
    MAX_CONTEXT_LENGTH,
    GeneratedExternalIssueDetails,
    _make_generate_external_issue_details_request,
    maybe_generate_external_issue_details,
)
from sentry.testutils.cases import TestCase
from sentry.utils import json


class MakeGenerateExternalIssueDetailsRequestTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()

    @patch("sentry.integrations.utils.external_issues.make_llm_generate_request")
    def test_successful_generation(self, mock_request: MagicMock) -> None:
        mock_response = MagicMock(status=200)
        mock_response.json.return_value = {
            "content": json.dumps(
                {
                    "title": "Fix NullPointerException in UserService",
                    "description": "A NullPointerException occurs when accessing user profile data.",
                }
            )
        }
        mock_request.return_value = mock_response

        result = _make_generate_external_issue_details_request(self.group)

        assert result is not None
        assert result["title"] == "Fix NullPointerException in UserService"
        assert (
            result["description"]
            == "A NullPointerException occurs when accessing user profile data."
        )
        mock_request.assert_called_once()

    @patch("sentry.integrations.utils.external_issues.make_llm_generate_request")
    def test_values_are_stripped(self, mock_request: MagicMock) -> None:
        mock_response = MagicMock(status=200)
        mock_response.json.return_value = {
            "content": json.dumps({"title": "  Title  ", "description": "  Description  "})
        }
        mock_request.return_value = mock_response

        result = _make_generate_external_issue_details_request(self.group)

        assert result is not None
        assert result["title"] == "Title"
        assert result["description"] == "Description"

    @patch("sentry.integrations.utils.external_issues.make_llm_generate_request")
    def test_seer_api_error_raises(self, mock_request: MagicMock) -> None:
        mock_request.side_effect = Exception("Connection error")

        with pytest.raises(Exception, match="Connection error"):
            _make_generate_external_issue_details_request(self.group)

    @patch("sentry.integrations.utils.external_issues.make_llm_generate_request")
    def test_empty_response_returns_none(self, mock_request: MagicMock) -> None:
        mock_response = MagicMock(status=200)
        mock_response.json.return_value = {"content": None}
        mock_request.return_value = mock_response

        result = _make_generate_external_issue_details_request(self.group)

        assert result is None

    @patch("sentry.integrations.utils.external_issues.make_llm_generate_request")
    def test_seer_returns_400(self, mock_request: MagicMock) -> None:
        mock_response = MagicMock(status=400)
        mock_request.return_value = mock_response

        result = _make_generate_external_issue_details_request(self.group)

        assert result is None

    @patch("sentry.integrations.utils.external_issues.make_llm_generate_request")
    def test_context_is_truncated(self, mock_request: MagicMock) -> None:
        mock_response = MagicMock(status=200)
        mock_response.json.return_value = {
            "content": json.dumps(
                {"title": "Generated Title", "description": "Generated Description"}
            )
        }
        mock_request.return_value = mock_response

        group = self.create_group(message="x" * 3000)
        _make_generate_external_issue_details_request(group)

        call_args = mock_request.call_args
        request_body = call_args.args[0]
        prompt_prefix = "Generate a title and description for this Sentry error:\n\n"
        assert len(request_body["prompt"]) <= MAX_CONTEXT_LENGTH + len(prompt_prefix)


class GenerateExternalIssueDetailsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()

    @patch("sentry.integrations.utils.external_issues.make_llm_generate_request")
    def test_feature_flag_disabled_returns_empty(self, mock_request: MagicMock) -> None:
        result = maybe_generate_external_issue_details(group=self.group, user=self.user)

        assert result == GeneratedExternalIssueDetails(title=None, description=None)
        mock_request.assert_not_called()

    @patch("sentry.integrations.utils.external_issues.make_llm_generate_request")
    def test_hide_ai_features_returns_empty(self, mock_request: MagicMock) -> None:
        self.group.organization.update_option("sentry:hide_ai_features", True)

        with self.feature(
            ["organizations:gen-ai-features", "organizations:external-issues-ai-generate"]
        ):
            result = maybe_generate_external_issue_details(group=self.group, user=self.user)

        assert result == GeneratedExternalIssueDetails(title=None, description=None)
        mock_request.assert_not_called()

    @patch("sentry.integrations.utils.external_issues.make_llm_generate_request")
    def test_gen_ai_features_disabled_returns_empty(self, mock_request: MagicMock) -> None:
        with self.feature("organizations:external-issues-ai-generate"):
            result = maybe_generate_external_issue_details(group=self.group, user=self.user)

        assert result == GeneratedExternalIssueDetails(title=None, description=None)
        mock_request.assert_not_called()

    @patch("sentry.integrations.utils.external_issues.make_llm_generate_request")
    def test_exception_returns_empty(self, mock_request: MagicMock) -> None:
        mock_request.side_effect = Exception("Connection error")

        with self.feature(
            ["organizations:gen-ai-features", "organizations:external-issues-ai-generate"]
        ):
            result = maybe_generate_external_issue_details(group=self.group, user=self.user)

        assert result == GeneratedExternalIssueDetails(title=None, description=None)

    @patch("sentry.integrations.utils.external_issues.make_llm_generate_request")
    def test_successful_returns_details(self, mock_request: MagicMock) -> None:
        mock_response = MagicMock(status=200)
        mock_response.json.return_value = {
            "content": json.dumps({"title": "AI Title", "description": "AI Description"})
        }
        mock_request.return_value = mock_response

        with self.feature(
            ["organizations:gen-ai-features", "organizations:external-issues-ai-generate"]
        ):
            result = maybe_generate_external_issue_details(group=self.group, user=self.user)

        assert result == GeneratedExternalIssueDetails(
            title="AI Title", description="AI Description"
        )

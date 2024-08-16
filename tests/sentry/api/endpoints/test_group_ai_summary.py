from unittest.mock import ANY, Mock, patch

from sentry.api.endpoints.group_ai_summary import SummarizeIssueResponse
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@apply_feature_flag_on_cls("organizations:ai-summary")
class GroupAiSummaryEndpointTest(APITestCase, SnubaTestCase):
    def _get_url(self, group_id: int):
        return f"/api/0/issues/{group_id}/summarize/"

    @patch("sentry.api.endpoints.group_ai_summary.GroupAiSummaryEndpoint._call_seer")
    @patch("sentry.api.endpoints.group_ai_summary.cache")
    def test_ai_summary_get_endpoint_with_existing_summary(self, mock_cache, mock_call_seer):
        group = self.create_group()
        existing_summary = {
            "group_id": str(group.id),
            "summary": "Existing summary",
            "impact": "Existing impact",
            "headline": "Existing headline",
        }

        mock_cache.has_key.return_value = True
        mock_cache.get.return_value = existing_summary

        self.login_as(user=self.user)
        response = self.client.post(self._get_url(group.id), format="json")

        assert response.status_code == 200
        assert response.data == convert_dict_key_case(existing_summary, snake_to_camel_case)
        mock_call_seer.assert_not_called()

    @patch("sentry.api.endpoints.group_ai_summary.GroupAiSummaryEndpoint._get_event")
    @patch("sentry.api.endpoints.group_ai_summary.cache")
    def test_ai_summary_get_endpoint_without_event(self, mock_cache, mock_get_event):
        mock_get_event.return_value = None
        group = self.create_group()

        mock_cache.has_key.return_value = False

        self.login_as(user=self.user)
        response = self.client.post(self._get_url(group.id), format="json")

        assert response.status_code == 400
        assert response.data == {"detail": "Could not find an event for the issue"}
        mock_cache.set.assert_not_called()

    @patch("sentry.api.endpoints.group_ai_summary.GroupAiSummaryEndpoint._call_seer")
    @patch("sentry.api.endpoints.group_ai_summary.GroupAiSummaryEndpoint._get_event")
    @patch("sentry.api.endpoints.group_ai_summary.cache")
    def test_ai_summary_get_endpoint_without_existing_summary(
        self, mock_cache, mock_get_event, mock_call_seer
    ):
        group = self.create_group()
        mock_event = {"id": "test_event_id", "data": "test_event_data"}
        mock_get_event.return_value = mock_event
        mock_summary = SummarizeIssueResponse(
            group_id=str(group.id),
            summary="Test summary",
            impact="Test impact",
            headline="Test headline",
        )
        mock_call_seer.return_value = mock_summary

        mock_cache.has_key.return_value = False

        self.login_as(user=self.user)
        response = self.client.post(self._get_url(group.id), format="json")

        assert response.status_code == 200
        assert response.data == convert_dict_key_case(mock_summary.dict(), snake_to_camel_case)
        mock_get_event.assert_called_once_with(group, ANY)
        mock_call_seer.assert_called_once_with(group, mock_event)
        mock_cache.set.assert_called_once_with(
            f"ai-group-summary:{group.id}",
            mock_summary.dict(),
            timeout=60 * 60 * 24 * 7,  # 7 days
        )

    @patch("sentry.api.endpoints.group_ai_summary.requests.post")
    @patch("sentry.api.endpoints.group_ai_summary.GroupAiSummaryEndpoint._get_event")
    @patch("sentry.api.endpoints.group_ai_summary.cache")
    def test_ai_summary_call_seer(self, mock_cache, mock_get_event, mock_post):
        group = self.create_group()
        serialized_event = {"id": "test_event_id", "data": "test_event_data"}
        mock_get_event.return_value = serialized_event
        mock_response = Mock()
        mock_response.json.return_value = {
            "group_id": str(group.id),
            "summary": "Test summary",
            "impact": "Test impact",
            "headline": "Test headline",
        }
        mock_post.return_value = mock_response

        mock_cache.has_key.return_value = False

        self.login_as(user=self.user)
        response = self.client.post(self._get_url(group.id), format="json")

        assert response.status_code == 200
        assert response.data == convert_dict_key_case(
            mock_response.json.return_value, snake_to_camel_case
        )
        mock_post.assert_called_once()
        mock_cache.set.assert_called_once_with(
            f"ai-group-summary:{group.id}",
            mock_response.json.return_value,
            timeout=60 * 60 * 24 * 7,  # 7 days
        )

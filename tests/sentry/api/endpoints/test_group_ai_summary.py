from unittest.mock import ANY, Mock, patch

from sentry.api.endpoints.group_ai_summary import SummarizeIssueResponse
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.skips import requires_snuba
from sentry.utils.cache import cache

pytestmark = [requires_snuba]


@apply_feature_flag_on_cls("organizations:ai-summary")
class GroupAiSummaryEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.group = self.create_group()
        self.url = self._get_url(self.group.id)
        self.login_as(user=self.user)

    def tearDown(self):
        super().tearDown()
        # Clear the cache after each test
        cache.delete(f"ai-group-summary:{self.group.id}")

    def _get_url(self, group_id: int):
        return f"/api/0/issues/{group_id}/summarize/"

    @patch("sentry.api.endpoints.group_ai_summary.GroupAiSummaryEndpoint._call_seer")
    def test_ai_summary_get_endpoint_with_existing_summary(self, mock_call_seer):
        existing_summary = {
            "group_id": str(self.group.id),
            "summary": "Existing summary",
            "impact": "Existing impact",
            "headline": "Existing headline",
        }

        # Set the cache with the existing summary
        cache.set(f"ai-group-summary:{self.group.id}", existing_summary, timeout=60 * 60 * 24 * 7)

        response = self.client.post(self.url, format="json")

        assert response.status_code == 200
        assert response.data == convert_dict_key_case(existing_summary, snake_to_camel_case)
        mock_call_seer.assert_not_called()

    @patch("sentry.api.endpoints.group_ai_summary.GroupAiSummaryEndpoint._get_event")
    def test_ai_summary_get_endpoint_without_event(self, mock_get_event):
        mock_get_event.return_value = None

        response = self.client.post(self.url, format="json")

        assert response.status_code == 400
        assert response.data == {"detail": "Could not find an event for the issue"}
        assert cache.get(f"ai-group-summary:{self.group.id}") is None

    @patch("sentry.api.endpoints.group_ai_summary.GroupAiSummaryEndpoint._call_seer")
    @patch("sentry.api.endpoints.group_ai_summary.GroupAiSummaryEndpoint._get_event")
    def test_ai_summary_get_endpoint_without_existing_summary(self, mock_get_event, mock_call_seer):
        mock_event = {"id": "test_event_id", "data": "test_event_data"}
        mock_get_event.return_value = mock_event
        mock_summary = SummarizeIssueResponse(
            group_id=str(self.group.id),
            summary="Test summary",
            impact="Test impact",
            headline="Test headline",
        )
        mock_call_seer.return_value = mock_summary

        response = self.client.post(self.url, format="json")

        assert response.status_code == 200
        assert response.data == convert_dict_key_case(mock_summary.dict(), snake_to_camel_case)
        mock_get_event.assert_called_once_with(self.group, ANY)
        mock_call_seer.assert_called_once_with(self.group, mock_event)

        # Check if the cache was set correctly
        cached_summary = cache.get(f"ai-group-summary:{self.group.id}")
        assert cached_summary == mock_summary.dict()

    @patch("sentry.api.endpoints.group_ai_summary.requests.post")
    @patch("sentry.api.endpoints.group_ai_summary.GroupAiSummaryEndpoint._get_event")
    def test_ai_summary_call_seer(self, mock_get_event, mock_post):
        serialized_event = {"id": "test_event_id", "data": "test_event_data"}
        mock_get_event.return_value = serialized_event
        mock_response = Mock()
        mock_response.json.return_value = {
            "group_id": str(self.group.id),
            "summary": "Test summary",
            "impact": "Test impact",
            "headline": "Test headline",
        }
        mock_post.return_value = mock_response

        response = self.client.post(self.url, format="json")

        assert response.status_code == 200
        assert response.data == convert_dict_key_case(
            mock_response.json.return_value, snake_to_camel_case
        )
        mock_post.assert_called_once()

        assert cache.get(f"ai-group-summary:{self.group.id}") == mock_response.json.return_value

    def test_ai_summary_cache_write_read(self):
        # First request to populate the cache
        with (
            patch(
                "sentry.api.endpoints.group_ai_summary.GroupAiSummaryEndpoint._get_event"
            ) as mock_get_event,
            patch(
                "sentry.api.endpoints.group_ai_summary.GroupAiSummaryEndpoint._call_seer"
            ) as mock_call_seer,
        ):
            mock_event = {"id": "test_event_id", "data": "test_event_data"}
            mock_get_event.return_value = mock_event

            mock_summary = SummarizeIssueResponse(
                group_id=str(self.group.id),
                summary="Test summary",
                impact="Test impact",
                headline="Test headline",
            )
            mock_call_seer.return_value = mock_summary

            response = self.client.post(self.url, format="json")
            assert response.status_code == 200
            assert response.data == convert_dict_key_case(mock_summary.dict(), snake_to_camel_case)

        # Second request should use cached data
        with (
            patch(
                "sentry.api.endpoints.group_ai_summary.GroupAiSummaryEndpoint._get_event"
            ) as mock_get_event,
            patch(
                "sentry.api.endpoints.group_ai_summary.GroupAiSummaryEndpoint._call_seer"
            ) as mock_call_seer,
        ):
            response = self.client.post(self.url, format="json")
            assert response.status_code == 200
            assert response.data == convert_dict_key_case(mock_summary.dict(), snake_to_camel_case)

            # Verify that _get_event and _call_seer were not called for the second request
            mock_get_event.assert_not_called()
            mock_call_seer.assert_not_called()

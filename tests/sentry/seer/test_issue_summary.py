import datetime
from unittest.mock import ANY, Mock, call, patch

import orjson

from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.seer.issue_summary import (
    _call_seer,
    _get_event,
    _get_trace_connected_issues,
    get_issue_summary,
)
from sentry.seer.models import SummarizeIssueResponse, SummarizeIssueScores
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.skips import requires_snuba
from sentry.utils.cache import cache

pytestmark = [requires_snuba]


@apply_feature_flag_on_cls("organizations:gen-ai-features")
class IssueSummaryTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.group = self.create_group()
        self.login_as(user=self.user)

    def tearDown(self):
        super().tearDown()
        # Clear the cache after each test
        cache.delete(f"ai-group-summary-v2:{self.group.id}")

    @patch("sentry.seer.issue_summary._call_seer")
    def test_get_issue_summary_with_existing_summary(self, mock_call_seer):
        existing_summary = {
            "group_id": str(self.group.id),
            "headline": "Existing headline",
            "whats_wrong": "Existing whats wrong",
            "trace": "Existing trace",
            "possible_cause": "Existing possible cause",
            "scores": {
                "possible_cause_confidence": 0.9,
                "possible_cause_novelty": 0.8,
            },
        }

        # Set the cache with the existing summary
        cache.set(
            f"ai-group-summary-v2:{self.group.id}", existing_summary, timeout=60 * 60 * 24 * 7
        )

        summary_data, status_code = get_issue_summary(self.group, self.user)

        assert status_code == 200
        assert summary_data == convert_dict_key_case(existing_summary, snake_to_camel_case)
        mock_call_seer.assert_not_called()

    @patch("sentry.seer.issue_summary._get_event")
    def test_get_issue_summary_without_event(self, mock_get_event):
        mock_get_event.return_value = [None, None]

        summary_data, status_code = get_issue_summary(self.group, self.user)

        assert status_code == 400
        assert summary_data == {"detail": "Could not find an event for the issue"}
        assert cache.get(f"ai-group-summary-v2:{self.group.id}") is None

    @patch("sentry.seer.issue_summary._get_trace_connected_issues")
    @patch("sentry.seer.issue_summary._call_seer")
    @patch("sentry.seer.issue_summary._get_event")
    def test_get_issue_summary_without_existing_summary(
        self, mock_get_event, mock_call_seer, mock_get_connected_issues
    ):
        event = Mock(
            event_id="test_event_id",
            data="test_event_data",
            trace_id="test_trace",
            datetime=datetime.datetime.now(),
        )
        serialized_event = {"event_id": "test_event_id", "data": "test_event_data"}
        mock_get_event.return_value = [serialized_event, event]
        mock_summary = SummarizeIssueResponse(
            group_id=str(self.group.id),
            headline="Test headline",
            whats_wrong="Test whats wrong",
            trace="Test trace",
            possible_cause="Test possible cause",
            scores=SummarizeIssueScores(
                possible_cause_confidence=0.0,
                possible_cause_novelty=0.0,
            ),
        )
        mock_call_seer.return_value = mock_summary
        mock_get_connected_issues.return_value = [self.group, self.group]

        expected_response_summary = mock_summary.dict()
        expected_response_summary["event_id"] = event.event_id

        summary_data, status_code = get_issue_summary(self.group, self.user)

        assert status_code == 200
        assert summary_data == convert_dict_key_case(expected_response_summary, snake_to_camel_case)
        mock_get_event.assert_called_with(self.group, ANY)
        assert mock_get_event.call_count == 3
        mock_call_seer.assert_called_once_with(
            self.group,
            serialized_event,
            [self.group, self.group],
            [serialized_event, serialized_event],
        )

        # Check if the cache was set correctly
        cached_summary = cache.get(f"ai-group-summary-v2:{self.group.id}")
        assert cached_summary == expected_response_summary

    @patch("sentry.seer.issue_summary.requests.post")
    @patch("sentry.seer.issue_summary._get_event")
    def test_call_seer_integration(self, mock_get_event, mock_post):
        event = Mock(
            event_id="test_event_id",
            data="test_event_data",
            trace_id=None,
            datetime=datetime.datetime.now(),
        )
        serialized_event = {"event_id": "test_event_id", "data": "test_event_data"}
        mock_get_event.return_value = [serialized_event, event]
        mock_response = Mock()
        mock_response.json.return_value = {
            "group_id": str(self.group.id),
            "whats_wrong": "Test whats wrong",
            "trace": "Test trace",
            "possible_cause": "Test possible cause",
            "headline": "Test headline",
            "scores": {
                "possible_cause_confidence": 0.9,
                "possible_cause_novelty": 0.8,
                "fixability_score": 0.5,
                "is_fixable": True,
                "fixability_score_version": 1,
            },
        }
        mock_post.return_value = mock_response

        expected_response_summary = mock_response.json.return_value
        expected_response_summary["event_id"] = event.event_id

        summary_data, status_code = get_issue_summary(self.group, self.user)

        assert status_code == 200
        assert summary_data == convert_dict_key_case(expected_response_summary, snake_to_camel_case)
        mock_post.assert_called_once()

        assert cache.get(f"ai-group-summary-v2:{self.group.id}") == expected_response_summary

    @patch("sentry.seer.issue_summary.get_issue_summary")
    def test_get_issue_summary_cache_write_read(self, mock_get_issue_summary):
        # First request to populate the cache
        mock_get_event = Mock()
        mock_call_seer = Mock()

        event = Mock(
            event_id="test_event_id",
            data="test_event_data",
            trace_id=None,
            datetime=datetime.datetime.now(),
        )
        serialized_event = {"event_id": "test_event_id", "data": "test_event_data"}
        mock_get_event.return_value = [serialized_event, event]

        mock_summary = SummarizeIssueResponse(
            group_id=str(self.group.id),
            whats_wrong="Test whats wrong",
            trace="Test trace",
            possible_cause="Test possible cause",
            headline="Test headline",
        )
        mock_call_seer.return_value = mock_summary

        # Set up the cache with the test data
        expected_response_summary = mock_summary.dict()
        expected_response_summary["event_id"] = event.event_id

        cache.set(
            f"ai-group-summary-v2:{self.group.id}",
            expected_response_summary,
            timeout=60 * 60 * 24 * 7,
        )

        # Test the cache hit
        with (
            patch("sentry.seer.issue_summary._get_event") as mock_get_event,
            patch("sentry.seer.issue_summary._call_seer") as mock_call_seer,
        ):
            summary_data, status_code = get_issue_summary(self.group, self.user)

            assert status_code == 200
            assert summary_data == convert_dict_key_case(
                expected_response_summary, snake_to_camel_case
            )

            # Verify that _get_event and _call_seer were not called due to cache hit
            mock_get_event.assert_not_called()
            mock_call_seer.assert_not_called()

    def test_call_seer_payload(self):
        with (
            patch("sentry.seer.issue_summary.requests.post") as mock_post,
            patch("sentry.seer.issue_summary.sign_with_seer_secret") as mock_sign,
        ):
            serialized_event = {
                "event_id": "test_event_id",
                "data": "test_event_data",
                "project_id": self.project.id,
            }
            connected_groups = []
            connected_serialized_events = []

            mock_sign.return_value = {"Authorization": "Bearer test_token"}
            mock_post.return_value.json.return_value = {
                "group_id": str(self.group.id),
                "whats_wrong": "Test whats wrong",
                "trace": "Test trace",
                "possible_cause": "Test possible cause",
                "headline": "Test headline",
                "scores": {
                    "possible_cause_confidence": 0.9,
                    "possible_cause_novelty": 0.8,
                },
            }

            _call_seer(self.group, serialized_event, connected_groups, connected_serialized_events)

            expected_payload = {
                "group_id": self.group.id,
                "issue": {
                    "id": self.group.id,
                    "title": self.group.title,
                    "short_id": self.group.qualified_short_id,
                    "events": [serialized_event],
                },
                "connected_issues": [],
                "organization_slug": self.group.organization.slug,
                "organization_id": self.group.organization.id,
                "project_id": self.group.project.id,
            }

            mock_post.assert_called_once()
            actual_payload = orjson.loads(mock_post.call_args[1]["data"])
            assert actual_payload == expected_payload

            # Check headers
            headers = mock_post.call_args[1]["headers"]
            assert headers["content-type"] == "application/json;charset=utf-8"
            assert headers["Authorization"] == "Bearer test_token"

    @patch("sentry.seer.issue_summary.Project.objects.filter")
    @patch("sentry.seer.issue_summary.eventstore.backend.get_events")
    def test_get_trace_connected_issues(self, mock_get_events, mock_project_filter):
        event = Mock()
        event.trace_id = "test_trace_id"
        event.datetime = datetime.datetime.now()
        event.group.organization.id = 1

        mock_project_filter.return_value.values_list.return_value = [
            (1, "project1"),
            (2, "project2"),
        ]

        # connected events
        mock_event1 = Mock(
            event_id="1",
            group_id=1,
            group=Mock(),
            datetime=event.datetime - datetime.timedelta(minutes=5),
        )
        mock_event2 = Mock(
            event_id="2",
            group_id=2,
            group=Mock(),
            datetime=event.datetime + datetime.timedelta(minutes=5),
        )
        mock_get_events.return_value = [mock_event1, mock_event2]

        result = _get_trace_connected_issues(event)

        assert len(result) == 2
        assert mock_event1.group in result
        assert mock_event2.group in result

        mock_project_filter.assert_called_once()
        mock_get_events.assert_called_once()

        _, kwargs = mock_get_events.call_args
        assert kwargs["filter"].conditions == [["trace", "=", "test_trace_id"]]
        assert kwargs["filter"].project_ids == [1, 2]
        assert kwargs["referrer"] == "api.group_ai_summary"
        assert kwargs["tenant_ids"] == {"organization_id": 1}

    def test_get_trace_connected_issues_no_trace_id(self):
        event = Mock()
        event.trace_id = None
        result = _get_trace_connected_issues(event)
        assert result == []

    @patch("sentry.seer.issue_summary.eventstore.backend.get_event_by_id")
    @patch("sentry.seer.issue_summary.serialize")
    def test_get_event_no_recommended(self, mock_serialize, mock_get_event_by_id):
        mock_group = Mock()
        mock_event = Mock()
        mock_user = Mock()
        mock_event.event_id = "test_event_id"
        mock_group.get_recommended_event_for_environments.return_value = None
        mock_group.get_latest_event.return_value = mock_event
        mock_group.project.id = "test_project_id"
        mock_group.id = "test_group_id"

        mock_ready_event = Mock()
        mock_get_event_by_id.return_value = mock_ready_event

        mock_serialized_event = {"serialized": "event"}
        mock_serialize.return_value = mock_serialized_event

        result = _get_event(mock_group, mock_user)

        assert result == (mock_serialized_event, mock_event)
        mock_group.get_recommended_event_for_environments.assert_called_once()
        mock_group.get_latest_event.assert_called_once()
        mock_get_event_by_id.assert_called_once_with(
            "test_project_id", "test_event_id", group_id="test_group_id"
        )
        mock_serialize.assert_called_once()

    @patch("sentry.seer.issue_summary.eventstore.backend.get_event_by_id")
    def test_get_event_recommended_first(self, mock_get_event_by_id):
        mock_group = Mock()
        mock_event = Mock()
        mock_user = Mock()
        mock_event.event_id = "test_event_id"
        mock_group.get_recommended_event_for_environments.return_value = mock_event
        mock_group.project.id = "test_project_id"
        mock_group.id = "test_group_id"

        mock_get_event_by_id.return_value = None

        result = _get_event(mock_group, mock_user)

        assert result == (None, None)
        mock_group.get_recommended_event_for_environments.assert_called_once()
        mock_group.get_latest_event.assert_not_called()
        mock_get_event_by_id.assert_called_once_with(
            "test_project_id", "test_event_id", group_id="test_group_id"
        )

    @patch("sentry.seer.issue_summary.eventstore.backend.get_event_by_id")
    def test_get_event_none_found(self, mock_get_event_by_id):
        mock_group = Mock()
        mock_user = Mock()
        mock_group.get_recommended_event_for_environments.return_value = None
        mock_group.get_latest_event.return_value = None
        mock_group.project.id = "test_project_id"
        mock_group.id = "test_group_id"

        mock_get_event_by_id.return_value = None

        result = _get_event(mock_group, mock_user)

        assert result == (None, None)
        mock_group.get_recommended_event_for_environments.assert_called_once()
        mock_group.get_latest_event.assert_called_once()
        mock_get_event_by_id.assert_not_called()

    @patch("sentry.seer.issue_summary.eventstore.backend.get_event_by_id")
    @patch("sentry.seer.issue_summary.serialize")
    def test_get_event_provided(self, mock_serialize, mock_get_event_by_id):
        mock_group = Mock()
        mock_event = Mock()
        mock_user = Mock()
        mock_event.event_id = "test_event_id"
        mock_group.project.id = "test_project_id"
        mock_group.id = "test_group_id"

        mock_get_event_by_id.return_value = mock_event

        mock_serialized_event = {"serialized": "event"}
        mock_serialize.return_value = mock_serialized_event

        result = _get_event(mock_group, mock_user, provided_event_id="test_event_id")

        assert result == (mock_serialized_event, mock_event)
        mock_group.get_recommended_event_for_environments.assert_not_called()
        mock_group.get_latest_event.assert_not_called()
        mock_get_event_by_id.assert_has_calls(
            [
                call("test_project_id", "test_event_id", group_id="test_group_id"),
                call("test_project_id", "test_event_id", group_id="test_group_id"),
            ]
        )
        mock_serialize.assert_called_once()

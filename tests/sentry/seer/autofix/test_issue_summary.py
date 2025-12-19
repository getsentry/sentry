import datetime
import threading
import time
from unittest.mock import MagicMock, Mock, call, patch

import orjson
import pytest
from django.conf import settings

from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.issues.grouptype import WebVitalsGroup
from sentry.issues.ingest import save_issue_occurrence
from sentry.locks import locks
from sentry.seer.autofix.constants import SeerAutomationSource
from sentry.seer.autofix.issue_summary import (
    _apply_user_preference_upper_bound,
    _call_seer,
    _fetch_user_preference,
    _get_event,
    _get_stopping_point_from_fixability,
    get_and_update_group_fixability_score,
    get_issue_summary,
    run_automation,
)
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.models import (
    FixabilitySummaryPayload,
    SummarizeIssueResponse,
    SummarizeIssueScores,
)
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.skips import requires_snuba
from sentry.utils.cache import cache
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import OccurrenceTestMixin

pytestmark = [requires_snuba]


@with_feature("organizations:gen-ai-features")
class IssueSummaryTest(APITestCase, SnubaTestCase, OccurrenceTestMixin):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.login_as(user=self.user)

    def tearDown(self) -> None:
        super().tearDown()
        # Clear the cache after each test
        cache.delete(f"ai-group-summary-v2:{self.group.id}")

    @patch("sentry.seer.autofix.issue_summary.get_seer_org_acknowledgement")
    @patch("sentry.seer.autofix.issue_summary._call_seer")
    def test_get_issue_summary_with_existing_summary(
        self, mock_call_seer, mock_get_acknowledgement
    ):
        mock_get_acknowledgement.return_value = True
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
        mock_get_acknowledgement.assert_called_once_with(self.group.organization)

    @patch("sentry.seer.autofix.issue_summary.get_seer_org_acknowledgement")
    @patch("sentry.seer.autofix.issue_summary._get_event")
    def test_get_issue_summary_without_event(
        self, mock_get_event: MagicMock, mock_get_acknowledgement: MagicMock
    ) -> None:
        mock_get_acknowledgement.return_value = True
        mock_get_event.return_value = [None, None]

        summary_data, status_code = get_issue_summary(self.group, self.user)

        assert status_code == 400
        assert summary_data == {"detail": "Could not find an event for the issue"}
        assert cache.get(f"ai-group-summary-v2:{self.group.id}") is None
        mock_get_acknowledgement.assert_called_once_with(self.group.organization)

    @patch("sentry.seer.autofix.issue_summary.get_seer_org_acknowledgement")
    @patch("sentry.seer.autofix.issue_summary._get_trace_tree_for_event")
    @patch("sentry.seer.autofix.issue_summary._call_seer")
    @patch("sentry.seer.autofix.issue_summary._get_event")
    def test_get_issue_summary_without_existing_summary(
        self, mock_get_event, mock_call_seer, mock_get_trace_tree, mock_get_acknowledgement
    ):
        mock_get_acknowledgement.return_value = True
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
        mock_get_trace_tree.return_value = {"trace": "tree"}

        expected_response_summary = mock_summary.dict()
        expected_response_summary["event_id"] = event.event_id

        summary_data, status_code = get_issue_summary(self.group, self.user)

        assert status_code == 200
        assert summary_data == convert_dict_key_case(expected_response_summary, snake_to_camel_case)
        mock_get_event.assert_called_once_with(self.group, self.user, provided_event_id=None)
        mock_get_trace_tree.assert_called_once()
        mock_call_seer.assert_called_once_with(self.group, serialized_event, {"trace": "tree"})
        mock_get_acknowledgement.assert_called_once_with(self.group.organization)

        # Check if the cache was set correctly
        cached_summary = cache.get(f"ai-group-summary-v2:{self.group.id}")
        assert cached_summary == expected_response_summary

    def test_get_issue_summary_without_ai_acknowledgement(self) -> None:
        with patch(
            "sentry.seer.autofix.issue_summary.get_seer_org_acknowledgement"
        ) as mock_get_acknowledgement:
            mock_get_acknowledgement.return_value = False

            summary_data, status_code = get_issue_summary(self.group, self.user)

            assert status_code == 403
            assert summary_data == {
                "detail": "AI Autofix has not been acknowledged by the organization."
            }
            mock_get_acknowledgement.assert_called_once_with(self.group.organization)

    @patch("sentry.seer.autofix.issue_summary.requests.post")
    @patch("sentry.seer.autofix.issue_summary._get_event")
    @patch("sentry.seer.autofix.issue_summary.get_seer_org_acknowledgement")
    def test_call_seer_integration(
        self, mock_get_acknowledgement: MagicMock, mock_get_event: MagicMock, mock_post: MagicMock
    ) -> None:
        mock_get_acknowledgement.return_value = True
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
        payload = orjson.loads(mock_post.call_args_list[0].kwargs["data"])
        assert payload["trace_tree"] is None
        mock_get_acknowledgement.assert_called_once_with(self.group.organization)

        assert cache.get(f"ai-group-summary-v2:{self.group.id}") == expected_response_summary

    @patch("sentry.seer.autofix.issue_summary.get_issue_summary")
    @patch("sentry.seer.autofix.issue_summary.get_seer_org_acknowledgement")
    def test_get_issue_summary_cache_write_read(
        self, mock_get_acknowledgement, mock_get_issue_summary
    ):
        mock_get_acknowledgement.return_value = True
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
            patch("sentry.seer.autofix.issue_summary._get_event") as mock_get_event,
            patch("sentry.seer.autofix.issue_summary._call_seer") as mock_call_seer,
        ):
            summary_data, status_code = get_issue_summary(self.group, self.user)

            assert status_code == 200
            assert summary_data == convert_dict_key_case(
                expected_response_summary, snake_to_camel_case
            )

            # Verify that _get_event and _call_seer were not called due to cache hit
            mock_get_event.assert_not_called()
            mock_call_seer.assert_not_called()
            mock_get_acknowledgement.assert_called_with(self.group.organization)

    @patch("sentry.seer.autofix.issue_summary._generate_summary")
    @patch("sentry.seer.autofix.issue_summary.get_seer_org_acknowledgement")
    def test_get_issue_summary_concurrent_wait_for_lock(
        self, mock_get_acknowledgement, mock_generate_summary
    ):
        """Test that a second request waits for the lock and reads from cache."""
        mock_get_acknowledgement.return_value = True
        cache_key = f"ai-group-summary-v2:{self.group.id}"

        # Mock summary generation to take time and cache the result
        generated_summary = {"headline": "Generated Summary", "event_id": "gen_event"}
        cache_key = f"ai-group-summary-v2:{self.group.id}"

        def side_effect_generate(*args, **kwargs):
            # Simulate work
            time.sleep(0.3)
            # Write to cache before returning (simulates behavior after lock release)
            cache.set(cache_key, generated_summary, timeout=60)
            return generated_summary, 200

        mock_generate_summary.side_effect = side_effect_generate

        results = {}
        exceptions = {}

        def target(req_id):
            try:
                summary_data, status_code = get_issue_summary(self.group, self.user)
                results[req_id] = (summary_data, status_code)
            except Exception as e:
                exceptions[req_id] = e

        # Start two threads concurrently
        thread1 = threading.Thread(target=target, args=(1,))
        thread2 = threading.Thread(target=target, args=(2,))

        thread1.start()
        # Give thread1 a slight head start, but the lock should handle the race
        time.sleep(0.01)
        thread2.start()

        # Wait for both threads to complete
        thread1.join(timeout=5)
        thread2.join(timeout=5)

        # Assertions
        if exceptions:
            raise AssertionError(f"Threads raised exceptions: {exceptions}")

        assert 1 in results, "Thread 1 did not complete in time"
        assert 2 in results, "Thread 2 did not complete in time"

        # Both should succeed and get the same summary
        assert results[1][1] == 200, f"Thread 1 failed with status {results[1][1]}"
        assert results[2][1] == 200, f"Thread 2 failed with status {results[2][1]}"
        expected_result = convert_dict_key_case(generated_summary, snake_to_camel_case)
        assert results[1][0] == expected_result, "Thread 1 returned wrong summary"
        assert results[2][0] == expected_result, "Thread 2 returned wrong summary"

        # Check that _generate_summary was only called once
        # (by the thread that acquired the lock)
        mock_generate_summary.assert_called_once()

        # Ensure the cache contains the final result
        assert cache.get(cache_key) == generated_summary

    @patch("sentry.seer.autofix.issue_summary._generate_summary")
    @patch("sentry.seer.autofix.issue_summary.get_seer_org_acknowledgement")
    def test_get_issue_summary_concurrent_force_event_id_bypasses_lock(
        self, mock_get_acknowledgement, mock_generate_summary
    ):
        """Test that force_event_id bypasses lock waiting."""
        mock_get_acknowledgement.return_value = True
        # Mock summary generation
        forced_summary = {"headline": "Forced Summary", "event_id": "force_event"}
        mock_generate_summary.return_value = (forced_summary, 200)

        # Ensure cache is empty and lock *could* be acquired if attempted
        cache_key = f"ai-group-summary-v2:{self.group.id}"
        lock_key = f"ai-group-summary-v2-lock:{self.group.id}"
        cache.delete(cache_key)

        locks.get(lock_key, duration=1).release()  # Ensure lock isn't held

        # Call with force_event_id=True
        summary_data, status_code = get_issue_summary(
            self.group, self.user, force_event_id="some_event"
        )

        assert status_code == 200
        assert summary_data == convert_dict_key_case(forced_summary, snake_to_camel_case)

        # Ensure generation was called directly
        mock_generate_summary.assert_called_once()
        mock_get_acknowledgement.assert_called_once_with(self.group.organization)

    @patch("sentry.seer.autofix.issue_summary.sign_with_seer_secret", return_value={})
    @patch("sentry.seer.autofix.issue_summary.requests.post")
    def test_call_seer_routes_to_summarization_url(self, post: MagicMock, _sign: MagicMock) -> None:
        resp = Mock()
        resp.json.return_value = {
            "group_id": str(self.group.id),
            "whats_wrong": "w",
            "trace": "t",
            "possible_cause": "c",
            "headline": "h",
            "scores": {},
        }
        resp.raise_for_status = Mock()
        post.return_value = resp

        result = _call_seer(self.group, {"event_id": "e1"}, {"trace": "tree"})

        assert result.group_id == str(self.group.id)
        assert post.call_count == 1
        assert (
            post.call_args_list[0]
            .args[0]
            .startswith(f"{settings.SEER_SUMMARIZATION_URL}/v1/automation/summarize/issue")
        )
        payload = orjson.loads(post.call_args_list[0].kwargs["data"])
        assert payload["trace_tree"] == {"trace": "tree"}
        resp.raise_for_status.assert_called_once()

    @patch("sentry.seer.autofix.issue_summary.sign_with_seer_secret", return_value={})
    @patch(
        "sentry.seer.autofix.issue_summary.requests.post", side_effect=Exception("primary error")
    )
    def test_call_seer_raises_exception_when_endpoint_fails(
        self, post: MagicMock, sign: MagicMock
    ) -> None:
        with pytest.raises(Exception):
            _call_seer(self.group, {"event_id": "e1"}, None)

    @patch("sentry.seer.autofix.issue_summary.cache.get")
    @patch("sentry.seer.autofix.issue_summary._generate_summary")
    @patch("sentry.utils.locking.lock.Lock.blocking_acquire")
    @patch("sentry.seer.autofix.issue_summary.get_seer_org_acknowledgement")
    def test_get_issue_summary_lock_timeout(
        self,
        mock_get_acknowledgement,
        mock_blocking_acquire,
        mock_generate_summary_core,
        mock_cache_get,
    ):
        """Test that a timeout waiting for the lock returns 503."""
        mock_get_acknowledgement.return_value = True
        # Simulate lock acquisition always failing with the specific exception
        mock_blocking_acquire.side_effect = UnableToAcquireLock
        # Simulate cache miss even after timeout
        mock_cache_get.return_value = None

        summary_data, status_code = get_issue_summary(self.group, self.user)

        assert status_code == 503
        assert summary_data == {"detail": "Timeout waiting for summary generation lock"}
        # Ensure lock acquisition was attempted
        mock_blocking_acquire.assert_called_once()
        # Ensure generation was NOT called
        mock_generate_summary_core.assert_not_called()
        # Ensure cache was checked three times (once initially, once after lock failure, and once for hideAiFeatures check)
        assert mock_cache_get.call_count == 3
        mock_get_acknowledgement.assert_called_once_with(self.group.organization)

    @patch("sentry.seer.autofix.issue_summary.eventstore.backend.get_event_by_id")
    @patch("sentry.seer.autofix.issue_summary.serialize")
    def test_get_event_no_recommended(
        self, mock_serialize: MagicMock, mock_get_event_by_id: MagicMock
    ) -> None:
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

    @patch("sentry.seer.autofix.issue_summary.eventstore.backend.get_event_by_id")
    def test_get_event_recommended_first(self, mock_get_event_by_id: MagicMock) -> None:
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

    @patch("sentry.seer.autofix.issue_summary.eventstore.backend.get_event_by_id")
    def test_get_event_none_found(self, mock_get_event_by_id: MagicMock) -> None:
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

    @patch("sentry.seer.autofix.issue_summary.eventstore.backend.get_event_by_id")
    @patch("sentry.seer.autofix.issue_summary.serialize")
    def test_get_event_provided(
        self, mock_serialize: MagicMock, mock_get_event_by_id: MagicMock
    ) -> None:
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
                call(
                    "test_project_id",
                    "test_event_id",
                    group_id="test_group_id",
                ),
                call(
                    "test_project_id",
                    "test_event_id",
                    group_id="test_group_id",
                ),
            ]
        )
        mock_serialize.assert_called_once()

    @patch("sentry.seer.autofix.issue_summary._trigger_autofix_task.delay")
    @patch("sentry.seer.autofix.issue_summary.get_autofix_state")
    @patch("sentry.seer.autofix.issue_summary._generate_fixability_score")
    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.seer.autofix.issue_summary.get_seer_org_acknowledgement")
    @patch("sentry.seer.autofix.issue_summary._get_trace_tree_for_event")
    @patch("sentry.seer.autofix.issue_summary._call_seer")
    @patch("sentry.seer.autofix.issue_summary._get_event")
    def test_get_issue_summary_with_web_vitals_issue(
        self,
        mock_get_event,
        mock_call_seer,
        mock_get_trace_tree,
        mock_get_acknowledgement,
        mock_record_seer_run,
        mock_generate_fixability_score,
        mock_get_autofix_state,
        mock_trigger_autofix_task,
    ):
        mock_get_acknowledgement.return_value = True
        mock_get_autofix_state.return_value = None
        mock_fixability_response = SummarizeIssueResponse(
            group_id=str(self.group.id),
            headline="some headline",
            whats_wrong="some whats wrong",
            trace="some trace",
            possible_cause="some possible cause",
            scores=SummarizeIssueScores(
                fixability_score=0.5,
                is_fixable=True,
            ),
        )
        mock_generate_fixability_score.return_value = mock_fixability_response
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
        mock_get_trace_tree.return_value = {"trace": "tree"}
        # Create an event
        data = load_data("javascript", timestamp=before_now(minutes=1))
        event = self.store_event(data=data, project_id=self.project.id)
        # Create an occurrence to obtain a WebVitalsGroup group
        occurrence_data = self.build_occurrence_data(
            event_id=event.event_id,
            project_id=self.project.id,
            type=WebVitalsGroup.type_id,
            issue_title="LCP score needs improvement",
            subtitle="/test-transaction has an LCP score of 75",
            culprit="/test-transaction",
            evidence_data={
                "transaction": "/test-transaction",
                "vital": "lcp",
                "score": 75,
                "trace_id": "1234567890",
            },
            level="info",
        )

        _, group_info = save_issue_occurrence(occurrence_data, event)
        assert group_info is not None
        self.group = group_info.group

        summary_data, status_code = get_issue_summary(
            self.group, self.user, source=SeerAutomationSource.POST_PROCESS
        )

        assert status_code == 200
        mock_record_seer_run.assert_called_once()
        mock_trigger_autofix_task.assert_called_once()

    @patch("sentry.seer.autofix.issue_summary.get_seer_org_acknowledgement")
    @patch("sentry.seer.autofix.issue_summary.run_automation")
    @patch("sentry.seer.autofix.issue_summary._get_trace_tree_for_event")
    @patch("sentry.seer.autofix.issue_summary._call_seer")
    @patch("sentry.seer.autofix.issue_summary._get_event")
    def test_get_issue_summary_continues_when_automation_fails(
        self,
        mock_get_event,
        mock_call_seer,
        mock_get_trace_tree,
        mock_run_automation,
        mock_get_acknowledgement,
    ):
        """Test that issue summary is still returned when run_automation throws an exception."""
        mock_get_acknowledgement.return_value = True

        # Set up event and seer response
        event = Mock(event_id="test_event_id", datetime=datetime.datetime.now())
        serialized_event = {"event_id": "test_event_id", "data": "test_event_data"}
        mock_get_event.return_value = [serialized_event, event]
        mock_get_trace_tree.return_value = None

        mock_summary = SummarizeIssueResponse(
            group_id=str(self.group.id),
            headline="Test headline",
            whats_wrong="Test whats wrong",
            trace="Test trace",
            possible_cause="Test possible cause",
        )
        mock_call_seer.return_value = mock_summary

        # Make run_automation raise an exception
        mock_run_automation.side_effect = Exception("Automation failed")

        # Call get_issue_summary and verify it still returns successfully
        summary_data, status_code = get_issue_summary(self.group, self.user)

        assert status_code == 200
        expected_response = mock_summary.dict()
        expected_response["event_id"] = event.event_id
        assert summary_data == convert_dict_key_case(expected_response, snake_to_camel_case)

        # Verify run_automation was called and failed
        mock_run_automation.assert_called_once()
        mock_call_seer.assert_called_once()

    @patch("sentry.seer.autofix.issue_summary._get_trace_tree_for_event")
    def test_get_issue_summary_handles_trace_tree_errors(
        self,
        mock_get_trace_tree,
    ):
        mock_get_trace_tree.side_effect = Exception("boom")

        event = Mock(event_id="test_event_id", datetime=datetime.datetime.now())
        serialized_event = {"event_id": "test_event_id", "data": "test_event_data"}

        with (
            patch(
                "sentry.seer.autofix.issue_summary._get_event",
                return_value=[serialized_event, event],
            ),
            patch(
                "sentry.seer.autofix.issue_summary._call_seer",
                return_value=SummarizeIssueResponse(
                    group_id=str(self.group.id),
                    headline="headline",
                    whats_wrong="what",
                    trace="trace",
                    possible_cause="cause",
                ),
            ) as mock_call_seer,
            patch("sentry.seer.autofix.issue_summary.run_automation"),
            patch(
                "sentry.seer.autofix.issue_summary.get_seer_org_acknowledgement",
                return_value=True,
            ),
        ):
            summary_data, status_code = get_issue_summary(self.group, self.user)

        assert status_code == 200
        mock_call_seer.assert_called_once_with(self.group, serialized_event, None)

    @patch("sentry.seer.autofix.issue_summary.get_seer_org_acknowledgement")
    @patch("sentry.seer.autofix.issue_summary.run_automation")
    @patch("sentry.seer.autofix.issue_summary._get_trace_tree_for_event")
    @patch("sentry.seer.autofix.issue_summary._call_seer")
    @patch("sentry.seer.autofix.issue_summary._get_event")
    def test_get_issue_summary_with_should_run_automation_false(
        self,
        mock_get_event,
        mock_call_seer,
        mock_get_trace_tree,
        mock_run_automation,
        mock_get_acknowledgement,
    ):
        """Test that should_run_automation=False prevents run_automation from being called."""
        mock_get_acknowledgement.return_value = True
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
        mock_get_trace_tree.return_value = {"trace": "tree"}

        expected_response_summary = mock_summary.dict()
        expected_response_summary["event_id"] = event.event_id

        summary_data, status_code = get_issue_summary(
            self.group, self.user, should_run_automation=False
        )

        assert status_code == 200
        assert summary_data == convert_dict_key_case(expected_response_summary, snake_to_camel_case)
        mock_get_event.assert_called_once_with(self.group, self.user, provided_event_id=None)
        mock_get_trace_tree.assert_called_once()
        mock_call_seer.assert_called_once_with(self.group, serialized_event, {"trace": "tree"})
        mock_get_acknowledgement.assert_called_once_with(self.group.organization)

        # Verify that run_automation was NOT called
        mock_run_automation.assert_not_called()

        # Check if the cache was set correctly
        cached_summary = cache.get(f"ai-group-summary-v2:{self.group.id}")
        assert cached_summary == expected_response_summary


class TestGetStoppingPointFromFixability:
    @pytest.mark.parametrize(
        "score,expected",
        [
            (0.0, None),
            (0.39, None),
            (0.40, AutofixStoppingPoint.ROOT_CAUSE),
            (0.65, AutofixStoppingPoint.ROOT_CAUSE),
            (0.66, AutofixStoppingPoint.CODE_CHANGES),
            (0.77, AutofixStoppingPoint.CODE_CHANGES),
            (0.78, AutofixStoppingPoint.OPEN_PR),
            (0.79, AutofixStoppingPoint.OPEN_PR),
            (1.0, AutofixStoppingPoint.OPEN_PR),
        ],
    )
    def test_stopping_point_mapping(self, score, expected):
        assert _get_stopping_point_from_fixability(score) == expected


@with_feature({"organizations:gen-ai-features": True, "organizations:triage-signals-v0-org": True})
class TestRunAutomationStoppingPoint(APITestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        event_data = load_data("python")
        self.event = self.store_event(data=event_data, project_id=self.project.id)

    @patch("sentry.seer.autofix.issue_summary._trigger_autofix_task.delay")
    @patch(
        "sentry.seer.autofix.issue_summary.is_seer_autotriggered_autofix_rate_limited",
        return_value=False,
    )
    @patch("sentry.seer.autofix.issue_summary.get_autofix_state", return_value=None)
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.issue_summary._generate_fixability_score")
    def test_high_fixability_code_changes(
        self, mock_gen, mock_budget, mock_state, mock_rate, mock_trigger
    ):
        self.project.update_option("sentry:autofix_automation_tuning", "always")
        mock_gen.return_value = SummarizeIssueResponse(
            group_id=str(self.group.id),
            headline="h",
            whats_wrong="w",
            trace="t",
            possible_cause="c",
            scores=SummarizeIssueScores(fixability_score=0.70),
        )
        self.group.times_seen = 10
        self.group.times_seen_pending = 0
        run_automation(self.group, self.user, self.event, SeerAutomationSource.ALERT)
        mock_trigger.assert_called_once()
        assert mock_trigger.call_args[1]["stopping_point"] == AutofixStoppingPoint.CODE_CHANGES

    @patch("sentry.seer.autofix.issue_summary._trigger_autofix_task.delay")
    @patch(
        "sentry.seer.autofix.issue_summary.is_seer_autotriggered_autofix_rate_limited",
        return_value=False,
    )
    @patch("sentry.seer.autofix.issue_summary.get_autofix_state", return_value=None)
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.issue_summary._generate_fixability_score")
    def test_medium_fixability_solution(
        self, mock_gen, mock_budget, mock_state, mock_rate, mock_trigger
    ):
        self.project.update_option("sentry:autofix_automation_tuning", "always")
        mock_gen.return_value = SummarizeIssueResponse(
            group_id=str(self.group.id),
            headline="h",
            whats_wrong="w",
            trace="t",
            possible_cause="c",
            scores=SummarizeIssueScores(fixability_score=0.50),
        )
        self.group.times_seen = 10
        self.group.times_seen_pending = 0
        run_automation(self.group, self.user, self.event, SeerAutomationSource.ALERT)
        mock_trigger.assert_called_once()
        assert mock_trigger.call_args[1]["stopping_point"] == AutofixStoppingPoint.ROOT_CAUSE

    @patch("sentry.seer.autofix.issue_summary._trigger_autofix_task.delay")
    @patch(
        "sentry.seer.autofix.issue_summary.is_seer_autotriggered_autofix_rate_limited",
        return_value=False,
    )
    @patch("sentry.seer.autofix.issue_summary.get_autofix_state", return_value=None)
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.issue_summary._generate_fixability_score")
    def test_without_feature_flag(self, mock_gen, mock_budget, mock_state, mock_rate, mock_trigger):
        self.project.update_option("sentry:autofix_automation_tuning", "always")
        mock_gen.return_value = SummarizeIssueResponse(
            group_id=str(self.group.id),
            headline="h",
            whats_wrong="w",
            trace="t",
            possible_cause="c",
            scores=SummarizeIssueScores(fixability_score=0.80),
        )

        with self.feature(
            {"organizations:gen-ai-features": True, "organizations:triage-signals-v0-org": False}
        ):
            run_automation(self.group, self.user, self.event, SeerAutomationSource.ALERT)

        mock_trigger.assert_called_once()
        assert mock_trigger.call_args[1]["stopping_point"] is None


class TestFetchUserPreference:
    @patch("sentry.seer.autofix.issue_summary.sign_with_seer_secret", return_value={})
    @patch("sentry.seer.autofix.issue_summary.requests.post")
    def test_fetch_user_preference_success(self, mock_post, mock_sign):
        mock_response = Mock()
        mock_response.json.return_value = {
            "preference": {"automated_run_stopping_point": "solution"}
        }
        mock_response.raise_for_status = Mock()
        mock_post.return_value = mock_response

        result = _fetch_user_preference(project_id=123)

        assert result == "solution"
        mock_post.assert_called_once()
        mock_response.raise_for_status.assert_called_once()

    @patch("sentry.seer.autofix.issue_summary.sign_with_seer_secret", return_value={})
    @patch("sentry.seer.autofix.issue_summary.requests.post")
    def test_fetch_user_preference_no_preference(self, mock_post, mock_sign):
        mock_response = Mock()
        mock_response.json.return_value = {"preference": None}
        mock_response.raise_for_status = Mock()
        mock_post.return_value = mock_response

        result = _fetch_user_preference(project_id=123)

        assert result is None

    @patch("sentry.seer.autofix.issue_summary.sign_with_seer_secret", return_value={})
    @patch("sentry.seer.autofix.issue_summary.requests.post")
    def test_fetch_user_preference_empty_preference(self, mock_post, mock_sign):
        mock_response = Mock()
        mock_response.json.return_value = {"preference": {"automated_run_stopping_point": None}}
        mock_response.raise_for_status = Mock()
        mock_post.return_value = mock_response

        result = _fetch_user_preference(project_id=123)

        assert result is None

    @patch("sentry.seer.autofix.issue_summary.sign_with_seer_secret", return_value={})
    @patch("sentry.seer.autofix.issue_summary.requests.post")
    def test_fetch_user_preference_api_error(self, mock_post, mock_sign):
        mock_post.side_effect = Exception("API error")

        result = _fetch_user_preference(project_id=123)

        assert result is None


class TestApplyUserPreferenceUpperBound:
    @pytest.mark.parametrize(
        "fixability,user_pref,expected",
        [
            # Fixability is None - return user preference if available, otherwise ROOT_CAUSE
            (None, "open_pr", AutofixStoppingPoint.OPEN_PR),
            (None, "code_changes", AutofixStoppingPoint.CODE_CHANGES),
            (None, "solution", AutofixStoppingPoint.SOLUTION),
            (None, "root_cause", AutofixStoppingPoint.ROOT_CAUSE),
            (None, None, AutofixStoppingPoint.ROOT_CAUSE),
            # User preference is None - return fixability suggestion
            (AutofixStoppingPoint.OPEN_PR, None, AutofixStoppingPoint.OPEN_PR),
            (AutofixStoppingPoint.CODE_CHANGES, None, AutofixStoppingPoint.CODE_CHANGES),
            (AutofixStoppingPoint.SOLUTION, None, AutofixStoppingPoint.SOLUTION),
            (AutofixStoppingPoint.ROOT_CAUSE, None, AutofixStoppingPoint.ROOT_CAUSE),
            # User preference limits automation (user is more conservative)
            (
                AutofixStoppingPoint.OPEN_PR,
                "code_changes",
                AutofixStoppingPoint.CODE_CHANGES,
            ),
            (AutofixStoppingPoint.OPEN_PR, "solution", AutofixStoppingPoint.SOLUTION),
            (AutofixStoppingPoint.OPEN_PR, "root_cause", AutofixStoppingPoint.ROOT_CAUSE),
            (AutofixStoppingPoint.CODE_CHANGES, "solution", AutofixStoppingPoint.SOLUTION),
            (
                AutofixStoppingPoint.CODE_CHANGES,
                "root_cause",
                AutofixStoppingPoint.ROOT_CAUSE,
            ),
            (AutofixStoppingPoint.SOLUTION, "root_cause", AutofixStoppingPoint.ROOT_CAUSE),
            # Fixability is more conservative (fixability limits automation)
            (AutofixStoppingPoint.SOLUTION, "open_pr", AutofixStoppingPoint.SOLUTION),
            (
                AutofixStoppingPoint.SOLUTION,
                "code_changes",
                AutofixStoppingPoint.SOLUTION,
            ),
            (AutofixStoppingPoint.ROOT_CAUSE, "open_pr", AutofixStoppingPoint.ROOT_CAUSE),
            (
                AutofixStoppingPoint.ROOT_CAUSE,
                "code_changes",
                AutofixStoppingPoint.ROOT_CAUSE,
            ),
            (AutofixStoppingPoint.ROOT_CAUSE, "solution", AutofixStoppingPoint.ROOT_CAUSE),
            # Same level - return fixability
            (AutofixStoppingPoint.OPEN_PR, "open_pr", AutofixStoppingPoint.OPEN_PR),
            (
                AutofixStoppingPoint.CODE_CHANGES,
                "code_changes",
                AutofixStoppingPoint.CODE_CHANGES,
            ),
            (AutofixStoppingPoint.SOLUTION, "solution", AutofixStoppingPoint.SOLUTION),
            (
                AutofixStoppingPoint.ROOT_CAUSE,
                "root_cause",
                AutofixStoppingPoint.ROOT_CAUSE,
            ),
        ],
    )
    def test_upper_bound_combinations(self, fixability, user_pref, expected):
        result = _apply_user_preference_upper_bound(fixability, user_pref)
        assert result == expected


@with_feature({"organizations:gen-ai-features": True, "organizations:triage-signals-v0-org": True})
class TestRunAutomationWithUpperBound(APITestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        event_data = load_data("python")
        self.event = self.store_event(data=event_data, project_id=self.project.id)

    @patch("sentry.seer.autofix.issue_summary._trigger_autofix_task.delay")
    @patch("sentry.seer.autofix.issue_summary._fetch_user_preference")
    @patch(
        "sentry.seer.autofix.issue_summary.is_seer_autotriggered_autofix_rate_limited",
        return_value=False,
    )
    @patch("sentry.seer.autofix.issue_summary.get_autofix_state", return_value=None)
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.issue_summary._generate_fixability_score")
    def test_user_preference_limits_high_fixability(
        self, mock_gen, mock_budget, mock_state, mock_rate, mock_fetch, mock_trigger
    ):
        """High fixability (OPEN_PR) limited by user preference (SOLUTION)"""
        self.project.update_option("sentry:autofix_automation_tuning", "always")
        mock_gen.return_value = SummarizeIssueResponse(
            group_id=str(self.group.id),
            headline="h",
            whats_wrong="w",
            trace="t",
            possible_cause="c",
            scores=SummarizeIssueScores(fixability_score=0.80),  # High = OPEN_PR
        )
        mock_fetch.return_value = "solution"
        self.group.times_seen = 10
        self.group.times_seen_pending = 0

        run_automation(self.group, self.user, self.event, SeerAutomationSource.ALERT)

        mock_trigger.assert_called_once()
        # Should be limited to SOLUTION by user preference
        assert mock_trigger.call_args[1]["stopping_point"] == AutofixStoppingPoint.SOLUTION

    @patch("sentry.seer.autofix.issue_summary._trigger_autofix_task.delay")
    @patch("sentry.seer.autofix.issue_summary._fetch_user_preference")
    @patch(
        "sentry.seer.autofix.issue_summary.is_seer_autotriggered_autofix_rate_limited",
        return_value=False,
    )
    @patch("sentry.seer.autofix.issue_summary.get_autofix_state", return_value=None)
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.issue_summary._generate_fixability_score")
    def test_fixability_limits_permissive_user_preference(
        self, mock_gen, mock_budget, mock_state, mock_rate, mock_fetch, mock_trigger
    ):
        """Medium fixability (ROOT_CAUSE) used despite user allowing OPEN_PR"""
        self.project.update_option("sentry:autofix_automation_tuning", "always")
        mock_gen.return_value = SummarizeIssueResponse(
            group_id=str(self.group.id),
            headline="h",
            whats_wrong="w",
            trace="t",
            possible_cause="c",
            scores=SummarizeIssueScores(fixability_score=0.50),  # Medium = ROOT_CAUSE
        )
        mock_fetch.return_value = "open_pr"
        self.group.times_seen = 10
        self.group.times_seen_pending = 0

        run_automation(self.group, self.user, self.event, SeerAutomationSource.ALERT)

        mock_trigger.assert_called_once()
        # Should use ROOT_CAUSE from fixability, not OPEN_PR from user
        assert mock_trigger.call_args[1]["stopping_point"] == AutofixStoppingPoint.ROOT_CAUSE

    @patch("sentry.seer.autofix.issue_summary._trigger_autofix_task.delay")
    @patch("sentry.seer.autofix.issue_summary._fetch_user_preference")
    @patch(
        "sentry.seer.autofix.issue_summary.is_seer_autotriggered_autofix_rate_limited",
        return_value=False,
    )
    @patch("sentry.seer.autofix.issue_summary.get_autofix_state", return_value=None)
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.issue_summary._generate_fixability_score")
    def test_no_user_preference_uses_fixability_only(
        self, mock_gen, mock_budget, mock_state, mock_rate, mock_fetch, mock_trigger
    ):
        """When user has no preference, use fixability score alone"""
        self.project.update_option("sentry:autofix_automation_tuning", "always")
        mock_gen.return_value = SummarizeIssueResponse(
            group_id=str(self.group.id),
            headline="h",
            whats_wrong="w",
            trace="t",
            possible_cause="c",
            scores=SummarizeIssueScores(fixability_score=0.80),  # High = OPEN_PR
        )
        mock_fetch.return_value = None
        self.group.times_seen = 10
        self.group.times_seen_pending = 0

        run_automation(self.group, self.user, self.event, SeerAutomationSource.ALERT)

        mock_trigger.assert_called_once()
        # Should use OPEN_PR from fixability
        assert mock_trigger.call_args[1]["stopping_point"] == AutofixStoppingPoint.OPEN_PR


@with_feature("organizations:gen-ai-features")
@with_feature("organizations:triage-signals-v0-org")
class TestRunAutomationAlertEventCount(APITestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        event_data = load_data("python")
        self.event = self.store_event(data=event_data, project_id=self.project.id)
        self.user = self.create_user()

    @patch("sentry.seer.autofix.issue_summary._trigger_autofix_task")
    @patch("sentry.seer.autofix.issue_summary._generate_fixability_score")
    @patch("sentry.seer.autofix.issue_summary.get_autofix_state")
    @patch("sentry.seer.autofix.issue_summary.quotas.backend.check_seer_quota")
    def test_alert_skips_automation_below_threshold(
        self, mock_budget, mock_state, mock_fixability, mock_trigger
    ):
        """Alert automation should skip when event count < 10 with triage-signals-v0-org"""
        self.project.update_option("sentry:autofix_automation_tuning", "always")
        mock_budget.return_value = True
        mock_state.return_value = None
        mock_fixability.return_value = SummarizeIssueResponse(
            group_id=str(self.group.id),
            headline="Test",
            scores=SummarizeIssueScores(fixability_score=0.70),
        )

        # Set event count to 5
        self.group.times_seen = 5
        self.group.times_seen_pending = 0

        run_automation(self.group, self.user, self.event, SeerAutomationSource.ALERT)

        # Should not trigger automation
        mock_trigger.delay.assert_not_called()

    @patch(
        "sentry.seer.autofix.issue_summary.is_seer_autotriggered_autofix_rate_limited",
        return_value=False,
    )
    @patch("sentry.seer.autofix.issue_summary._trigger_autofix_task")
    @patch("sentry.seer.autofix.issue_summary._generate_fixability_score")
    @patch("sentry.seer.autofix.issue_summary.get_autofix_state")
    @patch("sentry.seer.autofix.issue_summary.quotas.backend.check_seer_quota")
    def test_alert_runs_automation_above_threshold(
        self, mock_budget, mock_state, mock_fixability, mock_trigger, mock_rate_limit
    ):
        """Alert automation should run when event count >= 10 with triage-signals-v0"""
        self.project.update_option("sentry:autofix_automation_tuning", "always")
        mock_budget.return_value = True
        mock_state.return_value = None
        mock_fixability.return_value = SummarizeIssueResponse(
            group_id=str(self.group.id),
            headline="Test",
            scores=SummarizeIssueScores(fixability_score=0.70),
        )

        # Set event count to 10
        self.group.times_seen = 10
        self.group.times_seen_pending = 0

        run_automation(self.group, self.user, self.event, SeerAutomationSource.ALERT)

        # Should trigger automation
        mock_trigger.delay.assert_called_once()


@with_feature("organizations:gen-ai-features")
class TestGetAndUpdateGroupFixabilityScore(APITestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()

    @patch("sentry.seer.autofix.issue_summary._generate_fixability_score")
    def test_returns_existing_score_without_regenerating(self, mock_generate):
        """Test that existing fixability score is returned without calling Seer."""
        # Set an existing fixability score
        self.group.update(seer_fixability_score=0.75)

        result = get_and_update_group_fixability_score(self.group)

        assert result == 0.75
        # Seer should not be called when score exists
        mock_generate.assert_not_called()

    @patch("sentry.seer.autofix.issue_summary._generate_fixability_score")
    def test_generates_and_updates_score_when_missing(self, mock_generate):
        """Test that fixability score is generated and saved when missing."""
        mock_generate.return_value = SummarizeIssueResponse(
            group_id=str(self.group.id),
            headline="Test",
            whats_wrong="Something",
            trace="Trace",
            possible_cause="Cause",
            scores=SummarizeIssueScores(fixability_score=0.85),
        )

        result = get_and_update_group_fixability_score(self.group)

        assert result == 0.85
        # Verify group was updated with the new score
        self.group.refresh_from_db()
        assert self.group.seer_fixability_score == 0.85
        mock_generate.assert_called_once_with(self.group, summary=None)

    @patch("sentry.seer.autofix.issue_summary._generate_fixability_score")
    def test_force_generate_regenerates_existing_score(self, mock_generate):
        """Test that force_generate=True regenerates score even if one exists."""
        # Set an existing score
        self.group.update(seer_fixability_score=0.50)

        mock_generate.return_value = SummarizeIssueResponse(
            group_id=str(self.group.id),
            headline="Test",
            whats_wrong="Something",
            trace="Trace",
            possible_cause="Cause",
            scores=SummarizeIssueScores(fixability_score=0.90),
        )

        result = get_and_update_group_fixability_score(self.group, force_generate=True)

        assert result == 0.90
        # Verify the score was updated
        self.group.refresh_from_db()
        assert self.group.seer_fixability_score == 0.90
        mock_generate.assert_called_once_with(self.group, summary=None)

    @patch("sentry.seer.autofix.issue_summary.make_signed_seer_api_request")
    def test_passes_summary_in_api_payload(self, mock_request):
        """Test that summary is included in the API payload sent to Seer."""
        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = orjson.dumps(
            {
                "group_id": str(self.group.id),
                "headline": "Test",
                "whats_wrong": "Something",
                "trace": "Trace",
                "possible_cause": "Cause",
                "scores": {"fixability_score": 0.80},
            }
        )
        mock_request.return_value = mock_response

        summary = FixabilitySummaryPayload(
            group_id=self.group.id,
            headline="Test Headline",
            whats_wrong="Test whats wrong",
            trace="Test trace",
            possible_cause="Test cause",
        )

        result = get_and_update_group_fixability_score(
            self.group, force_generate=True, summary=summary
        )

        assert result == 0.80
        mock_request.assert_called_once()
        call_args = mock_request.call_args
        payload = orjson.loads(call_args.kwargs["body"])
        assert payload["group_id"] == self.group.id
        assert payload["summary"] == summary.dict()

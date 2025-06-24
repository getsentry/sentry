import datetime
import threading
import time
from unittest.mock import ANY, Mock, call, patch

from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.autofix.utils import SeerAutomationSource
from sentry.locks import locks
from sentry.seer.issue_summary import (
    _get_event,
    _get_trace_connected_issues,
    _run_automation,
    get_issue_summary,
)
from sentry.seer.models import SummarizeIssueResponse, SummarizeIssueScores
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.features import apply_feature_flag_on_cls, with_feature
from sentry.testutils.skips import requires_snuba
from sentry.utils.cache import cache
from sentry.utils.locking import UnableToAcquireLock

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

    @patch("sentry.seer.issue_summary.get_seer_org_acknowledgement")
    @patch("sentry.seer.issue_summary._call_seer")
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
        mock_get_acknowledgement.assert_called_once_with(self.group.organization.id)

    @patch("sentry.seer.issue_summary.get_seer_org_acknowledgement")
    @patch("sentry.seer.issue_summary._get_event")
    def test_get_issue_summary_without_event(self, mock_get_event, mock_get_acknowledgement):
        mock_get_acknowledgement.return_value = True
        mock_get_event.return_value = [None, None]

        summary_data, status_code = get_issue_summary(self.group, self.user)

        assert status_code == 400
        assert summary_data == {"detail": "Could not find an event for the issue"}
        assert cache.get(f"ai-group-summary-v2:{self.group.id}") is None
        mock_get_acknowledgement.assert_called_once_with(self.group.organization.id)

    @patch("sentry.seer.issue_summary.get_seer_org_acknowledgement")
    @patch("sentry.seer.issue_summary._get_trace_connected_issues")
    @patch("sentry.seer.issue_summary._call_seer")
    @patch("sentry.seer.issue_summary._get_event")
    def test_get_issue_summary_without_existing_summary(
        self, mock_get_event, mock_call_seer, mock_get_connected_issues, mock_get_acknowledgement
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
        mock_get_acknowledgement.assert_called_once_with(self.group.organization.id)

        # Check if the cache was set correctly
        cached_summary = cache.get(f"ai-group-summary-v2:{self.group.id}")
        assert cached_summary == expected_response_summary

    def test_get_issue_summary_without_ai_acknowledgement(self):
        with patch(
            "sentry.seer.issue_summary.get_seer_org_acknowledgement"
        ) as mock_get_acknowledgement:
            mock_get_acknowledgement.return_value = False

            summary_data, status_code = get_issue_summary(self.group, self.user)

            assert status_code == 403
            assert summary_data == {
                "detail": "AI Autofix has not been acknowledged by the organization."
            }
            mock_get_acknowledgement.assert_called_once_with(self.group.organization.id)

    @patch("sentry.seer.issue_summary.requests.post")
    @patch("sentry.seer.issue_summary._get_event")
    @patch("sentry.seer.issue_summary.get_seer_org_acknowledgement")
    def test_call_seer_integration(self, mock_get_acknowledgement, mock_get_event, mock_post):
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
        mock_get_acknowledgement.assert_called_once_with(self.group.organization.id)

        assert cache.get(f"ai-group-summary-v2:{self.group.id}") == expected_response_summary

    @patch("sentry.seer.issue_summary.get_issue_summary")
    @patch("sentry.seer.issue_summary.get_seer_org_acknowledgement")
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
            mock_get_acknowledgement.assert_called_with(self.group.organization.id)

    @patch("sentry.seer.issue_summary._generate_summary")
    @patch("sentry.seer.issue_summary.get_seer_org_acknowledgement")
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

    @patch("sentry.seer.issue_summary._generate_summary")
    @patch("sentry.seer.issue_summary.get_seer_org_acknowledgement")
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
        mock_get_acknowledgement.assert_called_once_with(self.group.organization.id)

    @patch("sentry.seer.issue_summary.cache.get")
    @patch("sentry.seer.issue_summary._generate_summary")
    @patch("sentry.utils.locking.lock.Lock.blocking_acquire")
    @patch("sentry.seer.issue_summary.get_seer_org_acknowledgement")
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
        # Ensure cache was checked twice (once initially, once after lock failure)
        assert mock_cache_get.call_count == 2
        mock_get_acknowledgement.assert_called_once_with(self.group.organization.id)

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

    @patch("sentry.seer.issue_summary._trigger_autofix_task.delay")
    @patch("sentry.seer.issue_summary.get_autofix_state")
    @patch("sentry.seer.issue_summary._generate_fixability_score")
    @with_feature("organizations:trigger-autofix-on-issue-summary")
    def test_run_automation_saves_fixability_score(
        self,
        mock_generate_fixability_score,
        mock_get_autofix_state,
        mock_trigger_autofix_task,
    ):
        """Test that _run_automation saves the fixability score."""
        self.group.project.update_option("sentry:autofix_automation_tuning", "high")
        mock_event = Mock(event_id="test_event_id")
        mock_user = self.user

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
        mock_get_autofix_state.return_value = None

        self.group.refresh_from_db()
        assert self.group.seer_fixability_score is None

        _run_automation(self.group, mock_user, mock_event, source=SeerAutomationSource.POST_PROCESS)

        mock_generate_fixability_score.assert_called_once_with(self.group)

        mock_trigger_autofix_task.assert_called_once_with(
            group_id=self.group.id,
            event_id="test_event_id",
            user_id=mock_user.id,
            auto_run_source="issue_summary_on_post_process_fixability",
        )

        self.group.refresh_from_db()
        assert self.group.seer_fixability_score == 0.5

    @with_feature("organizations:trigger-autofix-on-issue-summary")
    @patch("sentry.seer.issue_summary._trigger_autofix_task.delay")
    @patch("sentry.seer.issue_summary.get_autofix_state")
    @patch("sentry.seer.issue_summary._generate_fixability_score")
    def test_is_issue_fixable_triggers_autofix(
        self,
        mock_generate_fixability_score,
        mock_get_autofix_state,
        mock_trigger_autofix_task,
    ):
        mock_event = Mock(event_id="test_event_id")
        mock_user = self.user
        mock_get_autofix_state.return_value = None

        test_cases = [
            # option, fixability_score, should_trigger_autofix
            ("off", 0.9, False),
            ("low", 0.6, False),
            ("low", 0.7, True),
            ("low", 0.8, True),
            ("medium", 0.39, False),
            ("medium", 0.5, True),
            ("medium", 0.6, True),
            ("high", 0.2, False),
            ("high", 0.3, True),
            ("high", 0.4, True),
            ("always", 0.1, True),
            ("always", 0.0, True),
        ]

        for option_value, score, should_trigger in test_cases:
            mock_trigger_autofix_task.reset_mock()
            mock_generate_fixability_score.reset_mock()
            self.group.seer_fixability_score = None
            self.group.save()

            mock_fixability_response = SummarizeIssueResponse(
                group_id=str(self.group.id),
                headline="some headline",
                whats_wrong="some whats wrong",
                trace="some trace",
                possible_cause="some possible cause",
                scores=SummarizeIssueScores(
                    fixability_score=score,
                    is_fixable=True,  # is_fixable from seer doesn't gate our logic
                ),
            )
            mock_generate_fixability_score.return_value = mock_fixability_response

            with self.subTest(option=option_value, score=score, should_trigger=should_trigger):
                self.group.project.update_option("sentry:autofix_automation_tuning", option_value)
                _run_automation(
                    self.group, mock_user, mock_event, source=SeerAutomationSource.POST_PROCESS
                )

                mock_generate_fixability_score.assert_called_once_with(self.group)
                self.group.refresh_from_db()
                assert self.group.seer_fixability_score == score

                if should_trigger:
                    mock_trigger_autofix_task.assert_called_once_with(
                        group_id=self.group.id,
                        event_id="test_event_id",
                        user_id=mock_user.id,
                        auto_run_source="issue_summary_on_post_process_fixability",
                    )
                else:
                    mock_trigger_autofix_task.assert_not_called()

    @patch("sentry.seer.issue_summary.get_seer_org_acknowledgement")
    @patch("sentry.seer.issue_summary._run_automation")
    @patch("sentry.seer.issue_summary._call_seer")
    @patch("sentry.seer.issue_summary._get_event")
    @patch("sentry.seer.issue_summary._get_trace_connected_issues")
    def test_get_issue_summary_continues_when_automation_fails(
        self,
        mock_get_connected_issues,
        mock_get_event,
        mock_call_seer,
        mock_run_automation,
        mock_get_acknowledgement,
    ):
        """Test that issue summary is still returned when _run_automation throws an exception."""
        mock_get_acknowledgement.return_value = True

        # Set up event and seer response
        event = Mock(event_id="test_event_id", datetime=datetime.datetime.now())
        serialized_event = {"event_id": "test_event_id", "data": "test_event_data"}
        mock_get_event.return_value = [serialized_event, event]
        mock_get_connected_issues.return_value = []

        mock_summary = SummarizeIssueResponse(
            group_id=str(self.group.id),
            headline="Test headline",
            whats_wrong="Test whats wrong",
            trace="Test trace",
            possible_cause="Test possible cause",
        )
        mock_call_seer.return_value = mock_summary

        # Make _run_automation raise an exception
        mock_run_automation.side_effect = Exception("Automation failed")

        # Call get_issue_summary and verify it still returns successfully
        summary_data, status_code = get_issue_summary(self.group, self.user)

        assert status_code == 200
        expected_response = mock_summary.dict()
        expected_response["event_id"] = event.event_id
        assert summary_data == convert_dict_key_case(expected_response, snake_to_camel_case)

        # Verify _run_automation was called and failed
        mock_run_automation.assert_called_once()
        mock_call_seer.assert_called_once()

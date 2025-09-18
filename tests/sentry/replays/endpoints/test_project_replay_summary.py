import uuid
import zlib
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import MagicMock, Mock, patch

import requests
from django.conf import settings
from django.urls import reverse

from sentry.feedback.lib.utils import FeedbackCreationSource
from sentry.feedback.usecases.ingest.create_feedback import create_feedback_issue
from sentry.replays.endpoints.project_replay_summary import (
    SEER_POLL_STATE_ENDPOINT_PATH,
    SEER_START_TASK_ENDPOINT_PATH,
)
from sentry.replays.lib.storage import FilestoreBlob, RecordingSegmentStorageMeta
from sentry.replays.testutils import mock_replay
from sentry.replays.usecases.summarize import EventDict
from sentry.testutils.cases import SnubaTestCase, TransactionTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba
from sentry.utils import json


class MockSeerResponse:
    def __init__(self, status: int, json_data: dict[str, str]):
        self.status = status
        self.json_data = json_data
        self.data = json.dumps(json_data)

    def json(self) -> dict[str, str]:
        return self.json_data


# have to use TransactionTestCase because we're using threadpools
@requires_snuba
class ProjectReplaySummaryTestCase(
    TransactionTestCase,
    SnubaTestCase,
):
    endpoint = "sentry-api-0-project-replay-summary"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.replay_id = uuid.uuid4().hex
        self.url = reverse(
            self.endpoint,
            args=(self.organization.slug, self.project.slug, self.replay_id),
        )
        self.features = {
            "organizations:session-replay": True,
            "organizations:replay-ai-summaries": True,
        }
        self.mock_has_seer_access_patcher = patch(
            "sentry.replays.endpoints.project_replay_summary.has_seer_access",
            return_value=True,
        )
        self.mock_has_seer_access = self.mock_has_seer_access_patcher.start()

    def tearDown(self) -> None:
        self.mock_has_seer_access_patcher.stop()
        super().tearDown()

    def store_replay(self, dt: datetime | None = None, **kwargs: Any) -> None:
        replay = mock_replay(dt or datetime.now(UTC), self.project.id, self.replay_id, **kwargs)
        response = requests.post(
            settings.SENTRY_SNUBA + "/tests/entities/replays/insert", json=[replay]
        )
        assert response.status_code == 200

    def save_recording_segment(
        self, segment_id: int, data: bytes, compressed: bool = True, is_archived: bool = False
    ) -> None:
        metadata = RecordingSegmentStorageMeta(
            project_id=self.project.id,
            replay_id=self.replay_id,
            segment_id=segment_id,
            retention_days=30,
            file_id=None,
        )
        FilestoreBlob().set(metadata, zlib.compress(data) if compressed else data)

    def test_feature_flag_disabled(self) -> None:
        self.save_recording_segment(0, json.dumps([]).encode())

        features = [
            (False, True),
            (True, False),
            (False, False),
        ]

        for replay, replay_ai in features:
            with self.feature(
                {
                    "organizations:session-replay": replay,
                    "organizations:replay-ai-summaries": replay_ai,
                }
            ):
                for method in ["GET", "POST"]:
                    response = (
                        self.client.get(self.url) if method == "GET" else self.client.post(self.url)
                    )
                    assert response.status_code == 403, (replay, replay_ai, method)

    def test_no_seer_access(self) -> None:
        self.mock_has_seer_access.return_value = False
        with self.feature(self.features):
            for method in ["GET", "POST"]:
                response = (
                    self.client.get(self.url) if method == "GET" else self.client.post(self.url)
                )
                assert response.status_code == 403, method

    @patch("sentry.replays.endpoints.project_replay_summary.make_signed_seer_api_request")
    def test_get_simple(self, mock_make_seer_api_request: Mock) -> None:
        mock_response = MockSeerResponse(200, json_data={"hello": "world"})
        mock_make_seer_api_request.return_value = mock_response

        with self.feature(self.features):
            response = self.client.get(self.url)
            assert response.status_code == 200
            assert response.json() == {"hello": "world"}

        mock_make_seer_api_request.assert_called_once()
        call_args = mock_make_seer_api_request.call_args
        assert call_args[1]["path"] == SEER_POLL_STATE_ENDPOINT_PATH
        assert json.loads(call_args[1]["body"].decode()) == {"replay_id": self.replay_id}

    @patch("sentry.replays.endpoints.project_replay_summary.make_signed_seer_api_request")
    def test_post_simple(self, mock_make_seer_api_request: Mock) -> None:
        mock_response = MockSeerResponse(200, json_data={"hello": "world"})
        mock_make_seer_api_request.return_value = mock_response

        data = [
            {
                "type": 5,
                "timestamp": 0.0,
                "data": {
                    "tag": "breadcrumb",
                    "payload": {"category": "console", "message": "hello"},
                },
            },
            {
                "type": 5,
                "timestamp": 0.0,
                "data": {
                    "tag": "breadcrumb",
                    "payload": {"category": "console", "message": "world"},
                },
            },
        ]
        self.save_recording_segment(0, json.dumps(data).encode())
        self.save_recording_segment(1, json.dumps([]).encode())
        self.store_replay()

        with self.feature(self.features):
            response = self.client.post(
                self.url, data={"num_segments": 2}, content_type="application/json"
            )

        assert response.status_code == 200
        assert response.json() == {"hello": "world"}

        mock_make_seer_api_request.assert_called_once()
        call_args = mock_make_seer_api_request.call_args
        assert call_args[1]["path"] == SEER_START_TASK_ENDPOINT_PATH
        request_body = json.loads(call_args[1]["body"].decode())
        assert request_body == {
            "logs": ["Logged: 'hello' at 0.0", "Logged: 'world' at 0.0"],
            "num_segments": 2,
            "replay_id": self.replay_id,
            "organization_id": self.organization.id,
            "project_id": self.project.id,
            "temperature": None,
        }

    def test_post_out_of_date_range(self) -> None:
        data = [
            {
                "type": 5,
                "timestamp": 0.0,
                "data": {
                    "tag": "breadcrumb",
                    "payload": {"category": "console", "message": "hello"},
                },
            },
            {
                "type": 5,
                "timestamp": 0.0,
                "data": {
                    "tag": "breadcrumb",
                    "payload": {"category": "console", "message": "world"},
                },
            },
        ]
        self.save_recording_segment(0, json.dumps(data).encode())
        self.save_recording_segment(1, json.dumps([]).encode())
        self.store_replay(dt=before_now(days=80))

        with self.feature(self.features):
            response = self.client.post(
                self.url
                + f"?start={before_now(days=3).isoformat().replace('+00:00', 'Z')}&end={before_now(days=0).isoformat().replace('+00:00', 'Z')}",
                data={"num_segments": 2},
                content_type="application/json",
            )

        assert response.status_code == 404

    @patch("sentry.replays.endpoints.project_replay_summary.make_signed_seer_api_request")
    def test_post_with_both_direct_and_trace_connected_errors(
        self, mock_make_seer_api_request: Mock
    ) -> None:
        """Test handling of breadcrumbs with both direct and trace connected errors. Error logs should not be duplicated."""
        mock_response = MockSeerResponse(200, json_data={"hello": "world"})
        mock_make_seer_api_request.return_value = mock_response

        now = datetime.now(UTC)
        trace_id = uuid.uuid4().hex
        span_id = "1" + uuid.uuid4().hex[:15]

        # Create a direct error event that is not trace connected.
        direct_event_id = uuid.uuid4().hex
        direct_error_timestamp = now.timestamp() - 2
        self.store_event(
            data={
                "event_id": direct_event_id,
                "timestamp": direct_error_timestamp,
                "exception": {
                    "values": [
                        {
                            "type": "ZeroDivisionError",
                            "value": "division by zero",
                        }
                    ]
                },
                "contexts": {
                    "replay": {"replay_id": self.replay_id},
                    "trace": {
                        "type": "trace",
                        "trace_id": uuid.uuid4().hex,
                        "span_id": span_id,
                    },
                },
            },
            project_id=self.project.id,
        )

        # Create a trace connected error event
        connected_event_id = uuid.uuid4().hex
        connected_error_timestamp = now.timestamp() - 1
        project_2 = self.create_project()
        self.store_event(
            data={
                "event_id": connected_event_id,
                "timestamp": connected_error_timestamp,
                "exception": {
                    "values": [
                        {
                            "type": "ConnectionError",
                            "value": "Failed to connect to database",
                        }
                    ]
                },
                "contexts": {
                    "trace": {
                        "type": "trace",
                        "trace_id": trace_id,
                        "span_id": span_id,
                    }
                },
            },
            project_id=project_2.id,
        )

        # Store the replay with both error IDs and trace IDs
        self.store_replay(
            error_ids=[direct_event_id],
            trace_ids=[trace_id],
        )

        data = [
            {
                "type": 5,
                "timestamp": float(now.timestamp()),
                "data": {
                    "tag": "breadcrumb",
                    "payload": {"category": "console", "message": "hello"},
                },
            }
        ]
        self.save_recording_segment(0, json.dumps(data).encode())

        with self.feature(self.features):
            response = self.client.post(
                self.url, data={"num_segments": 1}, content_type="application/json"
            )
            assert response.status_code == 200
            assert response.json() == {"hello": "world"}

        mock_make_seer_api_request.assert_called_once()
        request_body = json.loads(mock_make_seer_api_request.call_args[1]["body"].decode())
        logs = request_body["logs"]
        assert len(logs) == 3
        assert any("ZeroDivisionError" in log for log in logs)
        assert any("division by zero" in log for log in logs)
        assert any("ConnectionError" in log for log in logs)
        assert any("Failed to connect to database" in log for log in logs)

    @patch("sentry.replays.endpoints.project_replay_summary.make_signed_seer_api_request")
    def test_post_with_feedback_breadcrumb(self, mock_make_seer_api_request: Mock) -> None:
        """Test handling of a feedback breadcrumb when the feedback
        is in nodestore, but hasn't reached Snuba yet.
        If the feedback is in Snuba (guaranteed for SDK v8.0.0+),
        it should be de-duped like in the duplicate_feedback test below."""
        mock_response = MockSeerResponse(
            200,
            json_data={"hello": "world"},
        )
        mock_make_seer_api_request.return_value = mock_response

        now = datetime.now(UTC)
        feedback_event_id = uuid.uuid4().hex

        self.store_event(
            data={
                "type": "feedback",
                "event_id": feedback_event_id,
                "timestamp": now.timestamp(),
                "contexts": {
                    "feedback": {
                        "contact_email": "josh.ferge@sentry.io",
                        "name": "Josh Ferge",
                        "message": "Great website!",
                        "replay_id": self.replay_id,
                        "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
                    },
                },
            },
            project_id=self.project.id,
        )
        self.store_replay()

        data = [
            {
                "type": 5,
                "timestamp": float(now.timestamp()),
                "data": {
                    "tag": "breadcrumb",
                    "payload": {
                        "category": "sentry.feedback",
                        "data": {"feedbackId": feedback_event_id},
                    },
                },
            },
        ]
        self.save_recording_segment(0, json.dumps(data).encode())

        with self.feature(self.features):
            response = self.client.post(
                self.url, data={"num_segments": 1}, content_type="application/json"
            )

        assert response.status_code == 200
        assert response.json() == {"hello": "world"}

        mock_make_seer_api_request.assert_called_once()
        request_body = json.loads(mock_make_seer_api_request.call_args[1]["body"].decode())
        logs = request_body["logs"]
        assert "User submitted feedback: 'Great website!'" in logs[0]

    @patch("sentry.replays.endpoints.project_replay_summary.make_signed_seer_api_request")
    def test_post_with_trace_errors_both_datasets(
        self, mock_make_seer_api_request: MagicMock
    ) -> None:
        """Test that trace connected error snuba query works correctly with both datasets."""
        mock_response = MockSeerResponse(200, {"hello": "world"})
        mock_make_seer_api_request.return_value = mock_response

        now = datetime.now(UTC)
        project_1 = self.create_project()
        project_2 = self.create_project()

        # Create regular error event - errors dataset
        event_id_1 = uuid.uuid4().hex
        trace_id_1 = uuid.uuid4().hex
        timestamp_1 = (now - timedelta(minutes=2)).timestamp()
        self.store_event(
            data={
                "event_id": event_id_1,
                "timestamp": timestamp_1,
                "exception": {
                    "values": [
                        {
                            "type": "ValueError",
                            "value": "Invalid input",
                        }
                    ]
                },
                "contexts": {
                    "trace": {
                        "type": "trace",
                        "trace_id": trace_id_1,
                        "span_id": "1" + uuid.uuid4().hex[:15],
                    }
                },
            },
            project_id=project_1.id,
        )

        # Create feedback event - issuePlatform dataset
        event_id_2 = uuid.uuid4().hex
        trace_id_2 = uuid.uuid4().hex
        timestamp_2 = (now - timedelta(minutes=5)).timestamp()

        feedback_data = {
            "type": "feedback",
            "event_id": event_id_2,
            "timestamp": timestamp_2,
            "contexts": {
                "feedback": {
                    "contact_email": "test@example.com",
                    "name": "Test User",
                    "message": "Great website",
                    "replay_id": self.replay_id,
                    "url": "https://example.com",
                },
                "trace": {
                    "type": "trace",
                    "trace_id": trace_id_2,
                    "span_id": "2" + uuid.uuid4().hex[:15],
                },
            },
        }

        create_feedback_issue(
            feedback_data, project_2, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
        )

        # Store the replay with all trace IDs
        self.store_replay(trace_ids=[trace_id_1, trace_id_2])

        data = [
            {
                "type": 5,
                "timestamp": 0.0,
                "data": {
                    "tag": "breadcrumb",
                    "payload": {"category": "console", "message": "hello"},
                },
            },
        ]
        self.save_recording_segment(0, json.dumps(data).encode())

        with self.feature(self.features):
            response = self.client.post(
                self.url, data={"num_segments": 1}, content_type="application/json"
            )

        assert response.status_code == 200
        assert response.get("Content-Type") == "application/json"
        assert response.json() == {"hello": "world"}

        mock_make_seer_api_request.assert_called_once()
        call_args = mock_make_seer_api_request.call_args
        request_body = json.loads(call_args[1]["body"].decode())
        logs = request_body["logs"]
        assert len(logs) == 3

        # Verify that feedback event is included
        assert "Great website" in logs[1]
        assert "User submitted feedback" in logs[1]

        # Verify that regular error event is included
        assert "ValueError" in logs[2]
        assert "Invalid input" in logs[2]
        assert "User experienced an error" in logs[2]

    @patch("sentry.replays.usecases.summarize.fetch_feedback_details")
    @patch("sentry.replays.endpoints.project_replay_summary.make_signed_seer_api_request")
    def test_post_with_trace_errors_duplicate_feedback(
        self, mock_make_seer_api_request: MagicMock, mock_fetch_feedback_details: MagicMock
    ) -> None:
        """Test that duplicate feedback events are filtered.
        Duplicates may happen when the replay has a feedback breadcrumb,
        and the feedback is also returned from the Snuba query for trace-connected errors."""
        mock_response = MockSeerResponse(200, {"hello": "world"})
        mock_make_seer_api_request.return_value = mock_response

        now = datetime.now(UTC)
        feedback_event_id = uuid.uuid4().hex
        feedback_event_id_2 = uuid.uuid4().hex
        trace_id = uuid.uuid4().hex
        trace_id_2 = uuid.uuid4().hex

        # Create feedback event - issuePlatform dataset
        feedback_data: dict[str, Any] = {
            "type": "feedback",
            "event_id": feedback_event_id,
            "timestamp": (now - timedelta(minutes=3)).timestamp(),
            "contexts": {
                "feedback": {
                    "contact_email": "test@example.com",
                    "name": "Test User",
                    "message": "Great website",
                    "replay_id": self.replay_id,
                    "url": "https://example.com",
                },
                "trace": {
                    "type": "trace",
                    "trace_id": trace_id,
                    "span_id": "1" + uuid.uuid4().hex[:15],
                },
            },
        }

        # Create another feedback event - issuePlatform dataset
        feedback_data_2: dict[str, Any] = {
            "type": "feedback",
            "event_id": feedback_event_id_2,
            "timestamp": (now - timedelta(minutes=2)).timestamp(),
            "contexts": {
                "feedback": {
                    "contact_email": "test2@example.com",
                    "name": "Test User 2",
                    "message": "Broken website",
                    "replay_id": self.replay_id,
                    "url": "https://example.com",
                },
                "trace": {
                    "type": "trace",
                    "trace_id": trace_id_2,
                    "span_id": "1" + uuid.uuid4().hex[:15],
                },
            },
        }

        create_feedback_issue(
            feedback_data, self.project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
        )
        create_feedback_issue(
            feedback_data_2, self.project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
        )

        self.store_replay(trace_ids=[trace_id, trace_id_2])

        # mock SDK feedback event with same event_id as the first feedback event
        data = [
            {
                "type": 5,
                "timestamp": float((now - timedelta(minutes=3)).timestamp()),
                "data": {
                    "tag": "breadcrumb",
                    "payload": {
                        "category": "sentry.feedback",
                        "data": {"feedbackId": feedback_event_id},
                    },
                },
            },
        ]
        self.save_recording_segment(0, json.dumps(data).encode())

        # Mock fetch_feedback_details to return a dup of the first feedback event.
        # In prod this is from nodestore. We had difficulties writing to nodestore in tests.
        mock_fetch_feedback_details.return_value = EventDict(
            id=feedback_event_id,
            title="User Feedback",
            message=feedback_data["contexts"]["feedback"]["message"],
            timestamp=float(feedback_data["timestamp"]),
            category="feedback",
        )

        with self.feature(self.features):
            response = self.client.post(
                self.url, data={"num_segments": 1}, content_type="application/json"
            )

        assert response.status_code == 200
        assert response.get("Content-Type") == "application/json"
        assert response.json() == {"hello": "world"}

        mock_make_seer_api_request.assert_called_once()
        call_args = mock_make_seer_api_request.call_args
        request_body = json.loads(call_args[1]["body"].decode())
        logs = request_body["logs"]

        # Verify that only the unique feedback logs are included
        assert len(logs) == 2
        assert "User submitted feedback" in logs[0]
        assert "Great website" in logs[0]
        assert "User submitted feedback" in logs[1]
        assert "Broken website" in logs[1]

    @patch("sentry.replays.endpoints.project_replay_summary.MAX_SEGMENTS_TO_SUMMARIZE", 1)
    @patch("sentry.replays.endpoints.project_replay_summary.make_signed_seer_api_request")
    def test_post_max_segments_exceeded(self, mock_make_seer_api_request: Mock) -> None:
        mock_response = MockSeerResponse(200, json_data={"hello": "world"})
        mock_make_seer_api_request.return_value = mock_response

        data1 = [
            {
                "type": 5,
                "timestamp": 0.0,
                "data": {
                    "tag": "breadcrumb",
                    "payload": {"category": "console", "message": "hello"},
                },
            }
        ]
        data2 = [
            {
                "type": 5,
                "timestamp": 0.0,
                "data": {
                    "tag": "breadcrumb",
                    "payload": {"category": "console", "message": "world"},
                },
            },
        ]
        self.save_recording_segment(0, json.dumps(data1).encode())
        self.save_recording_segment(1, json.dumps(data2).encode())
        self.store_replay()

        with self.feature(self.features):
            response = self.client.post(
                self.url, data={"num_segments": 2}, content_type="application/json"
            )

        assert response.status_code == 200

        mock_make_seer_api_request.assert_called_once()
        call_args = mock_make_seer_api_request.call_args
        assert call_args[1]["path"] == SEER_START_TASK_ENDPOINT_PATH
        request_body = json.loads(call_args[1]["body"].decode())
        assert request_body == {
            "logs": ["Logged: 'hello' at 0.0"],  # only 1 log from the first segment.
            "num_segments": 1,  # capped to 1.
            "replay_id": self.replay_id,
            "organization_id": self.organization.id,
            "project_id": self.project.id,
            "temperature": None,
        }

    @patch("sentry.replays.endpoints.project_replay_summary.make_signed_seer_api_request")
    def test_post_with_temperature(self, mock_make_seer_api_request: Mock) -> None:
        mock_response = MockSeerResponse(200, json_data={"hello": "world"})
        mock_make_seer_api_request.return_value = mock_response

        data = [
            {
                "type": 5,
                "timestamp": 0.0,
                "data": {
                    "tag": "breadcrumb",
                    "payload": {"category": "console", "message": "hello"},
                },
            },
        ]
        self.save_recording_segment(0, json.dumps(data).encode())
        self.store_replay()

        with self.feature(self.features):
            response = self.client.post(
                self.url,
                data={"num_segments": 1, "temperature": 0.73},
                content_type="application/json",
            )

        assert response.status_code == 200

        mock_make_seer_api_request.assert_called_once()
        call_args = mock_make_seer_api_request.call_args
        assert call_args[1]["path"] == SEER_START_TASK_ENDPOINT_PATH
        request_body = json.loads(call_args[1]["body"].decode())
        assert request_body == {
            "logs": ["Logged: 'hello' at 0.0"],
            "num_segments": 1,
            "replay_id": self.replay_id,
            "organization_id": self.organization.id,
            "project_id": self.project.id,
            "temperature": 0.73,
        }

    @patch("sentry.replays.endpoints.project_replay_summary.make_signed_seer_api_request")
    def test_seer_timeout(self, mock_make_seer_api_request: Mock) -> None:
        for method in ["GET", "POST"]:
            mock_make_seer_api_request.side_effect = requests.exceptions.Timeout(
                "Request timed out"
            )
            self.save_recording_segment(0, json.dumps([]).encode())
            self.store_replay()

            with self.feature(self.features):
                response = (
                    self.client.get(self.url)
                    if method == "GET"
                    else self.client.post(
                        self.url, data={"num_segments": 1}, content_type="application/json"
                    )
                )

            assert response.status_code == 500, method

    @patch("sentry.replays.endpoints.project_replay_summary.make_signed_seer_api_request")
    def test_seer_connection_error(self, mock_make_seer_api_request: Mock) -> None:
        for method in ["GET", "POST"]:
            mock_make_seer_api_request.side_effect = requests.exceptions.ConnectionError(
                "Connection error"
            )
            self.save_recording_segment(0, json.dumps([]).encode())
            self.store_replay()

            with self.feature(self.features):
                response = (
                    self.client.get(self.url)
                    if method == "GET"
                    else self.client.post(
                        self.url, data={"num_segments": 1}, content_type="application/json"
                    )
                )

            assert response.status_code == 500, method

    @patch("sentry.replays.endpoints.project_replay_summary.make_signed_seer_api_request")
    def test_seer_request_error(self, mock_make_seer_api_request: Mock) -> None:
        for method in ["GET", "POST"]:
            mock_make_seer_api_request.side_effect = requests.exceptions.RequestException(
                "Generic request error"
            )
            self.save_recording_segment(0, json.dumps([]).encode())
            self.store_replay()

            with self.feature(self.features):
                response = (
                    self.client.get(self.url)
                    if method == "GET"
                    else self.client.post(
                        self.url, data={"num_segments": 1}, content_type="application/json"
                    )
                )

            assert response.status_code == 500, method

    @patch("sentry.replays.endpoints.project_replay_summary.make_signed_seer_api_request")
    def test_seer_http_errors(self, mock_make_seer_api_request: Mock) -> None:
        for method in ["GET", "POST"]:
            for status in [400, 401, 403, 404, 429, 500, 502, 503, 504]:
                mock_response = MockSeerResponse(
                    status=status,
                    json_data={"error": "Test error"},
                )
                mock_make_seer_api_request.return_value = mock_response
                self.save_recording_segment(0, json.dumps([]).encode())
                self.store_replay()

                with self.feature(self.features):
                    response = (
                        self.client.get(self.url)
                        if method == "GET"
                        else self.client.post(
                            self.url, data={"num_segments": 1}, content_type="application/json"
                        )
                    )

                assert response.status_code == 500, method

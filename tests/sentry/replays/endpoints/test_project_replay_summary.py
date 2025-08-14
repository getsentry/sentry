import uuid
import zlib
from datetime import UTC, datetime
from unittest.mock import Mock, patch

import requests
import responses
from django.conf import settings
from django.urls import reverse

from sentry.feedback.lib.utils import FeedbackCreationSource
from sentry.feedback.usecases.ingest.create_feedback import create_feedback_issue
from sentry.replays.endpoints.project_replay_summary import SEER_POLL_STATE_URL, SEER_START_TASK_URL
from sentry.replays.lib.storage import FilestoreBlob, RecordingSegmentStorageMeta
from sentry.replays.testutils import mock_replay
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.skips import requires_snuba
from sentry.utils import json
from tests.sentry.issues.test_utils import SearchIssueTestMixin


def mock_seer_response(method: str, **kwargs) -> None:
    """Use with @responses.activate to cleanup after tests. Not compatible with store_replay."""
    responses.add(
        responses.POST,
        SEER_START_TASK_URL if method == "POST" else SEER_POLL_STATE_URL,
        **kwargs,
    )


# have to use TransactionTestCase because we're using threadpools
@requires_snuba
class ProjectReplaySummaryTestCase(
    TransactionTestCase,
    SearchIssueTestMixin,
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
            "organizations:gen-ai-features": True,
        }

    def store_replay(self, dt: datetime | None = None, **kwargs) -> None:
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
            (False, True, True),
            (True, False, True),
            (True, True, False),
            (True, False, False),
            (False, True, False),
            (False, False, True),
            (False, False, False),
        ]

        for replay, replay_ai, gen_ai in features:
            with self.feature(
                {
                    "organizations:session-replay": replay,
                    "organizations:replay-ai-summaries": replay_ai,
                    "organizations:gen-ai-features": gen_ai,
                }
            ):
                for method in ["GET", "POST"]:
                    response = (
                        self.client.get(self.url) if method == "GET" else self.client.post(self.url)
                    )
                    assert response.status_code == 404, (replay, replay_ai, gen_ai, method)

    @responses.activate
    def test_get_simple(self) -> None:
        mock_seer_response("GET", status=200, json={"hello": "world"})
        with self.feature(self.features):
            response = self.client.get(self.url)
            assert response.status_code == 200
            assert response.json() == {"hello": "world"}

        assert len(responses.calls) == 1
        seer_request = responses.calls[0].request
        assert seer_request.url == SEER_POLL_STATE_URL
        assert seer_request.method == "POST"
        assert seer_request.headers["content-type"] == "application/json;charset=utf-8"
        assert seer_request.body == json.dumps({"replay_id": self.replay_id})

    @responses.activate
    def test_post_simple(self) -> None:
        mock_seer_response("POST", status=200, json={"hello": "world"})

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

        with self.feature(self.features):
            response = self.client.post(
                self.url, data={"num_segments": 2}, content_type="application/json"
            )

        assert response.status_code == 200
        assert response.json() == {"hello": "world"}

        assert len(responses.calls) == 1
        seer_request = responses.calls[0].request
        assert seer_request.url == SEER_START_TASK_URL
        assert seer_request.method == "POST"
        assert seer_request.headers["content-type"] == "application/json;charset=utf-8"
        assert json.loads(seer_request.body) == {
            "logs": ["Logged: hello at 0.0", "Logged: world at 0.0"],
            "num_segments": 2,
            "replay_id": self.replay_id,
            "organization_id": self.organization.id,
            "project_id": self.project.id,
        }

    @patch("sentry.replays.endpoints.project_replay_summary.requests")
    def test_post_with_both_direct_and_trace_connected_errors(self, mock_requests) -> None:
        """Test handling of breadcrumbs with both direct and trace connected errors"""
        mock_requests.post.return_value = Mock(status_code=200, json=lambda: {"hello": "world"})

        now = datetime.now(UTC)
        trace_id = uuid.uuid4().hex

        # Create a direct error event
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
                "contexts": {"replay": {"replay_id": self.replay_id}},
            },
            project_id=self.project.id,
        )

        # Create a trace connected error event
        connected_event_id = uuid.uuid4().hex
        span_id = "1" + uuid.uuid4().hex[:15]
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

        assert mock_requests.post.call_count == 1
        data = mock_requests.post.call_args.kwargs["data"]
        logs = json.loads(data)["logs"]
        assert any("ZeroDivisionError" in log for log in logs)
        assert any("division by zero" in log for log in logs)
        assert any("ConnectionError" in log for log in logs)
        assert any("Failed to connect to database" in log for log in logs)

    @patch("sentry.replays.endpoints.project_replay_summary.requests")
    def test_post_with_feedback_sdk_event(self, mock_requests) -> None:
        """Test handling of breadcrumbs with user feedback"""
        mock_requests.post.return_value = Mock(
            status_code=200, json=lambda: {"feedback": "Feedback was submitted"}
        )

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
                    "payload": {"category": "console", "message": "hello"},
                },
            },
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
        assert response.json() == {"feedback": "Feedback was submitted"}

        assert mock_requests.post.call_count == 1
        data = mock_requests.post.call_args.kwargs["data"]
        logs = json.loads(data)["logs"]
        assert any("Great website!" in log for log in logs)
        assert any("User submitted feedback" in log for log in logs)

    @patch("sentry.replays.endpoints.project_replay_summary.requests")
    def test_post_with_trace_errors_both_datasets(self, mock_requests):
        """Test that trace connected error snuba query works correctly with both datasets."""
        mock_requests.post.return_value = Mock(
            status_code=200, json=lambda: {"summary": "Test summary"}
        )

        now = datetime.now(UTC)
        project_1 = self.create_project()
        project_2 = self.create_project()

        # Create regular error event - errors dataset
        event_id_1 = uuid.uuid4().hex
        trace_id_1 = uuid.uuid4().hex
        timestamp_1 = now.timestamp() - 2
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
        timestamp_2 = now.timestamp()

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
        assert response.json() == {"summary": "Test summary"}

        assert mock_requests.post.call_count == 1
        data = mock_requests.post.call_args.kwargs["data"]
        logs = json.loads(data)["logs"]
        assert len(logs) == 3

        # Verify that regular error event is included
        assert "ValueError" in logs[1]
        assert "Invalid input" in logs[1]
        assert "User experienced an error" in logs[1]

        # Verify that feedback event is included
        assert "Great website" in logs[2]
        assert "User submitted feedback" in logs[2]

    @patch("sentry.replays.endpoints.project_replay_summary.requests")
    def test_post_with_trace_errors_duplicate_feedback(self, mock_requests):
        """Test that duplicate feedback events are filtered."""
        mock_requests.post.return_value = Mock(
            status_code=200, json=lambda: {"summary": "Test summary"}
        )

        now = datetime.now(UTC)
        feedback_event_id = uuid.uuid4().hex
        feedback_event_id_2 = uuid.uuid4().hex
        trace_id = uuid.uuid4().hex
        trace_id_2 = uuid.uuid4().hex

        # Create feedback event - issuePlatform dataset
        feedback_data = {
            "type": "feedback",
            "event_id": feedback_event_id,
            "timestamp": now.timestamp(),
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
        feedback_data_2 = {
            "type": "feedback",
            "event_id": feedback_event_id_2,
            "timestamp": now.timestamp() + 2,
            "contexts": {
                "feedback": {
                    "contact_email": "test@example.com",
                    "name": "Test User",
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
        assert response.get("Content-Type") == "application/json"
        assert response.json() == {"summary": "Test summary"}

        assert mock_requests.post.call_count == 1
        data = mock_requests.post.call_args.kwargs["data"]
        logs = json.loads(data)["logs"]

        # Verify that only the unique feedback logs are included
        assert len(logs) == 2
        assert "User submitted feedback" in logs[0]
        assert "Great website" in logs[0]
        assert "User submitted feedback" in logs[1]
        assert "Broken website" in logs[1]

    @responses.activate
    @patch("sentry.replays.endpoints.project_replay_summary.MAX_SEGMENTS_TO_SUMMARIZE", 1)
    def test_post_max_segments_exceeded(self) -> None:
        mock_seer_response("POST", status=200, json={"hello": "world"})

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

        with self.feature(self.features):
            response = self.client.post(
                self.url, data={"num_segments": 2}, content_type="application/json"
            )

        assert response.status_code == 200

        assert len(responses.calls) == 1
        seer_request = responses.calls[0].request
        assert seer_request.url == SEER_START_TASK_URL
        assert seer_request.method == "POST"
        assert seer_request.headers["content-type"] == "application/json;charset=utf-8"
        assert json.loads(seer_request.body) == {
            "logs": ["Logged: hello at 0.0"],  # only 1 log from the first segment.
            "num_segments": 1,  # capped to 1.
            "replay_id": self.replay_id,
            "organization_id": self.organization.id,
            "project_id": self.project.id,
        }

    @responses.activate
    def test_seer_timeout(self) -> None:
        for method in ["GET", "POST"]:
            mock_seer_response(method, body=requests.exceptions.Timeout("Request timed out"))
            self.save_recording_segment(0, json.dumps([]).encode())

            with self.feature(self.features):
                response = (
                    self.client.get(self.url)
                    if method == "GET"
                    else self.client.post(
                        self.url, data={"num_segments": 1}, content_type="application/json"
                    )
                )

            assert response.status_code == 504, method

    @responses.activate
    def test_seer_connection_error(self) -> None:
        for method in ["GET", "POST"]:
            mock_seer_response(method, body=requests.exceptions.ConnectionError("Connection error"))
            self.save_recording_segment(0, json.dumps([]).encode())

            with self.feature(self.features):
                response = (
                    self.client.get(self.url)
                    if method == "GET"
                    else self.client.post(
                        self.url, data={"num_segments": 1}, content_type="application/json"
                    )
                )

            assert response.status_code == 502, method

    @responses.activate
    def test_seer_request_error(self) -> None:
        for method in ["GET", "POST"]:
            mock_seer_response(
                method, body=requests.exceptions.RequestException("Generic request error")
            )
            self.save_recording_segment(0, json.dumps([]).encode())

            with self.feature(self.features):
                response = (
                    self.client.get(self.url)
                    if method == "GET"
                    else self.client.post(
                        self.url, data={"num_segments": 1}, content_type="application/json"
                    )
                )

            assert response.status_code == 502, method

    @responses.activate
    def test_seer_http_errors(self) -> None:
        for method in ["GET", "POST"]:
            for status in [400, 401, 403, 404, 429, 500, 502, 503, 504]:
                mock_seer_response(method, status=status)
                self.save_recording_segment(0, json.dumps([]).encode())

                with self.feature(self.features):
                    response = (
                        self.client.get(self.url)
                        if method == "GET"
                        else self.client.post(
                            self.url, data={"num_segments": 1}, content_type="application/json"
                        )
                    )

                assert response.status_code == status, method

import uuid
import zlib
from datetime import UTC, datetime
from unittest.mock import Mock, patch

import requests
import responses
from django.conf import settings
from django.urls import reverse

from sentry.replays.endpoints.project_replay_summarize_breadcrumbs_async import (
    SEER_POLL_STATE_URL,
    SEER_START_TASK_URL,
)
from sentry.replays.lib.storage import FilestoreBlob, RecordingSegmentStorageMeta
from sentry.replays.testutils import mock_replay
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.skips import requires_snuba
from sentry.utils import json


def mock_seer_response(method: str, **kwargs) -> None:
    """Use with @responses.activate to cleanup after tests. Not compatible with store_replay."""
    responses.add(
        responses.POST,
        SEER_START_TASK_URL if method == "POST" else SEER_POLL_STATE_URL,
        **kwargs,
    )


# have to use TransactionTestCase because we're using threadpools
@requires_snuba
class ProjectReplaySummarizeBreadcrumbsAsyncTestCase(
    TransactionTestCase,
):
    endpoint = "sentry-api-0-project-replay-summarize-breadcrumbs-v2"

    def setUp(self):
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

    def store_replay(self, dt: datetime | None = None, **kwargs):
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

    def test_feature_flag_disabled(self):
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
    def test_get_simple(self):
        mock_seer_response("GET", status=200, json={"hello": "world"})
        with self.feature(self.features):
            response = self.client.get(self.url)
            assert response.status_code == 200
            assert response.json() == {"hello": "world"}

        assert len(responses.calls) == 1
        request = responses.calls[0].request
        assert request.url == SEER_POLL_STATE_URL
        assert request.method == "POST"
        assert request.body == json.dumps({"replay_id": self.replay_id})

    @responses.activate
    def test_post_simple(self):
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
            response = self.client.post(self.url)

        assert response.status_code == 200
        assert response.json() == {"hello": "world"}

        assert len(responses.calls) == 1
        request = responses.calls[0].request
        assert request.url == SEER_START_TASK_URL
        assert request.method == "POST"
        assert request.headers["content-type"] == "application/json;charset=utf-8"
        assert json.loads(request.body) == {
            "logs": ["Logged: hello at 0.0", "Logged: world at 0.0"],
            "num_segments": 2,
            "replay_id": self.replay_id,
            "organization_id": self.organization.id,
            "project_id": self.project.id,
        }

    @patch("sentry.replays.endpoints.project_replay_summarize_breadcrumbs_async.requests")
    def test_post_with_both_direct_and_trace_connected_errors(self, mock_requests):
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
            response = self.client.post(self.url)
            assert response.status_code == 200
            assert response.get("Content-Type") == "application/json"
            assert response.json() == {"hello": "world"}

        assert mock_requests.post.call_count == 1
        data = mock_requests.post.call_args.kwargs["data"]
        logs = json.loads(data)["logs"]
        assert any("ZeroDivisionError" in log for log in logs)
        assert any("division by zero" in log for log in logs)
        assert any("ConnectionError" in log for log in logs)
        assert any("Failed to connect to database" in log for log in logs)

    @patch("sentry.replays.endpoints.project_replay_summarize_breadcrumbs_async.requests")
    def test_post_with_feedback(self, mock_requests):
        """Test handling of breadcrumbs with user feedback"""
        mock_requests.post.return_value = Mock(
            status_code=200, json=lambda: {"feedback": "Feedback was submitted"}
        )

        now = datetime.now(UTC)
        feedback_event_id = uuid.uuid4().hex

        self.store_event(
            data={
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
            response = self.client.post(self.url)

        assert response.status_code == 200
        assert response.get("Content-Type") == "application/json"
        assert response.json() == {"feedback": "Feedback was submitted"}

        assert mock_requests.post.call_count == 1
        data = mock_requests.post.call_args.kwargs["data"]
        logs = json.loads(data)["logs"]
        assert any("Great website!" in log for log in logs)
        assert any("User submitted feedback" in log for log in logs)

    @responses.activate
    def test_seer_timeout(self):
        for method in ["GET", "POST"]:
            mock_seer_response(method, body=requests.exceptions.Timeout("Request timed out"))
            self.save_recording_segment(0, json.dumps([]).encode())

            with self.feature(self.features):
                response = (
                    self.client.get(self.url) if method == "GET" else self.client.post(self.url)
                )

            assert response.status_code == 504, method

    @responses.activate
    def test_seer_connection_error(self):
        for method in ["GET", "POST"]:
            mock_seer_response(method, body=requests.exceptions.ConnectionError("Connection error"))
            self.save_recording_segment(0, json.dumps([]).encode())

            with self.feature(self.features):
                response = (
                    self.client.get(self.url) if method == "GET" else self.client.post(self.url)
                )

            assert response.status_code == 502, method

    @responses.activate
    def test_seer_request_error(self):
        for method in ["GET", "POST"]:
            mock_seer_response(
                method, body=requests.exceptions.RequestException("Generic request error")
            )
            self.save_recording_segment(0, json.dumps([]).encode())

            with self.feature(self.features):
                response = (
                    self.client.get(self.url) if method == "GET" else self.client.post(self.url)
                )

            assert response.status_code == 502, method

    @responses.activate
    def test_seer_http_errors(self):
        for method in ["GET", "POST"]:
            for status in [400, 401, 403, 404, 429, 500, 502, 503, 504]:
                mock_seer_response(method, status=status)
                self.save_recording_segment(0, json.dumps([]).encode())

                with self.feature(self.features):
                    response = (
                        self.client.get(self.url) if method == "GET" else self.client.post(self.url)
                    )

                assert response.status_code == status, method

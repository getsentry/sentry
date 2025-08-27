import uuid
import zlib
from datetime import UTC, datetime
from unittest.mock import Mock, patch

import requests
from django.conf import settings
from django.urls import reverse

from sentry.replays.endpoints.project_replay_summary import (
    SEER_POLL_STATE_ENDPOINT_PATH,
    SEER_START_TASK_ENDPOINT_PATH,
)
from sentry.replays.lib.storage import FilestoreBlob, RecordingSegmentStorageMeta
from sentry.replays.testutils import mock_replay
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.skips import requires_snuba
from sentry.utils import json


class MockSeerResponse:
    def __init__(self, status: int, json_data: dict):
        self.status = status
        self.json_data = json_data
        self.data = json.dumps(json_data)

    def json(self):
        return self.json_data


# have to use TransactionTestCase because we're using threadpools
@requires_snuba
class ProjectReplaySummaryTestCase(
    TransactionTestCase,
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

    @patch("sentry.replays.endpoints.project_replay_summary.make_signed_seer_api_request")
    def test_post_with_both_direct_and_trace_connected_errors(
        self, mock_make_seer_api_request: Mock
    ) -> None:
        """Test handling of breadcrumbs with both direct and trace connected errors"""
        mock_response = MockSeerResponse(200, json_data={"hello": "world"})
        mock_make_seer_api_request.return_value = mock_response

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

        mock_make_seer_api_request.assert_called_once()
        request_body = json.loads(mock_make_seer_api_request.call_args[1]["body"].decode())
        logs = request_body["logs"]
        assert any("ZeroDivisionError" in log for log in logs)
        assert any("division by zero" in log for log in logs)
        assert any("ConnectionError" in log for log in logs)
        assert any("Failed to connect to database" in log for log in logs)

    @patch("sentry.replays.endpoints.project_replay_summary.make_signed_seer_api_request")
    def test_post_with_feedback(self, mock_make_seer_api_request: Mock) -> None:
        """Test handling of breadcrumbs with user feedback"""
        mock_response = MockSeerResponse(
            200,
            json_data={"feedback": "Feedback was submitted"},
        )
        mock_make_seer_api_request.return_value = mock_response

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
            response = self.client.post(
                self.url, data={"num_segments": 1}, content_type="application/json"
            )

        assert response.status_code == 200
        assert response.json() == {"feedback": "Feedback was submitted"}

        mock_make_seer_api_request.assert_called_once()
        request_body = json.loads(mock_make_seer_api_request.call_args[1]["body"].decode())
        logs = request_body["logs"]
        assert any("Great website!" in log for log in logs)
        assert any("User submitted feedback" in log for log in logs)

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

                with self.feature(self.features):
                    response = (
                        self.client.get(self.url)
                        if method == "GET"
                        else self.client.post(
                            self.url, data={"num_segments": 1}, content_type="application/json"
                        )
                    )

                assert response.status_code == 500, method

import uuid
import zlib
from datetime import UTC, datetime

import requests
import responses
from django.conf import settings
from django.urls import reverse

from sentry.eventstore.models import Event
from sentry.replays.endpoints.project_replay_summarize_breadcrumbs_async import (
    SEER_POLL_STATE_URL,
    SEER_START_TASK_URL,
)
from sentry.replays.lib.storage import FilestoreBlob, RecordingSegmentStorageMeta
from sentry.replays.testutils import mock_replay
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.skips import requires_snuba
from sentry.utils import json


def mock_response(method: str, **kwargs) -> None:
    """Use with @responses.activate to cleanup after tests."""
    responses.add(
        responses.POST if method == "POST" else responses.GET,
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

    def store_feedback_event(self, dt: datetime | None = None) -> Event:
        event_id = uuid.uuid4().hex
        return self.store_event(
            data={
                "event_id": event_id,
                "timestamp": (dt or datetime.now(UTC)).timestamp(),
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
    def test_post_simple(self):
        mock_response("POST", status=200, json={"hello": "world"})

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

    @responses.activate
    def test_post_seer_timeout(self):
        mock_response("POST", body=requests.exceptions.Timeout("Request timed out"))
        self.save_recording_segment(0, json.dumps([]).encode())

        with self.feature(self.features):
            response = self.client.post(self.url)

        assert response.status_code == 504

    @responses.activate
    def test_post_seer_connection_error(self):
        mock_response("POST", body=requests.exceptions.ConnectionError("Connection error"))
        self.save_recording_segment(0, json.dumps([]).encode())

        with self.feature(self.features):
            response = self.client.post(self.url)

        assert response.status_code == 502

    @responses.activate
    def test_post_seer_request_error(self):
        mock_response("POST", body=requests.exceptions.RequestException("Generic request error"))
        self.save_recording_segment(0, json.dumps([]).encode())

        with self.feature(self.features):
            response = self.client.post(self.url)

        assert response.status_code == 502

    @responses.activate
    def test_post_seer_http_errors(self):
        for status in [400, 401, 403, 404, 429, 500, 502, 503, 504]:
            mock_response("POST", status=status)
            self.save_recording_segment(0, json.dumps([]).encode())

            with self.feature(self.features):
                response = self.client.post(self.url)

            assert response.status_code == status

    # Some rule in requests exc handling causes GET to always raise connection error for any requests lib exception, which we handle as 502.

    @responses.activate
    def test_get_seer_timeout(self):
        mock_response("GET", body=requests.exceptions.Timeout("Request timed out"))
        self.save_recording_segment(0, json.dumps([]).encode())

        with self.feature(self.features):
            response = self.client.get(self.url)

        assert response.status_code == 502

    @responses.activate
    def test_get_seer_connection_error(self):
        mock_response("GET", body=requests.exceptions.ConnectionError("Connection error"))
        self.save_recording_segment(0, json.dumps([]).encode())

        with self.feature(self.features):
            response = self.client.get(self.url)

        assert response.status_code == 502

    @responses.activate
    def test_get_seer_request_error(self):
        mock_response("GET", body=requests.exceptions.RequestException("Generic request error"))
        self.save_recording_segment(0, json.dumps([]).encode())

        with self.feature(self.features):
            response = self.client.get(self.url)

        assert response.status_code == 502

    @responses.activate
    def test_get_seer_http_errors(self):
        for status in [400, 401, 403, 404, 429, 500, 502, 503, 504]:
            mock_response("GET", status=status)
            self.save_recording_segment(0, json.dumps([]).encode())

            with self.feature(self.features):
                response = self.client.get(self.url)

            assert response.status_code == 502

    # @patch("sentry.replays.endpoints.project_replay_summarize_breadcrumbs.make_seer_request")
    # def test_post_with_both_direct_and_trace_connected_errors(self, make_seer_request):
    #     """Test handling of breadcrumbs with both direct and trace connected errors"""
    #     make_seer_request.return_value = Response(data={"hello": "world"}, status=200)

    #     now = datetime.now(timezone.utc)
    #     trace_id = uuid.uuid4().hex

    #     # Create a direct error event
    #     direct_event_id = uuid.uuid4().hex
    #     direct_error_timestamp = now.timestamp() - 2
    #     self.store_event(
    #         data={
    #             "event_id": direct_event_id,
    #             "timestamp": direct_error_timestamp,
    #             "exception": {
    #                 "values": [
    #                     {
    #                         "type": "ZeroDivisionError",
    #                         "value": "division by zero",
    #                     }
    #                 ]
    #             },
    #             "contexts": {"replay": {"replay_id": self.replay_id}},
    #         },
    #         project_id=self.project.id,
    #     )

    #     # Create a trace connected error event
    #     connected_event_id = uuid.uuid4().hex
    #     span_id = "1" + uuid.uuid4().hex[:15]
    #     connected_error_timestamp = now.timestamp() - 1
    #     project_2 = self.create_project()
    #     self.store_event(
    #         data={
    #             "event_id": connected_event_id,
    #             "timestamp": connected_error_timestamp,
    #             "exception": {
    #                 "values": [
    #                     {
    #                         "type": "ConnectionError",
    #                         "value": "Failed to connect to database",
    #                     }
    #                 ]
    #             },
    #             "contexts": {
    #                 "trace": {
    #                     "type": "trace",
    #                     "trace_id": trace_id,
    #                     "span_id": span_id,
    #                 }
    #             },
    #         },
    #         project_id=project_2.id,
    #     )

    #     # Store the replay with both error IDs and trace IDs
    #     self.store_replays(
    #         mock_replay(
    #             now,
    #             self.project.id,
    #             self.replay_id,
    #             error_ids=[direct_event_id],
    #             trace_ids=[trace_id],
    #         )
    #     )

    #     data = [
    #         {
    #             "type": 5,
    #             "timestamp": float(now.timestamp()),
    #             "data": {
    #                 "tag": "breadcrumb",
    #                 "payload": {"category": "console", "message": "hello"},
    #             },
    #         }
    #     ]
    #     self.save_recording_segment(0, json.dumps(data).encode())

    #     with self.feature(
    #         {
    #             "organizations:session-replay": True,
    #             "organizations:replay-ai-summaries": True,
    #             "organizations:gen-ai-features": True,
    #         }
    #     ):
    #         response = self.client.post(self.url)

    #     make_seer_request.assert_called_once()
    #     seer_request = make_seer_request.call_args[0][0]
    #     assert "logs" in seer_request
    #     assert any("ZeroDivisionError" in log for log in seer_request["logs"])
    #     assert any("division by zero" in log for log in seer_request["logs"])
    #     assert any("ConnectionError" in log for log in seer_request["logs"])
    #     assert any("Failed to connect to database" in log for log in seer_request["logs"])

    #     assert response.status_code == 200
    #     assert response.get("Content-Type") == "application/json"
    #     assert response.content == return_value

    # @patch("sentry.replays.endpoints.project_replay_summarize_breadcrumbs.make_seer_request")
    # def test_post_with_feedback(self, make_seer_request):
    #     """Test handling of breadcrumbs with user feedback"""
    #     return_value = json.dumps({"feedback": "Feedback was submitted"}).encode()
    #     make_seer_request.return_value = return_value

    #     self.mock_create_feedback_occurrence(self.project.id, replay_id=self.replay_id)

    #     now = datetime.now(timezone.utc)

    #     self.store_replays(
    #         mock_replay(
    #             now,
    #             self.project.id,
    #             self.replay_id,
    #         )
    #     )

    #     data = [
    #         {
    #             "type": 5,
    #             "timestamp": float(now.timestamp()),
    #             "data": {
    #                 "tag": "breadcrumb",
    #                 "payload": {"category": "console", "message": "hello"},
    #             },
    #         },
    #         {
    #             "type": 5,
    #             "timestamp": float(now.timestamp()),
    #             "data": {
    #                 "tag": "breadcrumb",
    #                 "payload": {
    #                     "category": "sentry.feedback",
    #                     "data": {"feedbackId": "56b08cf7852c42cbb95e4a6998c66ad6"},
    #                 },
    #             },
    #         },
    #     ]
    #     self.save_recording_segment(0, json.dumps(data).encode())

    #     with self.feature(
    #         {
    #             "organizations:session-replay": True,
    #             "organizations:replay-ai-summaries": True,
    #             "organizations:gen-ai-features": True,
    #         }
    #     ):
    #         response = self.client.post(self.url)

    #     make_seer_request.assert_called_once()
    #     seer_request = make_seer_request.call_args[0][0]
    #     assert "logs" in seer_request
    #     assert any("Great website!" in log for log in seer_request["logs"])
    #     assert any("User submitted feedback" in log for log in seer_request["logs"])

    #     assert response.status_code == 200
    #     assert response.get("Content-Type") == "application/json"
    #     assert response.content == return_value

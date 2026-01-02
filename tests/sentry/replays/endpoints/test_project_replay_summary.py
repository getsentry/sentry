import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import Mock, patch

import requests
from django.conf import settings
from django.urls import reverse

from sentry.replays.endpoints.project_replay_summary import (
    SEER_POLL_STATE_ENDPOINT_PATH,
    SEER_START_TASK_ENDPOINT_PATH,
)
from sentry.replays.testutils import mock_replay
from sentry.testutils.cases import SnubaTestCase, TransactionTestCase
from sentry.utils import json


class MockSeerResponse:
    def __init__(self, status: int, json_data: dict[str, str]):
        self.status = status
        self.json_data = json_data
        self.data = json.dumps(json_data)

    def json(self) -> dict[str, str]:
        return self.json_data


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
        replay = mock_replay(
            dt or datetime.now(UTC) - timedelta(minutes=1),  # Avoid clock skew query issues.
            self.project.id,
            self.replay_id,
            **kwargs,
        )
        response = requests.post(
            settings.SENTRY_SNUBA + "/tests/entities/replays/insert", json=[replay]
        )
        assert response.status_code == 200

    def test_feature_flag_disabled(self) -> None:
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
                    # When session-replay is disabled, endpoint returns 404
                    # When session-replay is enabled but replay-ai-summaries is disabled, returns 403
                    expected_status = 404 if not replay else 403
                    assert response.status_code == expected_status, (replay, replay_ai, method)

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
        mock_make_seer_api_request.return_value = MockSeerResponse(
            200, json_data={"hello": "world"}
        )

        start = datetime.now(UTC) - timedelta(days=3)
        end = datetime.now(UTC) - timedelta(days=2, hours=23)
        self.store_replay(dt=start, segment_id=0)
        self.store_replay(dt=end, segment_id=1)

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

        assert request_body["replay_id"] == self.replay_id
        assert abs(datetime.fromisoformat(request_body["replay_start"]) - start) <= timedelta(
            seconds=1
        )
        assert abs(datetime.fromisoformat(request_body["replay_end"]) - end) <= timedelta(seconds=1)
        assert request_body["num_segments"] == 2
        assert request_body["organization_id"] == self.organization.id
        assert request_body["project_id"] == self.project.id
        assert request_body["temperature"] is None

    def test_post_replay_not_found(self) -> None:
        with self.feature(self.features):
            response = self.client.post(
                self.url, data={"num_segments": 2}, content_type="application/json"
            )
            assert response.status_code == 404

    @patch("sentry.replays.endpoints.project_replay_summary.MAX_SEGMENTS_TO_SUMMARIZE", 1)
    @patch("sentry.replays.endpoints.project_replay_summary.make_signed_seer_api_request")
    def test_post_max_segments_exceeded(self, mock_make_seer_api_request: Mock) -> None:
        mock_make_seer_api_request.return_value = MockSeerResponse(
            200, json_data={"hello": "world"}
        )
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
        assert request_body["num_segments"] == 1

    @patch("sentry.replays.endpoints.project_replay_summary.make_signed_seer_api_request")
    def test_post_with_temperature(self, mock_make_seer_api_request: Mock) -> None:
        mock_make_seer_api_request.return_value = MockSeerResponse(
            200, json_data={"hello": "world"}
        )
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
        assert request_body["temperature"] == 0.73

    @patch("sentry.replays.endpoints.project_replay_summary.make_signed_seer_api_request")
    def test_seer_timeout(self, mock_make_seer_api_request: Mock) -> None:
        for method in ["GET", "POST"]:
            mock_make_seer_api_request.side_effect = requests.exceptions.Timeout(
                "Request timed out"
            )
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

import uuid
import zlib
from datetime import datetime, timezone
from unittest.mock import patch

import requests
from django.conf import settings
from django.urls import reverse
from rest_framework.exceptions import ParseError

from sentry.replays.endpoints.project_replay_summarize_breadcrumbs import get_request_data
from sentry.replays.lib.storage import FilestoreBlob, RecordingSegmentStorageMeta
from sentry.replays.testutils import mock_replay
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.skips import requires_snuba
from sentry.utils import json


@requires_snuba
class ProjectReplaySummarizeBreadcrumbsTestCase(TransactionTestCase):
    endpoint = "sentry-api-0-project-replay-summarize-breadcrumbs"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.replay_id = uuid.uuid4().hex
        self.url = reverse(
            self.endpoint,
            args=(self.organization.slug, self.project.slug, self.replay_id),
        )

    def store_replays(self, replay):
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

    def test_get_request_data(self):
        def _faker():
            yield 0, memoryview(
                json.dumps(
                    [
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
                ).encode()
            )

        result = get_request_data(_faker(), error_ids=[], project_id=self.project.id)
        assert result == ["Logged: hello at 0.0", "Logged: world at 0.0"]

    @patch("sentry.replays.endpoints.project_replay_summarize_breadcrumbs.make_seer_request")
    def test_get(self, make_seer_request):
        return_value = json.dumps({"hello": "world"}).encode()
        make_seer_request.return_value = return_value

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

        with self.feature(
            {
                "organizations:session-replay": True,
                "organizations:replay-ai-summaries": True,
                "organizations:gen-ai-features": True,
            }
        ):
            response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.get("Content-Type") == "application/json"
        assert response.content == return_value

    def test_get_feature_flag_disabled(self):
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
                response = self.client.get(self.url)
                assert response.status_code == 404

    @patch("sentry.replays.endpoints.project_replay_summarize_breadcrumbs.make_seer_request")
    def test_get_seer_failed(self, make_seer_request):
        def x(x):
            raise ParseError("e")

        make_seer_request.side_effect = x
        self.save_recording_segment(0, json.dumps([]).encode())

        with self.feature(
            {
                "organizations:session-replay": True,
                "organizations:replay-ai-summaries": True,
                "organizations:gen-ai-features": True,
            }
        ):
            response = self.client.get(self.url)

        assert response.status_code == 400
        assert response.get("Content-Type") == "application/json"
        assert response.json() == {"detail": "e"}

    @patch("sentry.replays.endpoints.project_replay_summarize_breadcrumbs.make_seer_request")
    def test_get_with_error(self, make_seer_request):
        """Test handling of breadcrumbs with error"""
        return_value = json.dumps({"error": "An error happened"}).encode()
        make_seer_request.return_value = return_value

        now = datetime.now(timezone.utc)
        event_id = uuid.uuid4().hex

        self.store_event(
            data={
                "event_id": event_id,
                "timestamp": float(now.timestamp()),
                "exception": [
                    {
                        "type": "ZeroDivisionError",
                        "value": "division by zero",
                    }
                ],
            },
            project_id=self.project.id,
        )

        self.store_replays(
            mock_replay(
                now,
                self.project.id,
                self.replay_id,
                error_ids=[event_id],
            )
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

        with self.feature(
            {
                "organizations:session-replay": True,
                "organizations:replay-ai-summaries": True,
                "organizations:gen-ai-features": True,
            }
        ):
            response = self.client.get(self.url)

        make_seer_request.assert_called_once()
        call_args = json.loads(make_seer_request.call_args[0][0])
        assert "logs" in call_args
        assert any("division by zero" in log for log in call_args["logs"])
        assert any("ZeroDivisionError" in log for log in call_args["logs"])

        assert response.status_code == 200
        assert response.get("Content-Type") == "application/json"
        assert response.content == return_value

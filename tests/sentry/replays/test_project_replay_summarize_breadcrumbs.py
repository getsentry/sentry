import uuid
import zlib
from unittest.mock import patch

from django.urls import reverse
from rest_framework.exceptions import ParseError

from sentry.replays.endpoints.project_replay_summarize_breadcrumbs import get_request_data
from sentry.replays.lib.storage import FilestoreBlob, RecordingSegmentStorageMeta
from sentry.testutils.cases import TransactionTestCase
from sentry.utils import json


# have to use TransactionTestCase because we're using threadpools
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
    def test_get_invalid_breadcrumb_data(self, make_seer_request):
        """Test handling of invalid breadcrumb data format"""
        return_value = json.dumps({"error": "Invalid breadcrumb format"}).encode()
        make_seer_request.return_value = return_value

        # Test with malformed breadcrumb data
        data = [
            {
                "type": 5,
                "timestamp": 0.0,
                "data": {
                    "tag": "breadcrumb",
                    # Missing payload field
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

        assert response.status_code == 500

    @patch("sentry.replays.endpoints.project_replay_summarize_breadcrumbs.make_seer_request")
    def test_get_empty_breadcrumbs(self, make_seer_request):
        """Test handling of empty breadcrumbs list"""
        return_value = json.dumps({"message": "No breadcrumbs found"}).encode()
        make_seer_request.return_value = return_value

        # Test with empty breadcrumbs
        data = []
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

    @patch("sentry.replays.endpoints.project_replay_summarize_breadcrumbs.make_seer_request")
    def test_get_missing_segment(self, make_seer_request):
        """Test handling of missing recording segment"""
        return_value = json.dumps({"error": "Recording segment not found"}).encode()
        make_seer_request.return_value = return_value

        # Don't save any recording segment
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

    @patch("sentry.replays.endpoints.project_replay_summarize_breadcrumbs.make_seer_request")
    def test_get_corrupted_segment_data(self, make_seer_request):
        """Test handling of corrupted segment data"""
        return_value = json.dumps({"error": "Invalid segment data"}).encode()
        make_seer_request.return_value = return_value

        # Save corrupted data
        self.save_recording_segment(0, b"invalid json data", compressed=False)

        with self.feature(
            {
                "organizations:session-replay": True,
                "organizations:replay-ai-summaries": True,
                "organizations:gen-ai-features": True,
            }
        ):
            response = self.client.get(self.url)

        assert response.status_code == 500

    @patch("sentry.replays.endpoints.project_replay_summarize_breadcrumbs.make_seer_request")
    def test_get_with_user_feedback(self, make_seer_request):
        """Test handling of breadcrumbs with user feedback"""
        return_value = json.dumps({"feedback": "User feedback included"}).encode()
        make_seer_request.return_value = return_value

        data = [
            {
                "type": 5,
                "timestamp": 0.0,
                "data": {
                    "tag": "breadcrumb",
                    "payload": {
                        "category": "feedback",
                        "message": "This feature is great!",
                        "level": "info",
                        "user": {"email": "user@example.com", "name": "Test User"},
                    },
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

        assert response.status_code == 200
        assert response.get("Content-Type") == "application/json"
        assert response.content == return_value

    @patch("sentry.replays.endpoints.project_replay_summarize_breadcrumbs.make_seer_request")
    def test_get_with_error_events(self, make_seer_request):
        """Test handling of breadcrumbs with error events"""
        return_value = json.dumps({"errors": "Error events included"}).encode()
        make_seer_request.return_value = return_value

        data = [
            {
                "type": 5,
                "timestamp": 0.0,
                "data": {
                    "tag": "breadcrumb",
                    "payload": {
                        "category": "error",
                        "message": "TypeError: Cannot read property of undefined",
                        "level": "error",
                        "data": {"stack": "Error stack trace...", "type": "TypeError"},
                    },
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

        assert response.status_code == 200
        assert response.get("Content-Type") == "application/json"
        assert response.content == return_value

    @patch("sentry.replays.endpoints.project_replay_summarize_breadcrumbs.make_seer_request")
    def test_get_with_mixed_events(self, make_seer_request):
        """Test handling of breadcrumbs with mixed feedback and error events"""
        return_value = json.dumps({"mixed": "Mixed events included"}).encode()
        make_seer_request.return_value = return_value

        data = [
            {
                "type": 5,
                "timestamp": 0.0,
                "data": {
                    "tag": "breadcrumb",
                    "payload": {
                        "category": "feedback",
                        "message": "User feedback message",
                        "level": "info",
                    },
                },
            },
            {
                "type": 5,
                "timestamp": 1.0,
                "data": {
                    "tag": "breadcrumb",
                    "payload": {"category": "error", "message": "Error message", "level": "error"},
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

    @patch("sentry.replays.endpoints.project_replay_summarize_breadcrumbs.make_seer_request")
    def test_get_with_error_context(self, make_seer_request):
        """Test handling of breadcrumbs with error context information"""
        return_value = json.dumps({"error_context": "Error context included"}).encode()
        make_seer_request.return_value = return_value

        data = [
            {
                "type": 5,
                "timestamp": 0.0,
                "data": {
                    "tag": "breadcrumb",
                    "payload": {
                        "category": "error",
                        "message": "Error occurred",
                        "level": "error",
                        "data": {
                            "stack": "Error stack trace...",
                            "type": "Error",
                            "context": {
                                "url": "https://example.com",
                                "component": "Button",
                                "state": {"count": 5},
                            },
                        },
                    },
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

        assert response.status_code == 200
        assert response.get("Content-Type") == "application/json"
        assert response.content == return_value

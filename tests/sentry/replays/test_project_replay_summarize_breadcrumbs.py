import uuid
import zlib
from datetime import UTC, datetime, timezone
from unittest.mock import patch

import requests
from django.conf import settings
from django.urls import reverse
from rest_framework.exceptions import ParseError

from sentry import nodestore
from sentry.eventstore.models import Event
from sentry.replays.endpoints.project_replay_summarize_breadcrumbs import (
    GroupEvent,
    as_log_message,
    get_request_data,
)
from sentry.replays.lib.storage import FilestoreBlob, RecordingSegmentStorageMeta
from sentry.replays.testutils import mock_replay
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.skips import requires_snuba
from sentry.utils import json


# have to use TransactionTestCase because we're using threadpools
@requires_snuba
class ProjectReplaySummarizeBreadcrumbsTestCase(
    TransactionTestCase,
):
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

    def mock_create_feedback_occurrence(self, project_id: int, replay_id: str | None = None):
        dt = datetime.now(UTC)

        event = {
            "project_id": project_id,
            "event_id": "56b08cf7852c42cbb95e4a6998c66ad6",
            "timestamp": dt.timestamp(),
            "received": dt.isoformat(),
            "first_seen": dt.isoformat(),
            "user": {
                "ip_address": "72.164.175.154",
                "email": "josh.ferge@sentry.io",
                "id": 880461,
                "isStaff": False,
                "name": "Josh Ferge",
            },
            "contexts": {
                "feedback": {
                    "contact_email": "josh.ferge@sentry.io",
                    "name": "Josh Ferge",
                    "message": "Great website!",
                    "replay_id": replay_id,
                    "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
                },
            },
        }

        self.store_event(
            data={
                "event_id": event["event_id"],
                "timestamp": event["timestamp"],
                "contexts": event["contexts"],
            },
            project_id=self.project.id,
        )

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
        error_timestamp = now.timestamp() - 1
        self.store_event(
            data={
                "event_id": event_id,
                "timestamp": error_timestamp,
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

        # Ensure the event is stored in nodestore
        node_id = Event.generate_node_id(self.project.id, event_id)
        event_data = nodestore.backend.get(node_id)
        assert event_data is not None, "Event not found in nodestore"
        assert (
            event_data.get("exception", {}).get("values", [{}])[0].get("type")
            == "ZeroDivisionError"
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
        assert any("ZeroDivisionError" in log for log in call_args["logs"])
        assert any("division by zero" in log for log in call_args["logs"])

        assert response.status_code == 200
        assert response.get("Content-Type") == "application/json"
        assert response.content == return_value

    @patch("sentry.replays.endpoints.project_replay_summarize_breadcrumbs.make_seer_request")
    def test_get_with_error_context_disabled_and_enabled(self, make_seer_request):
        """Test handling of breadcrumbs with error context disabled"""
        return_value = json.dumps({"error": "An error happened"}).encode()
        make_seer_request.return_value = return_value

        now = datetime.now(timezone.utc)
        event_id = uuid.uuid4().hex
        error_timestamp = now.timestamp() - 1
        self.store_event(
            data={
                "event_id": event_id,
                "timestamp": error_timestamp,
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

        # with error context disabled
        with self.feature(
            {
                "organizations:session-replay": True,
                "organizations:replay-ai-summaries": True,
                "organizations:gen-ai-features": True,
            }
        ):
            response = self.client.get(self.url, {"enable_error_context": "false"})

        make_seer_request.assert_called_once()
        call_args = json.loads(make_seer_request.call_args[0][0])
        assert "logs" in call_args
        assert not any("ZeroDivisionError" in log for log in call_args["logs"])
        assert not any("division by zero" in log for log in call_args["logs"])

        assert response.status_code == 200
        assert response.get("Content-Type") == "application/json"
        assert response.content == return_value

        # with error context enabled
        with self.feature(
            {
                "organizations:session-replay": True,
                "organizations:replay-ai-summaries": True,
                "organizations:gen-ai-features": True,
            }
        ):
            response = self.client.get(self.url, {"enable_error_context": "true"})

        assert make_seer_request.call_count == 2
        call_args = json.loads(make_seer_request.call_args[0][0])
        assert "logs" in call_args
        assert any("ZeroDivisionError" in log for log in call_args["logs"])
        assert any("division by zero" in log for log in call_args["logs"])

        assert response.status_code == 200
        assert response.get("Content-Type") == "application/json"
        assert response.content == return_value

    @patch("sentry.replays.endpoints.project_replay_summarize_breadcrumbs.make_seer_request")
    def test_get_with_trace_connected_errors(self, make_seer_request):
        """Test handling of breadcrumbs with trace connected errors"""
        return_value = json.dumps({"trace_errors": "Trace connected errors found"}).encode()
        make_seer_request.return_value = return_value

        now = datetime.now(timezone.utc)
        trace_id = uuid.uuid4().hex
        span_id = "1" + uuid.uuid4().hex[:15]
        event_id = uuid.uuid4().hex
        error_timestamp = now.timestamp() - 1
        project_2 = self.create_project()

        self.store_event(
            data={
                "event_id": event_id,
                "timestamp": error_timestamp,
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

        self.store_replays(
            mock_replay(
                now,
                self.project.id,
                self.replay_id,
                trace_ids=[trace_id],
                error_ids=[],
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
        assert any("ConnectionError" in log for log in call_args["logs"])
        assert any("Failed to connect to database" in log for log in call_args["logs"])

        assert response.status_code == 200
        assert response.get("Content-Type") == "application/json"
        assert response.content == return_value

    @patch("sentry.replays.endpoints.project_replay_summarize_breadcrumbs.make_seer_request")
    def test_get_with_trace_connected_errors_no_timestamp(self, make_seer_request):
        """Test handling of breadcrumbs with trace connected errors with no timestamp"""
        return_value = json.dumps({"trace_errors": "Trace connected errors found"}).encode()
        make_seer_request.return_value = return_value

        now = datetime.now(timezone.utc)
        trace_id = uuid.uuid4().hex
        span_id = "1" + uuid.uuid4().hex[:15]
        event_id = uuid.uuid4().hex
        project_2 = self.create_project()

        self.store_event(
            data={
                "event_id": event_id,
                "timestamp": None,
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

        self.store_replays(
            mock_replay(
                now,
                self.project.id,
                self.replay_id,
                trace_ids=[trace_id],
                error_ids=[],
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
        assert not any("ConnectionError" in log for log in call_args["logs"])
        assert not any("Failed to connect to database" in log for log in call_args["logs"])

        assert response.status_code == 200
        assert response.get("Content-Type") == "application/json"
        assert response.content == return_value

    @patch("sentry.replays.endpoints.project_replay_summarize_breadcrumbs.make_seer_request")
    def test_get_with_both_direct_and_trace_connected_errors(self, make_seer_request):
        """Test handling of breadcrumbs with both direct and trace connected errors"""
        return_value = json.dumps({"errors": "Both types of errors found"}).encode()
        make_seer_request.return_value = return_value

        now = datetime.now(timezone.utc)
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
        self.store_replays(
            mock_replay(
                now,
                self.project.id,
                self.replay_id,
                error_ids=[direct_event_id],
                trace_ids=[trace_id],
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
        assert any("ZeroDivisionError" in log for log in call_args["logs"])
        assert any("division by zero" in log for log in call_args["logs"])
        assert any("ConnectionError" in log for log in call_args["logs"])
        assert any("Failed to connect to database" in log for log in call_args["logs"])

        assert response.status_code == 200
        assert response.get("Content-Type") == "application/json"
        assert response.content == return_value

    @patch("sentry.replays.endpoints.project_replay_summarize_breadcrumbs.make_seer_request")
    def test_get_with_feedback(self, make_seer_request):
        """Test handling of breadcrumbs with user feedback"""
        return_value = json.dumps({"feedback": "Feedback was submitted"}).encode()
        make_seer_request.return_value = return_value

        self.mock_create_feedback_occurrence(self.project.id, replay_id=self.replay_id)

        now = datetime.now(timezone.utc)

        self.store_replays(
            mock_replay(
                now,
                self.project.id,
                self.replay_id,
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
            },
            {
                "type": 5,
                "timestamp": float(now.timestamp()),
                "data": {
                    "tag": "breadcrumb",
                    "payload": {
                        "category": "sentry.feedback",
                        "data": {"feedbackId": "56b08cf7852c42cbb95e4a6998c66ad6"},
                    },
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

        make_seer_request.assert_called_once()
        call_args = json.loads(make_seer_request.call_args[0][0])
        assert "logs" in call_args
        assert any("Great website!" in log for log in call_args["logs"])
        assert any("User submitted feedback" in log for log in call_args["logs"])

        assert response.status_code == 200
        assert response.get("Content-Type") == "application/json"
        assert response.content == return_value


@django_db_all
def test_get_request_data(default_project):
    def _faker():
        yield 0, memoryview(
            json.dumps(
                [
                    {
                        "type": 5,
                        "timestamp": 1.5,
                        "data": {
                            "tag": "breadcrumb",
                            "payload": {"category": "console", "message": "hello"},
                        },
                    },
                    {
                        "type": 5,
                        "timestamp": 2.0,
                        "data": {
                            "tag": "breadcrumb",
                            "payload": {"category": "console", "message": "world"},
                        },
                    },
                ]
            ).encode()
        )

    error_events = [
        GroupEvent(
            category="error",
            id="123",
            title="ZeroDivisionError",
            timestamp=3.0,
            message="division by zero",
        ),
        GroupEvent(
            category="error",
            id="234",
            title="BadError",
            timestamp=1.0,
            message="something else bad",
        ),
    ]

    result = get_request_data(_faker(), error_events=error_events, project_id=default_project.id)
    assert result == [
        "User experienced an error: 'BadError: something else bad' at 1.0",
        "Logged: hello at 1.5",
        "Logged: world at 2.0",
        "User experienced an error: 'ZeroDivisionError: division by zero' at 3.0",
    ]


def test_as_log_message():
    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "breadcrumb", "payload": {"category": "ui.click", "message": "div"}},
    }
    assert as_log_message(event) is not None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "category": "ui.slowClickDetected",
                "message": "div",
                "data": {
                    "clickCount": 4,
                    "endReason": "timeout",
                    "timeAfterClickMs": 7000,
                    "node": {"tagName": "button"},
                },
            },
        },
    }
    assert as_log_message(event) is not None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "category": "ui.slowClickDetected",
                "message": "div",
                "data": {
                    "clickCount": 5,
                    "endReason": "timeout",
                    "timeAfterClickMs": 7000,
                    "node": {"tagName": "button"},
                },
            },
        },
    }
    assert as_log_message(event) is not None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "breadcrumb", "payload": {"category": "navigation", "data": {"to": "/"}}},
    }
    assert as_log_message(event) is not None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "breadcrumb", "payload": {"category": "console", "message": "t"}},
    }
    assert as_log_message(event) is not None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "breadcrumb", "payload": {"category": "ui.blur"}},
    }
    assert as_log_message(event) is not None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "breadcrumb", "payload": {"category": "ui.focus"}},
    }
    assert as_log_message(event) is not None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "resource.fetch",
                "description": "https://www.z.com/path?q=true",
                "endTimestamp": 0.0,
                "startTimestamp": 0.0,
                "data": {
                    "method": "GET",
                    "statusCode": 404,
                    "response": {"size": 0},
                },
            },
        },
    }
    assert as_log_message(event) is not None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "resource.fetch",
                "description": "https://www.z.com/path?q=true",
                "endTimestamp": 0.0,
                "startTimestamp": 0.0,
                "data": {
                    "method": "GET",
                    "statusCode": 404,
                    "response": {"wrong": "wrong"},
                },
            },
        },
    }

    result = as_log_message(event)
    assert result is not None
    assert "unknown" not in result

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "resource.fetch",
                "description": "https://www.z.com/path?q=true",
                "endTimestamp": 0.0,
                "startTimestamp": 0.0,
                "data": {
                    "method": "GET",
                    "statusCode": 200,
                    "response": {"size": 0},
                },
            },
        },
    }

    result = as_log_message(event)
    assert result is None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "performanceSpan", "payload": {"op": "resource.xhr"}},
    }
    assert as_log_message(event) is None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "web-vital",
                "description": "largest-contentful-paint",
                "data": {"size": 0, "rating": "good"},
            },
        },
    }
    assert as_log_message(event) is not None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "web-vital",
                "description": "first-contentful-paint",
                "data": {"size": 0, "rating": "good"},
            },
        },
    }
    assert as_log_message(event) is not None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "breadcrumb", "payload": {"category": "replay.hydrate-error"}},
    }
    assert as_log_message(event) is not None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "breadcrumb", "payload": {"category": "replay.mutations"}},
    }
    assert as_log_message(event) is None
    assert as_log_message({}) is None

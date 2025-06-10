import uuid
import zlib
from unittest.mock import patch

from django.urls import reverse

from sentry.replays.endpoints.project_replay_summarize_breadcrumbs import PROMPT, get_request_data
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

        with self.feature("organizations:session-replay"):
            response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.get("Content-Type") == "application/json"
        assert response.content == return_value


def test_get_request_data():
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

    result = get_request_data(_faker())
    assert result == PROMPT + "Logged: hello at 0.0\nLogged: world at 0.0\n"

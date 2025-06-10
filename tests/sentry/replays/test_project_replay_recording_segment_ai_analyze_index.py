import uuid
import zlib
from collections import namedtuple

from django.urls import reverse

from sentry.replays.lib.storage import FilestoreBlob, RecordingSegmentStorageMeta
from sentry.testutils.cases import TransactionTestCase
from sentry.utils import json

Message = namedtuple("Message", ["project_id", "replay_id"])


# have to use TransactionTestCase because we're using threadpools
class FilestoreProjectReplayRecordingSegmentIndexTestCase(TransactionTestCase):
    endpoint = "sentry-api-0-project-replay-recording-segment-ai-analyze-index"

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

    def test_index_download_basic_compressed(self):
        data = [
            {
                "type": 5,
                "timestamp": 0.0,
                "data": {
                    "tag": "breadcrumb",
                    "payload": {"category": "ui.click", "message": "div#id.class"},
                },
            },
            {
                "type": 5,
                "timestamp": 0.0,
                "data": {
                    "tag": "breadcrumb",
                    "payload": {"category": "navigation", "data": {"to": "/explore/traces"}},
                },
            },
            {
                "type": 5,
                "timestamp": 0.0,
                "data": {
                    "tag": "breadcrumb",
                    "payload": {"category": "console", "message": "message"},
                },
            },
            {
                "type": 5,
                "timestamp": 0.0,
                "data": {"tag": "breadcrumb", "payload": {"category": "ui.blur"}},
            },
            {
                "type": 5,
                "timestamp": 0.0,
                "data": {"tag": "breadcrumb", "payload": {"category": "ui.focus"}},
            },
            {
                "type": 5,
                "timestamp": 0.0,
                "data": {
                    "tag": "performanceSpan",
                    "payload": {
                        "op": "resource.fetch",
                    },
                },
            },
        ]
        self.save_recording_segment(0, json.dumps(data).encode())

        with self.feature("organizations:session-replay"):
            response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.get("Content-Type") == "application/json"
        assert response.content == (
            b'[[{"test":"hello 0"}],[{"test":"hello 1"}],[{"test":"hello 2"}]]'
        )

import datetime
import uuid

from django.urls import reverse

from sentry.replays.lib.storage import _make_video_filename, storage_kv
from sentry.replays.testutils import mock_replay
from sentry.testutils.cases import APITestCase, ReplaysSnubaTestCase
from sentry.testutils.helpers.response import close_streaming_response


class ReplayVideoDetailsTestCase(APITestCase, ReplaysSnubaTestCase):
    endpoint = "sentry-api-0-project-replay-video-details"

    def setUp(self):
        super().setUp()
        self.replay_id = uuid.uuid4().hex
        self.segment_id = 0
        self.segment_data = b"hello, world!"
        self.segment_data_size = len(self.segment_data)

        self.url = reverse(
            self.endpoint,
            args=(
                self.organization.slug,
                self.project.slug,
                self.replay_id,
                self.segment_id,
            ),
        )

    def save_video_file(self, segment_id: int, data: bytes) -> None:
        # Push the file to blob storage.
        self.filename = _make_video_filename(30, self.project.id, self.replay_id, segment_id)
        storage_kv.set(key=self.filename, value=data)

    def save_replay_segment(self, segment_id: int, **metadata) -> None:
        # Insert a mock row into the database for tracking the blob.
        self.store_replays(
            mock_replay(
                datetime.datetime.now() - datetime.timedelta(seconds=22),
                self.project.id,
                self.replay_id,
                segment_id=segment_id,
                retention_days=30,
                **metadata,
            )
        )

    def save_video(self, segment_id: int, data: bytes, **metadata) -> None:
        self.save_video_file(segment_id, data)
        self.save_replay_segment(segment_id, **metadata)

    def test_get_replay_video(self):
        self.save_video(0, self.segment_data)
        self.login_as(user=self.user)

        with self.feature("organizations:session-replay"):
            response = self.client.get(self.url)

            assert response.status_code == 200, response.content
            assert close_streaming_response(response) == self.segment_data
            assert response.get("Content-Disposition") == f'attachment; filename="{self.filename}"'
            assert response.get("Content-Length") == str(self.segment_data_size)
            assert response.get("Content-Type") == "application/octet-stream"

    def test_get_replay_video_segment_not_found(self):
        self.login_as(user=self.user)

        with self.feature("organizations:session-replay"):
            response = self.client.get(self.url)
            assert response.status_code == 404, response.content

    def test_get_replay_video_payload_not_found(self):
        self.save_replay_segment(0)
        self.login_as(user=self.user)

        with self.feature("organizations:session-replay"):
            response = self.client.get(self.url)
            assert response.status_code == 404, response.content

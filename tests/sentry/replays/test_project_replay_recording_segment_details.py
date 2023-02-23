import uuid

from django.urls import reverse

from sentry.replays.lib.storage import (
    FilestoreBlob,
    RecordingSegmentStorageMeta,
    StorageBlob,
    make_filename,
)
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


class EnvironmentMixin:
    endpoint = "sentry-api-0-project-replay-recording-segment-details"

    def init_environment(self, driver):
        self.replay_id = uuid.uuid4().hex
        self.segment_id = 0
        self.segment_data = b"[{hello: world}]"
        self.segment_data_size = len(self.segment_data)

        metadata = RecordingSegmentStorageMeta(
            project_id=self.project.id,
            replay_id=self.replay_id,
            segment_id=self.segment_id,
            retention_days=30,
        )
        driver.set(metadata, self.segment_data)

        self.segment_filename = make_filename(metadata)

        self.url = reverse(
            self.endpoint,
            args=(
                self.organization.slug,
                self.project.slug,
                self.replay_id,
                self.segment_id,
            ),
        )

    def test_get_replay_recording_segment(self):
        self.login_as(user=self.user)

        with self.feature("organizations:session-replay"):
            response = self.client.get(self.url)

            assert response.status_code == 200, response.content
            assert response.data["data"]["replayId"] == self.replay_id
            assert response.data["data"]["segmentId"] == self.segment_id
            assert response.data["data"]["projectId"] == str(self.project.id)
            assert "dateAdded" in response.data["data"]

    def test_get_replay_recording_segment_download(self):
        self.login_as(user=self.user)

        with self.feature("organizations:session-replay"):
            response = self.client.get(self.url + "?download")

            assert response.status_code == 200, response.content
            assert (
                response.get("Content-Disposition")
                == f'attachment; filename="{self.segment_filename}"'
            )
            assert response.get("Content-Length") == str(self.segment_data_size)
            assert response.get("Content-Type") == "application/json"
            assert self.segment_data == b"".join(response.streaming_content)


@region_silo_test
class FilestoreReplayRecordingSegmentDetailsTestCase(EnvironmentMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.init_environment(FilestoreBlob())


@region_silo_test
class StorageReplayRecordingSegmentDetailsTestCase(EnvironmentMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.init_environment(StorageBlob())

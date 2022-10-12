import uuid
import zlib
from io import BytesIO

from django.urls import reverse

from sentry.models import File
from sentry.replays.models import ReplayRecordingSegment
from sentry.testutils import APITestCase, TransactionTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProjectReplayRecordingSegmentTestCase(APITestCase):
    endpoint = "sentry-api-0-project-replay-recording-segment-index"

    def setUp(self):
        super().setUp()

        self.replay_id = uuid.uuid4().hex
        self.url = reverse(
            self.endpoint,
            args=(self.organization.slug, self.project.slug, self.replay_id),
        )

    def test_index(self):
        self.login_as(user=self.user)

        recording_segment = ReplayRecordingSegment.objects.create(
            replay_id=self.replay_id,
            project_id=self.project.id,
            segment_id=0,
            file_id=File.objects.create(name="hello.png", type="image/png").id,
        )
        ReplayRecordingSegment.objects.create(
            replay_id=self.replay_id,
            project_id=self.project.id,
            segment_id=1,
            file_id=File.objects.create(name="hello.png", type="image/png").id,
        )
        ReplayRecordingSegment.objects.create(
            replay_id=self.replay_id,
            project_id=self.project.id,
            segment_id=2,
            file_id=File.objects.create(name="hello.png", type="image/png").id,
        )

        with self.feature("organizations:session-replay"):
            response = self.client.get(self.url)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 3
        assert response.data["data"][0]["replayId"] == recording_segment.replay_id
        assert response.data["data"][0]["segmentId"] == recording_segment.segment_id
        assert response.data["data"][0]["projectId"] == str(recording_segment.project_id)
        assert response.data["data"][0]["dateAdded"] == recording_segment.date_added

        assert response.data["data"][0]["segmentId"] == 0
        assert response.data["data"][1]["segmentId"] == 1
        assert response.data["data"][2]["segmentId"] == 2

    def test_index_404(self):
        self.login_as(user=self.user)

        url = reverse(
            self.endpoint,
            args=(self.organization.slug, self.project.slug, 4242424242),
        )

        with self.feature("organizations:session-replay"):
            response = self.client.get(url)
            assert response.status_code == 404


class DownloadSegmentsTestCase(TransactionTestCase):
    # have to use TransactionTestCase because we're using threadpools

    endpoint = "sentry-api-0-project-replay-recording-segment-index"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.replay_id = uuid.uuid4().hex
        self.url = reverse(
            self.endpoint,
            args=(self.organization.slug, self.project.slug, self.replay_id),
        )

    def test_index_download_basic_compressed(self):
        for i in range(0, 3):
            f = File.objects.create(name=f"rr:{i}", type="replay.recording")
            f.putfile(BytesIO(zlib.compress(f'[{{"test":"hello {i}"}}]'.encode())))
            ReplayRecordingSegment.objects.create(
                replay_id=self.replay_id,
                project_id=self.project.id,
                segment_id=i,
                file_id=f.id,
            )

        with self.feature("organizations:session-replay"):
            response = self.client.get(self.url + "?download=true")

        assert response.status_code == 200

        assert response.get("Content-Type") == "application/json"
        assert b'[[{"test":"hello 0"}],[{"test":"hello 1"}],[{"test":"hello 2"}]]' == b"".join(
            response.streaming_content
        )

    def test_index_download_basic_compressed_over_chunk_size(self):
        segment_id = 1
        f = File.objects.create(name=f"rr:{segment_id}", type="replay.recording")
        f.putfile(BytesIO(zlib.compress(("a" * 5000).encode())))
        ReplayRecordingSegment.objects.create(
            replay_id=self.replay_id,
            project_id=self.project.id,
            segment_id=segment_id,
            file_id=f.id,
        )

        with self.feature("organizations:session-replay"):
            response = self.client.get(self.url + "?download=true")

        assert response.status_code == 200

        assert response.get("Content-Type") == "application/json"
        assert len(b"".join(response.streaming_content)) == 5002

    def test_index_download_basic_not_compressed(self):
        for i in range(0, 3):
            f = File.objects.create(name=f"rr:{i}", type="replay.recording")
            f.putfile(BytesIO(f'[{{"test":"hello {i}"}}]'.encode()))
            ReplayRecordingSegment.objects.create(
                replay_id=self.replay_id,
                project_id=self.project.id,
                segment_id=i,
                file_id=f.id,
            )

        with self.feature("organizations:session-replay"):
            response = self.client.get(self.url + "?download")

        assert response.status_code == 200

        assert response.get("Content-Type") == "application/json"
        assert b'[[{"test":"hello 0"}],[{"test":"hello 1"}],[{"test":"hello 2"}]]' == b"".join(
            response.streaming_content
        )

    def test_index_download_paginate(self):
        for i in range(0, 3):
            f = File.objects.create(name=f"rr:{i}", type="replay.recording")
            f.putfile(BytesIO(zlib.compress(f'[{{"test":"hello {i}"}}]'.encode())))
            ReplayRecordingSegment.objects.create(
                replay_id=self.replay_id,
                project_id=self.project.id,
                segment_id=i,
                file_id=f.id,
            )

        with self.feature("organizations:session-replay"):
            response = self.client.get(self.url + "?download&per_page=1&cursor=0:0:0")

        assert response.status_code == 200

        assert response.get("Content-Type") == "application/json"
        assert b'[[{"test":"hello 0"}]]' == b"".join(response.streaming_content)

        with self.feature("organizations:session-replay"):
            response = self.client.get(self.url + "?download&per_page=1&cursor=1:1:0")

        assert response.status_code == 200

        assert response.get("Content-Type") == "application/json"
        assert b'[[{"test":"hello 1"}]]' == b"".join(response.streaming_content)

        with self.feature("organizations:session-replay"):
            response = self.client.get(self.url + "?download&per_page=2&cursor=1:1:0")

        assert response.status_code == 200

        assert response.get("Content-Type") == "application/json"
        assert b'[[{"test":"hello 1"}],[{"test":"hello 2"}]]' == b"".join(
            response.streaming_content
        )

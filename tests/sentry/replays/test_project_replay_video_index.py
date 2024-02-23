import datetime
import uuid
import zlib
from collections import namedtuple

from django.urls import reverse

from sentry.replays.lib.storage import make_video_filename, storage_kv
from sentry.replays.lib.storage.legacy import RecordingSegmentStorageMeta
from sentry.replays.testutils import mock_replay
from sentry.testutils.cases import APITestCase, ReplaysSnubaTestCase, TransactionTestCase
from sentry.testutils.helpers.response import close_streaming_response
from sentry.testutils.silo import region_silo_test

Message = namedtuple("Message", ["project_id", "replay_id"])


@region_silo_test
class StorageProjectReplayVideoIndexTestCase(
    TransactionTestCase, APITestCase, ReplaysSnubaTestCase
):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.replay_id = uuid.uuid4().hex
        self.url = reverse(
            "sentry-api-0-project-replay-video-index",
            args=(self.organization.slug, self.project.slug, self.replay_id),
        )
        self.features = {"organizations:session-replay": True}

    def save_video_file(self, segment_id: int, data: bytes) -> None:
        # Push the file to blob storage.
        filename = make_video_filename(30, self.project.id, self.replay_id, segment_id)
        storage_kv.set(key=filename, value=zlib.compress(data))

    def save_video(self, segment_id: int, data: bytes, **metadata) -> None:
        self.save_video_file(segment_id, data)

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

    def test_archived_segment_metadata_returns_no_results(self):
        """Assert archived segment metadata returns no results."""
        self.save_video(0, b"[]", is_archived=True)

        with self.feature("organizations:session-replay"):
            response = self.client.get(self.url + "?download=true")

        assert response.status_code == 200
        assert response.get("Content-Type") == "application/json"
        assert close_streaming_response(response) == b"[]"

    def test_blob_does_not_exist(self):
        """Assert missing blobs return default value."""
        self.store_replays(
            mock_replay(
                datetime.datetime.now() - datetime.timedelta(seconds=22),
                self.project.id,
                self.replay_id,
                segment_id=0,
                retention_days=30,
            )
        )

        with self.feature("organizations:session-replay"):
            response = self.client.get(self.url + "?download=true")

        assert response.status_code == 200
        assert response.get("Content-Type") == "application/json"
        assert close_streaming_response(response) == b"[]"

    def test_missing_segment_meta(self):
        """Assert missing segment meta returns no blob data."""
        self.save_video_file(0, b"hello, world")

        with self.feature("organizations:session-replay"):
            response = self.client.get(self.url + "?download=true")

        assert response.status_code == 200
        assert response.get("Content-Type") == "application/json"
        assert close_streaming_response(response) == b"[]"

    def test_index_download_basic_compressed(self):
        for i in range(0, 3):
            self.save_video(i, str(i).encode())

        with self.feature("organizations:session-replay"):
            response = self.client.get(self.url + "?download=true")

        assert response.status_code == 200
        assert response.get("Content-Type") == "application/json"
        assert b"[0,1,2]" == close_streaming_response(response)

    def test_index_download_paginate(self):
        for i in range(0, 3):
            self.save_video(i, str(i).encode())

        with self.feature("organizations:session-replay"):
            response = self.client.get(self.url + "?download&per_page=1&cursor=0:0:0")

        assert response.status_code == 200
        assert response.get("Content-Type") == "application/json"
        assert b"[0]" == close_streaming_response(response)

        with self.feature("organizations:session-replay"):
            response = self.client.get(self.url + "?download&per_page=1&cursor=1:1:0")

        assert response.status_code == 200
        assert response.get("Content-Type") == "application/json"
        assert b"[1]" == close_streaming_response(response)

        with self.feature("organizations:session-replay"):
            response = self.client.get(self.url + "?download&per_page=2&cursor=1:1:0")

        assert response.status_code == 200
        assert response.get("Content-Type") == "application/json"
        assert b"[1,2]" == close_streaming_response(response)

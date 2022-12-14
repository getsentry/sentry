import uuid
import zlib
from collections import namedtuple
from io import BytesIO

from django.test import override_settings
from django.urls import reverse

from sentry.models import File
from sentry.replays.models import ReplayRecordingSegment
from sentry.replays.usecases.ingest import store_replays_directly
from sentry.testutils import TransactionTestCase
from sentry.testutils.silo import region_silo_test

Message = namedtuple("Message", ["project_id", "replay_id"])


@region_silo_test
class DownloadSegmentsTestCaseFileModel(TransactionTestCase):
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


class DownloadSegmentsTestCaseDirect(TransactionTestCase):
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
        with override_settings(SENTRY_REPLAYS_DIRECT_FILESTORE_ORGS=[self.organization.id]):
            for i in range(0, 3):
                message = Message(project_id=self.project.id, replay_id=self.replay_id)
                headers = {"segment_id": i}
                store_replays_directly(
                    message, headers, zlib.compress(f'[{{"test":"hello {i}"}}]'.encode())
                )

            with self.feature("organizations:session-replay"):
                response = self.client.get(self.url + "?download=true")

            assert response.status_code == 200

            assert response.get("Content-Type") == "application/json"
            assert b'[[{"test":"hello 0"}],[{"test":"hello 1"}],[{"test":"hello 2"}]]' == b"".join(
                response.streaming_content
            )

    def test_index_download_basic_compressed_over_chunk_size(self):
        with override_settings(SENTRY_REPLAYS_DIRECT_FILESTORE_ORGS=[self.organization.id]):
            segment_id = 1

            message = Message(project_id=self.project.id, replay_id=self.replay_id)
            headers = {"segment_id": segment_id}
            store_replays_directly(message, headers, zlib.compress(("a" * 5000).encode()))

            with self.feature("organizations:session-replay"):
                response = self.client.get(self.url + "?download=true")

            assert response.status_code == 200

            assert response.get("Content-Type") == "application/json"
            assert len(b"".join(response.streaming_content)) == 5002

    def test_index_download_basic_not_compressed(self):
        with override_settings(SENTRY_REPLAYS_DIRECT_FILESTORE_ORGS=[self.organization.id]):
            for i in range(0, 3):
                message = Message(project_id=self.project.id, replay_id=self.replay_id)
                headers = {"segment_id": i}
                store_replays_directly(message, headers, f'[{{"test":"hello {i}"}}]'.encode())

            with self.feature("organizations:session-replay"):
                response = self.client.get(self.url + "?download")

            assert response.status_code == 200

            assert response.get("Content-Type") == "application/json"
            assert b'[[{"test":"hello 0"}],[{"test":"hello 1"}],[{"test":"hello 2"}]]' == b"".join(
                response.streaming_content
            )

    def test_index_download_paginate(self):
        with override_settings(SENTRY_REPLAYS_DIRECT_FILESTORE_ORGS=[self.organization.id]):
            for i in range(0, 3):
                message = Message(project_id=self.project.id, replay_id=self.replay_id)
                headers = {"segment_id": i}
                store_replays_directly(
                    message, headers, zlib.compress(f'[{{"test":"hello {i}"}}]'.encode())
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

    def test_index_download_basic_compressed_fallback_to_filemodel(self):
        with override_settings(SENTRY_REPLAYS_DIRECT_FILESTORE_ORGS=[self.organization.id]):

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

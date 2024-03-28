import datetime
from io import BytesIO
from unittest import mock
from uuid import uuid4

from django.urls import reverse

from sentry.models.files.file import File
from sentry.replays.lib import kafka
from sentry.replays.lib.storage import RecordingSegmentStorageMeta, storage
from sentry.replays.models import ReplayRecordingSegment
from sentry.replays.testutils import assert_expected_response, mock_expected_response, mock_replay
from sentry.testutils.cases import APITestCase, ReplaysSnubaTestCase
from sentry.testutils.helpers import TaskRunner
from sentry.utils import kafka_config

REPLAYS_FEATURES = {"organizations:session-replay": True}


class ProjectReplayDetailsTest(APITestCase, ReplaysSnubaTestCase):
    endpoint = "sentry-api-0-project-replay-details"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.replay_id = uuid4().hex
        self.url = reverse(
            self.endpoint, args=(self.organization.slug, self.project.slug, self.replay_id)
        )

    def test_feature_flag_disabled(self):
        response = self.client.get(self.url)
        assert response.status_code == 404

    def test_no_replay_found(self):
        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 404

    def test_get_one_replay(self):
        """Test only one replay returned."""
        replay1_id = self.replay_id
        replay2_id = uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=10)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=5)

        self.store_replays(mock_replay(seq1_timestamp, self.project.id, replay1_id))
        self.store_replays(mock_replay(seq2_timestamp, self.project.id, replay1_id))
        self.store_replays(mock_replay(seq1_timestamp, self.project.id, replay2_id))
        self.store_replays(mock_replay(seq2_timestamp, self.project.id, replay2_id))

        with self.feature(REPLAYS_FEATURES):
            # Replay 1.
            response = self.client.get(self.url)
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert response_data["data"]["id"] == replay1_id

            # Replay 2.
            response = self.client.get(
                reverse(self.endpoint, args=(self.organization.slug, self.project.slug, replay2_id))
            )
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data
            assert response_data["data"]["id"] == replay2_id

    def test_get_replay_schema(self):
        """Test replay schema is well-formed."""
        replay1_id = self.replay_id
        replay2_id = uuid4().hex
        seq1_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=25)
        seq2_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=7)
        seq3_timestamp = datetime.datetime.now() - datetime.timedelta(seconds=4)

        trace_id_1 = uuid4().hex
        trace_id_2 = uuid4().hex
        # Assert values from this non-returned replay do not pollute the returned
        # replay.
        self.store_replays(mock_replay(seq1_timestamp, self.project.id, replay2_id))
        self.store_replays(mock_replay(seq3_timestamp, self.project.id, replay2_id))

        self.store_replays(
            mock_replay(
                seq1_timestamp,
                self.project.id,
                replay1_id,
                trace_ids=[trace_id_1],
                urls=["http://localhost:3000/"],
            )
        )
        self.store_replays(
            mock_replay(
                seq2_timestamp,
                self.project.id,
                replay1_id,
                segment_id=1,
                trace_ids=[trace_id_2],
                urls=["http://www.sentry.io/"],
                error_ids=[],
            )
        )
        self.store_replays(
            mock_replay(
                seq3_timestamp,
                self.project.id,
                replay1_id,
                segment_id=2,
                trace_ids=[trace_id_2],
                urls=["http://localhost:3000/"],
                error_ids=[],
            )
        )
        self.store_replays(
            self.mock_event_links(
                seq1_timestamp,
                self.project.id,
                "error",
                replay1_id,
                "a3a62ef6ac86415b83c2416fc2f76db1",
            )
        )

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url)
            assert response.status_code == 200

            response_data = response.json()
            assert "data" in response_data

            expected_response = mock_expected_response(
                self.project.id,
                replay1_id,
                seq1_timestamp,
                seq3_timestamp,
                trace_ids=[
                    trace_id_1,
                    trace_id_2,
                ],
                urls=[
                    "http://localhost:3000/",
                    "http://www.sentry.io/",
                    "http://localhost:3000/",
                ],
                count_segments=3,
                activity=4,
                count_errors=1,
            )
            assert_expected_response(response_data["data"], expected_response)

    def test_delete_replay_from_filestore(self):
        """Test deleting files uploaded through the filestore interface."""
        # test deleting as a member, as they should be able to
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=self.organization, role="member", teams=[])
        self.login_as(user=user)

        file = File.objects.create(name="recording-segment-0", type="application/octet-stream")
        file.putfile(BytesIO(b"replay-recording-segment"))

        recording_segment = ReplayRecordingSegment.objects.create(
            replay_id=self.replay_id,
            project_id=self.project.id,
            segment_id=0,
            file_id=file.id,
        )

        file_id = file.id
        recording_segment_id = recording_segment.id

        with self.feature(REPLAYS_FEATURES):
            with (
                TaskRunner(),
                mock.patch.object(kafka_config, "get_kafka_producer_cluster_options"),
                mock.patch.object(kafka, "KafkaPublisher"),
            ):
                response = self.client.delete(self.url)
                assert response.status_code == 204

        try:
            ReplayRecordingSegment.objects.get(id=recording_segment_id)
            assert False, "Recording Segment was not deleted."
        except ReplayRecordingSegment.DoesNotExist:
            pass

        try:
            File.objects.get(id=file_id)
            assert False, "File was not deleted."
        except File.DoesNotExist:
            pass

    def test_delete_replay_from_clickhouse_data(self):
        """Test deleting files uploaded through the direct storage interface."""
        kept_replay_id = uuid4().hex

        t1 = datetime.datetime.now() - datetime.timedelta(seconds=10)
        t2 = datetime.datetime.now() - datetime.timedelta(seconds=5)
        self.store_replays(mock_replay(t1, self.project.id, self.replay_id, segment_id=0))
        self.store_replays(mock_replay(t2, self.project.id, self.replay_id, segment_id=1))
        self.store_replays(mock_replay(t1, self.project.id, kept_replay_id, segment_id=0))

        metadata1 = RecordingSegmentStorageMeta(
            project_id=self.project.id,
            replay_id=self.replay_id,
            segment_id=0,
            retention_days=30,
            file_id=None,
        )
        storage.set(metadata1, b"hello, world!")

        metadata2 = RecordingSegmentStorageMeta(
            project_id=self.project.id,
            replay_id=self.replay_id,
            segment_id=1,
            retention_days=30,
            file_id=None,
        )
        storage.set(metadata2, b"hello, world!")

        metadata3 = RecordingSegmentStorageMeta(
            project_id=self.project.id,
            replay_id=kept_replay_id,
            segment_id=0,
            retention_days=30,
            file_id=None,
        )
        storage.set(metadata3, b"hello, world!")

        with self.feature(REPLAYS_FEATURES):
            with TaskRunner():
                response = self.client.delete(self.url)
                assert response.status_code == 204

        assert storage.get(metadata1) is None
        assert storage.get(metadata2) is None
        assert storage.get(metadata3) is not None

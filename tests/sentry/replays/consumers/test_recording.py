from __future__ import annotations

import time
import uuid
import zlib
from datetime import datetime
from unittest.mock import ANY, patch

import msgpack
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic
from sentry_kafka_schemas.schema_types.ingest_replay_recordings_v1 import ReplayRecording

from sentry.models.organizationonboardingtask import OnboardingTask, OnboardingTaskStatus
from sentry.replays.consumers.recording import ProcessReplayRecordingStrategyFactory
from sentry.replays.consumers.recording_two_step import RecordingTwoStepStrategyFactory
from sentry.replays.lib.storage import _make_recording_filename, storage_kv
from sentry.replays.models import ReplayRecordingSegment
from sentry.replays.usecases.pack import unpack
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.helpers.options import override_options


class RecordingTestCase(TransactionTestCase):
    replay_id = uuid.uuid4().hex
    replay_recording_id = uuid.uuid4().hex
    force_synchronous = True

    def assert_replay_recording_segment(self, segment_id: int, compressed: bool) -> None:
        # Assert no recording segment is written for direct-storage.  Direct-storage does not
        # use a metadata database.
        recording_segment = ReplayRecordingSegment.objects.first()
        assert recording_segment is None

        bytes = self.get_recording_data(segment_id)

        # Assert (depending on compression) that the bytes are equal to our default mock value.
        if compressed:
            assert bytes == b'[{"hello":"world"}]'
        else:
            assert bytes == b'[{"hello":"world"}]'

    def get_recording_data(self, segment_id):
        result = storage_kv.get(
            _make_recording_filename(
                project_id=self.project.id,
                replay_id=self.replay_id,
                segment_id=segment_id,
                retention_days=30,
            )
        )
        if result:
            return unpack(zlib.decompress(result))[1]

    def get_video_data(self, segment_id):
        result = storage_kv.get(
            _make_recording_filename(
                project_id=self.project.id,
                replay_id=self.replay_id,
                segment_id=segment_id,
                retention_days=30,
            )
        )
        if result:
            return unpack(zlib.decompress(result))[0]

    def processing_factory(self):
        return ProcessReplayRecordingStrategyFactory(
            input_block_size=1,
            max_batch_size=1,
            max_batch_time=1,
            num_processes=1,
            num_threads=1,
            output_block_size=1,
            force_synchronous=self.force_synchronous,
        )

    def submit(self, messages):
        strategy = self.processing_factory().create_with_partitions(
            lambda x, force=False: None, None
        )

        for message in messages:
            strategy.submit(
                Message(
                    BrokerValue(
                        KafkaPayload(b"key", msgpack.packb(message), [("should_drop", b"1")]),
                        Partition(Topic("ingest-replay-recordings"), 1),
                        1,
                        datetime.now(),
                    )
                )
            )
        strategy.poll()
        strategy.join(1)
        strategy.terminate()

    def nonchunked_messages(
        self,
        message: bytes = b'[{"hello":"world"}]',
        segment_id: int = 0,
        compressed: bool = False,
        replay_event: bytes | None = None,
        replay_video: bytes | None = None,
    ) -> list[ReplayRecording]:
        message = zlib.compress(message) if compressed else message
        return [
            {
                "type": "replay_recording_not_chunked",
                "replay_id": self.replay_id,
                "org_id": self.organization.id,
                "key_id": 123,
                "project_id": self.project.id,
                "received": int(time.time()),
                "retention_days": 30,
                "payload": f'{{"segment_id":{segment_id}}}\n'.encode() + message,  # type: ignore[typeddict-item]
                "replay_event": replay_event,  # type: ignore[typeddict-item]
                "replay_video": replay_video,  # type: ignore[typeddict-item]
            }
        ]

    @patch("sentry.models.OrganizationOnboardingTask.objects.record")
    @patch("sentry.analytics.record")
    @patch("sentry.replays.usecases.ingest.track_outcome")
    def test_compressed_segment_ingestion(self, track_outcome, mock_record, mock_onboarding_task):
        segment_id = 0
        self.submit(self.nonchunked_messages(segment_id=segment_id, compressed=True))
        self.assert_replay_recording_segment(segment_id, compressed=True)

        self.project.refresh_from_db()
        assert self.project.flags.has_replays

        mock_onboarding_task.assert_called_with(
            organization_id=self.project.organization_id,
            task=OnboardingTask.SESSION_REPLAY,
            status=OnboardingTaskStatus.COMPLETE,
            date_completed=ANY,
        )

        mock_record.assert_called_with(
            "first_replay.sent",
            organization_id=self.organization.id,
            project_id=self.project.id,
            platform=self.project.platform,
            user_id=self.organization.default_owner_id,
        )

        assert track_outcome.called

    @patch("sentry.models.OrganizationOnboardingTask.objects.record")
    @patch("sentry.analytics.record")
    @patch("sentry.replays.usecases.ingest.track_outcome")
    def test_event_with_replay_video(self, track_outcome, mock_record, mock_onboarding_task):
        segment_id = 0
        self.submit(
            self.nonchunked_messages(
                segment_id=segment_id,
                compressed=True,
                replay_video=b"hello, world!",
            )
        )
        self.assert_replay_recording_segment(segment_id, compressed=True)
        assert self.get_video_data(segment_id) == b"hello, world!"

        self.project.refresh_from_db()
        assert self.project.flags.has_replays

        mock_onboarding_task.assert_called_with(
            organization_id=self.project.organization_id,
            task=OnboardingTask.SESSION_REPLAY,
            status=OnboardingTaskStatus.COMPLETE,
            date_completed=ANY,
        )

        mock_record.assert_called_with(
            "first_replay.sent",
            organization_id=self.organization.id,
            project_id=self.project.id,
            platform=self.project.platform,
            user_id=self.organization.default_owner_id,
        )

        assert track_outcome.called

    @patch("sentry.models.OrganizationOnboardingTask.objects.record")
    @patch("sentry.analytics.record")
    @patch("sentry.replays.usecases.ingest.track_outcome")
    def test_event_with_replay_video_packed(self, track_outcome, mock_record, mock_onboarding_task):
        segment_id = 0

        self.submit(
            self.nonchunked_messages(
                segment_id=segment_id,
                compressed=True,
                replay_video=b"hello, world!",
            )
        )
        self.assert_replay_recording_segment(segment_id, compressed=True)
        assert self.get_video_data(segment_id) == b"hello, world!"

        self.project.refresh_from_db()
        assert self.project.flags.has_replays

        mock_onboarding_task.assert_called_with(
            organization_id=self.project.organization_id,
            task=OnboardingTask.SESSION_REPLAY,
            status=OnboardingTaskStatus.COMPLETE,
            date_completed=ANY,
        )

        mock_record.assert_called_with(
            "first_replay.sent",
            organization_id=self.organization.id,
            project_id=self.project.id,
            platform=self.project.platform,
            user_id=self.organization.default_owner_id,
        )

        assert track_outcome.called

    @patch("sentry.models.OrganizationOnboardingTask.objects.record")
    @patch("sentry.analytics.record")
    @patch("sentry.replays.usecases.ingest.track_outcome")
    def test_uncompressed_segment_ingestion(self, track_outcome, mock_record, mock_onboarding_task):
        segment_id = 0
        self.submit(self.nonchunked_messages(segment_id=segment_id, compressed=False))
        self.assert_replay_recording_segment(segment_id, False)

        self.project.refresh_from_db()
        assert self.project.flags.has_replays

        mock_onboarding_task.assert_called_with(
            organization_id=self.project.organization_id,
            task=OnboardingTask.SESSION_REPLAY,
            status=OnboardingTaskStatus.COMPLETE,
            date_completed=ANY,
        )

        mock_record.assert_called_with(
            "first_replay.sent",
            organization_id=self.organization.id,
            project_id=self.project.id,
            platform=self.project.platform,
            user_id=self.organization.default_owner_id,
        )

        assert track_outcome.called

    @patch("sentry.models.OrganizationOnboardingTask.objects.record")
    @patch("sentry.analytics.record")
    @patch("sentry.replays.usecases.ingest.dom_index.emit_replay_actions")
    def test_invalid_json(self, emit_replay_actions, mock_record, mock_onboarding_task):
        """Assert invalid JSON does not break ingestion.

        In production, we'll never received invalid JSON. Its validated in Relay. However, we
        may still encounter issues when deserializing JSON that are not encountered in Relay
        (e.g. max depth). These issues should not break ingestion.
        """
        segment_id = 0
        self.submit(
            self.nonchunked_messages(segment_id=segment_id, compressed=True, message=b"[{]")
        )

        # Data was persisted even though an error was encountered.
        bytes = self.get_recording_data(segment_id)
        assert bytes == b"[{]"

        # Onboarding and billing tasks were called.
        self.project.refresh_from_db()
        assert self.project.flags.has_replays

        mock_onboarding_task.assert_called_with(
            organization_id=self.project.organization_id,
            task=OnboardingTask.SESSION_REPLAY,
            status=OnboardingTaskStatus.COMPLETE,
            date_completed=ANY,
        )

        mock_record.assert_called_with(
            "first_replay.sent",
            organization_id=self.organization.id,
            project_id=self.project.id,
            platform=self.project.platform,
            user_id=self.organization.default_owner_id,
        )

        # No replay actions were emitted because JSON deserialization failed.
        assert not emit_replay_actions.called

    @patch("sentry.models.OrganizationOnboardingTask.objects.record")
    @patch("sentry.analytics.record")
    @patch("sentry.replays.usecases.ingest.dom_index.emit_replay_actions")
    def test_invalid_payload_invalid_headers(
        self, emit_replay_actions, mock_record, mock_onboarding_task
    ):
        """Test missing segment_id key does not break ingestion."""
        segment_id = 0

        self.submit(
            [
                {
                    "type": "replay_recording_not_chunked",
                    "replay_id": self.replay_id,
                    "org_id": self.organization.id,
                    "key_id": 123,
                    "project_id": self.project.id,
                    "received": int(time.time()),
                    "retention_days": 30,
                    "payload": b'{"something":"else"}\n' + b'[{"hello":"world"}]',
                }
            ]
        )

        # Assert the message was totally broken and nothing happened.
        bytes = self.get_recording_data(segment_id)
        assert bytes is None
        self.project.refresh_from_db()
        assert not self.project.flags.has_replays
        # assert not mock_onboarding_task.called
        # assert not mock_record.called
        assert not emit_replay_actions.called

    @patch("sentry.models.OrganizationOnboardingTask.objects.record")
    @patch("sentry.analytics.record")
    @patch("sentry.replays.usecases.ingest.dom_index.emit_replay_actions")
    def test_invalid_payload_invalid_unicode_codepoint(
        self, emit_replay_actions, mock_record, mock_onboarding_task
    ):
        """Test invalid unicode codepoint in headers does not break ingestion."""
        segment_id = 0

        self.submit(
            [
                {
                    "type": "replay_recording_not_chunked",
                    "replay_id": self.replay_id,
                    "org_id": self.organization.id,
                    "key_id": 123,
                    "project_id": self.project.id,
                    "received": int(time.time()),
                    "retention_days": 30,
                    "payload": '{"segment_id":"\\ud83c"}\n'.encode("utf-16")
                    + b'[{"hello":"world"}]',
                }
            ]
        )

        # Assert the message was totally broken and nothing happened.
        bytes = self.get_recording_data(segment_id)
        assert bytes is None
        self.project.refresh_from_db()
        assert not self.project.flags.has_replays
        # assert not mock_onboarding_task.called
        # assert not mock_record.called
        assert not emit_replay_actions.called

    @patch("sentry.models.OrganizationOnboardingTask.objects.record")
    @patch("sentry.analytics.record")
    @patch("sentry.replays.usecases.ingest.dom_index.emit_replay_actions")
    def test_invalid_payload_malformed_headers(
        self, emit_replay_actions, mock_record, mock_onboarding_task
    ):
        """Test malformed headers in payload attribute do not break ingestion."""
        segment_id = 0

        self.submit(
            [
                {
                    "type": "replay_recording_not_chunked",
                    "replay_id": self.replay_id,
                    "org_id": self.organization.id,
                    "key_id": 123,
                    "project_id": self.project.id,
                    "received": int(time.time()),
                    "retention_days": 30,
                    "payload": b"i am invalid\n" + b'[{"hello":"world"}]',
                }
            ]
        )

        # Assert the message was totally broken and nothing happened.
        bytes = self.get_recording_data(segment_id)
        assert bytes is None
        self.project.refresh_from_db()
        assert not self.project.flags.has_replays
        # assert not mock_onboarding_task.called
        # assert not mock_record.called
        assert not emit_replay_actions.called

    @patch("sentry.models.OrganizationOnboardingTask.objects.record")
    @patch("sentry.analytics.record")
    @patch("sentry.replays.usecases.ingest.dom_index.emit_replay_actions")
    def test_invalid_payload_missing_headers(
        self, emit_replay_actions, mock_record, mock_onboarding_task
    ):
        """Test missing headers in payload attribute does not break ingestion."""
        segment_id = 0

        self.submit(
            [
                {
                    "type": "replay_recording_not_chunked",
                    "replay_id": self.replay_id,
                    "org_id": self.organization.id,
                    "key_id": 123,
                    "project_id": self.project.id,
                    "received": int(time.time()),
                    "retention_days": 30,
                    "payload": b"no headers :P",
                }
            ]
        )

        # Assert the message was totally broken and nothing happened.
        bytes = self.get_recording_data(segment_id)
        assert bytes is None
        self.project.refresh_from_db()
        assert not self.project.flags.has_replays
        # assert not mock_onboarding_task.called
        # assert not mock_record.called
        assert not emit_replay_actions.called

    @patch("sentry.models.OrganizationOnboardingTask.objects.record")
    @patch("sentry.analytics.record")
    @patch("sentry.replays.usecases.ingest.dom_index.emit_replay_actions")
    def test_invalid_payload_type(self, emit_replay_actions, mock_record, mock_onboarding_task):
        """Test invalid payload types do not break ingestion."""
        segment_id = 0

        self.submit(
            [
                {
                    "type": "replay_recording_not_chunked",
                    "replay_id": self.replay_id,
                    "org_id": self.organization.id,
                    "key_id": 123,
                    "project_id": self.project.id,
                    "received": int(time.time()),
                    "retention_days": 30,
                    "payload": "I'm a string!",
                }
            ]
        )

        # Assert the message was totally broken and nothing happened.
        bytes = self.get_recording_data(segment_id)
        assert bytes is None
        self.project.refresh_from_db()
        assert not self.project.flags.has_replays
        # assert not mock_onboarding_task.called
        # assert not mock_record.called
        assert not emit_replay_actions.called

    @patch("sentry.models.OrganizationOnboardingTask.objects.record")
    @patch("sentry.analytics.record")
    @patch("sentry.replays.usecases.ingest.dom_index.emit_replay_actions")
    def test_invalid_message(self, emit_replay_actions, mock_record, mock_onboarding_task):
        """Test invalid messages do not break ingestion."""
        self.submit(["i am totally wrong"])

        # Assert the message was totally broken and nothing happened.
        bytes = self.get_recording_data(0)
        assert bytes is None
        self.project.refresh_from_db()
        assert not self.project.flags.has_replays
        # assert not mock_onboarding_task.called
        # assert not mock_record.called
        assert not emit_replay_actions.called


class ThreadedRecordingTestCase(RecordingTestCase):
    force_synchronous = False


# Experimental Two Step Recording Consumer


class RecordingTwoStepTestCase(RecordingTestCase):
    def processing_factory(self):
        return RecordingTwoStepStrategyFactory()


class SeparateIOComputeRecordingTestCase(RecordingTestCase):
    def test_compressed_segment_ingestion(self):
        with override_options(
            {"replay.consumer.separate-compute-and-io-org-ids": [self.organization.id]}
        ):
            super().test_compressed_segment_ingestion()

    def test_event_with_replay_video(self):
        with override_options(
            {"replay.consumer.separate-compute-and-io-org-ids": [self.organization.id]}
        ):
            super().test_event_with_replay_video()

    def test_event_with_replay_video_packed(self):
        with override_options(
            {"replay.consumer.separate-compute-and-io-org-ids": [self.organization.id]}
        ):
            super().test_event_with_replay_video_packed()

    def test_uncompressed_segment_ingestion(self):
        with override_options(
            {"replay.consumer.separate-compute-and-io-org-ids": [self.organization.id]}
        ):
            super().test_uncompressed_segment_ingestion()

    def test_invalid_json(self):
        with override_options(
            {"replay.consumer.separate-compute-and-io-org-ids": [self.organization.id]}
        ):
            super().test_invalid_json()

    def test_invalid_payload_invalid_headers(self):
        with override_options(
            {"replay.consumer.separate-compute-and-io-org-ids": [self.organization.id]}
        ):
            super().test_invalid_payload_invalid_headers()

    def test_invalid_payload_invalid_unicode_codepoint(self):
        with override_options(
            {"replay.consumer.separate-compute-and-io-org-ids": [self.organization.id]}
        ):
            super().test_invalid_payload_invalid_unicode_codepoint()

    def test_invalid_payload_malformed_headers(self):
        with override_options(
            {"replay.consumer.separate-compute-and-io-org-ids": [self.organization.id]}
        ):
            super().test_invalid_payload_malformed_headers()

    def test_invalid_payload_missing_headers(self):
        with override_options(
            {"replay.consumer.separate-compute-and-io-org-ids": [self.organization.id]}
        ):
            super().test_invalid_payload_missing_headers()

    def test_invalid_payload_type(self):
        with override_options(
            {"replay.consumer.separate-compute-and-io-org-ids": [self.organization.id]}
        ):
            super().test_invalid_payload_type()

    def test_invalid_message(self):
        with override_options(
            {"replay.consumer.separate-compute-and-io-org-ids": [self.organization.id]}
        ):
            super().test_invalid_message()

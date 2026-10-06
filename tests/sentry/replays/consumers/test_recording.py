from __future__ import annotations

import time
import uuid
import zlib
from unittest.mock import ANY, MagicMock, patch

import msgpack
from sentry_kafka_schemas.schema_types.ingest_replay_recordings_v1 import ReplayRecording

from sentry.models.organizationonboardingtask import OnboardingTask, OnboardingTaskStatus
from sentry.replays.lib.storage import _make_recording_filename, storage_kv
from sentry.replays.tasks import process_replay_recording
from sentry.replays.usecases.pack import unpack
from sentry.testutils.cases import TransactionTestCase
from sentry.utils import json


class RecordingTestCase(TransactionTestCase):
    replay_id = uuid.uuid4().hex

    def get_recording_data(self, segment_id: int) -> memoryview:
        result = storage_kv.get(
            _make_recording_filename(
                project_id=self.project.id,
                replay_id=self.replay_id,
                segment_id=segment_id,
                retention_days=30,
            )
        )
        assert result is not None, "Expecting non-None result here"
        return unpack(zlib.decompress(result))[1]

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
                "relay_snuba_publish_disabled": True,
            }
        ]

    @patch("sentry.models.OrganizationOnboardingTask.objects.record")
    @patch("sentry.replays.usecases.ingest.track_outcome")
    def test_process_replay_recording_task(
        self,
        track_outcome: MagicMock,
        mock_onboarding_task: MagicMock,
    ) -> None:
        # The raw-mode taskbroker entrypoint: a single Kafka message is handed to
        # the task as raw bytes (taskbroker also passes headers).
        data = [{"hello": "world"}]
        segment_id = 0
        message = self.nonchunked_messages(
            message=json.dumps(data).encode(),
            segment_id=segment_id,
            compressed=True,
            replay_event=json.dumps(
                {
                    "type": "replay_event",
                    "replay_id": self.replay_id,
                    "timestamp": int(time.time()),
                }
            ).encode(),
        )[0]

        process_replay_recording(msgpack.packb(message))

        dat = self.get_recording_data(segment_id)
        assert json.loads(bytes(dat).decode("utf-8")) == data

        self.project.refresh_from_db()
        assert self.project.flags.has_replays

        mock_onboarding_task.assert_called_with(
            organization_id=self.project.organization_id,
            task=OnboardingTask.SESSION_REPLAY,
            status=OnboardingTaskStatus.COMPLETE,
            date_completed=ANY,
        )
        assert track_outcome.called

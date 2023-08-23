import uuid
import zlib

from sentry.models import FilePartModel
from sentry.replays.consumers.batched_recording import ProcessReplayRecordingStrategyFactory
from sentry.replays.lib.batched_file_storage.read import download_file_part
from sentry.replays.models import ReplayRecordingSegment
from sentry.testutils.cases import TransactionTestCase
from tests.sentry.replays.consumers.test_recording import RecordingTestCaseMixin


class BatchedRecordingTestCase(RecordingTestCaseMixin, TransactionTestCase):
    def processing_factory(self):
        return ProcessReplayRecordingStrategyFactory(
            max_batch_row_count=1,
            max_batch_size_in_bytes=1,
            max_batch_time_in_seconds=1,
        )

    def setUp(self):
        self.replay_id = uuid.uuid4().hex
        self.replay_recording_id = uuid.uuid4().hex
        self.force_synchronous = True

    def assert_replay_recording_segment(self, segment_id: int, compressed: bool):
        # Assert no recording segment is written for direct-storage.  Direct-storage does not
        # use a metadata database.
        recording_segment = ReplayRecordingSegment.objects.first()
        assert recording_segment is None

        bytes = self.get_recording_data(segment_id)

        # Assert (depending on compression) that the bytes are equal to our default mock value.
        if compressed:
            assert zlib.decompress(bytes) == b'[{"hello":"world"}]'
        else:
            assert bytes == b'[{"hello":"world"}]'

    def get_recording_data(self, segment_id):
        file_part = FilePartModel.objects.first()
        return download_file_part(file_part)

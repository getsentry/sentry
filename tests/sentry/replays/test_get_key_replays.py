import uuid
from datetime import datetime, timedelta

from sentry.replays.testutils import mock_replay
from sentry.replays.usecases.get_key_replays import get_key_replays
from sentry.testutils.cases import ReplaysSnubaTestCase


class KeyReplayQueryTest(ReplaysSnubaTestCase):
    def test_key_replay(self):

        replay1_id = uuid.uuid4().hex
        replay2_id = uuid.uuid4().hex
        replay3_id = uuid.uuid4().hex
        replay4_id = uuid.uuid4().hex
        seq1_timestamp = datetime.now() - timedelta(seconds=22)
        seq2_timestamp = datetime.now() - timedelta(seconds=5)
        self.store_replays(
            mock_replay(
                seq1_timestamp,
                self.project.id,
                replay1_id,
                urls=[
                    "http://localhost:3000/",
                    "http://localhost:3000/login",
                ],
                tags={"test": "hello", "other": "hello"},
                error_ids=[uuid.uuid4().hex],
                segment_id=0,
            )
        )
        self.store_replays(
            mock_replay(
                seq2_timestamp,
                self.project.id,
                replay1_id,
                urls=["http://localhost:3000/"],
                tags={"test": "world", "other": "hello"},
                error_ids=[uuid.uuid4().hex],
                segment_id=1,
            )
        )

        self.store_replays(
            mock_replay(
                seq1_timestamp,
                self.project.id,
                replay2_id,
                urls=[
                    "http://localhost:3000/",
                    "http://localhost:3000/login",
                ],
                tags={"test": "hello", "other": "hello"},
                error_ids=[],
                segment_id=0,
            )
        )
        self.store_replays(
            mock_replay(
                seq2_timestamp,
                self.project.id,
                replay2_id,
                urls=["http://localhost:3000/"],
                tags={"test": "world", "other": "hello"},
                error_ids=[],
                segment_id=1,
            )
        )

        self.store_replays(
            mock_replay(
                seq1_timestamp,
                self.project.id - 1,
                replay3_id,
                is_archived=True,
                segment_id=0,
            )
        )
        self.store_replays(
            mock_replay(
                seq2_timestamp - timedelta(seconds=1),
                self.project.id - 1,
                replay3_id,
                is_archived=False,
                segment_id=1,
            )
        )

        self.store_replays(
            mock_replay(
                seq1_timestamp,
                self.project.id,
                replay4_id,
                error_ids=[uuid.uuid4().hex],
                segment_id=0,
            )
        )

        key_replays = get_key_replays(
            self.organization.id,
            self.project.id,
            datetime.now() - timedelta(days=7),
            datetime.now(),
        )
        assert key_replays == [
            {
                "count_errors": 2,
                "id": replay1_id,
                "duration": 17,
                "user": {
                    "id": "123",
                    "username": "username",
                    "email": "username@example.com",
                    "ip": "127.0.0.1",
                    "display_name": "username",
                },
                "is_archived": False,
            },
            {
                "count_errors": 1,
                "id": replay4_id,
                "duration": 0,
                "user": {
                    "id": "123",
                    "username": "username",
                    "email": "username@example.com",
                    "ip": "127.0.0.1",
                    "display_name": "username",
                },
                "is_archived": False,
            },
        ]

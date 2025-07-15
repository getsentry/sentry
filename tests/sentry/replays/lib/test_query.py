import uuid
from datetime import datetime, timedelta

from sentry.replays.query import query_replays_segment_count
from sentry.replays.testutils import mock_replay
from sentry.testutils.cases import ReplaysSnubaTestCase, SnubaTestCase


class QueryReplaysSegmentCountTest(SnubaTestCase, ReplaysSnubaTestCase):
    def setUp(self):
        super().setUp()

    def store_replay_event(self, dt: datetime, replay_id: str, **kwargs):
        self.store_replays(
            mock_replay(
                dt,
                self.project.id,
                replay_id,
                **kwargs,
            )
        )

    def test_query_replays_segment_count(self):
        replay1_id = uuid.uuid4().hex
        replay2_id = uuid.uuid4().hex
        replay3_id = uuid.uuid4().hex
        replay4_id = uuid.uuid4().hex

        self.store_replay_event(
            datetime.now() - timedelta(minutes=22),
            replay1_id,
            segment_id=0,
        )
        self.store_replay_event(
            datetime.now() - timedelta(minutes=18),
            replay1_id,
            segment_id=1,
        )
        self.store_replay_event(
            datetime.now() - timedelta(minutes=17),
            replay1_id,
            segment_id=2,
        )

        self.store_replay_event(
            datetime.now() - timedelta(minutes=7),
            replay2_id,
            segment_id=0,
        )
        self.store_replay_event(
            datetime.now() + timedelta(days=2),  # out of range
            replay2_id,
            segment_id=1,
        )

        # archived
        self.store_replay_event(
            datetime.now() - timedelta(minutes=7),
            replay3_id,
            segment_id=0,
            is_archived=True,
        )

        # seg 0 out of range
        self.store_replay_event(
            datetime.fromtimestamp(0),
            replay4_id,
            segment_id=0,
        )
        self.store_replay_event(
            datetime.now() - timedelta(minutes=6),
            replay4_id,
            segment_id=1,
        )

        results_list = query_replays_segment_count(
            project_ids=[self.project.id],
            start=datetime.now() - timedelta(hours=1),
            end=datetime.now(),
            replay_ids=[replay1_id, replay2_id, replay3_id, replay4_id],
            tenant_ids={"organization_id": self.organization.id},
        )["data"]

        results = {}
        for row in results_list:
            results[row["rid"]] = row

        assert results[replay1_id]["segment_count"] == 3
        assert results[replay1_id]["is_archived"] == 0
        assert results[replay2_id]["segment_count"] == 1
        assert results[replay2_id]["is_archived"] == 0
        assert results[replay3_id]["segment_count"] == 1
        assert results[replay3_id]["is_archived"] == 1
        assert replay4_id not in results

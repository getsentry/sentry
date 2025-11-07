import datetime
from uuid import uuid4

from sentry.replays.endpoints.organization_replay_details import query_replay_instance_eap
from sentry.testutils.cases import ReplayEAPTestCase, TestCase


class TestQueryReplayInstanceEAP(TestCase, ReplayEAPTestCase):
    def test_eap_replay_query(self) -> None:
        replay_id1 = uuid4().hex
        replay_id2 = uuid4().hex
        now = datetime.datetime.now(datetime.UTC)

        replay1 = self.create_eap_replay(
            replay_id=replay_id1,
            timestamp=now,
            segment_id=0,
            replay_start_timestamp=int(now.timestamp()),
            count_error_events=5,
            count_warning_events=2,
            count_info_events=1,
            click_is_dead=0,
            click_is_rage=0,
            is_archived=0,
        )
        replay2 = self.create_eap_replay(
            replay_id=replay_id2,
            timestamp=now,
            segment_id=0,
            replay_start_timestamp=int(now.timestamp()),
            count_error_events=3,
            count_warning_events=1,
            count_info_events=0,
            click_is_dead=0,
            click_is_rage=0,
            is_archived=0,
        )

        self.store_replays_eap([replay1, replay2])

        start = now - datetime.timedelta(minutes=5)
        end = now + datetime.timedelta(minutes=5)
        organization_id = self.organization.id
        project_ids = [self.project.id]

        res1 = query_replay_instance_eap(
            project_ids=project_ids,
            replay_ids=[replay_id1],
            start=start,
            end=end,
            request_user_id=self.user.id,
            organization_id=organization_id,
        )
        res2 = query_replay_instance_eap(
            project_ids=project_ids,
            replay_ids=[replay_id2],
            start=start,
            end=end,
            request_user_id=self.user.id,
            organization_id=organization_id,
        )

        assert isinstance(res1, dict)
        assert isinstance(res2, dict)
        assert res1.get("data") is not None
        assert res2.get("data") is not None
        assert len(res1["data"]) > 0, f"res1 returned no data: {res1}"
        assert len(res2["data"]) > 0, f"res2 returned no data: {res2}"

        assert res1["data"][0]["replay_id"] == replay_id1
        assert res2["data"][0]["replay_id"] == replay_id2

        replay1_data = res1["data"][0]
        assert "count_segments" in replay1_data
        assert "count_errors" in replay1_data
        assert "is_archived" in replay1_data
        assert "started_at" in replay1_data
        assert "finished_at" in replay1_data

        assert replay1_data["count_errors"] == 5
        assert replay1_data["count_warnings"] == 2
        assert replay1_data["count_segments"] == 1

        replay2_data = res2["data"][0]
        assert replay2_data["count_errors"] == 3
        assert replay2_data["count_warnings"] == 1

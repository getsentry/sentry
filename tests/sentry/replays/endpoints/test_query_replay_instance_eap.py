import datetime
from typing import Any
from uuid import uuid4

from sentry.replays.endpoints.organization_replay_details import (
    _format_eap_timestamps,
    query_replay_instance_eap,
)
from sentry.testutils.cases import ReplayBreadcrumbType, ReplayEAPTestCase, TestCase


class TestQueryReplayInstanceEAP(TestCase, ReplayEAPTestCase):
    def test_eap_replay_query(self) -> None:
        replay_id1 = uuid4().hex
        replay_id2 = uuid4().hex
        now = datetime.datetime.now(datetime.UTC)

        replay1_breadcrumbs = [
            # Dead clicks
            self.create_eap_replay_breadcrumb(
                project=self.project,
                replay_id=replay_id1,
                segment_id=0,
                breadcrumb_type=ReplayBreadcrumbType.DEAD_CLICK,
                timestamp=now,
            ),
            self.create_eap_replay_breadcrumb(
                project=self.project,
                replay_id=replay_id1,
                segment_id=0,
                breadcrumb_type=ReplayBreadcrumbType.DEAD_CLICK,
                timestamp=now,
            ),
            # Rage clicks
            self.create_eap_replay_breadcrumb(
                project=self.project,
                replay_id=replay_id1,
                segment_id=0,
                breadcrumb_type=ReplayBreadcrumbType.RAGE_CLICK,
                timestamp=now,
            ),
            # Regular click
            self.create_eap_replay_breadcrumb(
                project=self.project,
                replay_id=replay_id1,
                segment_id=0,
                breadcrumb_type=ReplayBreadcrumbType.CLICK,
                timestamp=now,
            ),
        ]

        replay2_breadcrumbs = [
            # Dead clicks
            self.create_eap_replay_breadcrumb(
                project=self.project,
                replay_id=replay_id2,
                segment_id=0,
                breadcrumb_type=ReplayBreadcrumbType.DEAD_CLICK,
                timestamp=now,
            ),
            # Rage clicks
            self.create_eap_replay_breadcrumb(
                project=self.project,
                replay_id=replay_id2,
                segment_id=0,
                breadcrumb_type=ReplayBreadcrumbType.RAGE_CLICK,
                timestamp=now,
            ),
            self.create_eap_replay_breadcrumb(
                project=self.project,
                replay_id=replay_id2,
                segment_id=0,
                breadcrumb_type=ReplayBreadcrumbType.RAGE_CLICK,
                timestamp=now,
            ),
        ]

        self.store_replays_eap(replay1_breadcrumbs + replay2_breadcrumbs)

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

        assert len(res1["data"]) == 1, f"Expected 1 row for replay_id1, got {len(res1['data'])}"
        assert len(res2["data"]) == 1, f"Expected 1 row for replay_id2, got {len(res2['data'])}"

        assert res1["data"][0]["replay_id"] == replay_id1
        assert res2["data"][0]["replay_id"] == replay_id2

        replay1_data = res1["data"][0]
        assert "count_segments" in replay1_data
        assert "count_errors" in replay1_data
        assert "count_warnings" in replay1_data
        assert "count_dead_clicks" in replay1_data
        assert "count_rage_clicks" in replay1_data
        assert "isArchived" in replay1_data
        assert "started_at" in replay1_data
        assert "finished_at" in replay1_data

        assert replay1_data["started_at"] is not None, "started_at should not be None"
        assert replay1_data["finished_at"] is not None, "finished_at should not be None"

        assert replay1_data["count_dead_clicks"] == 3, "2 DEAD_CLICK + 1 RAGE_CLICK = 3 dead"
        assert replay1_data["count_rage_clicks"] == 1, "1 RAGE_CLICK = 1 rage"

        replay2_data = res2["data"][0]
        assert replay2_data["count_dead_clicks"] == 3, "1 DEAD_CLICK + 2 RAGE_CLICK = 3 dead"
        assert replay2_data["count_rage_clicks"] == 2, "2 RAGE_CLICK = 2 rage"

    def test_format_eap_timestamps(self) -> None:
        """Test that float timestamps are correctly converted to ISO strings."""
        start_ts = 1690182000.0
        end_ts = 1690185600.0

        data: list[dict[str, Any]] = [
            {
                "replay_id": "test123",
                "started_at": start_ts,
                "finished_at": end_ts,
            },
            {
                "replay_id": "test456",
                "started_at": None,
                "finished_at": None,
            },
        ]

        formatted = _format_eap_timestamps(data)

        assert isinstance(formatted[0]["started_at"], str)
        assert isinstance(formatted[0]["finished_at"], str)

        assert formatted[1]["started_at"] is None
        assert formatted[1]["finished_at"] is None

        parsed_start = datetime.datetime.fromisoformat(formatted[0]["started_at"])
        parsed_end = datetime.datetime.fromisoformat(formatted[0]["finished_at"])

        assert parsed_start.timestamp() == start_ts
        assert parsed_end.timestamp() == end_ts

        assert (parsed_end - parsed_start).total_seconds() == 3600

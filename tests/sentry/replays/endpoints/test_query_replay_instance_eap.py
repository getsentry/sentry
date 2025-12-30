import datetime
from typing import Any
from uuid import uuid4

from sentry.replays.endpoints.organization_replay_details import (
    _normalize_eap_response,
    _query_replay_urls_eap,
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
            self.create_eap_replay_breadcrumb(
                project=self.project,
                replay_id=replay_id1,
                segment_id=0,
                breadcrumb_type=ReplayBreadcrumbType.CLICK,
                timestamp=now - datetime.timedelta(seconds=30),
                category="navigation",
                to="https://example.com/page1",
            ),
            self.create_eap_replay_breadcrumb(
                project=self.project,
                replay_id=replay_id1,
                segment_id=0,
                breadcrumb_type=ReplayBreadcrumbType.CLICK,
                timestamp=now - datetime.timedelta(seconds=20),
                category="navigation",
                to="https://example.com/page2",
            ),
            self.create_eap_replay_breadcrumb(
                project=self.project,
                replay_id=replay_id1,
                segment_id=0,
                breadcrumb_type=ReplayBreadcrumbType.CLICK,
                timestamp=now - datetime.timedelta(seconds=10),
                category="navigation",
                to="https://example.com/page3",
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
        assert "agg_project_id" in replay1_data

        assert isinstance(
            replay1_data["agg_project_id"], int
        ), f"agg_project_id should be int after normalization, got {type(replay1_data['agg_project_id'])}"
        assert (
            replay1_data["agg_project_id"] == self.project.id
        ), f"project_id mismatch: got {replay1_data['agg_project_id']}, expected {self.project.id}"
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

        # Test URL query for replay1
        urls = _query_replay_urls_eap(
            replay_id=replay_id1,
            project_ids=project_ids,
            start=start,
            end=end,
            organization_id=organization_id,
        )
        assert len(urls) == 3, f"Expected 3 URLs, got {len(urls)}"
        assert urls == [
            "https://example.com/page1",
            "https://example.com/page2",
            "https://example.com/page3",
        ], f"URLs should be sorted by timestamp ascending, got {urls}"

        urls2 = _query_replay_urls_eap(
            replay_id=replay_id2,
            project_ids=project_ids,
            start=start,
            end=end,
            organization_id=organization_id,
        )
        assert len(urls2) == 0, f"Expected 0 URLs for replay2, got {len(urls2)}"

    def test_normalize_eap_response(self) -> None:
        """Test that EAP response data is correctly normalized.

        - Float timestamps should be converted to ISO strings
        - Float project IDs should be converted to integers
        """
        start_ts = 1690182000.0
        end_ts = 1690185600.0
        project_id_float = 4557221366136832.0

        data: list[dict[str, Any]] = [
            {
                "replay_id": "test123",
                "started_at": start_ts,
                "finished_at": end_ts,
                "agg_project_id": project_id_float,
            },
            {
                "replay_id": "test456",
                "started_at": None,
                "finished_at": None,
                "agg_project_id": None,
            },
        ]

        normalized = _normalize_eap_response(data)

        # Test timestamp conversion
        assert isinstance(normalized[0]["started_at"], str)
        assert isinstance(normalized[0]["finished_at"], str)
        assert normalized[1]["started_at"] is None
        assert normalized[1]["finished_at"] is None

        parsed_start = datetime.datetime.fromisoformat(normalized[0]["started_at"])
        parsed_end = datetime.datetime.fromisoformat(normalized[0]["finished_at"])
        assert parsed_start.timestamp() == start_ts
        assert parsed_end.timestamp() == end_ts
        assert (parsed_end - parsed_start).total_seconds() == 3600

        assert isinstance(normalized[0]["agg_project_id"], int)
        assert normalized[0]["agg_project_id"] == int(project_id_float)

        assert ".0" not in str(normalized[0]["agg_project_id"])
        assert normalized[1]["agg_project_id"] is None

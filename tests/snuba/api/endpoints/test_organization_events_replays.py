from datetime import timedelta
from uuid import uuid4

from sentry.testutils.cases import ReplayBreadcrumbType, ReplayEAPTestCase, SnubaTestCase
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationEventsReplaysEndpointTest(
    OrganizationEventsEndpointTestBase, SnubaTestCase, ReplayEAPTestCase
):
    dataset = "replays"

    def test_simple(self) -> None:
        """This is vaguely copied from test_query_replay_instance_eap.py, just a quick test to make sure all the piping
        is there as expected"""
        replay_id1 = uuid4().hex
        replay_id2 = uuid4().hex

        self.store_eap_items(
            [
                # Dead clicks
                self.create_eap_replay_breadcrumb(
                    project=self.project,
                    replay_id=replay_id1,
                    segment_id=0,
                    breadcrumb_type=ReplayBreadcrumbType.DEAD_CLICK,
                    timestamp=self.ten_mins_ago,
                ),
                self.create_eap_replay_breadcrumb(
                    project=self.project,
                    replay_id=replay_id1,
                    segment_id=0,
                    breadcrumb_type=ReplayBreadcrumbType.DEAD_CLICK,
                    timestamp=self.ten_mins_ago,
                ),
                # Rage clicks
                self.create_eap_replay_breadcrumb(
                    project=self.project,
                    replay_id=replay_id1,
                    segment_id=0,
                    breadcrumb_type=ReplayBreadcrumbType.RAGE_CLICK,
                    timestamp=self.ten_mins_ago,
                ),
                # Regular click
                self.create_eap_replay_breadcrumb(
                    project=self.project,
                    replay_id=replay_id1,
                    segment_id=0,
                    breadcrumb_type=ReplayBreadcrumbType.CLICK,
                    timestamp=self.ten_mins_ago,
                ),
                self.create_eap_replay_breadcrumb(
                    project=self.project,
                    replay_id=replay_id1,
                    segment_id=0,
                    breadcrumb_type=ReplayBreadcrumbType.CLICK,
                    timestamp=self.ten_mins_ago - timedelta(seconds=20),
                    category="navigation",
                    to="https://example.com/page1",
                ),
                self.create_eap_replay_breadcrumb(
                    project=self.project,
                    replay_id=replay_id1,
                    segment_id=0,
                    breadcrumb_type=ReplayBreadcrumbType.CLICK,
                    timestamp=self.ten_mins_ago - timedelta(seconds=20),
                    category="navigation",
                    to="https://example.com/page2",
                ),
                self.create_eap_replay_breadcrumb(
                    project=self.project,
                    replay_id=replay_id1,
                    segment_id=0,
                    breadcrumb_type=ReplayBreadcrumbType.CLICK,
                    timestamp=self.ten_mins_ago - timedelta(seconds=10),
                    category="navigation",
                    to="https://example.com/page3",
                ),
                # Dead clicks
                self.create_eap_replay_breadcrumb(
                    project=self.project,
                    replay_id=replay_id2,
                    segment_id=0,
                    breadcrumb_type=ReplayBreadcrumbType.DEAD_CLICK,
                    timestamp=self.ten_mins_ago,
                ),
                # Rage clicks
                self.create_eap_replay_breadcrumb(
                    project=self.project,
                    replay_id=replay_id2,
                    segment_id=0,
                    breadcrumb_type=ReplayBreadcrumbType.RAGE_CLICK,
                    timestamp=self.ten_mins_ago,
                ),
                self.create_eap_replay_breadcrumb(
                    project=self.project,
                    replay_id=replay_id2,
                    segment_id=0,
                    breadcrumb_type=ReplayBreadcrumbType.RAGE_CLICK,
                    timestamp=self.ten_mins_ago,
                ),
            ]
        )

        response = self.do_request(
            {
                "field": ["replay.id", "sum(dead_clicks)", "sum(rage_clicks)"],
                "query": "",
                "dataset": self.dataset,
                "orderby": "sum(rage_clicks)",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "replay.id": replay_id1,
                "sum(dead_clicks)": 3,
                "sum(rage_clicks)": 1,
            },
            {
                "replay.id": replay_id2,
                "sum(dead_clicks)": 3,
                "sum(rage_clicks)": 2,
            },
        ]

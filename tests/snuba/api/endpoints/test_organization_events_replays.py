from datetime import timedelta
from uuid import uuid4

import pytest

from sentry.snuba.utils import PUBLIC_DATASET_LABELS
from sentry.testutils.cases import ReplayBreadcrumbType, ReplayEAPTestCase, SnubaTestCase
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationEventsReplaysEndpointTest(
    OrganizationEventsEndpointTestBase, SnubaTestCase, ReplayEAPTestCase
):
    dataset = "replays"

    def setUp(self):
        super().setUp()
        self.features = {"organizations:events-use-replays-dataset": True}

        self.replay_id1 = uuid4().hex
        self.replay_id2 = uuid4().hex

        self.store_eap_items(
            [
                # Dead clicks
                self.create_replay_breadcrumb(
                    project=self.project,
                    replay_id=self.replay_id1,
                    segment_id=0,
                    breadcrumb_type=ReplayBreadcrumbType.DEAD_CLICK,
                    timestamp=self.ten_mins_ago,
                ),
                self.create_replay_breadcrumb(
                    project=self.project,
                    replay_id=self.replay_id1,
                    segment_id=0,
                    breadcrumb_type=ReplayBreadcrumbType.DEAD_CLICK,
                    timestamp=self.ten_mins_ago,
                ),
                # Rage clicks
                self.create_replay_breadcrumb(
                    project=self.project,
                    replay_id=self.replay_id1,
                    segment_id=0,
                    breadcrumb_type=ReplayBreadcrumbType.RAGE_CLICK,
                    timestamp=self.ten_mins_ago,
                ),
                # Regular click
                self.create_replay_breadcrumb(
                    project=self.project,
                    replay_id=self.replay_id1,
                    segment_id=0,
                    breadcrumb_type=ReplayBreadcrumbType.CLICK,
                    timestamp=self.ten_mins_ago,
                ),
                self.create_replay_breadcrumb(
                    project=self.project,
                    replay_id=self.replay_id1,
                    segment_id=0,
                    breadcrumb_type=ReplayBreadcrumbType.CLICK,
                    timestamp=self.ten_mins_ago - timedelta(seconds=30),
                    category="navigation",
                    to="https://example.com/page1",
                ),
                self.create_replay_breadcrumb(
                    project=self.project,
                    replay_id=self.replay_id1,
                    segment_id=0,
                    breadcrumb_type=ReplayBreadcrumbType.CLICK,
                    timestamp=self.ten_mins_ago - timedelta(seconds=20),
                    category="navigation",
                    to="https://example.com/page2",
                ),
                self.create_replay_breadcrumb(
                    project=self.project,
                    replay_id=self.replay_id1,
                    segment_id=0,
                    breadcrumb_type=ReplayBreadcrumbType.CLICK,
                    timestamp=self.ten_mins_ago - timedelta(seconds=10),
                    category="navigation",
                    to="https://example.com/page3",
                ),
                # Dead clicks
                self.create_replay_breadcrumb(
                    project=self.project,
                    replay_id=self.replay_id2,
                    segment_id=0,
                    breadcrumb_type=ReplayBreadcrumbType.DEAD_CLICK,
                    timestamp=self.ten_mins_ago,
                ),
                # Rage clicks
                self.create_replay_breadcrumb(
                    project=self.project,
                    replay_id=self.replay_id2,
                    segment_id=0,
                    breadcrumb_type=ReplayBreadcrumbType.RAGE_CLICK,
                    timestamp=self.ten_mins_ago,
                ),
                self.create_replay_breadcrumb(
                    project=self.project,
                    replay_id=self.replay_id2,
                    segment_id=0,
                    breadcrumb_type=ReplayBreadcrumbType.RAGE_CLICK,
                    timestamp=self.ten_mins_ago,
                ),
            ]
        )

    def test_no_feature_errors(self) -> None:
        self.features = {}
        response = self.do_request(
            {
                "field": ["replay.id", "sum(dead_clicks)", "sum(rage_clicks)"],
                "query": "",
                "dataset": self.dataset,
                "orderby": "sum(rage_clicks)",
                "project": self.project.id,
            }
        )
        assert response.status_code == 400, response.content
        assert (
            response.data["detail"] == f"dataset must be one of: {', '.join(PUBLIC_DATASET_LABELS)}"
        )

    def test_count_rage_and_dead_clicks(self) -> None:
        response = self.do_request(
            {
                "field": ["replay.id", "sum(dead_clicks)", "sum(rage_clicks)"],
                "query": "",
                "dataset": self.dataset,
                "orderby": "sum(rage_clicks)",
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        assert response.data["data"] == [
            {
                "replay.id": self.replay_id1,
                "sum(dead_clicks)": 3,
                "sum(rage_clicks)": 1,
            },
            {
                "replay.id": self.replay_id2,
                "sum(dead_clicks)": 3,
                "sum(rage_clicks)": 2,
            },
        ]

    def test_count_transactions(self) -> None:
        response = self.do_request(
            {
                "field": ["replay.id", "count(transaction.span_id)"],
                "dataset": self.dataset,
                "orderby": "-count(transaction.span_id)",
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        assert response.data["data"] == [
            {
                "replay.id": self.replay_id1,
                "count(transaction.span_id)": 7,
            },
            {
                "replay.id": self.replay_id2,
                "count(transaction.span_id)": 3,
            },
        ]

    def test_min_max_timestamp(self) -> None:
        response = self.do_request(
            {
                "field": ["replay.id", "min(timestamp)", "max(timestamp)"],
                "query": f"replay.id:{self.replay_id1}",
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"] == [
            {
                "replay.id": self.replay_id1,
                "min(timestamp)": pytest.approx(
                    (self.ten_mins_ago - timedelta(seconds=30)).timestamp()
                ),
                "max(timestamp)": pytest.approx((self.ten_mins_ago).timestamp()),
            },
        ]

    def test_url_query(self):
        response = self.do_request(
            {
                "field": ["replay.url", "min(timestamp)"],
                "query": f"replay.category:navigation replay.id:{self.replay_id1}",
                "dataset": self.dataset,
                "orderby": "min(timestamp)",
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 3
        assert response.data["data"] == [
            {
                "replay.url": "https://example.com/page1",
                "min(timestamp)": pytest.approx(
                    (self.ten_mins_ago - timedelta(seconds=30)).timestamp()
                ),
            },
            {
                "replay.url": "https://example.com/page2",
                "min(timestamp)": pytest.approx(
                    (self.ten_mins_ago - timedelta(seconds=20)).timestamp()
                ),
            },
            {
                "replay.url": "https://example.com/page3",
                "min(timestamp)": pytest.approx(
                    (self.ten_mins_ago - timedelta(seconds=10)).timestamp()
                ),
            },
        ]

    def test_url_query_for_replay_without_urls(self):
        response = self.do_request(
            {
                "field": ["replay.url", "min(timestamp)"],
                "query": f"replay.category:navigation replay.id:{self.replay_id2}",
                "dataset": self.dataset,
                "orderby": "min(timestamp)",
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 0
        assert response.data["data"] == []

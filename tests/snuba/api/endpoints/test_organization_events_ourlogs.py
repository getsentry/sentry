from datetime import datetime, timezone

import pytest

from sentry.utils.cursors import Cursor
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationEventsOurLogsEndpointTest(OrganizationEventsEndpointTestBase):
    dataset = "ourlogs"

    def do_request(self, query, features=None, **kwargs):
        query["useRpc"] = "1"
        return super().do_request(query, features, **kwargs)

    def setUp(self):
        super().setUp()
        self.features = {
            "organizations:ourlogs-enabled": True,
        }

    @pytest.mark.querybuilder
    def test_simple(self):
        logs = [
            self.create_ourlog(
                {"body": "foo"},
                timestamp=self.ten_mins_ago,
            ),
            self.create_ourlog(
                {"body": "bar"},
                timestamp=self.nine_mins_ago,
            ),
        ]
        self.store_ourlogs(logs)
        response = self.do_request(
            {
                "field": ["log.body"],
                "query": "",
                "orderby": "log.body",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data == [
            {"log.body": "bar"},
            {"log.body": "foo"},
        ]
        assert meta["dataset"] == self.dataset

    @pytest.mark.querybuilder
    def test_timestamp_order(self):
        logs = [
            self.create_ourlog(
                {"body": "bar"},
                timestamp=self.ten_mins_ago,
            ),
            self.create_ourlog(
                {"body": "foo"},
                timestamp=self.nine_mins_ago,
            ),
        ]
        self.store_ourlogs(logs)
        response = self.do_request(
            {
                "field": ["log.body", "timestamp"],
                "query": "",
                "orderby": "timestamp",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2

        for log, source in zip(data, logs):
            assert log["log.body"] == source["body"]
            ts = datetime.fromisoformat(log["timestamp"])
            assert ts.tzinfo == timezone.utc
            timestamp_from_nanos = source["timestamp_nanos"] / 1_000_000_000
            assert ts.timestamp() == pytest.approx(timestamp_from_nanos, abs=5), "timestamp"

        assert meta["dataset"] == self.dataset

    def test_free_text_wildcard_filter(self):
        logs = [
            self.create_ourlog(
                {"body": "bar"},
                timestamp=self.ten_mins_ago,
            ),
            self.create_ourlog(
                {"body": "foo"},
                timestamp=self.nine_mins_ago,
            ),
        ]
        self.store_ourlogs(logs)
        response = self.do_request(
            {
                "field": ["log.body"],
                "query": "foo",
                "orderby": "log.body",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["log.body"] == "foo"

        assert meta["dataset"] == self.dataset

    def test_pagination(self):
        logs = [
            self.create_ourlog(
                {"body": "foo"},
                timestamp=self.eleven_mins_ago,
            ),
            self.create_ourlog(
                {"body": "bar"},
                timestamp=self.ten_mins_ago,
            ),
            self.create_ourlog(
                {"body": "baz"},
                timestamp=self.nine_mins_ago,
            ),
        ]
        self.store_ourlogs(logs)
        response = self.do_request(
            {
                "field": ["log.body", "timestamp"],
                "query": "",
                "cursor": Cursor(0, 2, False, False),
                "per_page": 2,
                "orderby": "timestamp",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data == [
            {"log.body": "baz"},
        ]

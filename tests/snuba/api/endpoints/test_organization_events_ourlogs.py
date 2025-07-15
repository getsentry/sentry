from datetime import datetime, timedelta, timezone

import pytest

from sentry.testutils.helpers.datetime import before_now
from sentry.utils.cursors import Cursor
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationEventsOurLogsEndpointTest(OrganizationEventsEndpointTestBase):
    dataset = "ourlogs"

    def do_request(self, query, features=None, **kwargs):
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
                {"body": "foo"},
                timestamp=self.ten_mins_ago,
            ),
            self.create_ourlog(
                {"body": "bar"},
                timestamp=self.ten_mins_ago + timedelta(microseconds=1),
            ),
            self.create_ourlog(
                {"body": "baz"},
                timestamp=self.ten_mins_ago + timedelta(microseconds=2),
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
        assert len(data) == len(logs)

        for log, source in zip(data, logs):
            assert log["log.body"] == source.attributes["sentry.body"].string_value
            assert "tags[sentry.timestamp_precise,number]" in log
            assert "timestamp" in log
            ts = datetime.fromisoformat(log["timestamp"])
            assert ts.tzinfo == timezone.utc
            timestamp_from_nanos = (
                source.attributes["sentry.timestamp_nanos"].int_value / 1_000_000_000
            )
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
        assert data[0]["log.body"] == "baz"

    @pytest.mark.xfail(
        reason="Failing because of https://github.com/getsentry/eap-planning/issues/238"
    )
    def test_project_slug_field(self):
        logs = [
            self.create_ourlog(
                {"body": "bar"},
                timestamp=self.ten_mins_ago,
            ),
        ]
        self.store_ourlogs(logs)
        response = self.do_request(
            {
                "field": ["project"],
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["project"] == self.project.slug

        assert meta["dataset"] == self.dataset

    def test_trace_id_list_filter(self):
        trace_id_1 = "1" * 32
        trace_id_2 = "2" * 32
        logs = [
            self.create_ourlog(
                {"body": "foo", "trace_id": trace_id_1},
                timestamp=self.ten_mins_ago,
            ),
            self.create_ourlog(
                {"body": "bar", "trace_id": trace_id_2},
                timestamp=self.ten_mins_ago,
            ),
        ]
        self.store_ourlogs(logs)
        response = self.do_request(
            {
                "field": ["message", "trace"],
                "query": f"trace:[{trace_id_1},{trace_id_2}]",
                "orderby": "message",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data == [
            {"message": "bar", "trace": trace_id_2},
            {"message": "foo", "trace": trace_id_1},
        ]
        assert meta["dataset"] == self.dataset

    def test_filter_timestamp(self):
        one_day_ago = before_now(days=1).replace(microsecond=0)
        three_days_ago = before_now(days=3).replace(microsecond=0)

        log1 = self.create_ourlog(
            {"body": "foo"},
            timestamp=one_day_ago,
        )
        log2 = self.create_ourlog(
            {"body": "bar"},
            timestamp=three_days_ago,
        )
        self.store_ourlogs([log1, log2])

        request = {
            "field": ["message"],
            "project": self.project.id,
            "dataset": self.dataset,
        }

        response = self.do_request(
            {
                **request,
                "query": "timestamp:-2d",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [{"message": "foo"}]

        timestamp = before_now(days=2).isoformat()
        timestamp = timestamp.split("T", 2)[0]

        response = self.do_request(
            {
                **request,
                "query": f"timestamp:>{timestamp}",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [{"message": "foo"}]

        response = self.do_request(
            {
                **request,
                "query": f"timestamp:<{timestamp}",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [{"message": "bar"}]

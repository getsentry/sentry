from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest

from sentry.constants import DataCategory
from sentry.search.eap import constants
from sentry.testutils.cases import OutcomesSnubaTest
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.cursors import Cursor
from sentry.utils.outcomes import Outcome
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationEventsOurLogsEndpointTest(OrganizationEventsEndpointTestBase, OutcomesSnubaTest):
    dataset = "logs"

    def setUp(self) -> None:
        super().setUp()
        self.features = {
            "organizations:ourlogs-enabled": True,
        }

    @pytest.mark.querybuilder
    def test_simple(self) -> None:
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
                "field": ["id", "log.body"],
                "query": "",
                "orderby": "-log.body",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data == [
            {
                "id": UUID(bytes=bytes(reversed(logs[0].item_id))).hex,
                "log.body": "foo",
            },
            {
                "id": UUID(bytes=bytes(reversed(logs[1].item_id))).hex,
                "log.body": "bar",
            },
        ]
        assert meta["dataset"] == self.dataset

    @pytest.mark.querybuilder
    def test_timestamp_order(self) -> None:
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
            assert "tags[sentry.timestamp_precise,number]" not in log
            assert constants.TIMESTAMP_PRECISE_ALIAS in log
            assert constants.TIMESTAMP_ALIAS in log
            ts = datetime.fromisoformat(log["timestamp"])
            assert ts.tzinfo == timezone.utc
            timestamp_from_nanos = (
                source.attributes["sentry.observed_timestamp_nanos"].int_value / 1_000_000_000
            )
            assert ts.timestamp() == pytest.approx(timestamp_from_nanos, abs=5), "timestamp"

        assert meta["dataset"] == self.dataset

    def test_free_text_wildcard_filter(self) -> None:
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

    def test_pagination(self) -> None:
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
    def test_project_slug_field(self) -> None:
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

    def test_trace_id_list_filter(self) -> None:
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

    def test_filter_timestamp(self) -> None:
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

    def test_count_meta_type_is_integer(self) -> None:
        one_day_ago = before_now(days=1).replace(microsecond=0)

        log1 = self.create_ourlog(
            {"body": "foo"},
            timestamp=one_day_ago,
        )
        self.store_ourlogs([log1])

        request = {
            "field": ["message", "count()"],
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
        assert response.data["data"] == [{"message": "foo", "count()": 1}]
        assert response.data["meta"]["fields"]["count()"] == "integer"

    def test_payload_bytes_meta_type_is_byte(self) -> None:
        one_day_ago = before_now(days=1).replace(microsecond=0)

        log1 = self.create_ourlog(
            {"body": "foo"},
            attributes={"sentry.payload_size_bytes": 1234567},
            timestamp=one_day_ago,
        )
        self.store_ourlogs([log1])

        request = {
            "field": ["message", "payload_size"],
            "project": self.project.id,
            "dataset": self.dataset,
        }

        response = self.do_request(
            {
                **request,
                "query": "message:foo payload_size:1234567",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [{"message": "foo", "payload_size": 1234567}]
        assert response.data["meta"]["fields"]["payload_size"] == "size"
        assert response.data["meta"]["units"]["payload_size"] == "byte"

    def test_pagelimit(self) -> None:
        log = self.create_ourlog(
            {"body": "test"},
            timestamp=self.ten_mins_ago,
        )
        self.store_ourlogs([log])

        response = self.do_request(
            {
                "field": ["message"],
                "project": self.project.id,
                "dataset": self.dataset,
                "per_page": 9999,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["message"] == "test"

        response = self.do_request(
            {
                "field": ["message"],
                "project": self.project.id,
                "dataset": self.dataset,
                "per_page": 10000,
            }
        )
        assert response.status_code == 400
        assert response.data["detail"] == "Invalid per_page value. Must be between 1 and 9999."

    def test_homepage_query(self) -> None:
        """This query matches the one made on the logs homepage so that we can be sure everything is working at least
        for the initial load"""
        logs = [
            self.create_ourlog(
                {"body": "foo"},
                attributes={
                    "sentry.observed_timestamp_nanos": str(
                        self.ten_mins_ago.timestamp() * 1_000_000_000
                    )
                },
                timestamp=self.ten_mins_ago,
            ),
            self.create_ourlog(
                {"body": "bar"},
                attributes={
                    "sentry.observed_timestamp_nanos": str(
                        self.nine_mins_ago.timestamp() * 1_000_000_000
                    ),
                },
                timestamp=self.nine_mins_ago,
            ),
        ]
        self.store_ourlogs(logs)
        response = self.do_request(
            {
                "cursor": "",
                "dataset": "logs",
                "field": [
                    "sentry.item_id",
                    "project.id",
                    "trace",
                    "severity_number",
                    "severity",
                    "timestamp",
                    "observed_timestamp",
                    "message",
                ],
                "per_page": 1000,
                "project": self.project.id,
                "query": "",
                "referrer": "api.explore.logs-table",
                "sort": "-timestamp",
                "statsPeriod": "14d",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        for result, source in zip(data, reversed(logs)):
            assert result == {
                "sentry.item_id": UUID(bytes=bytes(reversed(source.item_id))).hex,
                "project.id": self.project.id,
                "trace": source.trace_id,
                "severity_number": source.attributes["sentry.severity_number"].int_value,
                "severity": source.attributes["sentry.severity_text"].string_value,
                "timestamp": datetime.fromtimestamp(source.timestamp.seconds)
                .replace(tzinfo=timezone.utc)
                .isoformat(),
                constants.TIMESTAMP_PRECISE_ALIAS: pytest.approx(
                    source.attributes["sentry.timestamp_precise"].int_value
                ),
                "observed_timestamp": source.attributes[
                    "sentry.observed_timestamp_nanos"
                ].string_value,
                "message": source.attributes["sentry.body"].string_value,
            }
        assert meta["dataset"] == self.dataset

    def test_strip_sentry_prefix_from_message_parameter(self) -> None:
        logs = [
            self.create_ourlog(
                {"body": "User {username} logged in from {ip}"},
                attributes={
                    "sentry.message.parameter.username": "alice",
                    "sentry.message.parameter.ip": "192.168.1.1",
                },
                timestamp=self.ten_mins_ago,
            ),
            self.create_ourlog(
                {"body": "User {username} logged out"},
                attributes={"sentry.message.parameter.username": "bob"},
                timestamp=self.nine_mins_ago,
            ),
            self.create_ourlog(
                {"body": "Item {0} was purchased by {1}"},
                attributes={
                    "sentry.message.parameter.0": "laptop",
                    "sentry.message.parameter.1": "charlie",
                },
                timestamp=self.nine_mins_ago - timedelta(minutes=1),
            ),
            self.create_ourlog(
                {"body": "Item {0} of {1}"},
                attributes={
                    "sentry.message.parameter.0": 5,
                    "sentry.message.parameter.1": 10,
                },
                timestamp=self.nine_mins_ago - timedelta(minutes=1),
            ),
        ]

        self.store_ourlogs(logs)

        response = self.do_request(
            {
                "field": [
                    "timestamp",
                    "message",
                    "message.parameter.username",
                    "message.parameter.ip",
                ],
                "query": 'message.parameter.username:"alice"',
                "orderby": "-timestamp",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["message"] == "User {username} logged in from {ip}"
        assert data[0]["message.parameter.username"] == "alice"
        assert data[0]["message.parameter.ip"] == "192.168.1.1"

        response = self.do_request(
            {
                "field": [
                    "timestamp",
                    "message",
                    "message.parameter.0",
                    "message.parameter.1",
                ],
                "query": 'message.parameter.0:"laptop"',
                "orderby": "-timestamp",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["message"] == "Item {0} was purchased by {1}"
        assert data[0]["message.parameter.0"] == "laptop"
        assert data[0]["message.parameter.1"] == "charlie"

        response = self.do_request(
            {
                "field": [
                    "timestamp",
                    "message",
                    "tags[message.parameter.0,number]",
                    "tags[message.parameter.1,number]",
                ],
                "query": "tags[message.parameter.0,number]:>0",
                "orderby": "-timestamp",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["message"] == "Item {0} of {1}"
        assert data[0]["tags[message.parameter.0,number]"] == 5
        assert data[0]["tags[message.parameter.1,number]"] == 10

        response = self.do_request(
            {
                "field": ["timestamp", "message", "message.parameter.username"],
                "query": 'message.parameter.username:["alice", "bob"]',
                "orderby": "-timestamp",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        assert data[0]["message.parameter.username"] == "bob"
        assert data[1]["message.parameter.username"] == "alice"

    def test_high_accuracy_flex_time_order_by_timestamp(self):
        logs = [
            self.create_ourlog(
                {"body": "foo"},
                timestamp=self.nine_mins_ago,
                log_id=uuid4().hex,
            ),
            self.create_ourlog(
                {"body": "bar"},
                timestamp=self.ten_mins_ago,
                log_id="1" + uuid4().hex[1:],
            ),
            self.create_ourlog(
                {"body": "qux"},
                timestamp=self.ten_mins_ago,
                log_id="0" + uuid4().hex[1:],  # qux's id sorts after bar's id
            ),
        ]
        self.store_ourlogs(logs)
        response = self.do_request(
            {
                "field": ["id", "timestamp", "message"],
                "query": "",
                "orderby": "-timestamp",
                "project": self.project.id,
                "dataset": self.dataset,
                "sampling": "HIGHEST_ACCURACY_FLEX_TIME",
            },
            features={"organizations:ourlogs-high-fidelity": True},
        )
        assert response.status_code == 200, response.content

        assert [row["message"] for row in response.data["data"]] == ["foo", "bar", "qux"]

    def test_high_accuracy_flex_time_empty_page_no_next(self):
        response = self.do_request(
            {
                "field": ["timestamp", "message"],
                "orderby": "-timestamp",
                "project": self.project.id,
                "dataset": self.dataset,
                "sampling": "HIGHEST_ACCURACY_FLEX_TIME",
            },
            features={"organizations:ourlogs-high-fidelity": True},
        )

        assert response.status_code == 200, response.content
        assert response.data["data"] == []
        assert response.data["meta"]["dataScanned"] == "full"
        links = {
            attrs["rel"]: {**attrs, "href": url}
            for url, attrs in parse_link_header(response["link"]).items()
        }
        assert links["previous"]["results"] == "false"
        assert links["next"]["results"] == "false"

    def test_high_accuracy_flex_time_partial_page_no_next(self):
        logs = [
            self.create_ourlog(
                {"body": "log"},
                timestamp=self.nine_mins_ago,
            )
        ]
        self.store_ourlogs(logs)

        response = self.do_request(
            {
                "field": ["timestamp", "message"],
                "orderby": "-timestamp",
                "project": self.project.id,
                "dataset": self.dataset,
                "sampling": "HIGHEST_ACCURACY_FLEX_TIME",
                "per_page": 10,
            },
            features={"organizations:ourlogs-high-fidelity": True},
        )

        assert response.status_code == 200, response.content
        assert [row["message"] for row in response.data["data"]] == ["log"]
        assert response.data["meta"]["dataScanned"] == "full"
        links = {
            attrs["rel"]: {**attrs, "href": url}
            for url, attrs in parse_link_header(response["link"]).items()
        }
        assert links["previous"]["results"] == "false"
        assert links["next"]["results"] == "false"

    def test_high_accuracy_flex_time_full_page_no_next(self):
        n = 5
        logs = [
            self.create_ourlog(
                {"body": f"log {i + 1} of {n}"},
                timestamp=self.nine_mins_ago - timedelta(minutes=i + 1),
            )
            for i in range(n)
        ]
        self.store_ourlogs(logs)

        response = self.do_request(
            {
                "field": ["timestamp", "message"],
                "orderby": "-timestamp",
                "project": self.project.id,
                "dataset": self.dataset,
                "sampling": "HIGHEST_ACCURACY_FLEX_TIME",
                "per_page": 5,
            },
            features={"organizations:ourlogs-high-fidelity": True},
        )

        assert response.status_code == 200, response.content
        assert [row["message"] for row in response.data["data"]] == [
            f"log {i + 1} of {n}" for i in range(5)
        ]
        assert response.data["meta"]["dataScanned"] == "full"
        links = {
            attrs["rel"]: {**attrs, "href": url}
            for url, attrs in parse_link_header(response["link"]).items()
        }
        assert links["previous"]["results"] == "false"
        assert links["next"]["results"] == "false"

    def test_high_accuracy_flex_time_full_page_with_next(self):
        n = 8
        logs = [
            self.create_ourlog(
                {"body": f"log {i + 1} of {n}"},
                timestamp=self.nine_mins_ago - timedelta(minutes=i + 1),
            )
            for i in range(n)
        ]
        self.store_ourlogs(logs)

        request = {
            "field": ["timestamp", "message"],
            "orderby": "-timestamp",
            "project": self.project.id,
            "dataset": self.dataset,
            "sampling": "HIGHEST_ACCURACY_FLEX_TIME",
            "per_page": 5,
        }

        response = self.do_request(request, features={"organizations:ourlogs-high-fidelity": True})

        assert response.status_code == 200, response.content
        assert [row["message"] for row in response.data["data"]] == [
            f"log {i + 1} of {n}" for i in range(5)
        ]
        assert response.data["meta"]["dataScanned"] == "full"
        links = {
            attrs["rel"]: {**attrs, "href": url}
            for url, attrs in parse_link_header(response["link"]).items()
        }
        assert links["previous"]["results"] == "false"
        assert links["next"]["results"] == "true"

        response = self.do_request(
            {**request, "cursor": links["next"]["cursor"]},
            features={"organizations:ourlogs-high-fidelity": True},
        )

        assert response.status_code == 200, response.content
        assert [row["message"] for row in response.data["data"]] == [
            f"log {i + 6} of {n}" for i in range(3)
        ]
        assert response.data["meta"]["dataScanned"] == "full"
        links = {
            attrs["rel"]: {**attrs, "href": url}
            for url, attrs in parse_link_header(response["link"]).items()
        }
        assert links["previous"]["results"] == "false"
        assert links["next"]["results"] == "false"

    def test_high_accuracy_flex_time_partial_page_with_next(self):
        hour_1 = before_now(hours=4).replace(minute=0, second=0, microsecond=0)
        hour_2 = before_now(hours=3).replace(minute=0, second=0, microsecond=0)
        hour_3 = before_now(hours=2).replace(minute=0, second=0, microsecond=0)
        hour_4 = before_now(hours=1).replace(minute=0, second=0, microsecond=0)

        logs = [
            self.create_ourlog(
                {"body": "log 1"},
                timestamp=hour_4 - timedelta(minutes=30),
            ),
            self.create_ourlog(
                {"body": "log 2"},
                timestamp=hour_3 - timedelta(minutes=30),
            ),
        ]
        self.store_ourlogs(logs)
        for hour in [hour_4, hour_3]:
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "timestamp": hour - timedelta(minutes=30),
                    "project_id": self.project.id,
                    "outcome": Outcome.ACCEPTED,
                    "reason": "none",
                    "category": DataCategory.LOG_ITEM,
                    "quantity": 1,
                },
                1,
            )

        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "timestamp": hour_2 - timedelta(minutes=30),
                "project_id": self.project.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.LOG_ITEM,
                "quantity": 300_000_000,
            },
            1,
        )

        request = {
            "field": ["timestamp", "message"],
            "orderby": "-timestamp",
            "project": self.project.id,
            "dataset": self.dataset,
            "sampling": "HIGHEST_ACCURACY_FLEX_TIME",
            "per_page": 5,
            "start": hour_1.isoformat(),
            "end": hour_4.isoformat(),
        }

        response = self.do_request(request, features={"organizations:ourlogs-high-fidelity": True})

        assert response.status_code == 200, response.content
        assert [row["message"] for row in response.data["data"]] == ["log 1"]
        assert response.data["meta"]["dataScanned"] == "full"
        links = {
            attrs["rel"]: {**attrs, "href": url}
            for url, attrs in parse_link_header(response["link"]).items()
        }
        assert links["previous"]["results"] == "false"
        assert links["next"]["results"] == "true"

        response = self.do_request(
            {**request, "cursor": links["next"]["cursor"]},
            features={"organizations:ourlogs-high-fidelity": True},
        )

        assert response.status_code == 200, response.content
        assert [row["message"] for row in response.data["data"]] == ["log 2"]
        assert response.data["meta"]["dataScanned"] == "full"
        links = {
            attrs["rel"]: {**attrs, "href": url}
            for url, attrs in parse_link_header(response["link"]).items()
        }
        assert links["previous"]["results"] == "false"
        assert links["next"]["results"] == "true"

    def test_high_accuracy_flex_time_empty_page_with_next(self):
        hour_1 = before_now(hours=4).replace(minute=0, second=0, microsecond=0)
        hour_2 = before_now(hours=3).replace(minute=0, second=0, microsecond=0)
        hour_3 = before_now(hours=2).replace(minute=0, second=0, microsecond=0)
        hour_4 = before_now(hours=1).replace(minute=0, second=0, microsecond=0)

        logs = [
            self.create_ourlog(
                {"body": "log 2"},
                timestamp=hour_3 - timedelta(minutes=30),
            ),
        ]
        self.store_ourlogs(logs)
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "timestamp": hour_3 - timedelta(minutes=30),
                "project_id": self.project.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.LOG_ITEM,
                "quantity": 1,
            },
            1,
        )

        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "timestamp": hour_2 - timedelta(minutes=30),
                "project_id": self.project.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.LOG_ITEM,
                "quantity": 300_000_000,
            },
            1,
        )

        request = {
            "field": ["timestamp", "message"],
            "orderby": "-timestamp",
            "project": self.project.id,
            "dataset": self.dataset,
            "sampling": "HIGHEST_ACCURACY_FLEX_TIME",
            "per_page": 5,
            "start": hour_1.isoformat(),
            "end": hour_4.isoformat(),
        }

        response = self.do_request(request, features={"organizations:ourlogs-high-fidelity": True})

        assert response.status_code == 200, response.content
        assert response.data["data"] == []
        assert response.data["meta"]["dataScanned"] == "full"
        links = {
            attrs["rel"]: {**attrs, "href": url}
            for url, attrs in parse_link_header(response["link"]).items()
        }
        assert links["previous"]["results"] == "false"
        assert links["next"]["results"] == "true"

        response = self.do_request(
            {**request, "cursor": links["next"]["cursor"]},
            features={"organizations:ourlogs-high-fidelity": True},
        )

        assert response.status_code == 200, response.content
        assert [row["message"] for row in response.data["data"]] == ["log 2"]
        assert response.data["meta"]["dataScanned"] == "full"
        links = {
            attrs["rel"]: {**attrs, "href": url}
            for url, attrs in parse_link_header(response["link"]).items()
        }
        assert links["previous"]["results"] == "false"
        assert links["next"]["results"] == "true"

    def test_high_accuracy_flex_time_without_feature_flag(self):
        request = {
            "field": ["timestamp", "message"],
            "orderby": "-timestamp",
            "project": self.project.id,
            "dataset": self.dataset,
            "sampling": "HIGHEST_ACCURACY_FLEX_TIME",
            "per_page": 5,
        }

        response = self.do_request(request)
        assert response.status_code == 400

    def test_bytes_scanned(self):
        self.store_ourlogs([self.create_ourlog({"body": "log"}, timestamp=self.ten_mins_ago)])

        request = {
            "field": ["timestamp", "message"],
            "orderby": "-timestamp",
            "project": self.project.id,
            "dataset": self.dataset,
        }

        response = self.do_request(request)
        assert response.status_code == 200
        assert response.data["meta"]["bytesScanned"] > 0

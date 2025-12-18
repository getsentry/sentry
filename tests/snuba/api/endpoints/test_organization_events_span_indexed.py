import uuid
from datetime import datetime, timezone
from unittest import mock
from uuid import uuid4

import pytest
import urllib3
from django.utils.timezone import now
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import ExtrapolationMode

from sentry.insights.models import InsightsStarredSegment
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.snuba_rpc import _make_rpc_requests, table_rpc
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase

# Downsampling is deterministic, so unless the algorithm changes we can find a known id that will appear in the
# preflight and it will always show up
# If we need to get a new ID just query for event ids after loading 100s of events and use any of the ids that come back
KNOWN_PREFLIGHT_ID = "ca056dd858a24299"


class OrganizationEventsSpansEndpointTest(OrganizationEventsEndpointTestBase):
    def do_request(self, query, features=None, **kwargs):
        return super().do_request(query, features, **kwargs)

    def setUp(self) -> None:
        super().setUp()
        self.features = {
            "organizations:starfish-view": True,
        }

    @pytest.mark.xfail(reason="spm is not implemented, as spm will be replaced with spm")
    def test_spm(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["description", "spm()"],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data == [
            {
                "description": "foo",
                "spm()": 1 / (90 * 24 * 60),
            },
        ]
        assert meta["dataset"] == "spans"

    def test_id_fields(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "bar",
                        "sentry_tags": {"status": "invalid_argument"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["id", "span_id"],
                "query": "",
                "orderby": "id",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        for obj in data:
            assert obj["id"] == obj["span_id"]
        assert meta["dataset"] == "spans"

    def test_sentry_tags_vs_tags(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"transaction.method": "foo"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["transaction.method", "count()"],
                "query": "",
                "orderby": "count()",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["transaction.method"] == "foo"
        assert meta["dataset"] == "spans"

    def test_sentry_tags_syntax(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"transaction.method": "foo"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["sentry_tags[transaction.method]", "count()"],
                "query": "",
                "orderby": "count()",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["sentry_tags[transaction.method]"] == "foo"
        assert meta["dataset"] == "spans"

    @pytest.mark.skip(reason="module not migrated over")
    def test_module_alias(self) -> None:
        # Delegates `span.module` to `sentry_tags[category]`. Maps `"db.redis"` spans to the `"cache"` module
        self.store_spans(
            [
                self.create_span(
                    {
                        "op": "db.redis",
                        "description": "EXEC *",
                        "sentry_tags": {
                            "description": "EXEC *",
                            "category": "db",
                            "op": "db.redis",
                            "transaction": "/app/index",
                        },
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["span.module", "span.description"],
                "query": "span.module:cache",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["span.module"] == "cache"
        assert data[0]["span.description"] == "EXEC *"
        assert meta["dataset"] == "spans"

    def test_device_class_filter(self):
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"device.class": "3"}}, start_ts=self.ten_mins_ago
                ),
                self.create_span(
                    {"sentry_tags": {"device.class": "2"}}, start_ts=self.ten_mins_ago
                ),
                self.create_span(
                    {"sentry_tags": {"device.class": "1"}}, start_ts=self.ten_mins_ago
                ),
                self.create_span({"sentry_tags": {"device.class": ""}}, start_ts=self.ten_mins_ago),
                self.create_span({}, start_ts=self.ten_mins_ago),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["device.class", "count()"],
                "query": 'device.class:"high"',
                "orderby": "count()",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content

        meta = response.data["meta"]
        assert meta["dataset"] == "spans"

        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["device.class"] == "high"
        assert data[0]["count()"] == 1

    def test_device_class_filter_for_empty(self):
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"device.class": "3"}}, start_ts=self.ten_mins_ago
                ),
                self.create_span(
                    {"sentry_tags": {"device.class": "2"}}, start_ts=self.ten_mins_ago
                ),
                self.create_span(
                    {"sentry_tags": {"device.class": "1"}}, start_ts=self.ten_mins_ago
                ),
                self.create_span({"sentry_tags": {"device.class": ""}}, start_ts=self.ten_mins_ago),
                self.create_span({}, start_ts=self.ten_mins_ago),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["device.class", "count()"],
                "query": 'device.class:""',
                "orderby": "count()",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content

        meta = response.data["meta"]
        assert meta["dataset"] == "spans"

        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["device.class"] == "Unknown"
        assert data[0]["count()"] == 2

    def test_device_class_filter_for_unknown(self):
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"device.class": "3"}}, start_ts=self.ten_mins_ago
                ),
                self.create_span(
                    {"sentry_tags": {"device.class": "2"}}, start_ts=self.ten_mins_ago
                ),
                self.create_span(
                    {"sentry_tags": {"device.class": "1"}}, start_ts=self.ten_mins_ago
                ),
                self.create_span({"sentry_tags": {"device.class": ""}}, start_ts=self.ten_mins_ago),
                self.create_span({}, start_ts=self.ten_mins_ago),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["device.class", "count()"],
                "query": "device.class:Unknown",
                "orderby": "count()",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content

        meta = response.data["meta"]
        assert meta["dataset"] == "spans"

        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["device.class"] == "Unknown"
        assert data[0]["count()"] == 2

    def test_device_class_filter_out_unknown(self):
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"device.class": "3"}}, start_ts=self.ten_mins_ago
                ),
                self.create_span(
                    {"sentry_tags": {"device.class": "2"}}, start_ts=self.ten_mins_ago
                ),
                self.create_span(
                    {"sentry_tags": {"device.class": "1"}}, start_ts=self.ten_mins_ago
                ),
                self.create_span({"sentry_tags": {"device.class": ""}}, start_ts=self.ten_mins_ago),
                self.create_span({}, start_ts=self.ten_mins_ago),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["device.class", "count()"],
                "query": "!device.class:Unknown",
                "orderby": "device.class",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content

        meta = response.data["meta"]
        assert meta["dataset"] == "spans"

        data = response.data["data"]
        assert len(data) == 3
        assert data[0]["device.class"] == "high"
        assert data[0]["count()"] == 1
        assert data[1]["device.class"] == "low"
        assert data[1]["count()"] == 1
        assert data[2]["device.class"] == "medium"
        assert data[2]["count()"] == 1

    @pytest.mark.xfail(
        reason="wip: depends on rpc having a way to set a different default in virtual contexts"
    )
    def test_span_module(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "sentry_tags": {
                            "op": "http",
                            "category": "http",
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "sentry_tags": {
                            "op": "alternative",
                            "category": "other",
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "sentry_tags": {
                            "op": "alternative",
                            "category": "other",
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["span.module", "count()"],
                "query": "",
                "orderby": "-count()",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data[0]["span.module"] == "other"
        assert data[1]["span.module"] == "http"
        assert meta["dataset"] == "spans"

    def test_network_span(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "sentry_tags": {
                            "action": "GET",
                            "category": "http",
                            "description": "GET https://*.resource.com",
                            "domain": "*.resource.com",
                            "op": "http.client",
                            "status_code": "200",
                            "transaction": "/api/0/data/",
                            "transaction.method": "GET",
                            "transaction.op": "http.server",
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["span.op", "span.status_code"],
                "query": "span.status_code:200",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["span.op"] == "http.client"
        assert data[0]["span.status_code"] == "200"
        assert meta["dataset"] == "spans"

    @pytest.mark.xfail(
        reason="wip: depends on rpc having a way to set a different default in virtual contexts"
    )
    # https://github.com/getsentry/projects/issues/215?issue=getsentry%7Cprojects%7C488
    def test_other_category_span(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "sentry_tags": {
                            "action": "GET",
                            "category": "alternative",
                            "description": "GET https://*.resource.com",
                            "domain": "*.resource.com",
                            "op": "alternative",
                            "status_code": "200",
                            "transaction": "/api/0/data/",
                            "transaction.method": "GET",
                            "transaction.op": "http.server",
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["span.op", "span.status_code"],
                "query": "span.module:other span.status_code:200",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["span.op"] == "alternative"
        assert data[0]["span.status_code"] == "200"
        assert meta["dataset"] == "spans"

    def test_inp_span(self) -> None:
        replay_id = uuid.uuid4().hex
        self.store_spans(
            [
                self.create_span(
                    {
                        "sentry_tags": {
                            "replay_id": replay_id,
                            "browser.name": "Chrome",
                            "transaction": "/pageloads/",
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                # Not moving origin.transaction to RPC, its equivalent to transaction and just represents the
                # transaction that's related to the span
                "field": ["replay.id", "browser.name", "transaction", "count()"],
                "query": f"replay.id:{replay_id} AND browser.name:Chrome AND transaction:/pageloads/",
                "orderby": "count()",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["replay.id"] == replay_id
        assert data[0]["browser.name"] == "Chrome"
        assert data[0]["transaction"] == "/pageloads/"
        assert meta["dataset"] == "spans"

    @pytest.mark.xfail(reason="event_id isn't being written to the new table")
    def test_id_filtering(self) -> None:
        span = self.create_span({"description": "foo"}, start_ts=self.ten_mins_ago)
        self.store_span(span, is_eap=True)
        response = self.do_request(
            {
                "field": ["description", "count()"],
                "query": f"id:{span['span_id']}",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["description"] == "foo"
        assert meta["dataset"] == "spans"

        response = self.do_request(
            {
                "field": ["description", "count()"],
                "query": f"transaction.id:{span['event_id']}",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["description"] == "foo"
        assert meta["dataset"] == "spans"

    @pytest.mark.xfail(
        reason="wip: not implemented yet, depends on rpc having a way to filter based on casing"
    )
    # https://github.com/getsentry/projects/issues/215?issue=getsentry%7Cprojects%7C489
    def test_span_op_casing(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "sentry_tags": {
                            "replay_id": "abc123",
                            "browser.name": "Chrome",
                            "transaction": "/pageloads/",
                            "op": "this is a transaction",
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["span.op", "count()"],
                "query": 'span.op:"ThIs Is a TraNSActiON"',
                "orderby": "count()",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["span.op"] == "this is a transaction"
        assert meta["dataset"] == "spans"

    def test_queue_span(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "measurements": {
                            "messaging.message.body.size": {
                                "value": 1024,
                                "unit": "byte",
                            },
                            "messaging.message.receive.latency": {
                                "value": 1000,
                                "unit": "millisecond",
                            },
                            "messaging.message.retry.count": {
                                "value": 2,
                                "unit": "none",
                            },
                        },
                        "sentry_tags": {
                            "transaction": "queue-processor",
                            "messaging.destination.name": "events",
                            "messaging.message.id": "abc123",
                            "trace.status": "ok",
                        },
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "messaging.destination.name",
                    "messaging.message.id",
                    "measurements.messaging.message.receive.latency",
                    "measurements.messaging.message.body.size",
                    "measurements.messaging.message.retry.count",
                    "trace.status",
                    "count()",
                ],
                "query": 'messaging.destination.name:"events"',
                "orderby": "count()",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["transaction"] == "queue-processor"
        assert data[0]["messaging.destination.name"] == "events"
        assert data[0]["messaging.message.id"] == "abc123"
        assert data[0]["trace.status"] == "ok"
        assert data[0]["measurements.messaging.message.receive.latency"] == 1000
        assert data[0]["measurements.messaging.message.body.size"] == 1024
        assert data[0]["measurements.messaging.message.retry.count"] == 2
        assert meta["dataset"] == "spans"

    def test_tag_wildcards(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "tags": {"foo": "bar"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "qux", "tags": {"foo": "qux"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        for query in [
            "foo:b*",
            "foo:*r",
            "foo:*a*",
            "foo:b*r",
        ]:
            response = self.do_request(
                {
                    "field": ["foo", "count()"],
                    "query": query,
                    "project": self.project.id,
                    "dataset": "spans",
                }
            )
            assert response.status_code == 200, response.content
            assert response.data["data"] == [{"foo": "bar", "count()": 1}]

    def test_query_for_missing_tag(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo"},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "qux", "tags": {"foo": "bar"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["foo", "count()"],
                "query": "has:foo",
                "project": self.project.id,
                "dataset": "spans",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [{"foo": "bar", "count()": 1}]

    def test_count_field_type(self) -> None:
        response = self.do_request(
            {
                "field": ["count()"],
                "project": self.project.id,
                "dataset": "spans",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"]["fields"] == {"count()": "integer"}
        assert response.data["meta"]["units"] == {"count()": None}
        assert response.data["data"] == [{"count()": 0}]

    def _test_simple_measurements(self, keys):
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "foo",
                        "sentry_tags": {"status": "success"},
                        "tags": {"bar": "bar2"},
                    },
                    measurements={k: {"value": (i + 1) / 10} for i, (k, _, _) in enumerate(keys)},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        for i, (k, type, unit) in enumerate(keys):
            key = f"measurements.{k}"
            response = self.do_request(
                {
                    "field": [key],
                    "query": "description:foo",
                    "project": self.project.id,
                    "dataset": "spans",
                }
            )
            assert response.status_code == 200, response.content
            expected = {
                "bytesScanned": mock.ANY,
                "dataScanned": "full",
                "dataset": mock.ANY,
                "datasetReason": "unchanged",
                "fields": {
                    key: type,
                    "id": "string",
                    "project.name": "string",
                },
                "isMetricsData": False,
                "isMetricsExtractedData": False,
                "tips": {},
                "units": {
                    key: unit,
                    "id": None,
                    "project.name": None,
                },
            }
            if True:
                expected["accuracy"] = {
                    "confidence": [{}],
                }
            assert response.data["meta"] == expected
            assert response.data["data"] == [
                {
                    key: pytest.approx((i + 1) / 10),
                    "id": mock.ANY,
                    "project.name": self.project.slug,
                }
            ]

    def test_simple_measurements(self) -> None:
        keys = [
            ("app_start_cold", "duration", "millisecond"),
            ("app_start_warm", "duration", "millisecond"),
            (
                "frames_frozen",
                "number",
                None,
            ),  # should be integer but keeping it consistent
            ("frames_frozen_rate", "percentage", None),
            (
                "frames_slow",
                "number",
                None,
            ),  # should be integer but keeping it consistent
            ("frames_slow_rate", "percentage", None),
            (
                "frames_total",
                "number",
                None,
            ),  # should be integer but keeping it consistent
            ("time_to_initial_display", "duration", "millisecond"),
            ("time_to_full_display", "duration", "millisecond"),
            (
                "stall_count",
                "number",
                None,
            ),  # should be integer but keeping it consistent
            ("stall_percentage", "percentage", None),
            ("stall_stall_longest_time", "number", None),
            ("stall_stall_total_time", "number", None),
            ("cls", "number", None),
            ("fcp", "duration", "millisecond"),
            ("fid", "duration", "millisecond"),
            ("fp", "duration", "millisecond"),
            ("inp", "duration", "millisecond"),
            ("lcp", "duration", "millisecond"),
            ("ttfb", "duration", "millisecond"),
            ("ttfb.requesttime", "duration", "millisecond"),
            ("score.cls", "number", None),
            ("score.fcp", "number", None),
            ("score.fid", "number", None),
            ("score.inp", "number", None),
            ("score.lcp", "number", None),
            ("score.ttfb", "number", None),
            ("score.total", "number", None),
            ("score.weight.cls", "number", None),
            ("score.weight.fcp", "number", None),
            ("score.weight.fid", "number", None),
            ("score.weight.inp", "number", None),
            ("score.weight.lcp", "number", None),
            ("score.weight.ttfb", "number", None),
            ("cache.item_size", "size", "byte"),
            ("messaging.message.body.size", "size", "byte"),
            ("messaging.message.receive.latency", "duration", "millisecond"),
            ("messaging.message.retry.count", "number", None),
        ]

        self._test_simple_measurements(keys)

    def test_environment(self) -> None:
        self.create_environment(self.project, name="prod")
        self.create_environment(self.project, name="test")
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"environment": "prod"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "foo", "sentry_tags": {"environment": "test"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["environment", "count()"],
                "project": self.project.id,
                "environment": "prod",
                "orderby": "environment",
                "dataset": "spans",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {"environment": "prod", "count()": 1},
        ]

        response = self.do_request(
            {
                "field": ["environment", "count()"],
                "project": self.project.id,
                "environment": ["prod", "test"],
                "orderby": "environment",
                "dataset": "spans",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {"environment": "prod", "count()": 1},
            {"environment": "test", "count()": 1},
        ]

    def test_transaction(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"transaction": "bar"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["description", "count()"],
                "query": "transaction:bar",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data == [
            {
                "description": "foo",
                "count()": 1,
            },
        ]
        assert meta["dataset"] == "spans"

    def test_orderby_alias(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "bar",
                        "sentry_tags": {"status": "invalid_argument"},
                    },
                    duration=2000,
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["span.description", "sum(span.self_time)"],
                "query": "",
                "orderby": "sum_span_self_time",
                "project": self.project.id,
                "dataset": "spans",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data == [
            {
                "span.description": "foo",
                "sum(span.self_time)": 1000,
            },
            {
                "span.description": "bar",
                "sum(span.self_time)": 2000,
            },
        ]
        assert meta["dataset"] == "spans"

    @pytest.mark.querybuilder
    def test_explore_sample_query(self) -> None:
        spans = [
            self.create_span(
                {"description": "foo", "sentry_tags": {"status": "success"}},
                start_ts=self.ten_mins_ago,
            ),
            self.create_span(
                {"description": "bar", "sentry_tags": {"status": "invalid_argument"}},
                start_ts=self.nine_mins_ago,
            ),
        ]
        self.store_spans(
            spans,
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": [
                    "id",
                    "project",
                    "span.op",
                    "span.description",
                    "span.duration",
                    "timestamp",
                    "trace",
                    "transaction.span_id",
                ],
                "orderby": "timestamp",
                "statsPeriod": "1h",
                "project": self.project.id,
                "dataset": "spans",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        for source, result in zip(spans, data):
            assert result["id"] == source["span_id"], "id"
            assert result["span.duration"] == 1000.0, "duration"
            # TODO: once the snuba change to return Nones has merged remove the or
            assert result["span.op"] is None or result["span.op"] == "", "op"
            assert result["span.description"] == source["description"], "description"
            ts = datetime.fromisoformat(result["timestamp"])
            assert ts.tzinfo == timezone.utc
            assert ts.timestamp() == pytest.approx(
                source["end_timestamp_precise"], abs=5
            ), "timestamp"
            assert result["transaction.span_id"] == source["segment_id"], "transaction.span_id"
            assert result["project"] == result["project.name"] == self.project.slug, "project"
        assert meta["dataset"] == "spans"

    def test_span_status(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "internal_error"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["description", "count()"],
                "query": "span.status:internal_error",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data == [
            {
                "description": "foo",
                "count()": 1,
            },
        ]
        assert meta["dataset"] == "spans"

    def test_handle_nans_from_snuba(self) -> None:
        self.store_spans(
            [self.create_span({"description": "foo"}, start_ts=self.ten_mins_ago)],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["description", "count()"],
                "query": "span.status:internal_error",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )
        assert response.status_code == 200, response.content

    def test_in_filter(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"transaction": "bar"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "foo", "sentry_tags": {"transaction": "baz"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "foo", "sentry_tags": {"transaction": "bat"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["transaction", "count()"],
                "query": "transaction:[bar, baz]",
                "orderby": "transaction",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data == [
            {
                "transaction": "bar",
                "count()": 1,
            },
            {
                "transaction": "baz",
                "count()": 1,
            },
        ]
        assert meta["dataset"] == "spans"

    def _test_aggregate_filter(self, queries):
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"transaction": "foo"}},
                    measurements={
                        "lcp": {"value": 5000},
                        "http.response_content_length": {"value": 5000},
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"sentry_tags": {"transaction": "foo"}},
                    measurements={
                        "lcp": {"value": 5000},
                        "http.response_content_length": {"value": 5000},
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"sentry_tags": {"transaction": "bar"}},
                    measurements={
                        "lcp": {"value": 1000},
                        "http.response_content_length": {"value": 1000},
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        for query in queries:
            response = self.do_request(
                {
                    "field": ["transaction", "count()"],
                    "query": query,
                    "orderby": "transaction",
                    "project": self.project.id,
                    "dataset": "spans",
                }
            )
            assert response.status_code == 200, response.content
            data = response.data["data"]
            meta = response.data["meta"]
            assert len(data) == 1
            assert data[0]["transaction"] == "foo"
            assert data[0]["count()"] == 2
            assert meta["dataset"] == "spans"

    def test_pagination_samples(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "a"},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "b"},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["description"],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
                "per_page": 1,
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": mock.ANY,
                "project.name": self.project.slug,
                "description": "a",
            },
        ]

        links = {}
        for url, attrs in parse_link_header(response["Link"]).items():
            links[attrs["rel"]] = attrs
            attrs["href"] = url

        assert links["previous"]["results"] == "false"
        assert links["next"]["results"] == "true"

        assert links["next"]["href"] is not None
        response = self.client.get(links["next"]["href"], format="json")
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": mock.ANY,
                "project.name": self.project.slug,
                "description": "b",
            },
        ]

        links = {}
        for url, attrs in parse_link_header(response["Link"]).items():
            links[attrs["rel"]] = attrs
            attrs["href"] = url

        assert links["previous"]["results"] == "true"
        assert links["next"]["results"] == "false"

        assert links["previous"]["href"] is not None
        response = self.client.get(links["previous"]["href"], format="json")
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": mock.ANY,
                "project.name": self.project.slug,
                "description": "a",
            },
        ]

        links = {}
        for url, attrs in parse_link_header(response["Link"]).items():
            links[attrs["rel"]] = attrs
            attrs["href"] = url

        assert links["previous"]["results"] == "false"
        assert links["next"]["results"] == "true"

    def test_precise_timestamps(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["precise.start_ts", "precise.finish_ts"],
                "project": self.project.id,
                "dataset": "spans",
                "statsPeriod": "1h",
            }
        )
        start = self.ten_mins_ago.timestamp()
        finish = start + 1
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": mock.ANY,
                "project.name": self.project.slug,
                "precise.start_ts": start,
                "precise.finish_ts": finish,
            },
        ]

    def test_case_sensitivity_filtering(self):
        self.store_spans(
            [
                self.create_span(
                    {"description": "FoOoOoO"},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "FooOOoo"},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "foooooo"},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["span.description", "count()"],
                "query": "span.description:FoOoOoO",
                "project": self.project.id,
                "dataset": "spans",
                "statsPeriod": "1h",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "span.description": "FoOoOoO",
                "count()": 1.0,
            },
        ]

        response = self.do_request(
            {
                "field": ["span.description", "count()"],
                "orderby": ["span.description"],
                "query": "span.description:FOOOOOO",
                "project": self.project.id,
                "dataset": "spans",
                "statsPeriod": "1h",
                "caseInsensitive": 1,
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "span.description": "FoOoOoO",
                "count()": 1.0,
            },
            {
                "span.description": "FooOOoo",
                "count()": 1.0,
            },
            {
                "span.description": "foooooo",
                "count()": 1.0,
            },
        ]

    def test_case_sensitivity_filtering_with_list(self):
        self.store_spans(
            [
                self.create_span(
                    {"description": "FoOoOoO"},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "FooOOoo"},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "foooooo"},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["span.description", "count()"],
                "orderby": ["span.description"],
                "query": "span.description:[FoOoOoO, FooOOoo]",
                "project": self.project.id,
                "dataset": "spans",
                "statsPeriod": "1h",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "span.description": "FoOoOoO",
                "count()": 1.0,
            },
            {
                "span.description": "FooOOoo",
                "count()": 1.0,
            },
        ]

        response = self.do_request(
            {
                "field": ["span.description", "count()"],
                "orderby": ["span.description"],
                "query": "span.description:[FOOOOOO]",
                "project": self.project.id,
                "dataset": "spans",
                "statsPeriod": "1h",
                "caseInsensitive": 1,
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "span.description": "FoOoOoO",
                "count()": 1.0,
            },
            {
                "span.description": "FooOOoo",
                "count()": 1.0,
            },
            {
                "span.description": "foooooo",
                "count()": 1.0,
            },
        ]

    def test_case_sensitivity_with_wildcards(self):
        self.store_spans(
            [
                self.create_span(
                    {"description": "FoOoOoO"},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "FooOOoo"},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "foooooo"},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "boooooo"},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["span.description", "count()"],
                "orderby": ["span.description"],
                "query": "span.description:Foo*",
                "project": self.project.id,
                "dataset": "spans",
                "statsPeriod": "1h",
                "caseInsensitive": 1,
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "span.description": "FoOoOoO",
                "count()": 1.0,
            },
            {
                "span.description": "FooOOoo",
                "count()": 1.0,
            },
            {
                "span.description": "foooooo",
                "count()": 1.0,
            },
        ]

        response = self.do_request(
            {
                "field": ["span.description", "count()"],
                "orderby": ["span.description"],
                "query": "!span.description:Foo*",
                "project": self.project.id,
                "dataset": "spans",
                "statsPeriod": "1h",
                "caseInsensitive": 1,
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "span.description": "boooooo",
                "count()": 1.0,
            },
        ]

    @pytest.mark.skip(reason="replay id alias not migrated over")
    def test_replay_id(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"replay_id": "123"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "foo", "tags": {"replayId": "321"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["replay"],
                "project": self.project.id,
                "dataset": "spans",
                "orderby": "replay",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": mock.ANY,
                "project.name": self.project.slug,
                "replay": "123",
            },
            {
                "id": mock.ANY,
                "project.name": self.project.slug,
                "replay": "321",
            },
        ]

    @pytest.mark.skip(reason="user display alias not migrated over")
    def test_user_display(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "foo",
                        "sentry_tags": {"user.email": "test@test.com"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "foo", "sentry_tags": {"user.username": "test"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["user.display"],
                "project": self.project.id,
                "dataset": "spans",
                "orderby": "user.display",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": mock.ANY,
                "project.name": self.project.slug,
                "user.display": "test",
            },
            {
                "id": mock.ANY,
                "project.name": self.project.slug,
                "user.display": "test@test.com",
            },
        ]

    def test_query_with_asterisk(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "select * from database"},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["span.description"],
                "query": 'span.description:"select \\* from database"',
                "project": self.project.id,
                "dataset": "spans",
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["span.description"] == "select * from database"

    def test_wildcard_queries_with_asterisk_literals(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "select * from database"},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["span.description"],
                "query": 'span.description:"select \\* * database"',
                "project": self.project.id,
                "dataset": "spans",
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["span.description"] == "select * from database"

    def test_free_text_wildcard_filter(self) -> None:
        spans = [
            self.create_span(
                {
                    "description": "barbarbar",
                    "sentry_tags": {"status": "invalid_argument"},
                },
                start_ts=self.ten_mins_ago,
            ),
            self.create_span(
                {"description": "foofoofoo", "sentry_tags": {"status": "success"}},
                start_ts=self.ten_mins_ago,
            ),
        ]
        self.store_spans(spans, is_eap=True)
        response = self.do_request(
            {
                "field": ["count()", "description"],
                "query": "oof",
                "orderby": "-count()",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data == [
            {
                "count()": 1,
                "description": "foofoofoo",
            },
        ]
        assert meta["dataset"] == "spans"

    def test_simple(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "bar",
                        "sentry_tags": {"status": "invalid_argument"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["span.status", "description", "count()"],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data == [
            {
                "span.status": "invalid_argument",
                "description": "bar",
                "count()": 1,
            },
            {
                "span.status": "success",
                "description": "foo",
                "count()": 1,
            },
        ]
        assert meta["dataset"] == "spans"

    def test_numeric_attr_without_space(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "foo",
                        "sentry_tags": {"status": "success"},
                    },
                    measurements={"foo": {"value": 5}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "description",
                    "tags[foo,number]",
                ],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["tags[foo,number]"] == 5

    def test_numeric_attr_overlap_string_attr(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "foo",
                        "sentry_tags": {"status": "success"},
                    },
                    measurements={"foo": {"value": 5}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "bar",
                        "sentry_tags": {"status": "success"},
                        "tags": {"foo": "five"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "description",
                    "tags[foo,number]",
                    "tags[foo,string]",
                    "tags[foo]",
                ],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2
        data = response.data["data"]

        assert data[0]["tags[foo,number]"] is None
        assert data[0]["tags[foo,string]"] == "five"
        assert data[0]["tags[foo]"] == "five"

        assert data[1]["tags[foo,number]"] == 5
        assert data[1]["tags[foo,string]"] is None
        assert data[1]["tags[foo]"] is None

    def test_numeric_attr_with_spaces(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "zoo",
                        "sentry_tags": {"status": "success"},
                    },
                    measurements={"foo": {"value": 5}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "description",
                    "tags[foo,    number]",
                ],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["tags[foo,    number]"] == 5

    def test_numeric_attr_filtering(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "foo",
                        "sentry_tags": {"status": "success"},
                    },
                    measurements={"foo": {"value": 5}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "bar",
                        "sentry_tags": {"status": "success"},
                    },
                    measurements={"foo": {"value": 8}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["description", "tags[foo,number]"],
                "query": "tags[foo,number]:5",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["tags[foo,number]"] == 5
        assert data[0]["description"] == "foo"

    def test_long_attr_name(self) -> None:
        response = self.do_request(
            {
                "field": ["description", "z" * 201],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 400, response.content
        assert "Is Too Long" in response.data["detail"].title()

    def test_numeric_attr_orderby(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "baz",
                        "sentry_tags": {"status": "success"},
                        "tags": {"foo": "five"},
                    },
                    measurements={"foo": {"value": 71}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "foo",
                        "sentry_tags": {"status": "success"},
                        "tags": {"foo": "five"},
                    },
                    measurements={"foo": {"value": 5}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "bar",
                        "sentry_tags": {"status": "success"},
                        "tags": {"foo": "five"},
                    },
                    measurements={"foo": {"value": 8}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["description", "tags[foo,number]"],
                "query": "",
                "orderby": ["tags[foo,number]"],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 3
        data = response.data["data"]
        assert data[0]["tags[foo,number]"] == 5
        assert data[0]["description"] == "foo"
        assert data[1]["tags[foo,number]"] == 8
        assert data[1]["description"] == "bar"
        assert data[2]["tags[foo,number]"] == 71
        assert data[2]["description"] == "baz"

    def test_skip_aggregate_conditions_option(self) -> None:
        span_1 = self.create_span(
            {"description": "foo", "sentry_tags": {"status": "success"}},
            start_ts=self.ten_mins_ago,
        )
        span_2 = self.create_span(
            {"description": "bar", "sentry_tags": {"status": "invalid_argument"}},
            start_ts=self.ten_mins_ago,
        )
        self.store_spans(
            [span_1, span_2],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["description"],
                "query": "description:foo count():>1",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
                "allowAggregateConditions": "0",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data == [
            {
                "description": "foo",
                "project.name": self.project.slug,
                "id": span_1["span_id"],
            },
        ]
        assert meta["dataset"] == "spans"

    def test_span_data_fields_http_resource(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "op": "resource.img",
                        "description": "/image/",
                        "data": {
                            "http.decoded_response_content_length": 1,
                            "http.response_content_length": 2,
                            "http.response_transfer_size": 3,
                        },
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "http.decoded_response_content_length",
                    "http.response_content_length",
                    "http.response_transfer_size",
                ],
                "query": "http.decoded_response_content_length:>0 http.response_content_length:>0 http.response_transfer_size:>0",
                "project": self.project.id,
                "dataset": "spans",
                "allowAggregateConditions": "0",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "http.decoded_response_content_length": 1,
                "http.response_content_length": 2,
                "http.response_transfer_size": 3,
                "project.name": self.project.slug,
                "id": mock.ANY,
            },
        ]
        expected = {
            "bytesScanned": mock.ANY,
            "dataScanned": "full",
            "dataset": mock.ANY,
            "datasetReason": "unchanged",
            "fields": {
                "http.decoded_response_content_length": "size",
                "http.response_content_length": "size",
                "http.response_transfer_size": "size",
                "id": "string",
                "project.name": "string",
            },
            "isMetricsData": False,
            "isMetricsExtractedData": False,
            "tips": {},
            "units": {
                "http.decoded_response_content_length": "byte",
                "http.response_content_length": "byte",
                "http.response_transfer_size": "byte",
                "id": None,
                "project.name": None,
            },
        }
        if True:
            expected["accuracy"] = {
                "confidence": [{}],
            }
        assert response.data["meta"] == expected

    def test_filtering_numeric_attr(self) -> None:
        span_1 = self.create_span(
            {"description": "foo"},
            measurements={"foo": {"value": 30}},
            start_ts=self.ten_mins_ago,
        )
        span_2 = self.create_span(
            {"description": "foo"},
            measurements={"foo": {"value": 10}},
            start_ts=self.ten_mins_ago,
        )
        self.store_spans([span_1, span_2], is_eap=True)

        response = self.do_request(
            {
                "field": ["tags[foo,number]"],
                "query": "span.duration:>=0 tags[foo,number]:>20",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": span_1["span_id"],
                "project.name": self.project.slug,
                "tags[foo,number]": 30,
            },
        ]

    def test_aggregate_filter(self) -> None:
        self._test_aggregate_filter(
            [
                "count():2",
                "count():>1",
                "avg(measurements.lcp):>3000",
                "avg(measurements.lcp):>3s",
                "count():>1 avg(measurements.lcp):>3000",
                "count():>1 AND avg(measurements.lcp):>3000",
                "count():>1 OR avg(measurements.lcp):>3000",
                "(count():>1 AND avg(http.response_content_length):>3000) OR (count():>1 AND avg(measurements.lcp):>3000)",
            ]
        )

    @mock.patch(
        "sentry.utils.snuba_rpc._snuba_pool.urlopen",
        side_effect=urllib3.exceptions.TimeoutError,
    )
    def test_timeout(self, mock_rpc: mock.MagicMock) -> None:
        response = self.do_request(
            {
                "field": ["span.status", "description", "count()"],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 504, response.content
        assert "Query timeout" in response.data["detail"]

    def test_extrapolation(self) -> None:
        """Extrapolation only changes the number when there's a sample rate"""
        spans = []
        spans.append(
            self.create_span(
                {
                    "description": "foo",
                    "sentry_tags": {"status": "success"},
                    "measurements": {"client_sample_rate": {"value": 0.1}},
                },
                start_ts=self.ten_mins_ago,
            )
        )
        spans.append(
            self.create_span(
                {
                    "description": "bar",
                    "sentry_tags": {"status": "success"},
                },
                start_ts=self.ten_mins_ago,
            )
        )
        self.store_spans(spans, is_eap=True)
        response = self.do_request(
            {
                "field": ["description", "count()"],
                "orderby": "-count()",
                "query": "",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        confidence = meta["accuracy"]["confidence"]
        assert len(data) == 2
        assert len(confidence) == 2
        assert data[0]["count()"] == 10
        assert confidence[0]["count()"] == "low"
        assert data[1]["count()"] == 1
        assert confidence[1]["count()"] in ("high", "low")

    @mock.patch(
        "sentry.utils.snuba_rpc._make_rpc_requests",
        wraps=_make_rpc_requests,
    )
    def test_extrapolation_mode_server_only(self, mock_rpc_request: mock.MagicMock) -> None:
        spans = []
        spans.append(
            self.create_span(
                {
                    "description": "foo",
                    "sentry_tags": {"status": "success"},
                    "measurements": {"server_sample_rate": {"value": 0.1}},
                },
                start_ts=self.ten_mins_ago,
            )
        )
        spans.append(
            self.create_span(
                {
                    "description": "bar",
                    "sentry_tags": {"status": "success"},
                },
                start_ts=self.ten_mins_ago,
            )
        )
        self.store_spans(spans, is_eap=True)
        response = self.do_request(
            {
                "field": ["description", "count()"],
                "orderby": "-count()",
                "query": "",
                "project": self.project.id,
                "dataset": "spans",
                "extrapolationMode": "serverOnly",
            }
        )

        assert response.status_code == 200, response.content

        assert (
            mock_rpc_request.call_args.kwargs["table_requests"][0]
            .columns[1]
            .aggregation.extrapolation_mode
            == ExtrapolationMode.EXTRAPOLATION_MODE_SERVER_ONLY
        )

        # TODO: Ensure server only extrapolation actually gets applied
        data = response.data["data"]
        assert len(data) == 2

    def test_span_duration(self) -> None:
        spans = [
            self.create_span(
                {"description": "bar", "sentry_tags": {"status": "invalid_argument"}},
                start_ts=self.ten_mins_ago,
            ),
            self.create_span(
                {"description": "foo", "sentry_tags": {"status": "success"}},
                start_ts=self.ten_mins_ago,
            ),
        ]
        self.store_spans(spans, is_eap=True)
        response = self.do_request(
            {
                "field": ["span.duration", "description"],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data == [
            {
                "span.duration": 1000.0,
                "description": "bar",
                "project.name": self.project.slug,
                "id": spans[0]["span_id"],
            },
            {
                "span.duration": 1000.0,
                "description": "foo",
                "project.name": self.project.slug,
                "id": spans[1]["span_id"],
            },
        ]
        assert meta["dataset"] == "spans"

    def test_aggregate_numeric_attr(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "foo",
                        "sentry_tags": {"status": "success"},
                        "tags": {"bar": "bar1"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "foo",
                        "sentry_tags": {"status": "success"},
                        "tags": {"bar": "bar2"},
                    },
                    measurements={"foo": {"value": 5}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "description",
                    "count_unique(bar)",
                    "count_unique(tags[bar])",
                    "count_unique(tags[bar,string])",
                    "count_unique(tags[foo,number])",
                    "count()",
                    "count(span.duration)",
                    "count(tags[foo,     number])",
                    "sum(tags[foo,number])",
                    "avg(tags[foo,number])",
                    "p50(tags[foo,number])",
                    "p75(tags[foo,number])",
                    "p95(tags[foo,number])",
                    "p99(tags[foo,number])",
                    "p100(tags[foo,number])",
                    "min(tags[foo,number])",
                    "max(tags[foo,number])",
                ],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0] == {
            "description": "foo",
            "count_unique(bar)": 2,
            "count_unique(tags[bar])": 2,
            "count_unique(tags[bar,string])": 2,
            "count_unique(tags[foo,number])": 1,
            "count()": 2,
            "count(span.duration)": 2,
            "count(tags[foo,     number])": 1,
            "sum(tags[foo,number])": 5.0,
            "avg(tags[foo,number])": 5.0,
            "p50(tags[foo,number])": 5.0,
            "p75(tags[foo,number])": 5.0,
            "p95(tags[foo,number])": 5.0,
            "p99(tags[foo,number])": 5.0,
            "p100(tags[foo,number])": 5.0,
            "min(tags[foo,number])": 5.0,
            "max(tags[foo,number])": 5.0,
        }

    def test_epm(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["description", "epm()"],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data == [
            {
                "description": "foo",
                "epm()": 1 / (90 * 24 * 60),
            },
        ]
        assert meta["dataset"] == "spans"
        assert meta["units"] == {"description": None, "epm()": "1/minute"}
        assert meta["fields"] == {"description": "string", "epm()": "rate"}

    def test_tpm(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "foo",
                        "sentry_tags": {"status": "success"},
                        "is_segment": True,
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["description", "tpm()"],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        segment_span_count = 1
        total_time = 90 * 24 * 60

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data == [
            {
                "description": "foo",
                "tpm()": segment_span_count / total_time,
            },
        ]
        assert meta["dataset"] == "spans"
        assert meta["units"] == {"description": None, "tpm()": "1/minute"}
        assert meta["fields"] == {"description": "string", "tpm()": "rate"}

    def test_p75_if(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"is_segment": is_segment}, start_ts=self.ten_mins_ago, duration=duration
                )
                for is_segment, duration in [
                    *[(True, 1000)] * 2,
                    *[(True, 2000)] * 2,
                    *[(True, 3000)] * 3,
                    (True, 4000),
                    *[(False, 5000)] * 4,
                ]
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["p75_if(span.duration, is_transaction, equals, true)"],
                "query": "",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data == [
            {
                "p75_if(span.duration, is_transaction, equals, true)": 3000,
            },
        ]

        assert meta["dataset"] == "spans"
        assert meta["units"] == {
            "p75_if(span.duration, is_transaction, equals, true)": "millisecond"
        }
        assert meta["fields"] == {"p75_if(span.duration, is_transaction, equals, true)": "duration"}

    def test_is_transaction(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "foo",
                        "sentry_tags": {"status": "success"},
                        "is_segment": True,
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "bar",
                        "sentry_tags": {"status": "success"},
                        "is_segment": False,
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["span.status", "description", "count()", "is_transaction"],
                "query": "is_transaction:true",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data == [
            {
                "is_transaction": True,
                "span.status": "success",
                "description": "foo",
                "count()": 1,
            },
        ]
        assert meta["dataset"] == "spans"

    def test_is_not_transaction(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "foo",
                        "sentry_tags": {"status": "success"},
                        "is_segment": True,
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "bar",
                        "sentry_tags": {"status": "success"},
                        "is_segment": False,
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["span.status", "description", "count()", "is_transaction"],
                "query": "is_transaction:0",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data == [
            {
                "is_transaction": False,
                "span.status": "success",
                "description": "bar",
                "count()": 1,
            },
        ]
        assert meta["dataset"] == "spans"

    def test_byte_fields(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "foo",
                        "data": {
                            "cache.item_size": 1,
                            "messaging.message.body.size": 2,
                        },
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "cache.item_size",
                    "measurements.cache.item_size",
                    "messaging.message.body.size",
                    "measurements.messaging.message.body.size",
                ],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.data["data"] == [
            {
                "id": mock.ANY,
                "project.name": self.project.slug,
                "cache.item_size": 1.0,
                "measurements.cache.item_size": 1.0,
                "measurements.messaging.message.body.size": 2.0,
                "messaging.message.body.size": 2.0,
            },
        ]

        assert response.data["meta"]["fields"] == {
            "id": "string",
            "project.name": "string",
            "cache.item_size": "size",
            "measurements.cache.item_size": "size",
            "measurements.messaging.message.body.size": "size",
            "messaging.message.body.size": "size",
        }

        assert response.data["meta"]["units"] == {
            "id": None,
            "project.name": None,
            "cache.item_size": "byte",
            "measurements.cache.item_size": "byte",
            "measurements.messaging.message.body.size": "byte",
            "messaging.message.body.size": "byte",
        }

    def test_query_for_missing_tag_negated(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo"},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "qux", "tags": {"foo": "bar"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["foo", "count()"],
                "query": "!has:foo",
                "project": self.project.id,
                "dataset": "spans",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["foo"] == "" or data[0]["foo"] is None
        assert data[0]["count()"] == 1

    def test_device_class_column(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"device.class": "1"}}, start_ts=self.ten_mins_ago
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["device.class", "count()"],
                "query": "device.class:low",
                "orderby": "count()",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["device.class"] == "low"
        assert meta["dataset"] == "spans"

    def test_http_response_count(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"status_code": "500"}}, start_ts=self.ten_mins_ago
                ),
            ],
            is_eap=True,
        )
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"status_code": "500"}}, start_ts=self.ten_mins_ago
                ),
            ],
            is_eap=True,
        )
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"status_code": "404"}}, start_ts=self.ten_mins_ago
                ),
            ],
            is_eap=True,
        )
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"status_code": "200"}}, start_ts=self.ten_mins_ago
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": [
                    "http_response_count(5)",
                    "http_response_count(4)",
                    "http_response_count(2)",
                ],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["http_response_count(5)"] == 2
        assert data[0]["http_response_count(4)"] == 1
        assert data[0]["http_response_count(2)"] == 1
        assert meta["dataset"] == "spans"

    def test_http_response_rate(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"status_code": "500"}}, start_ts=self.ten_mins_ago
                ),
            ],
            is_eap=True,
        )
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"status_code": "500"}}, start_ts=self.ten_mins_ago
                ),
            ],
            is_eap=True,
        )
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"status_code": "404"}}, start_ts=self.ten_mins_ago
                ),
            ],
            is_eap=True,
        )
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"status_code": "200"}}, start_ts=self.ten_mins_ago
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": [
                    "http_response_rate(5)",
                    "http_response_rate(4)",
                    "http_response_rate(2)",
                ],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["http_response_rate(5)"] == 0.5
        assert data[0]["http_response_rate(4)"] == 0.25
        assert data[0]["http_response_rate(2)"] == 0.25
        assert meta["dataset"] == "spans"
        assert meta["fields"] == {
            "http_response_rate(5)": "percentage",
            "http_response_rate(4)": "percentage",
            "http_response_rate(2)": "percentage",
        }
        assert meta["units"] == {
            "http_response_rate(5)": None,
            "http_response_rate(4)": None,
            "http_response_rate(2)": None,
        }

    def test_http_response_rate_missing_status_code(self) -> None:
        self.store_spans(
            [
                self.create_span({"sentry_tags": {}}, start_ts=self.ten_mins_ago),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": [
                    "http_response_rate(5)",
                ],
                "project": self.project.id,
                "dataset": "spans",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["http_response_rate(5)"] is None
        assert meta["dataset"] == "spans"

    def test_http_response_rate_invalid_param(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"status_code": "500"}}, start_ts=self.ten_mins_ago
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": [
                    "http_response_rate(a)",
                ],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 400, response.content
        assert (
            "Invalid Parameter A. Must Be One Of ['1', '2', '3', '4', '5']"
            == response.data["detail"].title()
        )

    def test_http_response_rate_group_by(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "description 1",
                        "sentry_tags": {"status_code": "500"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "description 1",
                        "sentry_tags": {"status_code": "200"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "description 2",
                        "sentry_tags": {"status_code": "500"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "description 2",
                        "sentry_tags": {"status_code": "500"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["http_response_rate(5)", "description"],
                "project": self.project.id,
                "dataset": "spans",
                "orderby": "description",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data[0]["http_response_rate(5)"] == 0.5
        assert data[0]["description"] == "description 1"
        assert data[1]["http_response_rate(5)"] == 1.0
        assert data[1]["description"] == "description 2"
        assert meta["dataset"] == "spans"

    def test_cache_miss_rate(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "data": {"cache.hit": False},
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "data": {"cache.hit": True},
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "data": {"cache.hit": True},
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "data": {"cache.hit": True},
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["cache_miss_rate()"],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["cache_miss_rate()"] == 0.25
        assert meta["dataset"] == "spans"

    def test_cache_hit(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "get cache 1",
                        "data": {"cache.hit": False},
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "get cache 2",
                        "data": {"cache.hit": True},
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["cache.hit", "description"],
                "project": self.project.id,
                "dataset": "spans",
                "orderby": "description",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data[0]["cache.hit"] is False
        assert data[1]["cache.hit"] is True
        assert meta["dataset"] == "spans"

    def test_searchable_contexts(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"device.model": "Apple"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"sentry_tags": {"request.url": "https://sentry/api/0/foo"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["device.model", "request.url"],
                "project": self.project.id,
                "dataset": "spans",
                "orderby": "device.model",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data[0]["device.model"] == "Apple"
        assert data[1]["request.url"] == "https://sentry/api/0/foo"
        assert meta["dataset"] == "spans"

    def test_trace_status_rate(self) -> None:
        statuses = ["unknown", "internal_error", "unauthenticated", "ok", "ok"]
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"trace.status": status}},
                    start_ts=self.ten_mins_ago,
                )
                for status in statuses
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "trace_status_rate(ok)",
                    "trace_status_rate(unknown)",
                    "trace_status_rate(internal_error)",
                    "trace_status_rate(unauthenticated)",
                ],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]

        assert len(data) == 1
        assert data[0]["trace_status_rate(ok)"] == 0.4
        assert data[0]["trace_status_rate(unknown)"] == 0.2
        assert data[0]["trace_status_rate(internal_error)"] == 0.2
        assert data[0]["trace_status_rate(unauthenticated)"] == 0.2

        assert meta["dataset"] == "spans"

    def test_failure_rate(self) -> None:
        trace_statuses = ["ok", "cancelled", "unknown", "failure"]
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"status": status}},
                    start_ts=self.ten_mins_ago,
                )
                for status in trace_statuses
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["failure_rate()"],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["failure_rate()"] == 0.25
        assert meta["dataset"] == "spans"

    def test_failure_rate_if(self) -> None:
        trace_statuses = ["ok", "cancelled", "unknown", "failure"]

        spans = [
            self.create_span(
                {
                    "sentry_tags": {"status": status},
                    "is_segment": True,
                },
                start_ts=self.ten_mins_ago,
            )
            for status in trace_statuses
        ]

        spans.append(
            self.create_span(
                {
                    "sentry_tags": {"status": "ok"},
                    "is_segment": False,
                },
                start_ts=self.ten_mins_ago,
            )
        )

        self.store_spans(spans, is_eap=True)

        response = self.do_request(
            {
                "field": ["failure_rate_if(is_transaction, equals, true)"],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["failure_rate_if(is_transaction, equals, true)"] == 0.25
        assert meta["dataset"] == "spans"
        assert meta["fields"] == {
            "failure_rate_if(is_transaction, equals, true)": "percentage",
        }
        assert meta["units"] == {
            "failure_rate_if(is_transaction, equals, true)": None,
        }

    def test_count_op(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"op": "queue.process", "sentry_tags": {"op": "queue.process"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"op": "queue.process", "sentry_tags": {"op": "queue.process"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"op": "queue.publish", "sentry_tags": {"op": "queue.publish"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "count_op(queue.process)",
                    "count_op(queue.publish)",
                ],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]

        assert len(data) == 1
        assert data[0]["count_op(queue.process)"] == 2
        assert data[0]["count_op(queue.publish)"] == 1

        assert meta["dataset"] == "spans"

    def test_avg_if(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"op": "queue.process", "sentry_tags": {"op": "queue.process"}},
                    duration=1000,
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"op": "queue.process", "sentry_tags": {"op": "queue.process"}},
                    duration=2000,
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"op": "queue.publish", "sentry_tags": {"op": "queue.publish"}},
                    duration=3000,
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "avg_if(span.duration, span.op, equals, queue.process)",
                    "avg_if(span.duration, span.op, equals, queue.publish)",
                ],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["avg_if(span.duration, span.op, equals, queue.process)"] == 1500.0
        assert data[0]["avg_if(span.duration, span.op, equals, queue.publish)"] == 3000.0
        assert meta["dataset"] == "spans"

    def test_avg_compare(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"release": "foo"}},
                    duration=100,
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"sentry_tags": {"release": "bar"}},
                    duration=10,
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["avg_compare(span.self_time, release, foo, bar)"],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["avg_compare(span.self_time, release, foo, bar)"] == -0.9
        assert meta["dataset"] == "spans"
        assert meta["fields"] == {
            "avg_compare(span.self_time, release, foo, bar)": "percentage",
        }
        assert meta["units"] == {
            "avg_compare(span.self_time, release, foo, bar)": None,
        }

    def test_avg_if_invalid_param(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"op": "queue.process", "sentry_tags": {"op": "queue.process"}},
                    duration=1000,
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "avg_if(span.duration, span.duration, equals, queue.process)",
                ],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 400, response.content
        assert (
            "Span.Duration Is Invalid For Parameter 2 In Avg_If. Its A Millisecond Type Field, But It Must Be One Of These Types: {'String'}"
            == response.data["detail"].title()
        )

    def test_count_if_invalid_param(self) -> None:
        response = self.do_request(
            {
                "field": [
                    "count_if(span.description, snequals, queue.process)",
                ],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 400, response.content
        assert "Invalid parameter snequals" in response.data["detail"]

    def test_ttif_ttfd_contribution_rate(self) -> None:
        spans = []
        for _ in range(8):
            spans.append(
                self.create_span(
                    {"sentry_tags": {"ttid": "ttid", "ttfd": "ttfd"}},
                    start_ts=self.ten_mins_ago,
                ),
            )

        spans.extend(
            [
                self.create_span(
                    {"sentry_tags": {"ttfd": "ttfd", "ttid": ""}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"sentry_tags": {"ttfd": "", "ttid": ""}},
                    start_ts=self.ten_mins_ago,
                ),
            ]
        )

        self.store_spans(spans, is_eap=True)

        response = self.do_request(
            {
                "field": [
                    "ttid_contribution_rate()",
                    "ttfd_contribution_rate()",
                ],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]

        assert len(data) == 1
        assert data[0]["ttid_contribution_rate()"] == 0.8
        assert data[0]["ttfd_contribution_rate()"] == 0.9
        assert meta["dataset"] == "spans"

    def test_count_scores(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.lcp": {"value": 0.03},
                            "score.total": {"value": 0.43},
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.total": {"value": 1.0},
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.total": {"value": 0.0},
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "count_scores(measurements.score.lcp)",
                    "count_scores(measurements.score.total)",
                ],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["count_scores(measurements.score.lcp)"] == 1
        assert data[0]["count_scores(measurements.score.total)"] == 3
        assert meta["dataset"] == "spans"

    def test_count_scores_filter(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.lcp": {"value": 0.03},
                            "score.total": {"value": 0.43},
                        },
                        "sentry_tags": {"transaction": "foo_transaction"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.total": {"value": 1.0},
                            "score.ratio.lcp": {"value": 0.03},
                        },
                        "sentry_tags": {"transaction": "foo_transaction"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.total": {"value": 0.0},
                            "score.ratio.lcp": {"value": 0.03},
                        },
                        "sentry_tags": {"transaction": "bar_transaction"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["count_scores(measurements.score.lcp)", "transaction"],
                "query": "count_scores(measurements.score.lcp):>1",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["count_scores(measurements.score.lcp)"] == 2
        assert data[0]["transaction"] == "foo_transaction"
        assert meta["dataset"] == "spans"

    def test_time_spent_percentage(self) -> None:
        spans = []
        for _ in range(4):
            spans.append(
                self.create_span({"sentry_tags": {"transaction": "foo_transaction"}}, duration=1),
            )
        spans.append(
            self.create_span({"sentry_tags": {"transaction": "bar_transaction"}}, duration=1)
        )
        self.store_spans(spans, is_eap=True)

        response = self.do_request(
            {
                "field": ["transaction", "time_spent_percentage()"],
                "query": "",
                "orderby": ["-time_spent_percentage()"],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data[0]["time_spent_percentage()"] == 0.8
        assert data[0]["transaction"] == "foo_transaction"
        assert data[1]["time_spent_percentage()"] == 0.2
        assert data[1]["transaction"] == "bar_transaction"
        assert meta["dataset"] == "spans"

    def test_performance_score(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.lcp": {"value": 0.02},
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.lcp": {"value": 0.08},
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.lcp": {"value": 0.08},
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "performance_score(measurements.score.lcp)",
                ],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["performance_score(measurements.score.lcp)"] == 0.06
        assert meta["dataset"] == "spans"

    def test_performance_score_zero(self) -> None:

        response = self.do_request(
            {
                "field": [
                    "performance_score(measurements.score.lcp)",
                ],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["performance_score(measurements.score.lcp)"] is None
        assert meta["dataset"] == "spans"

    def test_division_if(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "measurements": {
                            "frames.total": {"value": 100},
                            "frames.slow": {"value": 10},
                            "frames.frozen": {"value": 20},
                        },
                        "sentry_tags": {"browser.name": "Chrome"},
                    }
                ),
                self.create_span(
                    {
                        "measurements": {
                            "frames.total": {"value": 100},
                            "frames.slow": {"value": 50},
                            "frames.frozen": {"value": 60},
                        },
                        "sentry_tags": {"browser.name": "Firefox"},
                    }
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "division_if(mobile.slow_frames,mobile.total_frames,browser.name,equals,Chrome)",
                    "division_if(mobile.slow_frames,mobile.total_frames,browser.name,equals,Firefox)",
                ],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert (
            data[0][
                "division_if(mobile.slow_frames,mobile.total_frames,browser.name,equals,Chrome)"
            ]
            == 10 / 100
        )
        assert (
            data[0][
                "division_if(mobile.slow_frames,mobile.total_frames,browser.name,equals,Firefox)"
            ]
            == 50 / 100
        )
        assert meta["dataset"] == "spans"
        assert meta["fields"] == {
            "division_if(mobile.slow_frames,mobile.total_frames,browser.name,equals,Chrome)": "percentage",
            "division_if(mobile.slow_frames,mobile.total_frames,browser.name,equals,Firefox)": "percentage",
        }

    def test_total_performance_score(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.lcp": {"value": 0.0},
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.lcp": {"value": 0.02},
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.lcp": {"value": 0.04},
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.cls": {"value": 0.08},
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.inp": {"value": 0.5},
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.fcp": {"value": 0.08},
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.ttfb": {"value": 0.5},
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "performance_score(measurements.score.lcp)",
                    "performance_score(measurements.score.cls)",
                    "performance_score(measurements.score.ttfb)",
                    "performance_score(measurements.score.fcp)",
                    "performance_score(measurements.score.inp)",
                    "performance_score(measurements.score.total)",
                ],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["performance_score(measurements.score.lcp)"] == 0.02
        assert data[0]["performance_score(measurements.score.cls)"] == 0.08
        assert data[0]["performance_score(measurements.score.ttfb)"] == 0.5
        assert data[0]["performance_score(measurements.score.fcp)"] == 0.08
        assert data[0]["performance_score(measurements.score.inp)"] == 0.5
        self.assertAlmostEqual(data[0]["performance_score(measurements.score.total)"], 0.23)

        assert meta["dataset"] == "spans"

    def test_total_performance_score_missing_vital(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.lcp": {"value": 0.0},
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.lcp": {"value": 0.02},
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.lcp": {"value": 0.04},
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.cls": {"value": 0.08},
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.inp": {"value": 0.5},
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.fcp": {"value": 0.08},
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "performance_score(measurements.score.lcp)",
                    "performance_score(measurements.score.cls)",
                    "performance_score(measurements.score.ttfb)",
                    "performance_score(measurements.score.fcp)",
                    "performance_score(measurements.score.inp)",
                    "performance_score(measurements.score.total)",
                ],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["performance_score(measurements.score.lcp)"] == 0.02
        assert data[0]["performance_score(measurements.score.cls)"] == 0.08
        assert data[0]["performance_score(measurements.score.ttfb)"] is None
        assert data[0]["performance_score(measurements.score.fcp)"] == 0.08
        assert data[0]["performance_score(measurements.score.inp)"] == 0.5
        self.assertAlmostEqual(data[0]["performance_score(measurements.score.total)"], 0.20)

        assert meta["dataset"] == "spans"

    def test_total_performance_score_multiple_transactions(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.lcp": {"value": 0.8},
                        },
                        "sentry_tags": {"transaction": "foo_transaction"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.cls": {"value": 0.7},
                        },
                        "sentry_tags": {"transaction": "bar_transaction"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "performance_score(measurements.score.total)",
                    "performance_score(measurements.score.lcp)",
                    "performance_score(measurements.score.cls)",
                    "performance_score(measurements.score.fcp)",
                    "opportunity_score(measurements.score.total)",
                    "opportunity_score(measurements.score.lcp)",
                    "opportunity_score(measurements.score.cls)",
                    "opportunity_score(measurements.score.fcp)",
                ],
                "project": self.project.id,
                "dataset": "spans",
                "orderby": "-transaction",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data[0]["transaction"] == "foo_transaction"
        self.assertAlmostEqual(data[0]["performance_score(measurements.score.total)"], 0.8)
        assert data[0]["performance_score(measurements.score.lcp)"] == 0.8
        assert data[0]["performance_score(measurements.score.cls)"] is None
        assert data[0]["performance_score(measurements.score.fcp)"] is None
        self.assertAlmostEqual(
            data[0]["opportunity_score(measurements.score.total)"], 0.13333333333333333
        )
        self.assertAlmostEqual(data[0]["opportunity_score(measurements.score.lcp)"], 0.2)
        assert data[0]["opportunity_score(measurements.score.cls)"] == 0.0
        assert data[0]["opportunity_score(measurements.score.fcp)"] == 0.0
        assert data[1]["transaction"] == "bar_transaction"
        self.assertAlmostEqual(data[1]["performance_score(measurements.score.total)"], 0.7)
        assert data[1]["performance_score(measurements.score.lcp)"] is None
        assert data[1]["performance_score(measurements.score.cls)"] == 0.7
        assert data[1]["performance_score(measurements.score.fcp)"] is None
        self.assertAlmostEqual(data[1]["opportunity_score(measurements.score.total)"], 0.1)
        assert data[1]["opportunity_score(measurements.score.lcp)"] == 0.0
        self.assertAlmostEqual(data[1]["opportunity_score(measurements.score.cls)"], 0.3)
        assert data[1]["opportunity_score(measurements.score.fcp)"] == 0.0

        assert meta["dataset"] == "spans"

    def test_division(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "measurements": {
                            "frames.total": {"value": 100},
                            "frames.slow": {"value": 10},
                            "frames.frozen": {"value": 20},
                        }
                    }
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "division(mobile.slow_frames,mobile.total_frames)",
                    "division(mobile.frozen_frames,mobile.total_frames)",
                ],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["division(mobile.slow_frames,mobile.total_frames)"] == 10 / 100
        assert data[0]["division(mobile.frozen_frames,mobile.total_frames)"] == 20 / 100
        assert meta["dataset"] == "spans"
        assert meta["fields"] == {
            "division(mobile.slow_frames,mobile.total_frames)": "percentage",
            "division(mobile.frozen_frames,mobile.total_frames)": "percentage",
        }

    def test_division_with_groupby(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "measurements": {
                            "frames.total": {"value": 100},
                            "frames.slow": {"value": 10},
                            "frames.frozen": {"value": 20},
                        },
                        "sentry_tags": {"transaction": "foo_transaction"},
                    }
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "division(mobile.slow_frames,mobile.total_frames)",
                    "division(mobile.frozen_frames,mobile.total_frames)",
                ],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["division(mobile.slow_frames,mobile.total_frames)"] == 10 / 100
        assert data[0]["division(mobile.frozen_frames,mobile.total_frames)"] == 20 / 100
        assert data[0]["transaction"] == "foo_transaction"
        assert meta["dataset"] == "spans"

    def test_opportunity_score_zero_scores(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.fcp": {"value": 0.0},
                            "score.ratio.cls": {"value": 0.0},
                            "score.ratio.ttfb": {"value": 0.0},
                            "score.ratio.lcp": {"value": 0.0},
                            "score.ratio.inp": {"value": 0.0},
                        },
                        "sentry_tags": {"transaction": "foo_transaction"},
                    }
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.fcp": {"value": 0.0},
                            "score.ratio.cls": {"value": 0.0},
                            "score.ratio.ttfb": {"value": 0.0},
                            "score.ratio.lcp": {"value": 0.0},
                            "score.ratio.inp": {"value": 0.0},
                        },
                        "sentry_tags": {"transaction": "bar_transaction"},
                    }
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "opportunity_score(measurements.score.total)",
                    "opportunity_score(measurements.score.lcp)",
                    "opportunity_score(measurements.score.inp)",
                    "opportunity_score(measurements.score.cls)",
                    "opportunity_score(measurements.score.ttfb)",
                    "opportunity_score(measurements.score.fcp)",
                ],
                "orderby": "transaction",
                "dataset": "spans",
                "project": self.project.id,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        assert data[0]["opportunity_score(measurements.score.lcp)"] == 0.5
        assert data[0]["opportunity_score(measurements.score.inp)"] == 0.5
        assert data[0]["opportunity_score(measurements.score.cls)"] == 0.5
        assert data[0]["opportunity_score(measurements.score.ttfb)"] == 0.5
        assert data[0]["opportunity_score(measurements.score.fcp)"] == 0.5
        assert data[0]["opportunity_score(measurements.score.total)"] == 0.5

        assert data[1]["opportunity_score(measurements.score.lcp)"] == 0.5
        assert data[1]["opportunity_score(measurements.score.inp)"] == 0.5
        assert data[1]["opportunity_score(measurements.score.cls)"] == 0.5
        assert data[1]["opportunity_score(measurements.score.ttfb)"] == 0.5
        assert data[1]["opportunity_score(measurements.score.fcp)"] == 0.5
        assert data[1]["opportunity_score(measurements.score.total)"] == 0.5

    def test_opportunity_score_simple(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.fcp": {"value": 0.0},
                            "score.ratio.cls": {"value": 0.0},
                            "score.ratio.ttfb": {"value": 0.0},
                            "score.ratio.lcp": {"value": 1.0},
                            "score.ratio.inp": {"value": 0.0},
                        },
                    }
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.fcp": {"value": 0.0},
                            "score.ratio.cls": {"value": 0.0},
                            "score.ratio.ttfb": {"value": 0.0},
                            "score.ratio.lcp": {"value": 0.0},
                            "score.ratio.inp": {"value": 0.0},
                        },
                    }
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "opportunity_score(measurements.score.lcp)",
                    "opportunity_score(measurements.score.inp)",
                    "opportunity_score(measurements.score.cls)",
                    "opportunity_score(measurements.score.ttfb)",
                    "opportunity_score(measurements.score.fcp)",
                    "opportunity_score(measurements.score.total)",
                ],
                "orderby": "transaction",
                "dataset": "spans",
                "project": self.project.id,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["opportunity_score(measurements.score.lcp)"] == 0.5
        assert data[0]["opportunity_score(measurements.score.inp)"] == 1.0
        assert data[0]["opportunity_score(measurements.score.cls)"] == 1.0
        assert data[0]["opportunity_score(measurements.score.ttfb)"] == 1.0
        assert data[0]["opportunity_score(measurements.score.fcp)"] == 1.0
        self.assertAlmostEqual(data[0]["opportunity_score(measurements.score.total)"], 0.85)

    def test_opportunity_score_with_transaction(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.fcp": {"value": 0.0},
                            "score.ratio.cls": {"value": 0.0},
                            "score.ratio.ttfb": {"value": 0.0},
                            "score.ratio.lcp": {"value": 1.0},
                            "score.ratio.inp": {"value": 0.0},
                        },
                        "sentry_tags": {"transaction": "foo_transaction"},
                    }
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.fcp": {"value": 0.0},
                            "score.ratio.cls": {"value": 0.0},
                            "score.ratio.ttfb": {"value": 0.0},
                            "score.ratio.lcp": {"value": 0.0},
                            "score.ratio.inp": {"value": 0.0},
                        },
                        "sentry_tags": {"transaction": "bar_transaction"},
                    }
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "opportunity_score(measurements.score.lcp)",
                    "opportunity_score(measurements.score.inp)",
                    "opportunity_score(measurements.score.cls)",
                    "opportunity_score(measurements.score.ttfb)",
                    "opportunity_score(measurements.score.fcp)",
                    "opportunity_score(measurements.score.total)",
                ],
                "orderby": "transaction",
                "dataset": "spans",
                "project": self.project.id,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2

        assert data[0]["opportunity_score(measurements.score.lcp)"] == 0.5
        assert data[0]["opportunity_score(measurements.score.inp)"] == 0.5
        assert data[0]["opportunity_score(measurements.score.cls)"] == 0.5
        assert data[0]["opportunity_score(measurements.score.ttfb)"] == 0.5
        assert data[0]["opportunity_score(measurements.score.fcp)"] == 0.5
        assert data[0]["opportunity_score(measurements.score.total)"] == 0.5

        assert data[1]["opportunity_score(measurements.score.lcp)"] == 0
        assert data[1]["opportunity_score(measurements.score.inp)"] == 0.5
        assert data[1]["opportunity_score(measurements.score.cls)"] == 0.5
        assert data[1]["opportunity_score(measurements.score.ttfb)"] == 0.5
        assert data[1]["opportunity_score(measurements.score.fcp)"] == 0.5
        self.assertAlmostEqual(data[1]["opportunity_score(measurements.score.total)"], 0.35)

    def test_opportunity_score_with_filter(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.fcp": {"value": 0.0},
                            "score.ratio.cls": {"value": 0.0},
                            "score.ratio.ttfb": {"value": 0.0},
                            "score.ratio.lcp": {"value": 1.0},
                            "score.ratio.inp": {"value": 0.0},
                        },
                        "sentry_tags": {
                            "transaction": "foo_transaction",
                            "browser.name": "Chrome",
                        },
                    }
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.fcp": {"value": 0.0},
                            "score.ratio.cls": {"value": 0.0},
                            "score.ratio.ttfb": {"value": 0.0},
                            "score.ratio.lcp": {"value": 0.0},
                            "score.ratio.inp": {"value": 0.0},
                        },
                        "sentry_tags": {
                            "transaction": "bar_transaction",
                            "browser.name": "Chrome",
                        },
                    }
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.fcp": {"value": 0.0},
                            "score.ratio.cls": {"value": 0.0},
                            "score.ratio.ttfb": {"value": 0.0},
                            "score.ratio.lcp": {"value": 0.0},
                            "score.ratio.inp": {"value": 0.0},
                        },
                        "sentry_tags": {
                            "transaction": "bar_transaction",
                            "browser.name": "Firefox",
                        },
                    }
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "opportunity_score(measurements.score.lcp)",
                    "opportunity_score(measurements.score.inp)",
                    "opportunity_score(measurements.score.cls)",
                    "opportunity_score(measurements.score.ttfb)",
                    "opportunity_score(measurements.score.fcp)",
                    "opportunity_score(measurements.score.total)",
                ],
                "query": "browser.name:Chrome",
                "orderby": "transaction",
                "dataset": "spans",
                "project": self.project.id,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2

        assert data[0]["opportunity_score(measurements.score.lcp)"] == 0.5
        assert data[0]["opportunity_score(measurements.score.inp)"] == 0.5
        assert data[0]["opportunity_score(measurements.score.cls)"] == 0.5
        assert data[0]["opportunity_score(measurements.score.ttfb)"] == 0.5
        assert data[0]["opportunity_score(measurements.score.fcp)"] == 0.5
        assert data[0]["opportunity_score(measurements.score.total)"] == 0.5

        assert data[1]["opportunity_score(measurements.score.lcp)"] == 0
        assert data[1]["opportunity_score(measurements.score.inp)"] == 0.5
        assert data[1]["opportunity_score(measurements.score.cls)"] == 0.5
        assert data[1]["opportunity_score(measurements.score.ttfb)"] == 0.5
        assert data[1]["opportunity_score(measurements.score.fcp)"] == 0.5
        self.assertAlmostEqual(data[1]["opportunity_score(measurements.score.total)"], 0.35)

    def test_total_opportunity_score_passes_with_bad_query(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.fcp": {"value": 0.0},
                            "score.ratio.cls": {"value": 0.0},
                            "score.ratio.ttfb": {"value": 0.0},
                            "score.ratio.lcp": {"value": 1.0},
                            "score.ratio.inp": {"value": 0.0},
                        },
                        "sentry_tags": {
                            "transaction": "foo_transaction",
                            "browser.name": "Chrome",
                        },
                    }
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "opportunity_score(measurements.score.total)",
                ],
                "query": 'transaction.op:foo_transaction span.op:foo_transaction !transaction:"<< unparameterized >>" avg(measurements.score.total):>=0',
                "orderby": "transaction",
                "dataset": "spans",
                "project": self.project.id,
            }
        )

        assert response.status_code == 200, response.content

    def test_total_opportunity_score_missing_data(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.fcp": {"value": 0.0},
                            "score.ratio.cls": {"value": 0.0},
                            "score.ratio.ttfb": {"value": 0.0},
                            "score.ratio.lcp": {"value": 1.0},
                        },
                    }
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.fcp": {"value": 0.0},
                            "score.ratio.cls": {"value": 0.0},
                            "score.ratio.ttfb": {"value": 0.0},
                            "score.ratio.lcp": {"value": 0.0},
                        },
                    }
                ),
                self.create_span(
                    {
                        "measurements": {
                            "score.ratio.fcp": {"value": 0.0},
                            "score.ratio.cls": {"value": 0.0},
                            "score.ratio.ttfb": {"value": 0.0},
                            "score.ratio.lcp": {"value": 0.0},
                        },
                    }
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "opportunity_score(measurements.score.total)",
                ],
                "dataset": "spans",
                "project": self.project.id,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        assert data[0]["opportunity_score(measurements.score.total)"] == 0.8571428571428572

    def test_count_starts(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "measurements": {"app_start_warm": {"value": 200}},
                        "sentry_tags": {"transaction": "foo_transaction"},
                    }
                ),
                self.create_span(
                    {
                        "measurements": {"app_start_warm": {"value": 100}},
                        "sentry_tags": {"transaction": "foo_transaction"},
                    }
                ),
                self.create_span(
                    {
                        "measurements": {"app_start_cold": {"value": 10}},
                        "sentry_tags": {"transaction": "foo_transaction"},
                    }
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "transaction",
                    "count_starts(measurements.app_start_warm)",
                    "count_starts(measurements.app_start_cold)",
                ],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["count_starts(measurements.app_start_warm)"] == 2
        assert data[0]["count_starts(measurements.app_start_cold)"] == 1
        assert meta["dataset"] == "spans"

    def test_unit_aggregate_filtering(self) -> None:
        spans = [
            self.create_span(
                {"description": "bar", "sentry_tags": {"status": "invalid_argument"}},
                start_ts=self.ten_mins_ago,
            ),
            self.create_span(
                {"description": "foo", "sentry_tags": {"status": "success"}},
                start_ts=self.ten_mins_ago,
            ),
        ]
        self.store_spans(spans, is_eap=True)
        response = self.do_request(
            {
                "field": ["avg(span.duration)", "description"],
                "query": "avg(span.duration):>0.5s",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data == [
            {
                "avg(span.duration)": 1000.0,
                "description": "bar",
            },
            {
                "avg(span.duration)": 1000.0,
                "description": "foo",
            },
        ]
        assert meta["dataset"] == "spans"

    def test_trace_id_in_filter(self) -> None:
        spans = [
            self.create_span(
                {"description": "bar", "trace_id": "1" * 32},
                start_ts=self.ten_mins_ago,
            ),
            self.create_span(
                {"description": "foo", "trace_id": "2" * 32},
                start_ts=self.ten_mins_ago,
            ),
        ]
        self.store_spans(spans, is_eap=True)
        response = self.do_request(
            {
                "field": ["description"],
                "query": f"trace:[{'1' * 32}, {'2' * 32}]",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data == [
            {
                "description": "bar",
                "id": mock.ANY,
                "project.name": self.project.slug,
            },
            {
                "description": "foo",
                "id": mock.ANY,
                "project.name": self.project.slug,
            },
        ]
        assert meta["dataset"] == "spans"

    def test_filtering_null_numeric_attr(self) -> None:
        spans = [
            self.create_span(
                {
                    "description": "bar",
                    "measurements": {"http.response.status_code": {"value": 200}},
                },
                start_ts=self.ten_mins_ago,
            ),
            self.create_span(
                {
                    "description": "foo",
                },
                start_ts=self.ten_mins_ago,
            ),
        ]
        self.store_spans(spans, is_eap=True)
        response = self.do_request(
            {
                "field": [
                    "description",
                    "tags[http.response.status_code,number]",
                    "count()",
                ],
                "query": "!tags[http.response.status_code,number]:200",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data == [
            {
                "tags[http.response.status_code,number]": None,
                "description": "foo",
                "count()": 1,
            },
        ]
        assert meta["dataset"] == "spans"

    def test_internal_fields(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "zoo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        for private_field in [
            "sentry.organization_id",
            "sentry.item_type",
        ]:
            response = self.do_request(
                {
                    "field": [private_field, "count()"],
                    "query": "",
                    "orderby": private_field,
                    "project": self.project.id,
                    "dataset": "spans",
                    "statsPeriod": "1h",
                }
            )

            assert response.status_code == 400, response.content

    def test_transaction_profile_attributes(self) -> None:
        span_with_profile = self.create_span(start_ts=before_now(minutes=10))
        span_without_profile = self.create_span(
            {"profile_id": None}, start_ts=before_now(minutes=20)
        )
        self.store_spans(
            [span_with_profile, span_without_profile],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["id", "profile.id", "timestamp"],
                "query": "",
                "orderby": "-timestamp",
                "project": self.project.id,
                "dataset": "spans",
                "statsPeriod": "1h",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": span_with_profile["span_id"],
                "profile.id": span_with_profile["profile_id"],
                "project.name": self.project.slug,
                "timestamp": mock.ANY,
            },
            {
                "id": span_without_profile["span_id"],
                "profile.id": None,
                "project.name": self.project.slug,
                "timestamp": mock.ANY,
            },
        ]

        response = self.do_request(
            {
                "field": ["id", "profile.id", "timestamp"],
                "query": "has:profile.id",
                "orderby": "-timestamp",
                "project": self.project.id,
                "dataset": "spans",
                "statsPeriod": "1h",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": span_with_profile["span_id"],
                "profile.id": span_with_profile["profile_id"],
                "project.name": self.project.slug,
                "timestamp": mock.ANY,
            },
        ]

    def test_continuous_profile_attributes(self) -> None:
        span_with_profile = self.create_span(
            {
                "profile_id": None,
                "sentry_tags": {
                    "profiler_id": uuid4().hex,
                    "thread.id": "123",
                    "thread.name": "main",
                },
            },
            start_ts=before_now(minutes=10),
        )
        span_without_profile = self.create_span(
            {"profile_id": None}, start_ts=before_now(minutes=20)
        )
        self.store_spans(
            [span_with_profile, span_without_profile],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["id", "profiler.id", "thread.id", "thread.name", "timestamp"],
                "query": "",
                "orderby": "-timestamp",
                "project": self.project.id,
                "dataset": "spans",
                "statsPeriod": "1h",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": span_with_profile["span_id"],
                "profiler.id": span_with_profile["sentry_tags"]["profiler_id"],
                "project.name": self.project.slug,
                "thread.id": span_with_profile["sentry_tags"]["thread.id"],
                "thread.name": span_with_profile["sentry_tags"]["thread.name"],
                "timestamp": mock.ANY,
            },
            {
                "id": span_without_profile["span_id"],
                "profiler.id": None,
                "project.name": self.project.slug,
                "thread.id": None,
                "thread.name": None,
                "timestamp": mock.ANY,
            },
        ]

        response = self.do_request(
            {
                "field": ["id", "profiler.id", "thread.id", "thread.name", "timestamp"],
                "query": "has:profiler.id",
                "orderby": "-timestamp",
                "project": self.project.id,
                "dataset": "spans",
                "statsPeriod": "1h",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": span_with_profile["span_id"],
                "profiler.id": span_with_profile["sentry_tags"]["profiler_id"],
                "project.name": self.project.slug,
                "thread.id": span_with_profile["sentry_tags"]["thread.id"],
                "thread.name": span_with_profile["sentry_tags"]["thread.name"],
                "timestamp": mock.ANY,
            },
        ]

    def test_sampling_weight_does_not_fail(self) -> None:
        span = self.create_span(
            {
                "profile_id": None,
                "sentry_tags": {
                    "profiler_id": uuid4().hex,
                    "thread.id": "123",
                    "thread.name": "main",
                },
                "measurements": {"client_sample_rate": {"value": 0.5}},
            },
            start_ts=before_now(minutes=10),
        )
        self.store_spans([span], is_eap=True)
        response = self.do_request(
            {
                "field": ["sentry.sampling_weight"],
                "query": "",
                "orderby": "sentry.sampling_weight",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        # Sampling weight is 1 / client_sample_rate
        assert data[0]["sentry.sampling_weight"] == 2.0
        assert meta["dataset"] == "spans"

    def test_sampling_factor_does_not_fail(self) -> None:
        span = self.create_span(
            {
                "profile_id": None,
                "sentry_tags": {
                    "profiler_id": uuid4().hex,
                    "thread.id": "123",
                    "thread.name": "main",
                },
                "measurements": {"client_sample_rate": {"value": 0.01}},
            },
            start_ts=before_now(minutes=10),
        )
        self.store_spans([span], is_eap=True)
        response = self.do_request(
            {
                "field": ["sentry.sampling_factor"],
                "query": "",
                "orderby": "sentry.sampling_factor",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["sentry.sampling_factor"] == 0.01
        assert meta["dataset"] == "spans"

    def test_is_starred_transaction(self) -> None:
        InsightsStarredSegment.objects.create(
            organization=self.organization,
            project=self.project,
            segment_name="foo",
            user_id=self.user.id,
        )

        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "foo",
                        "sentry_tags": {"status": "success", "transaction": "foo"},
                        "is_segment": True,
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "bar",
                        "sentry_tags": {"status": "success", "transaction": "bar"},
                        "is_segment": True,
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["is_starred_transaction", "transaction"],
                "query": "",
                "project": self.project.id,
                "dataset": "spans",
                "orderby": "-is_starred_transaction",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2

        assert data[0]["is_starred_transaction"] is True
        assert data[0]["transaction"] == "foo"

        assert data[1]["is_starred_transaction"] is False
        assert data[1]["transaction"] == "bar"

    @mock.patch("sentry.api.utils.sentry_sdk.capture_exception")
    @mock.patch("sentry.utils.snuba_rpc._snuba_pool.urlopen")
    def test_snuba_error_handles_correctly(
        self, mock_sdk: mock.MagicMock, mock_rpc_query: mock.MagicMock
    ) -> None:
        mock_rpc_query.side_effect = urllib3.exceptions.HTTPError()
        response = self.do_request(
            {
                "field": ["count()"],
                "query": "",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 500, response.content
        mock_sdk.assert_called_once()

    def test_empty_string_equal(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "foo",
                        "sentry_tags": {"user.email": "test@test.com"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "bar", "sentry_tags": {"user.email": ""}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["user.email", "description", "count()"],
                "query": '!user.email:""',
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data == [
            {
                "user.email": "test@test.com",
                "description": "foo",
                "count()": 1,
            },
        ]
        assert meta["dataset"] == "spans"

    def test_empty_string_negation(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "foo",
                        "sentry_tags": {"user.email": "test@test.com"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "bar", "sentry_tags": {"user.email": ""}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["user.email", "description", "count()"],
                "query": 'user.email:""',
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data == [
            {
                "user.email": "",
                "description": "bar",
                "count()": 1,
            },
        ]
        assert meta["dataset"] == "spans"

    def test_has_parent_span_filter(self) -> None:
        spans = [
            self.create_span(
                {"parent_span_id": None},
                start_ts=self.ten_mins_ago,
            ),
            self.create_span(
                {},
                start_ts=self.ten_mins_ago,
            ),
        ]
        self.store_spans(spans, is_eap=True)

        response = self.do_request(
            {
                "field": ["parent_span"],
                "query": "!has:parent_span",
                "project": self.project.id,
                "dataset": "spans",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data == [
            {
                "id": spans[0]["span_id"],
                "parent_span": None,
                "project.name": self.project.slug,
            }
        ]
        assert meta["dataset"] == "spans"

        response = self.do_request(
            {
                "field": ["parent_span"],
                "query": "has:parent_span",
                "project": self.project.id,
                "dataset": "spans",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data == [
            {
                "id": spans[1]["span_id"],
                "parent_span": spans[1]["parent_span_id"],
                "project.name": self.project.slug,
            }
        ]
        assert meta["dataset"] == "spans"

    def test_app_start_fields(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "foo",
                        "sentry_tags": {
                            "ttid": "ttid",
                            "app_start_type": "cold",
                            "os.name": "Android",
                        },
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "foo",
                        "sentry_tags": {
                            "ttid": "ttid",
                            "app_start_type": "warm",
                            "os.name": "iOS",
                        },
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "foo",
                        "sentry_tags": {"app_start_type": "cold", "os.name": "Android"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["app_start_type", "ttid", "os.name"],
                "query": "has:ttid",
                "orderby": "app_start_type",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data[0]["app_start_type"] == "cold"
        assert data[0]["ttid"] == "ttid"
        assert data[0]["os.name"] == "Android"
        assert data[1]["app_start_type"] == "warm"
        assert data[1]["ttid"] == "ttid"
        assert data[1]["os.name"] == "iOS"

        assert meta["dataset"] == "spans"
        assert meta["dataset"] == "spans"

    def test_typed_attributes_with_colons(self) -> None:
        span = self.create_span(
            {
                "data": {
                    "flag.evaluation.feature.organizations:foo": True,
                },
            },
            start_ts=self.ten_mins_ago,
        )
        self.store_spans(
            [
                self.create_span(start_ts=self.ten_mins_ago),
                span,
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["tags[flag.evaluation.feature.organizations:foo,number]"],
                "query": "has:tags[flag.evaluation.feature.organizations:foo,number] tags[flag.evaluation.feature.organizations:foo,number]:1",
                "project": self.project.id,
                "dataset": "spans",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": span["span_id"],
                "project.name": self.project.slug,
                "tags[flag.evaluation.feature.organizations:foo,number]": 1,
            },
        ]

    def test_count_if_two_args(self):
        """count_if should have an operator"""
        self.store_spans(
            [
                self.create_span({"sentry_tags": {"release": "foo"}}),
                self.create_span(
                    {"sentry_tags": {"release": "bar"}},
                    duration=10,
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["count_if(release,foo)"],
                "query": "",
                "project": self.project.id,
                "dataset": "spans",
            }
        )
        assert response.status_code == 400, response.content

    def test_span_ops_breakdown(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "measurements": {"span_ops.ops.http": {"value": 100}},
                    },
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["spans.http"],
                "query": "",
                "project": self.project.id,
                "dataset": "spans",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]

        assert len(data) == 1
        assert data[0]["spans.http"] == 100
        assert meta["dataset"] == "spans"

    def test_special_characters(self) -> None:
        characters = "_.-"
        span = self.create_span(
            {"tags": {f"tag{c}": c for c in characters}},
            start_ts=self.ten_mins_ago,
        )
        self.store_spans(
            [
                span,
                self.create_span(start_ts=self.ten_mins_ago),
            ],
            is_eap=True,
        )

        for c in characters:
            response = self.do_request(
                {
                    "field": [f"tag{c}"],
                    "query": f"tag{c}:{c}",
                    "project": self.project.id,
                    "dataset": "spans",
                }
            )
            assert response.status_code == 200, response.content
            assert response.data["data"] == [
                {
                    "id": span["span_id"],
                    "project.name": self.project.slug,
                    f"tag{c}": c,
                }
            ]

    def test_ai_total_tokens_returns_integer_meta(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"data": {"ai_total_tokens_used": 100}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"data": {"ai_total_tokens_used": 50}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["sum(ai.total_tokens.used)"],
                "query": "",
                "project": self.project.id,
                "dataset": "spans",
            }
        )
        assert response.status_code == 200, response.content

        data, meta = response.data["data"], response.data["meta"]
        assert len(data) == 1
        assert data[0]["sum(ai.total_tokens.used)"] == 150
        assert meta["dataset"] == "spans"
        assert meta["fields"]["sum(ai.total_tokens.used)"] == "integer"

    def test_equation_simple(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "bar",
                        "sentry_tags": {"status": "invalid_argument"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        equation = "equation|count() * 2"
        response = self.do_request(
            {
                "field": ["span.status", "description", equation],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data == [
            {
                "span.status": "invalid_argument",
                "description": "bar",
                equation: 2,
            },
            {
                "span.status": "success",
                "description": "foo",
                equation: 2,
            },
        ]
        assert meta["dataset"] == "spans"
        assert meta["fields"][equation] == "number"

    def test_equation_with_orderby_using_same_alias(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "bar",
                        "sentry_tags": {"status": "invalid_argument"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        equation = "equation|count(span.duration)"
        response = self.do_request(
            {
                "field": ["count(span.duration)", equation],
                "query": "",
                "orderby": "count_span_duration",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data == [
            {
                "count(span.duration)": 2,
                equation: 2,
            },
        ]
        assert meta["dataset"] == "spans"
        assert meta["fields"][equation] == "integer"

    def test_equation_single_function_term(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "bar",
                        "sentry_tags": {"status": "invalid_argument"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        equation = "equation|count()"
        response = self.do_request(
            {
                "field": ["span.status", "description", equation],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data == [
            {
                "span.status": "invalid_argument",
                "description": "bar",
                equation: 1,
            },
            {
                "span.status": "success",
                "description": "foo",
                equation: 1,
            },
        ]
        assert meta["dataset"] == "spans"
        assert meta["fields"][equation] == "integer"

    def test_equation_single_field_term(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "foo",
                        "sentry_tags": {"status": "success"},
                        "measurements": {"lcp": {"value": 1}},
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "bar",
                        "sentry_tags": {"status": "success"},
                        "measurements": {"lcp": {"value": 1}},
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        equation = "equation|measurements.lcp"
        response = self.do_request(
            {
                "field": ["span.status", "description", equation, "count()"],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data == [
            {
                "span.status": "success",
                "description": "bar",
                "count()": 1,
                equation: 1,
            },
            {
                "span.status": "success",
                "description": "foo",
                "count()": 1,
                equation: 1,
            },
        ]
        assert meta["dataset"] == "spans"
        assert meta["fields"][equation] == "duration"

    def test_equation_single_literal(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "foo",
                        "sentry_tags": {"status": "success"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "bar",
                        "sentry_tags": {"status": "success"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        equation = "equation|3.14159"
        response = self.do_request(
            {
                "field": ["span.status", "description", equation, "count()"],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data == [
            {
                "span.status": "success",
                "description": "bar",
                "count()": 1,
                equation: 3.14159,
            },
            {
                "span.status": "success",
                "description": "foo",
                "count()": 1,
                equation: 3.14159,
            },
        ]
        assert meta["dataset"] == "spans"
        assert meta["fields"][equation] == "number"

    @pytest.mark.xfail(reason="Confidence isn't being returned by the RPC currently")
    def test_equation_with_extrapolation(self) -> None:
        """Extrapolation only changes the number when there's a sample rate"""
        spans = []
        spans.append(
            self.create_span(
                {
                    "description": "foo",
                    "sentry_tags": {"status": "success"},
                    "measurements": {"client_sample_rate": {"value": 0.1}},
                },
                start_ts=self.ten_mins_ago,
            )
        )
        spans.append(
            self.create_span(
                {
                    "description": "bar",
                    "sentry_tags": {"status": "success"},
                },
                start_ts=self.ten_mins_ago,
            )
        )
        self.store_spans(spans, is_eap=True)
        equation = "equation|count() * (2)"
        response = self.do_request(
            {
                "field": ["description", equation],
                "orderby": f"-{equation}",
                "query": "",
                "project": self.project.id,
                "dataset": "spans",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        confidence = meta["accuracy"]["confidence"]
        assert len(data) == 2
        assert len(confidence) == 2
        assert data[0][equation] == 20
        assert confidence[0][equation] == "low"
        assert data[1][equation] == 2
        assert confidence[1][equation] in ("high", "low")

    def test_equation_all_symbols(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "bar",
                        "sentry_tags": {"status": "invalid_argument"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        equation = "equation|count() * 2 + 2 - 2 / 2"
        response = self.do_request(
            {
                "field": ["span.status", "description", equation],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data == [
            {
                "span.status": "invalid_argument",
                "description": "bar",
                equation: 3,
            },
            {
                "span.status": "success",
                "description": "foo",
                equation: 3,
            },
        ]
        assert meta["dataset"] == "spans"
        assert meta["fields"][equation] == "number"

    def test_release(self) -> None:
        span1 = self.create_span(
            {
                "sentry_tags": {
                    "release": "1.0.8",
                    "environment": self.environment.name,
                },
            },
            start_ts=self.ten_mins_ago,
        )
        span2 = self.create_span(
            {
                "sentry_tags": {
                    "release": "1.0.9",
                    "environment": self.environment.name,
                },
            },
            start_ts=self.ten_mins_ago,
        )
        self.store_spans([span1, span2], is_eap=True)

        response = self.do_request(
            {
                "field": ["release"],
                "query": "release:1.0.8",
                "project": self.project.id,
                "environment": self.environment.name,
                "dataset": "spans",
                "orderby": "release",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": span1["span_id"],
                "project.name": self.project.slug,
                "release": "1.0.8",
            },
        ]

        response = self.do_request(
            {
                "field": ["release"],
                "query": "release:1*",
                "project": self.project.id,
                "dataset": "spans",
                "orderby": "release",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": span1["span_id"],
                "project.name": self.project.slug,
                "release": "1.0.8",
            },
            {
                "id": span2["span_id"],
                "project.name": self.project.slug,
                "release": "1.0.9",
            },
        ]

    def test_latest_release_alias(self) -> None:
        self.create_release(version="0.8")
        span1 = self.create_span({"sentry_tags": {"release": "0.8"}}, start_ts=self.ten_mins_ago)
        self.store_spans([span1], is_eap=True)

        response = self.do_request(
            {
                "field": ["release"],
                "query": "release:latest",
                "project": self.project.id,
                "dataset": "spans",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": span1["span_id"],
                "project.name": self.project.slug,
                "release": "0.8",
            }
        ]

        self.create_release(version="0.9")
        span2 = self.create_span({"sentry_tags": {"release": "0.9"}}, start_ts=self.ten_mins_ago)
        self.store_spans([span2], is_eap=True)

        response = self.do_request(
            {
                "field": ["release"],
                "query": "release:latest",
                "project": self.project.id,
                "dataset": "spans",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": span2["span_id"],
                "project.name": self.project.slug,
                "release": "0.9",
            }
        ]

    def test_release_stage(self) -> None:
        replaced_release = self.create_release(
            version="replaced_release",
            environments=[self.environment],
            adopted=now(),
            unadopted=now(),
        )
        adopted_release = self.create_release(
            version="adopted_release",
            environments=[self.environment],
            adopted=now(),
        )
        self.create_release(version="not_adopted_release", environments=[self.environment])

        adopted_span = self.create_span(
            {
                "sentry_tags": {
                    "environment": self.environment.name,
                    "release": adopted_release.version,
                },
            },
            start_ts=self.ten_mins_ago,
        )
        replaced_span = self.create_span(
            {
                "sentry_tags": {
                    "environment": self.environment.name,
                    "release": replaced_release.version,
                },
            },
            start_ts=self.ten_mins_ago,
        )
        self.store_spans([adopted_span, replaced_span], is_eap=True)

        request = {
            "field": ["release"],
            "project": self.project.id,
            "dataset": "spans",
            "orderby": "release",
            "environment": self.environment.name,
        }

        response = self.do_request({**request, "query": "release.stage:adopted"})
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": adopted_span["span_id"],
                "project.name": self.project.slug,
                "release": "adopted_release",
            },
        ]

        response = self.do_request({**request, "query": "!release.stage:low_adoption"})
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": adopted_span["span_id"],
                "project.name": self.project.slug,
                "release": "adopted_release",
            },
            {
                "id": replaced_span["span_id"],
                "project.name": self.project.slug,
                "release": "replaced_release",
            },
        ]

        response = self.do_request({**request, "query": "release.stage:[adopted,replaced]"})
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": adopted_span["span_id"],
                "project.name": self.project.slug,
                "release": "adopted_release",
            },
            {
                "id": replaced_span["span_id"],
                "project.name": self.project.slug,
                "release": "replaced_release",
            },
        ]

    def test_semver(self) -> None:
        release_1 = self.create_release(version="test@1.2.1")
        release_2 = self.create_release(version="test@1.2.2")
        release_3 = self.create_release(version="test@1.2.3")

        span1 = self.create_span(
            {"sentry_tags": {"release": release_1.version}}, start_ts=self.ten_mins_ago
        )
        span2 = self.create_span(
            {"sentry_tags": {"release": release_2.version}}, start_ts=self.ten_mins_ago
        )
        span3 = self.create_span(
            {"sentry_tags": {"release": release_3.version}}, start_ts=self.ten_mins_ago
        )
        self.store_spans([span1, span2, span3], is_eap=True)

        request = {
            "field": ["release"],
            "project": self.project.id,
            "dataset": "spans",
            "orderby": "release",
        }

        response = self.do_request({**request, "query": "release.version:>1.2.1"})
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": span2["span_id"],
                "project.name": self.project.slug,
                "release": "test@1.2.2",
            },
            {
                "id": span3["span_id"],
                "project.name": self.project.slug,
                "release": "test@1.2.3",
            },
        ]

        with mock.patch("sentry.search.eap.spans.filter_aliases.constants.MAX_SEARCH_RELEASES", 2):
            response = self.do_request({**request, "query": "release.version:>1.2.1"})
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": span2["span_id"],
                "project.name": self.project.slug,
                "release": "test@1.2.2",
            },
            {
                "id": span3["span_id"],
                "project.name": self.project.slug,
                "release": "test@1.2.3",
            },
        ]

        response = self.do_request({**request, "query": "release.version:>=1.2.1"})
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": span1["span_id"],
                "project.name": self.project.slug,
                "release": "test@1.2.1",
            },
            {
                "id": span2["span_id"],
                "project.name": self.project.slug,
                "release": "test@1.2.2",
            },
            {
                "id": span3["span_id"],
                "project.name": self.project.slug,
                "release": "test@1.2.3",
            },
        ]

        response = self.do_request({**request, "query": "release.version:<1.2.2"})
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": span1["span_id"],
                "project.name": self.project.slug,
                "release": "test@1.2.1",
            }
        ]

        response = self.do_request({**request, "query": "release.version:1.2.2"})
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": span2["span_id"],
                "project.name": self.project.slug,
                "release": "test@1.2.2",
            }
        ]

        response = self.do_request({**request, "query": "!release.version:1.2.2"})
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": span1["span_id"],
                "project.name": self.project.slug,
                "release": "test@1.2.1",
            },
            {
                "id": span3["span_id"],
                "project.name": self.project.slug,
                "release": "test@1.2.3",
            },
        ]

    def test_semver_package(self) -> None:
        release_1 = self.create_release(version="test1@1.2.1")
        release_2 = self.create_release(version="test2@1.2.1")

        span1 = self.create_span(
            {"sentry_tags": {"release": release_1.version}}, start_ts=self.ten_mins_ago
        )
        span2 = self.create_span(
            {"sentry_tags": {"release": release_2.version}}, start_ts=self.ten_mins_ago
        )
        self.store_spans([span1, span2], is_eap=True)

        request = {
            "field": ["release"],
            "project": self.project.id,
            "dataset": "spans",
            "orderby": "release",
        }

        response = self.do_request({**request, "query": "release.package:test1"})
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": span1["span_id"],
                "project.name": self.project.slug,
                "release": "test1@1.2.1",
            },
        ]

        response = self.do_request({**request, "query": "release.package:test2"})
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": span2["span_id"],
                "project.name": self.project.slug,
                "release": "test2@1.2.1",
            },
        ]

    def test_semver_build(self) -> None:
        release_1 = self.create_release(version="test@1.2.3+121")
        release_2 = self.create_release(version="test@1.2.3+122")

        span1 = self.create_span(
            {"sentry_tags": {"release": release_1.version}}, start_ts=self.ten_mins_ago
        )
        span2 = self.create_span(
            {"sentry_tags": {"release": release_2.version}}, start_ts=self.ten_mins_ago
        )
        self.store_spans([span1, span2], is_eap=True)

        request = {
            "field": ["release"],
            "project": self.project.id,
            "dataset": "spans",
            "orderby": "release",
        }

        response = self.do_request({**request, "query": "release.build:121"})
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": span1["span_id"],
                "project.name": self.project.slug,
                "release": "test@1.2.3+121",
            },
        ]

        response = self.do_request({**request, "query": "release.build:122"})
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": span2["span_id"],
                "project.name": self.project.slug,
                "release": "test@1.2.3+122",
            },
        ]

        response = self.do_request({**request, "query": "!release.build:121"})
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": span2["span_id"],
                "project.name": self.project.slug,
                "release": "test@1.2.3+122",
            },
        ]

    def test_file_extension(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"file_extension": "css"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"sentry_tags": {"file_extension": "js"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "file_extension",
                ],
                "orderby": "file_extension",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data[0]["file_extension"] == "css"
        assert data[1]["file_extension"] == "js"
        assert meta["dataset"] == "spans"

    def test_filter_timestamp(self) -> None:
        one_day_ago = before_now(days=1).replace(microsecond=0)
        three_days_ago = before_now(days=3).replace(microsecond=0)

        span1 = self.create_span({}, start_ts=one_day_ago)
        span2 = self.create_span({}, start_ts=three_days_ago)
        self.store_spans([span1, span2], is_eap=True)

        request = {
            "field": ["timestamp"],
            "project": self.project.id,
            "dataset": "spans",
        }

        response = self.do_request(
            {
                **request,
                "query": "timestamp:-2d",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": span1["span_id"],
                "project.name": self.project.slug,
                "timestamp": one_day_ago.isoformat(),
            },
        ]

        timestamp = before_now(days=2).isoformat()
        timestamp = timestamp.split("T", 2)[0]

        response = self.do_request(
            {
                **request,
                "query": f"timestamp:>{timestamp}",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": span1["span_id"],
                "project.name": self.project.slug,
                "timestamp": one_day_ago.isoformat(),
            },
        ]

        response = self.do_request(
            {
                **request,
                "query": f"timestamp:<{timestamp}",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": span2["span_id"],
                "project.name": self.project.slug,
                "timestamp": three_days_ago.isoformat(),
            },
        ]

    def test_tag_wildcards_with_in_filter(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "tags": {"foo": "bar"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "qux", "tags": {"foo": "qux"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "bux", "tags": {"foo": "bux"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "qar", "tags": {"foo": "qar"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["foo", "count()"],
                "query": "foo:[b*,*ux]",
                "project": self.project.id,
                "orderby": "foo",
                "dataset": "spans",
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 3
        assert response.data["data"] == [
            {"foo": "bar", "count()": 1},
            {"foo": "bux", "count()": 1},
            {"foo": "qux", "count()": 1},
        ]

    def test_tag_wildcards_with_not_in_filter(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "bar", "tags": {"foo": "bar"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "qux", "tags": {"foo": "qux"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "bux", "tags": {"foo": "bux"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "qar", "tags": {"foo": "qar"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["foo", "count()"],
                "query": "!foo:[ba*,*ux]",
                "project": self.project.id,
                "orderby": "foo",
                "dataset": "spans",
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"] == [
            {"foo": "qar", "count()": 1},
        ]

    def test_disable_extrapolation(self) -> None:
        spans = []
        spans.append(
            self.create_span(
                {
                    "description": "foo",
                    "sentry_tags": {"status": "success"},
                    "measurements": {"client_sample_rate": {"value": 0.1}},
                },
                start_ts=self.ten_mins_ago,
            )
        )
        spans.append(
            self.create_span(
                {
                    "description": "bar",
                    "sentry_tags": {"status": "success"},
                },
                start_ts=self.ten_mins_ago,
            )
        )
        self.store_spans(spans, is_eap=True)
        response = self.do_request(
            {
                "field": ["description", "count()"],
                "orderby": "-count()",
                "query": "",
                "project": self.project.id,
                "dataset": "spans",
                "disableAggregateExtrapolation": 1,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        confidence = meta["accuracy"]["confidence"]
        assert len(data) == 2
        assert len(confidence) == 2
        assert data[0]["count()"] == 1
        assert "count()" not in confidence[0]
        assert data[1]["count()"] == 1
        assert "count()" not in confidence[1]

    def test_failure_count(self) -> None:
        trace_statuses = ["ok", "cancelled", "unknown", "failure"]
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"status": status}},
                    start_ts=self.ten_mins_ago,
                )
                for status in trace_statuses
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": ["failure_count()"],
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["failure_count()"] == 1
        assert meta["dataset"] == "spans"
        assert meta["fields"]["failure_count()"] == "integer"
        assert meta["units"]["failure_count()"] is None

    def test_trace_id_glob(self) -> None:
        response = self.do_request(
            {
                "field": ["trace"],
                "project": self.project.id,
                "dataset": "spans",
                "query": "trace:test*",
                "orderby": "trace",
            }
        )
        assert response.status_code == 400, response.content
        assert response.data["detail"] == "test% is an invalid value for trace"

    def test_short_trace_id_filter(self) -> None:
        trace_ids = [
            "0" * 32,
            ("7" * 31) + "0",
            "7" * 32,
            ("7" * 31) + "f",
            "f" * 32,
        ]
        self.store_spans(
            [
                self.create_span(
                    {"trace_id": trace_id},
                    start_ts=self.ten_mins_ago,
                )
                for trace_id in trace_ids
            ],
            is_eap=True,
        )

        for i in range(8, 32):
            response = self.do_request(
                {
                    "field": ["trace"],
                    "project": self.project.id,
                    "dataset": "spans",
                    "query": f"trace:{'7' * i}",
                    "orderby": "trace",
                }
            )

            assert response.status_code == 200, response.content
            data = response.data["data"]
            assert len(data) == 3
            assert {row["trace"] for row in data} == {
                ("7" * 31) + "0",
                "7" * 32,
                ("7" * 31) + "f",
            }

    def test_eps(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["description", "eps()"],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data == [
            {
                "description": "foo",
                "eps()": 1 / (90 * 24 * 60 * 60),
            },
        ]
        assert meta["dataset"] == "spans"
        assert meta["units"] == {"description": None, "eps()": "1/second"}
        assert meta["fields"] == {"description": "string", "eps()": "rate"}

    def test_count_if_span_status(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "bar",
                        "sentry_tags": {"status": "invalid_argument"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["count_if(span.status,equals,success)"],
                "query": "",
                "orderby": "count_if(span.status,equals,success)",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data == [
            {
                "count_if(span.status,equals,success)": 1,
            },
        ]
        assert meta["dataset"] == "spans"
        assert meta["fields"]["count_if(span.status,equals,success)"] == "integer"
        assert meta["units"]["count_if(span.status,equals,success)"] is None

    def test_count_if_span_status_equation_quoted(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "bar",
                        "sentry_tags": {"status": ""},
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        equation = 'equation|count_if(span.status,equals,"success")'
        response = self.do_request(
            {
                "field": [equation],
                "query": "",
                "orderby": equation,
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content

        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data == [
            {
                equation: 1.0,
            },
        ]
        assert meta["dataset"] == "spans"
        assert meta["fields"][equation] == "integer"
        assert meta["units"][equation] is None

        equation = 'equation|count_if(span.status,equals,"")'
        response = self.do_request(
            {
                "field": [equation],
                "query": "",
                "orderby": equation,
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content

        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data == [
            {
                equation: 1.0,
            },
        ]
        assert meta["dataset"] == "spans"
        assert meta["fields"][equation] == "integer"
        assert meta["units"][equation] is None

    def test_count_if_numeric(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                    duration=400,
                ),
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                    duration=400,
                ),
                self.create_span(
                    {
                        "description": "bar",
                        "sentry_tags": {"status": "invalid_argument"},
                    },
                    start_ts=self.ten_mins_ago,
                    duration=200,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["count_if(span.duration,greater,300)"],
                "query": "",
                "orderby": "count_if(span.duration,greater,300)",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data == [
            {
                "count_if(span.duration,greater,300)": 2,
            },
        ]
        assert meta["dataset"] == "spans"

    def test_count_if_numeric_raises_invalid_search_query_with_bad_value(self) -> None:
        response = self.do_request(
            {
                "field": ["count_if(span.duration,greater,three)"],
                "query": "",
                "orderby": "count_if(span.duration,greater,three)",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 400, response.content
        assert "Invalid Parameter " in response.data["detail"].title()

    def test_count_if_integer(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo"},
                    measurements={"gen_ai.usage.total_tokens": {"value": 100}},
                    start_ts=self.ten_mins_ago,
                    duration=400,
                ),
                self.create_span(
                    {"description": "bar"},
                    measurements={"gen_ai.usage.total_tokens": {"value": 200}},
                    start_ts=self.ten_mins_ago,
                    duration=400,
                ),
                self.create_span(
                    {"description": "baz"},
                    measurements={"gen_ai.usage.total_tokens": {"value": 300}},
                    start_ts=self.ten_mins_ago,
                    duration=200,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["count_if(gen_ai.usage.total_tokens,greater,200)"],
                "query": "",
                "orderby": "count_if(gen_ai.usage.total_tokens,greater,200)",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data == [
            {
                "count_if(gen_ai.usage.total_tokens,greater,200)": 1,
            },
        ]
        assert meta["dataset"] == "spans"

    def test_apdex_function(self) -> None:
        """Test the apdex function with span.duration and threshold."""
        # Create spans with different durations to test apdex calculation
        # Threshold = 1000ms (1 second)
        # Satisfactory: ≤ 1000ms
        # Tolerable: > 1000ms and ≤ 4000ms
        # Frustrated: > 4000ms
        spans = [
            # Satisfactory spans (≤ 1000ms)
            self.create_span(
                {"description": "http.server", "is_segment": True},
                start_ts=self.ten_mins_ago,
                duration=500,  # 500ms - satisfactory
            ),
            self.create_span(
                {"description": "http.server", "is_segment": True},
                start_ts=self.ten_mins_ago,
                duration=1000,  # 1000ms - satisfactory (at threshold)
            ),
            # Tolerable spans (> 1000ms and ≤ 4000ms)
            self.create_span(
                {"description": "http.server", "is_segment": True},
                start_ts=self.ten_mins_ago,
                duration=2000,  # 2000ms - tolerable
            ),
            self.create_span(
                {"description": "http.server", "is_segment": True},
                start_ts=self.ten_mins_ago,
                duration=4000,  # 4000ms - tolerable (at 4T)
            ),
            # Frustrated spans (> 4000ms)
            self.create_span(
                {"description": "http.server", "is_segment": True},
                start_ts=self.ten_mins_ago,
                duration=5000,  # 5000ms - frustrated
            ),
            # Non-segment span
            self.create_span(
                {"description": "http.server", "is_segment": False},
                start_ts=self.ten_mins_ago,
                duration=5000,  # 5000ms - frustrated
            ),
        ]
        self.store_spans(spans, is_eap=True)

        response = self.do_request(
            {
                "field": ["apdex(span.duration,1000)"],
                "query": "",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]

        # Expected apdex calculation:
        # Satisfactory: 2 spans (500ms, 1000ms)
        # Tolerable: 2 spans (2000ms, 4000ms)
        # Frustrated: 1 span (5000ms)
        # Total: 5 spans
        # Apdex = (2 + 2/2) / 5 = (2 + 1) / 5 = 3/5 = 0.6
        expected_apdex = 0.6

        assert len(data) == 1
        assert data[0]["apdex(span.duration,1000)"] == expected_apdex
        assert meta["dataset"] == "spans"
        assert meta["fields"] == {"apdex(span.duration,1000)": "number"}

    def test_apdex_function_with_filter(self) -> None:
        """Test the apdex function with filtering."""
        # Create spans with different descriptions and durations
        # Only segments (transactions) will be counted in apdex calculation
        spans = [
            # Satisfactory spans for "api" operations (segments)
            self.create_span(
                {
                    "description": "http.server",
                    "sentry_tags": {"status": "success"},
                    "is_segment": True,
                },
                start_ts=self.ten_mins_ago,
                duration=500,
            ),
            self.create_span(
                {
                    "description": "http.server",
                    "sentry_tags": {"status": "success"},
                    "is_segment": True,
                },
                start_ts=self.ten_mins_ago,
                duration=800,
            ),
            # Tolerable span for "api" operations (segment)
            self.create_span(
                {
                    "description": "http.server",
                    "sentry_tags": {"status": "success"},
                    "is_segment": True,
                },
                start_ts=self.ten_mins_ago,
                duration=2000,
            ),
            # Frustrated span for "api" operations (segment)
            self.create_span(
                {
                    "description": "http.server",
                    "sentry_tags": {"status": "success"},
                    "is_segment": True,
                },
                start_ts=self.ten_mins_ago,
                duration=5000,
            ),
            # Other spans that should be filtered out
            self.create_span(
                {
                    "description": "task",
                    "sentry_tags": {"status": "success"},
                    "is_segment": True,
                },
                start_ts=self.ten_mins_ago,
                duration=100,
            ),
        ]
        self.store_spans(spans, is_eap=True)

        response = self.do_request(
            {
                "field": ["apdex(span.duration,1000)"],
                "query": "description:http.server",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]

        # Expected apdex calculation for filtered results:
        # Only segments (transactions) are counted in apdex
        # Satisfactory: 2 spans (500ms, 800ms) - both are segments
        # Tolerable: 1 span (2000ms) - is a segment
        # Frustrated: 1 span (5000ms) - is a segment
        # Total: 4 spans (all segments)
        # Apdex = (2 + 1/2) / 4 = (2 + 0.5) / 4 = 2.5/4 = 0.625
        expected_apdex = 0.625

        assert len(data) == 1
        assert data[0]["apdex(span.duration,1000)"] == expected_apdex

    def test_user_misery_function(self) -> None:
        """Test the user_misery function with span.duration and threshold."""
        # Create spans with different durations and users to test user misery calculation
        # Threshold = 1000ms (1 second)
        # Miserable threshold = 4000ms (4x threshold)
        # Users are considered miserable when response time > 4000ms
        spans = [
            # Happy users (≤ 4000ms) - segments
            self.create_span(
                {
                    "description": "http.server",
                    "sentry_tags": {"user": "user1"},
                    "is_segment": True,
                },
                start_ts=self.ten_mins_ago,
                duration=500,  # 500ms - happy
            ),
            self.create_span(
                {
                    "description": "http.server",
                    "sentry_tags": {"user": "user2"},
                    "is_segment": True,
                },
                start_ts=self.ten_mins_ago,
                duration=2000,  # 2000ms - happy
            ),
            self.create_span(
                {
                    "description": "http.server",
                    "sentry_tags": {"user": "user3"},
                    "is_segment": True,
                },
                start_ts=self.ten_mins_ago,
                duration=4000,  # 4000ms - happy (at 4T)
            ),
            # Miserable users (> 4000ms) - segments
            self.create_span(
                {
                    "description": "http.server",
                    "sentry_tags": {"user": "user4"},
                    "is_segment": True,
                },
                start_ts=self.ten_mins_ago,
                duration=5000,  # 5000ms - miserable
            ),
            self.create_span(
                {
                    "description": "http.server",
                    "sentry_tags": {"user": "user2"},
                    "is_segment": True,
                },
                start_ts=self.ten_mins_ago,
                duration=6000,  # 6000ms - miserable
            ),
            # Non-segment span (should not be counted)
            self.create_span(
                {
                    "description": "http.server",
                    "sentry_tags": {"user": "user5"},
                    "is_segment": False,
                },
                start_ts=self.ten_mins_ago,
                duration=5000,  # 5000ms - miserable but not a segment
            ),
        ]
        self.store_spans(spans, is_eap=True)

        response = self.do_request(
            {
                "field": ["user_misery(span.duration,1000)"],
                "query": "",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]

        # Expected user misery calculation:
        # Miserable users: 2 (user4, user2) - both are segments
        # Total unique users: 5 (user1, user2, user3, user4) - all segments
        # MISERY_ALPHA = 5.8875, MISERY_BETA = 111.8625
        # User Misery = (2 + 5.8875) / (5 + 5.8875 + 111.8625) = 7.8875 / 122.75 ≈ 0.0643
        expected_user_misery = (2 + 5.8875) / (4 + 5.8875 + 111.8625)

        assert len(data) == 1
        assert data[0]["user_misery(span.duration,1000)"] == pytest.approx(
            expected_user_misery, rel=1e-3
        )
        assert meta["dataset"] == "spans"
        assert meta["fields"] == {"user_misery(span.duration,1000)": "number"}

    def test_user_misery_function_with_filter(self) -> None:
        """Test the user_misery function with filtering."""
        # Create spans with different descriptions, durations, and users
        # Only segments (transactions) will be counted in user misery calculation
        spans = [
            # Happy users for "api" operations (segments)
            self.create_span(
                {
                    "description": "http.server",
                    "sentry_tags": {"user": "user1", "status": "success"},
                    "is_segment": True,
                },
                start_ts=self.ten_mins_ago,
                duration=500,
            ),
            self.create_span(
                {
                    "description": "http.server",
                    "sentry_tags": {"user": "user2", "status": "success"},
                    "is_segment": True,
                },
                start_ts=self.ten_mins_ago,
                duration=2000,
            ),
            # Miserable user for "api" operations (segment)
            self.create_span(
                {
                    "description": "http.server",
                    "sentry_tags": {"user": "user3", "status": "success"},
                    "is_segment": True,
                },
                start_ts=self.ten_mins_ago,
                duration=5000,
            ),
            # Other spans that should be filtered out
            self.create_span(
                {
                    "description": "task",
                    "sentry_tags": {"user": "user4", "status": "success"},
                    "is_segment": True,
                },
                start_ts=self.ten_mins_ago,
                duration=100,
            ),
        ]
        self.store_spans(spans, is_eap=True)

        response = self.do_request(
            {
                "field": ["user_misery(span.duration,1000)"],
                "query": "description:http.server",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]

        # Expected user misery calculation for filtered results:
        # Only segments (transactions) are counted in user misery
        # Miserable users: 1 (user3) - is a segment
        # Total unique users: 3 (user1, user2, user3) - all segments
        # MISERY_ALPHA = 5.8875, MISERY_BETA = 111.8625
        # User Misery = (1 + 5.8875) / (3 + 5.8875 + 111.8625) = 6.8875 / 120.75 ≈ 0.0570
        expected_user_misery = (1 + 5.8875) / (3 + 5.8875 + 111.8625)

        assert len(data) == 1
        assert data[0]["user_misery(span.duration,1000)"] == pytest.approx(
            expected_user_misery, rel=1e-3
        )

    def test_link_field_fails(self) -> None:
        response = self.do_request(
            {
                "field": ["span.status", "description", "count()"],
                "query": "sentry.links:foo",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 400, response.content
        response = self.do_request(
            {
                "field": ["sentry.links", "description", "count()"],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 400, response.content

    def test_formula_filtering(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "sentry_tags": {"transaction": "transactionA", "browser.name": "Chrome"},
                        "measurements": {
                            "frames.total": {"value": 100},
                            "frames.frozen": {"value": 70},
                        },
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "sentry_tags": {"transaction": "transactionA", "browser.name": "Chrome"},
                        "measurements": {
                            "frames.total": {"value": 100},
                            "frames.frozen": {"value": 70},
                        },
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "sentry_tags": {"transaction": "transactionB", "browser.name": "Chrome"},
                        "measurements": {
                            "frames.total": {"value": 100},
                            "frames.frozen": {"value": 20},
                        },
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(
            {
                "field": [
                    "division_if(mobile.frozen_frames,mobile.total_frames,browser.name,equals,Chrome)",
                    "transaction",
                ],
                "query": "division_if(mobile.frozen_frames,mobile.total_frames,browser.name,equals,Chrome):>0.5",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert (
            data[0][
                "division_if(mobile.frozen_frames,mobile.total_frames,browser.name,equals,Chrome)"
            ]
            == 0.7
        )
        assert data[0]["transaction"] == "transactionA"
        assert meta["dataset"] == "spans"

    @pytest.mark.xfail(
        reason="https://linear.app/getsentry/issue/EAP-255/aggregationcomparisonfilter-does-not-work-with-binaryformula"
    )
    def test_formula_filtering_attribute_aggregation_only(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"status": "ok", "transaction": "transactionA"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"sentry_tags": {"status": "failure", "transaction": "transactionA"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"sentry_tags": {"status": "ok", "transaction": "transactionB"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
        )

        response = self.do_request(
            {
                "field": ["failure_rate()", "transaction"],
                "query": "failure_rate():>0.4",
                "project": self.project.id,
                "dataset": "spans",
            }
        )

        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["failure_rate()"] == 0.5
        assert data[0]["transaction"] == "transactionA"
        assert meta["dataset"] == "spans"

    def test_project_filter(self) -> None:
        project2 = self.create_project()
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "bar",
                        "sentry_tags": {"status": "invalid_argument"},
                    },
                    project=project2,
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["project", "description", "count()"],
                "query": f"project:[{self.project.slug}, {project2.slug}]",
                "orderby": "description",
                "project": [self.project.id, project2.id],
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data == [
            {
                "project": project2.slug,
                "description": "bar",
                "count()": 1,
            },
            {
                "project": self.project.slug,
                "description": "foo",
                "count()": 1,
            },
        ]
        assert meta["dataset"] == "spans"

        response = self.do_request(
            {
                "field": ["project", "description", "count()"],
                "query": f"project:{self.project.slug}",
                "orderby": "description",
                "project": [self.project.id, project2.id],
                "dataset": "spans",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data == [
            {
                "project": self.project.slug,
                "description": "foo",
                "count()": 1,
            },
        ]
        assert meta["dataset"] == "spans"

    def test_non_org_project_filter(self):
        organization2 = self.create_organization()
        project2 = self.create_project(organization=organization2)
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "bar",
                        "sentry_tags": {"status": "invalid_argument"},
                    },
                    project=project2,
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        response = self.do_request(
            {
                "field": ["project", "description", "count()"],
                "query": f"project:[{project2.slug}]",
                "orderby": "description",
                "project": [self.project.id],
                "dataset": "spans",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 0
        assert data == []
        assert meta["dataset"] == "spans"

        response = self.do_request(
            {
                "field": ["project", "description", "count()"],
                "query": f"project.id:[{project2.id}]",
                "orderby": "description",
                "project": [self.project.id],
                "dataset": "spans",
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 0
        assert data == []
        assert meta["dataset"] == "spans"

    def test_count_span_duration(self):
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )
        request = {
            "field": ["count(span.duration)"],
            "project": self.project.id,
            "dataset": "spans",
            "statsPeriod": "1h",
        }

        response = self.do_request(request)
        assert response.status_code == 200
        assert response.data["data"] == [{"count(span.duration)": 1}]

    def test_wildcard_operator_with_backslash(self):
        span = self.create_span({"description": r"foo\bar"}, start_ts=self.ten_mins_ago)
        self.store_spans([span], is_eap=True)
        base_request = {
            "field": ["project.name", "id"],
            "project": self.project.id,
            "dataset": "spans",
            "statsPeriod": "1h",
        }

        response = self.do_request({**base_request, "query": r"span.description:foo\bar"})
        assert response.status_code == 200, response.data
        assert response.data["data"] == [{"project.name": self.project.slug, "id": span["span_id"]}]

        response = self.do_request({**base_request, "query": r"span.description:*foo\\bar*"})
        assert response.status_code == 200, response.data
        assert response.data["data"] == [{"project.name": self.project.slug, "id": span["span_id"]}]

        response = self.do_request(
            {**base_request, "query": "span.description:\uf00dContains\uf00dfoo\\bar"}
        )
        assert response.status_code == 200, response.data
        assert response.data["data"] == [{"project.name": self.project.slug, "id": span["span_id"]}]

        response = self.do_request(
            {**base_request, "query": "span.description:\uf00dStartsWith\uf00dfoo\\bar"}
        )
        assert response.status_code == 200, response.data
        assert response.data["data"] == [{"project.name": self.project.slug, "id": span["span_id"]}]

        response = self.do_request(
            {**base_request, "query": "span.description:\uf00dEndsWith\uf00dfoo\\bar"}
        )
        assert response.status_code == 200, response.data
        assert response.data["data"] == [{"project.name": self.project.slug, "id": span["span_id"]}]

    def test_in_query_matches_is_query_with_truncated_strings(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo *"},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=True,
        )

        is_query = self.do_request(
            {
                "field": ["span.description"],
                "query": 'span.description:"foo \\*"',
                "project": self.project.id,
                "dataset": "spans",
            }
        )
        assert is_query.status_code == 200, is_query.content

        in_query = self.do_request(
            {
                "field": ["span.description"],
                "query": 'span.description:["foo \\*"]',
                "project": self.project.id,
                "dataset": "spans",
            }
        )
        assert in_query.status_code == 200, in_query.content
        assert is_query.data["data"] == in_query.data["data"]

    def test_in_query_with_numeric_values(self) -> None:
        span1 = self.create_span(
            {"data": {"ai_total_tokens_used": 100}},
            start_ts=self.ten_mins_ago,
        )
        span2 = self.create_span(
            {"data": {"ai_total_tokens_used": 200}},
            start_ts=self.ten_mins_ago,
        )
        span3 = self.create_span(
            {"data": {"ai_total_tokens_used": 300}},
            start_ts=self.ten_mins_ago,
        )

        self.store_spans([span1, span2, span3], is_eap=True)

        in_query = self.do_request(
            {
                "field": ["id", "ai.total_tokens.used"],
                "query": "ai.total_tokens.used:[100, 200]",
                "project": self.project.id,
                "dataset": "spans",
            }
        )
        assert in_query.status_code == 200, in_query.content
        assert len(in_query.data["data"]) == 2

        returned_ids = {row["id"] for row in in_query.data["data"]}
        assert returned_ids == {span1["span_id"], span2["span_id"]}

        assert span3["span_id"] not in returned_ids

    def test_no_project_sent_spans(self):
        project1 = self.create_project(flags=0)
        project2 = self.create_project(flags=0)

        request = {
            "field": ["timestamp", "span.description"],
            "project": [project1.id, project2.id],
            "dataset": "spans",
            "sort": "-timestamp",
            "statsPeriod": "1h",
        }

        response = self.do_request(request)
        assert response.status_code == 200
        assert response.data["data"] == []

    @mock.patch("sentry.utils.snuba_rpc.table_rpc", wraps=table_rpc)
    def test_sent_spans_project_optimization(self, mock_table_rpc):
        project1 = self.create_project(flags=0)
        project2 = self.create_project(flags=0)

        spans = [
            self.create_span({"description": "foo"}, project=project1, start_ts=self.ten_mins_ago),
        ]
        self.store_spans(spans, is_eap=True)

        response = self.do_request(
            {
                "field": [
                    "timestamp",
                    "span.description",
                ],
                "dataset": "spans",
                "project": [project1.id, project2.id],
            }
        )
        assert response.status_code == 200
        assert response.data["data"] == [
            {
                "id": mock.ANY,
                "timestamp": mock.ANY,
                "span.description": "foo",
                "project.name": project1.slug,
            }
        ]

        mock_table_rpc.assert_called_once()
        assert mock_table_rpc.call_args.args[0][0].meta.project_ids == [project1.id]

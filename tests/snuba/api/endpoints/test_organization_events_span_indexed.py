import uuid
from datetime import datetime, timezone
from unittest import mock

import pytest
import urllib3

from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationEventsSpanIndexedEndpointTest(OrganizationEventsEndpointTestBase):
    is_eap = False
    use_rpc = False
    """Test the indexed spans dataset.

    To run this locally you may need to set the ENABLE_SPANS_CONSUMER flag to True in Snuba.
    A way to do this is
    1. run: `sentry devservices down snuba`
    2. clone snuba locally
    3. run: `export ENABLE_SPANS_CONSUMER=True`
    4. run snuba
    At this point tests should work locally

    Once span ingestion is on by default this will no longer need to be done
    """

    @property
    def dataset(self):
        if self.is_eap:
            return "spans"
        else:
            return "spansIndexed"

    def do_request(self, query, features=None, **kwargs):
        query["useRpc"] = "1" if self.use_rpc else "0"
        return super().do_request(query, features, **kwargs)

    def setUp(self):
        super().setUp()
        self.features = {
            "organizations:starfish-view": True,
        }

    @pytest.mark.querybuilder
    def test_simple(self):
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "bar", "sentry_tags": {"status": "invalid_argument"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=self.is_eap,
        )
        response = self.do_request(
            {
                "field": ["span.status", "description", "count()"],
                "query": "",
                "orderby": "description",
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
                "span.status": "invalid_argument",
                "description": "bar",
                "count()": 1,
            },
            {
                "span.status": "ok",
                "description": "foo",
                "count()": 1,
            },
        ]
        assert meta["dataset"] == self.dataset

    def test_spm(self):
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=self.is_eap,
        )
        response = self.do_request(
            {
                "field": ["description", "spm()"],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": self.dataset,
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
        assert meta["dataset"] == self.dataset

    def test_id_fields(self):
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "bar", "sentry_tags": {"status": "invalid_argument"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=self.is_eap,
        )
        response = self.do_request(
            {
                "field": ["id", "span_id"],
                "query": "",
                "orderby": "id",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        for obj in data:
            assert obj["id"] == obj["span_id"]
        assert meta["dataset"] == self.dataset

    def test_sentry_tags_vs_tags(self):
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"transaction.method": "foo"}}, start_ts=self.ten_mins_ago
                ),
            ],
            is_eap=self.is_eap,
        )
        response = self.do_request(
            {
                "field": ["transaction.method", "count()"],
                "query": "",
                "orderby": "count()",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["transaction.method"] == "foo"
        assert meta["dataset"] == self.dataset

    def test_sentry_tags_syntax(self):
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"transaction.method": "foo"}}, start_ts=self.ten_mins_ago
                ),
            ],
            is_eap=self.is_eap,
        )
        response = self.do_request(
            {
                "field": ["sentry_tags[transaction.method]", "count()"],
                "query": "",
                "orderby": "count()",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["sentry_tags[transaction.method]"] == "foo"
        assert meta["dataset"] == self.dataset

    def test_module_alias(self):
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
            is_eap=self.is_eap,
        )

        response = self.do_request(
            {
                "field": ["span.module", "span.description"],
                "query": "span.module:cache",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["span.module"] == "cache"
        assert data[0]["span.description"] == "EXEC *"
        assert meta["dataset"] == self.dataset

    def test_device_class_filter_unknown(self):
        self.store_spans(
            [
                self.create_span({"sentry_tags": {"device.class": ""}}, start_ts=self.ten_mins_ago),
            ],
            is_eap=self.is_eap,
        )
        response = self.do_request(
            {
                "field": ["device.class", "count()"],
                "query": "device.class:Unknown",
                "orderby": "count()",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["device.class"] == "Unknown"
        assert meta["dataset"] == self.dataset

    def test_span_module(self):
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
            is_eap=self.is_eap,
        )

        response = self.do_request(
            {
                "field": ["span.module", "count()"],
                "query": "",
                "orderby": "-count()",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data[0]["span.module"] == "other"
        assert data[1]["span.module"] == "http"
        assert meta["dataset"] == self.dataset

    def test_network_span(self):
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
            is_eap=self.is_eap,
        )

        response = self.do_request(
            {
                "field": ["span.op", "span.status_code"],
                "query": "span.status_code:200",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["span.op"] == "http.client"
        assert data[0]["span.status_code"] == "200"
        assert meta["dataset"] == self.dataset

    def test_other_category_span(self):
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
            is_eap=self.is_eap,
        )

        response = self.do_request(
            {
                "field": ["span.op", "span.status_code"],
                "query": "span.module:other span.status_code:200",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["span.op"] == "alternative"
        assert data[0]["span.status_code"] == "200"
        assert meta["dataset"] == self.dataset

    def test_inp_span(self):
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
            is_eap=self.is_eap,
        )
        response = self.do_request(
            {
                "field": ["replay.id", "browser.name", "origin.transaction", "count()"],
                "query": f"replay.id:{replay_id} AND browser.name:Chrome AND origin.transaction:/pageloads/",
                "orderby": "count()",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["replay.id"] == replay_id
        assert data[0]["browser.name"] == "Chrome"
        assert data[0]["origin.transaction"] == "/pageloads/"
        assert meta["dataset"] == self.dataset

    def test_id_filtering(self):
        span = self.create_span({"description": "foo"}, start_ts=self.ten_mins_ago)
        self.store_span(span, is_eap=self.is_eap)
        response = self.do_request(
            {
                "field": ["description", "count()"],
                "query": f"id:{span['span_id']}",
                "orderby": "description",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["description"] == "foo"
        assert meta["dataset"] == self.dataset

        response = self.do_request(
            {
                "field": ["description", "count()"],
                "query": f"transaction.id:{span['event_id']}",
                "orderby": "description",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["description"] == "foo"
        assert meta["dataset"] == self.dataset

    def test_span_op_casing(self):
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
            is_eap=self.is_eap,
        )
        response = self.do_request(
            {
                "field": ["span.op", "count()"],
                "query": 'span.op:"ThIs Is a TraNSActiON"',
                "orderby": "count()",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["span.op"] == "this is a transaction"
        assert meta["dataset"] == self.dataset

    def test_queue_span(self):
        self.store_spans(
            [
                self.create_span(
                    {
                        "measurements": {
                            "messaging.message.body.size": {"value": 1024, "unit": "byte"},
                            "messaging.message.receive.latency": {
                                "value": 1000,
                                "unit": "millisecond",
                            },
                            "messaging.message.retry.count": {"value": 2, "unit": "none"},
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
            is_eap=self.is_eap,
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
                "dataset": self.dataset,
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
        assert meta["dataset"] == self.dataset

    def test_tag_wildcards(self):
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "tags": {"foo": "BaR"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "qux", "tags": {"foo": "QuX"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=self.is_eap,
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
                    "dataset": self.dataset,
                }
            )
            assert response.status_code == 200, response.content
            assert response.data["data"] == [{"foo": "BaR", "count()": 1}]

    def test_query_for_missing_tag(self):
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
            is_eap=self.is_eap,
        )

        response = self.do_request(
            {
                "field": ["foo", "count()"],
                "query": 'foo:""',
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [{"foo": "", "count()": 1}]

    def test_count_field_type(self):
        response = self.do_request(
            {
                "field": ["count()"],
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["meta"]["fields"] == {"count()": "integer"}
        assert response.data["meta"]["units"] == {"count()": None}
        assert response.data["data"] == [{"count()": 0}]

    def test_simple_measurements(self):
        keys = [
            ("app_start_cold", "duration", "millisecond"),
            ("app_start_warm", "duration", "millisecond"),
            ("frames_frozen", "number", None),  # should be integer but keeping it consistent
            ("frames_frozen_rate", "percentage", None),
            ("frames_slow", "number", None),  # should be integer but keeping it consistent
            ("frames_slow_rate", "percentage", None),
            ("frames_total", "number", None),  # should be integer but keeping it consistent
            ("time_to_initial_display", "duration", "millisecond"),
            ("time_to_full_display", "duration", "millisecond"),
            ("stall_count", "number", None),  # should be integer but keeping it consistent
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
            ("cache.item_size", "number", None),
            ("messaging.message.body.size", "number", None),
            ("messaging.message.receive.latency", "number", None),
            ("messaging.message.retry.count", "number", None),
        ]

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
            is_eap=self.is_eap,
        )

        for i, (k, type, unit) in enumerate(keys):
            key = f"measurements.{k}"
            response = self.do_request(
                {
                    "field": [key],
                    "query": "description:foo",
                    "project": self.project.id,
                    "dataset": self.dataset,
                }
            )
            assert response.status_code == 200, response.content
            assert response.data["meta"] == {
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
            assert response.data["data"] == [
                {
                    key: pytest.approx((i + 1) / 10),
                    "id": mock.ANY,
                    "project.name": self.project.slug,
                }
            ]

    def test_environment(self):
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
            is_eap=self.is_eap,
        )
        response = self.do_request(
            {
                "field": ["environment", "count()"],
                "project": self.project.id,
                "environment": "prod",
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {"environment": "prod", "count()": 1},
        ]

    def test_transaction(self):
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"transaction": "bar"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=self.is_eap,
        )
        response = self.do_request(
            {
                "field": ["description", "count()"],
                "query": "transaction:bar",
                "orderby": "description",
                "project": self.project.id,
                "dataset": self.dataset,
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
        assert meta["dataset"] == self.dataset

    def test_orderby_alias(self):
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "bar", "sentry_tags": {"status": "invalid_argument"}},
                    duration=2000,
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=self.is_eap,
        )
        response = self.do_request(
            {
                "field": ["span.description", "sum(span.self_time)"],
                "query": "",
                "orderby": "sum_span_self_time",
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
                "span.description": "foo",
                "sum(span.self_time)": 1000,
            },
            {
                "span.description": "bar",
                "sum(span.self_time)": 2000,
            },
        ]
        assert meta["dataset"] == self.dataset

    @pytest.mark.querybuilder
    def test_explore_sample_query(self):
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
            is_eap=self.is_eap,
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
                # This is to skip INP spans
                "query": "!transaction.span_id:00",
                "orderby": "timestamp",
                "statsPeriod": "1h",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        for source, result in zip(spans, data):
            assert result["id"] == source["span_id"], "id"
            assert result["span.duration"] == 1000.0, "duration"
            assert result["span.op"] == "", "op"
            assert result["span.description"] == source["description"], "description"
            ts = datetime.fromisoformat(result["timestamp"])
            assert ts.tzinfo == timezone.utc
            assert ts.timestamp() == pytest.approx(
                source["end_timestamp_precise"], abs=5
            ), "timestamp"
            assert result["transaction.span_id"] == source["segment_id"], "transaction.span_id"
            assert result["project"] == result["project.name"] == self.project.slug, "project"
        assert meta["dataset"] == self.dataset

    def test_span_status(self):
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "internal_error"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=self.is_eap,
        )
        response = self.do_request(
            {
                "field": ["description", "count()"],
                "query": "span.status:internal_error",
                "orderby": "description",
                "project": self.project.id,
                "dataset": self.dataset,
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
        assert meta["dataset"] == self.dataset

    def test_handle_nans_from_snuba(self):
        self.store_spans(
            [self.create_span({"description": "foo"}, start_ts=self.ten_mins_ago)],
            is_eap=self.is_eap,
        )

        response = self.do_request(
            {
                "field": ["description", "count()"],
                "query": "span.status:internal_error",
                "orderby": "description",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content

    def test_in_filter(self):
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
            is_eap=self.is_eap,
        )
        response = self.do_request(
            {
                "field": ["transaction", "count()"],
                "query": "transaction:[bar, baz]",
                "orderby": "transaction",
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
                "transaction": "bar",
                "count()": 1,
            },
            {
                "transaction": "baz",
                "count()": 1,
            },
        ]
        assert meta["dataset"] == self.dataset


class OrganizationEventsEAPSpanEndpointTest(OrganizationEventsSpanIndexedEndpointTest):
    is_eap = True
    use_rpc = False

    def test_simple(self):
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success"}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "bar", "sentry_tags": {"status": "invalid_argument"}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=self.is_eap,
        )
        response = self.do_request(
            {
                "field": ["span.status", "description", "count()"],
                "query": "",
                "orderby": "description",
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
        assert meta["dataset"] == self.dataset

    @pytest.mark.xfail(reason="event_id isn't being written to the new table")
    def test_id_filtering(self):
        super().test_id_filtering()

    def test_span_duration(self):
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
        self.store_spans(spans, is_eap=self.is_eap)
        response = self.do_request(
            {
                "field": ["span.duration", "description"],
                "query": "",
                "orderby": "description",
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
        assert meta["dataset"] == self.dataset

    @pytest.mark.xfail
    def test_aggregate_numeric_attr(self):
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
                self.create_span(
                    {
                        "description": "foo",
                        "sentry_tags": {"status": "success"},
                        "tags": {"bar": "bar3"},
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=self.is_eap,
        )

        response = self.do_request(
            {
                "field": [
                    "description",
                    "count_unique(bar)",
                    "count_unique(tags[bar])",
                    "count_unique(tags[bar,string])",
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
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0] == {
            "description": "foo",
            "count_unique(bar)": 3,
            "count_unique(tags[bar])": 3,
            "count_unique(tags[bar,string])": 3,
            "count()": 3,
            "count(span.duration)": 3,
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

    def test_numeric_attr_without_space(self):
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "foo",
                        "sentry_tags": {"status": "success"},
                        "tags": {"foo": "five"},
                    },
                    measurements={"foo": {"value": 5}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=self.is_eap,
        )

        response = self.do_request(
            {
                "field": ["description", "tags[foo,number]", "tags[foo,string]", "tags[foo]"],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["tags[foo,number]"] == 5
        assert data[0]["tags[foo,string]"] == "five"
        assert data[0]["tags[foo]"] == "five"

    def test_numeric_attr_with_spaces(self):
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "foo",
                        "sentry_tags": {"status": "success"},
                        "tags": {"foo": "five"},
                    },
                    measurements={"foo": {"value": 5}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=self.is_eap,
        )

        response = self.do_request(
            {
                "field": ["description", "tags[foo,    number]", "tags[foo, string]", "tags[foo]"],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["tags[foo,    number]"] == 5
        assert data[0]["tags[foo, string]"] == "five"
        assert data[0]["tags[foo]"] == "five"

    def test_numeric_attr_filtering(self):
        self.store_spans(
            [
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
                    {"description": "bar", "sentry_tags": {"status": "success", "foo": "five"}},
                    measurements={"foo": {"value": 8}},
                    start_ts=self.ten_mins_ago,
                ),
            ],
            is_eap=self.is_eap,
        )

        response = self.do_request(
            {
                "field": ["description", "tags[foo,number]"],
                "query": "tags[foo,number]:5",
                "orderby": "description",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"]
        assert data[0]["tags[foo,number]"] == 5
        assert data[0]["description"] == "foo"

    def test_long_attr_name(self):
        response = self.do_request(
            {
                "field": ["description", "z" * 201],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 400, response.content
        assert "Is Too Long" in response.data["detail"].title()

    def test_numeric_attr_orderby(self):
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
            is_eap=self.is_eap,
        )

        response = self.do_request(
            {
                "field": ["description", "tags[foo,number]"],
                "query": "",
                "orderby": ["tags[foo,number]"],
                "project": self.project.id,
                "dataset": self.dataset,
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

    def test_margin_of_error(self):
        total_samples = 10
        in_group = 5
        spans = []
        for _ in range(in_group):
            spans.append(
                self.create_span(
                    {
                        "description": "foo",
                        "sentry_tags": {"status": "success"},
                        "measurements": {"client_sample_rate": {"value": 0.00001}},
                    },
                    start_ts=self.ten_mins_ago,
                )
            )
        for _ in range(total_samples - in_group):
            spans.append(
                self.create_span(
                    {
                        "description": "bar",
                        "sentry_tags": {"status": "success"},
                        "measurements": {"client_sample_rate": {"value": 0.00001}},
                    },
                )
            )

        self.store_spans(
            spans,
            is_eap=self.is_eap,
        )

        response = self.do_request(
            {
                "field": [
                    "margin_of_error()",
                    "lower_count_limit()",
                    "upper_count_limit()",
                    "count()",
                ],
                "query": "description:foo",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        data = response.data["data"][0]
        margin_of_error = data["margin_of_error()"]
        lower_limit = data["lower_count_limit()"]
        upper_limit = data["upper_count_limit()"]
        extrapolated = data["count()"]
        assert margin_of_error == pytest.approx(0.306, rel=1e-1)
        # How to read this; these results mean that the extrapolated count is
        # 500k, with a lower estimated bound of ~200k, and an upper bound of 800k
        assert lower_limit == pytest.approx(190_000, abs=5000)
        assert extrapolated == pytest.approx(500_000, abs=5000)
        assert upper_limit == pytest.approx(810_000, abs=5000)

    def test_skip_aggregate_conditions_option(self):
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
            is_eap=self.is_eap,
        )
        response = self.do_request(
            {
                "field": ["description"],
                "query": "description:foo count():>1",
                "orderby": "description",
                "project": self.project.id,
                "dataset": self.dataset,
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
        assert meta["dataset"] == self.dataset

    def test_span_data_fields_http_resource(self):
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
            is_eap=self.is_eap,
        )

        response = self.do_request(
            {
                "field": [
                    "http.decoded_response_content_length",
                    "http.response_content_length",
                    "http.response_transfer_size",
                ],
                "project": self.project.id,
                "dataset": self.dataset,
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
        assert response.data["meta"] == {
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

    def test_filtering_numeric_attr(self):
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
        self.store_spans([span_1, span_2], is_eap=self.is_eap)

        response = self.do_request(
            {
                "field": ["tags[foo,number]"],
                "query": "span.duration:>=0 tags[foo,number]:>20",
                "project": self.project.id,
                "dataset": self.dataset,
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

    def test_byte_fields(self):
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
            is_eap=self.is_eap,
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
                "dataset": self.dataset,
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


class OrganizationEventsEAPRPCSpanEndpointTest(OrganizationEventsEAPSpanEndpointTest):
    """These tests aren't fully passing yet, currently inheriting xfail from the eap tests"""

    is_eap = True
    use_rpc = True

    @mock.patch(
        "sentry.utils.snuba_rpc._snuba_pool.urlopen", side_effect=urllib3.exceptions.TimeoutError
    )
    def test_timeout(self, mock_rpc):
        response = self.do_request(
            {
                "field": ["span.status", "description", "count()"],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 400, response.content
        assert "Query timeout" in response.data["detail"]

    def test_extrapolation(self):
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
        self.store_spans(spans, is_eap=self.is_eap)
        response = self.do_request(
            {
                "field": ["description", "count()"],
                "orderby": "-count()",
                "query": "",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        confidence = response.data["confidence"]
        assert len(data) == 2
        assert len(confidence) == 2
        assert data[0]["count()"] == 10
        assert confidence[0]["count()"] == "low"
        assert data[1]["count()"] == 1
        # While logically the confidence for 1 event at 100% sample rate should be high, we're going with low until we
        # get customer feedback
        assert confidence[1]["count()"] == "low"

    def test_span_duration(self):
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
        self.store_spans(spans, is_eap=self.is_eap)
        response = self.do_request(
            {
                "field": ["span.duration", "description"],
                "query": "",
                "orderby": "description",
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
        assert meta["dataset"] == self.dataset

    def test_average_sampling_rate(self):
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
                    "measurements": {"client_sample_rate": {"value": 0.85}},
                },
                start_ts=self.ten_mins_ago,
            )
        )
        self.store_spans(spans, is_eap=self.is_eap)
        response = self.do_request(
            {
                "field": [
                    "avg_sample(sampling_rate)",
                    "count()",
                    "min(sampling_rate)",
                    "count_sample()",
                ],
                "query": "",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        confidence = response.data["confidence"]
        assert len(data) == 1
        assert data[0]["avg_sample(sampling_rate)"] == pytest.approx(0.475)
        assert data[0]["min(sampling_rate)"] == pytest.approx(0.1)
        assert data[0]["count_sample()"] == 2
        assert data[0]["count()"] == 11
        assert confidence[0]["count()"] == "low"

    def test_aggregate_numeric_attr(self):
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
            is_eap=self.is_eap,
        )

        response = self.do_request(
            {
                "field": [
                    "description",
                    "count_unique(bar)",
                    "count_unique(tags[bar])",
                    "count_unique(tags[bar,string])",
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
                "dataset": self.dataset,
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

    @pytest.mark.skip(reason="margin will not be moved to the RPC")
    def test_margin_of_error(self):
        super().test_margin_of_error()

    @pytest.mark.skip(reason="module not migrated over")
    def test_module_alias(self):
        super().test_module_alias()

    @pytest.mark.xfail(
        reason="wip: depends on rpc having a way to set a different default in virtual contexts"
    )
    def test_span_module(self):
        super().test_span_module()

    def test_inp_span(self):
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
            is_eap=self.is_eap,
        )
        response = self.do_request(
            {
                # Not moving origin.transaction to RPC, its equivalent to transaction and just represents the
                # transaction that's related to the span
                "field": ["replay.id", "browser.name", "transaction", "count()"],
                "query": f"replay.id:{replay_id} AND browser.name:Chrome AND transaction:/pageloads/",
                "orderby": "count()",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["replay.id"] == replay_id
        assert data[0]["browser.name"] == "Chrome"
        assert data[0]["transaction"] == "/pageloads/"
        assert meta["dataset"] == self.dataset

    @pytest.mark.xfail(
        reason="wip: depends on rpc having a way to set a different default in virtual contexts"
    )
    # https://github.com/getsentry/projects/issues/215?issue=getsentry%7Cprojects%7C488
    def test_other_category_span(self):
        super().test_other_category_span()

    @pytest.mark.xfail(
        reason="wip: not implemented yet, depends on rpc having a way to filter based on casing"
    )
    # https://github.com/getsentry/projects/issues/215?issue=getsentry%7Cprojects%7C489
    def test_span_op_casing(self):
        super().test_span_op_casing()

    def test_tag_wildcards(self):
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
            is_eap=self.is_eap,
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
                    "dataset": self.dataset,
                }
            )
            assert response.status_code == 200, response.content
            assert response.data["data"] == [{"foo": "bar", "count()": 1}]

    @pytest.mark.xfail(reason="wip: rate not implemented yet")
    def test_spm(self):
        super().test_spm()

    def test_is_transaction(self):
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
            is_eap=self.is_eap,
        )
        response = self.do_request(
            {
                "field": ["span.status", "description", "count()", "is_transaction"],
                "query": "is_transaction:true",
                "orderby": "description",
                "project": self.project.id,
                "dataset": self.dataset,
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
        assert meta["dataset"] == self.dataset

    def test_is_not_transaction(self):
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
            is_eap=self.is_eap,
        )
        response = self.do_request(
            {
                "field": ["span.status", "description", "count()", "is_transaction"],
                "query": "is_transaction:0",
                "orderby": "description",
                "project": self.project.id,
                "dataset": self.dataset,
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
        assert meta["dataset"] == self.dataset

    def test_byte_fields(self):
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
            is_eap=self.is_eap,
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
                "dataset": self.dataset,
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

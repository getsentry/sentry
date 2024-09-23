import uuid

import pytest

from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationEventsSpanIndexedEndpointTest(OrganizationEventsEndpointTestBase):
    is_eap = False
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
                "query": "span.module:http span.status_code:200",
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


class OrganizationEventsEAPSpanEndpointTest(OrganizationEventsSpanIndexedEndpointTest):
    is_eap = True

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
                "field": ["span.duration", "description", "count()"],
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
                "span.duration": 1000,
                "description": "bar",
                "count()": 1,
            },
            {
                "span.duration": 1000,
                "description": "foo",
                "count()": 1,
            },
        ]
        assert meta["dataset"] == self.dataset

    def test_extrapolation_smoke(self):
        """This is a hack, we just want to make sure nothing errors from using the weighted functions"""
        for function in [
            "count_weighted()",
            "sum_weighted(span.duration)",
            "avg_weighted(span.duration)",
            "percentile_weighted(span.duration, 0.23)",
            "p50_weighted()",
            "p75_weighted()",
            "p90_weighted()",
            "p95_weighted()",
            "p99_weighted()",
            "p100_weighted()",
            "min_weighted(span.duration)",
            "max_weighted(span.duration)",
        ]:
            response = self.do_request(
                {
                    "field": ["description", function],
                    "query": "",
                    "orderby": "description",
                    "project": self.project.id,
                    "dataset": self.dataset,
                }
            )

            assert response.status_code == 200, f"error: {response.content}\naggregate: {function}"

    def test_numeric_attr_without_space(self):
        self.store_spans(
            [
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success", "foo": "five"}},
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
                    {"description": "foo", "sentry_tags": {"status": "success", "foo": "five"}},
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
                    {"description": "foo", "sentry_tags": {"status": "success", "foo": "five"}},
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
                    {"description": "baz", "sentry_tags": {"status": "success", "foo": "five"}},
                    measurements={"foo": {"value": 71}},
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {"description": "foo", "sentry_tags": {"status": "success", "foo": "five"}},
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

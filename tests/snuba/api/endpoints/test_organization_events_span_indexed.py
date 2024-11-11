import uuid

import pytest

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

    def test_aggregate_numeric_attr_weighted(self):
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
                    "count_unique_weighted(bar)",
                    "count_unique_weighted(tags[bar])",
                    "count_unique_weighted(tags[bar,string])",
                    "count_weighted()",
                    "count_weighted(span.duration)",
                    "count_weighted(tags[foo,     number])",
                    "sum_weighted(tags[foo,number])",
                    "avg_weighted(tags[foo,number])",
                    "p50_weighted(tags[foo,number])",
                    "p75_weighted(tags[foo,number])",
                    "p95_weighted(tags[foo,number])",
                    "p99_weighted(tags[foo,number])",
                    "p100_weighted(tags[foo,number])",
                    "min_weighted(tags[foo,number])",
                    "max_weighted(tags[foo,number])",
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
            "count_unique_weighted(bar)": 3,
            "count_unique_weighted(tags[bar])": 3,
            "count_unique_weighted(tags[bar,string])": 3,
            "count_weighted()": 3,
            "count_weighted(span.duration)": 3,
            "count_weighted(tags[foo,     number])": 1,
            "sum_weighted(tags[foo,number])": 5.0,
            "avg_weighted(tags[foo,number])": 5.0,
            "p50_weighted(tags[foo,number])": 5.0,
            "p75_weighted(tags[foo,number])": 5.0,
            "p95_weighted(tags[foo,number])": 5.0,
            "p99_weighted(tags[foo,number])": 5.0,
            "p100_weighted(tags[foo,number])": 5.0,
            "min_weighted(tags[foo,number])": 5.0,
            "max_weighted(tags[foo,number])": 5.0,
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
                    "count_weighted()",
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
        extrapolated = data["count_weighted()"]
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


class OrganizationEventsEAPRPCSpanEndpointTest(OrganizationEventsEAPSpanEndpointTest):
    """These tests aren't fully passing yet, currently inheriting xfail from the eap tests"""

    is_eap = True
    use_rpc = True

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

    @pytest.mark.xfail(reason="extrapolation not implemented yet")
    def test_aggregate_numeric_attr_weighted(self):
        super().test_aggregate_numeric_attr_weighted()

    @pytest.mark.xfail(reason="RPC failing because of aliasing")
    def test_numeric_attr_without_space(self):
        super().test_numeric_attr_without_space()

    @pytest.mark.xfail(reason="RPC failing because of aliasing")
    def test_numeric_attr_with_spaces(self):
        super().test_numeric_attr_with_spaces()

    @pytest.mark.xfail(reason="RPC failing because of aliasing")
    def test_numeric_attr_filtering(self):
        super().test_numeric_attr_filtering()

    @pytest.mark.xfail(reason="RPC failing because of aliasing")
    def test_numeric_attr_orderby(self):
        super().test_numeric_attr_orderby()

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
                    # TODO: bring p75 back once its added to the rpc
                    # "p75(tags[foo,number])",
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
            # TODO: bring p75 back once its added to the rpc
            # "p75(tags[foo,number])": 5.0,
            "p95(tags[foo,number])": 5.0,
            "p99(tags[foo,number])": 5.0,
            "p100(tags[foo,number])": 5.0,
            "min(tags[foo,number])": 5.0,
            "max(tags[foo,number])": 5.0,
        }

    @pytest.mark.xfail(reason="extrapolation not implemented yet")
    def test_margin_of_error(self):
        super().test_margin_of_error()

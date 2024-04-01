from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationEventsSpanIndexedEndpointTest(OrganizationEventsEndpointTestBase):
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

    def setUp(self):
        super().setUp()
        self.features = {
            "organizations:starfish-view": True,
        }

    def test_simple(self):
        self.store_spans(
            [
                self.create_span({"description": "foo"}, start_ts=self.ten_mins_ago),
                self.create_span({"description": "bar"}, start_ts=self.ten_mins_ago),
            ]
        )
        response = self.do_request(
            {
                "field": ["description", "count()"],
                "query": "",
                "orderby": "description",
                "project": self.project.id,
                "dataset": "spansIndexed",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 2
        assert data[0]["description"] == "bar"
        assert data[1]["description"] == "foo"
        assert meta["dataset"] == "spansIndexed"

    def test_sentry_tags_vs_tags(self):
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"transaction.method": "foo"}}, start_ts=self.ten_mins_ago
                ),
            ]
        )
        response = self.do_request(
            {
                "field": ["transaction.method", "count()"],
                "query": "",
                "orderby": "count()",
                "project": self.project.id,
                "dataset": "spansIndexed",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["transaction.method"] == "foo"
        assert meta["dataset"] == "spansIndexed"

    def test_sentry_tags_syntax(self):
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"transaction.method": "foo"}}, start_ts=self.ten_mins_ago
                ),
            ]
        )
        response = self.do_request(
            {
                "field": ["sentry_tags[transaction.method]", "count()"],
                "query": "",
                "orderby": "count()",
                "project": self.project.id,
                "dataset": "spansIndexed",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["sentry_tags[transaction.method]"] == "foo"
        assert meta["dataset"] == "spansIndexed"

    def test_device_class_filter_unknown(self):
        self.store_spans(
            [
                self.create_span({"sentry_tags": {"device.class": ""}}, start_ts=self.ten_mins_ago),
            ]
        )
        response = self.do_request(
            {
                "field": ["device.class", "count()"],
                "query": "device.class:Unknown",
                "orderby": "count()",
                "project": self.project.id,
                "dataset": "spansIndexed",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["device.class"] == "Unknown"
        assert meta["dataset"] == "spansIndexed"

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
            ]
        )

        response = self.do_request(
            {
                "field": ["span.op", "span.status_code"],
                "query": "span.module:http span.status_code:200",
                "project": self.project.id,
                "dataset": "spansIndexed",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["span.op"] == "http.client"
        assert data[0]["span.status_code"] == "200"
        assert meta["dataset"] == "spansIndexed"

    def test_inp_span(self):
        self.store_spans(
            [
                self.create_span(
                    {
                        "sentry_tags": {
                            "replay_id": "abc123",
                            "browser.name": "Chrome",
                            "transaction": "/pageloads/",
                        }
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ]
        )
        response = self.do_request(
            {
                "field": ["replay.id", "browser.name", "origin.transaction", "count()"],
                "query": "replay.id:abc123 AND browser.name:Chrome AND origin.transaction:/pageloads/",
                "orderby": "count()",
                "project": self.project.id,
                "dataset": "spansIndexed",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["replay.id"] == "abc123"
        assert data[0]["browser.name"] == "Chrome"
        assert data[0]["origin.transaction"] == "/pageloads/"
        assert meta["dataset"] == "spansIndexed"

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
            ]
        )
        response = self.do_request(
            {
                "field": ["span.op", "count()"],
                "query": 'span.op:"ThIs Is a TraNSActiON"',
                "orderby": "count()",
                "project": self.project.id,
                "dataset": "spansIndexed",
            }
        )

        assert response.status_code == 200, response.content
        data = response.data["data"]
        meta = response.data["meta"]
        assert len(data) == 1
        assert data[0]["span.op"] == "this is a transaction"
        assert meta["dataset"] == "spansIndexed"

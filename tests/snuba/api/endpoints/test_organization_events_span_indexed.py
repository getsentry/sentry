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

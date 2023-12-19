from datetime import datetime, timedelta
from uuid import uuid4

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

    # Some base data for create_span
    base_span = {
        "is_segment": False,
        "retention_days": 90,
        "tags": {},
        "sentry_tags": {},
        "measurements": {},
    }

    def setUp(self):
        super().setUp()
        self.features = {
            "organizations:starfish-view": True,
        }

    def create_span(
        self, extra_data=None, organization=None, project=None, start_ts=None, duration=1000
    ):
        """Create span json, not required for store_span, but with no params passed should just work out of the box"""
        if organization is None:
            organization = self.organization
        if project is None:
            project = self.project
        if start_ts is None:
            start_ts = datetime.now() - timedelta(minutes=1)
        if extra_data is None:
            extra_data = {}
        span = self.base_span.copy()
        # Load some defaults
        span.update(
            {
                "event_id": uuid4().hex,
                "organization_id": organization.id,
                "project_id": project.id,
                "trace_id": uuid4().hex,
                "span_id": uuid4().hex[:16],
                "parent_span_id": uuid4().hex[:16],
                "segment_id": uuid4().hex[:16],
                "group_raw": uuid4().hex[:16],
                "profile_id": uuid4().hex,
                # Multiply by 1000 cause it needs to be ms
                "start_timestamp_ms": int(start_ts.timestamp() * 1000),
                "received": start_ts.timestamp(),
                "duration_ms": duration,
                "exclusive_time_ms": duration,
            }
        )
        # Load any specific custom data
        span.update(extra_data)
        return span

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

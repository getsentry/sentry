from unittest import mock

from tests.snuba.api.endpoints.test_organization_events import (
    OrganizationEventsEndpointTestBase,
)


class OrganizationEventsTraceMetricsEndpointTest(OrganizationEventsEndpointTestBase):
    viewname = "sentry-api-0-organization-events-sql"

    def setUp(self):
        super().setUp()
        self.features = {"organizations:events-sql-grammar-api": True}

    def test_simple_with_explicit_filter(self) -> None:
        logs = [
            self.create_ourlog(
                {"body": "foo"},
                timestamp=self.ten_mins_ago,
            ),
            self.create_ourlog(
                {"body": "foo"},
                timestamp=self.nine_mins_ago,
            ),
        ]
        self.store_eap_items(logs)

        response = self.do_request(
            {
                "query": "SELECT id, log.body FROM logs WHERE log.body=foo ORDER BY id ASC",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": mock.ANY,
                "log.body": "foo",
            },
            {
                "id": mock.ANY,
                "log.body": "foo",
            },
        ]

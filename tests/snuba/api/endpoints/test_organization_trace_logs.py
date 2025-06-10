import logging
from uuid import uuid4

from django.urls import reverse

from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase

logger = logging.getLogger(__name__)


class OrganizationEventsTraceEndpointTest(OrganizationEventsEndpointTestBase):
    url_name = "sentry-api-0-organization-trace-logs"

    def setUp(self):
        super().setUp()
        self.features = {
            "organizations:ourlogs-enabled": True,
        }
        self.login_as(user=self.user)
        self.url = reverse(
            self.url_name,
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def test_no_projects(self):
        response = self.client.get(
            self.url,
            data={"traceId": uuid4().hex},
            format="json",
        )

        assert response.status_code == 404, response.content

    def test_invalid_trace_id(self):
        trace_id_1 = "1" * 32
        trace_id_2 = "2" * 32
        self.store_ourlogs(
            [
                self.create_ourlog(
                    {"body": "foo", "trace_id": trace_id_1},
                    timestamp=self.ten_mins_ago,
                ),
                self.create_ourlog(
                    {"body": "bar", "trace_id": trace_id_2},
                    timestamp=self.ten_mins_ago,
                ),
            ]
        )
        for trace_id in ["1" * 16, "test"]:
            response = self.client.get(
                self.url,
                data={"traceId": trace_id},
                format="json",
            )
            assert response.status_code == 400, response.content

    def test_simple(self):
        trace_id_1 = "1" * 32
        trace_id_2 = "2" * 32
        self.store_ourlogs(
            [
                self.create_ourlog(
                    {"body": "foo", "trace_id": trace_id_1},
                    timestamp=self.ten_mins_ago,
                ),
                self.create_ourlog(
                    {"body": "bar", "trace_id": trace_id_2},
                    timestamp=self.ten_mins_ago,
                ),
            ]
        )

        response = self.client.get(
            self.url,
            data={"traceId": trace_id_1},
            format="json",
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        log_data = data[0]
        assert log_data["project.id"] == self.project.id
        assert log_data["trace"] == trace_id_1
        assert log_data["message"] == "foo"

    def test_multiple_traces(self):
        trace_id_1 = "1" * 32
        trace_id_2 = "2" * 32
        self.store_ourlogs(
            [
                self.create_ourlog(
                    {"body": "foo", "trace_id": trace_id_1},
                    timestamp=self.ten_mins_ago,
                ),
                self.create_ourlog(
                    {"body": "bar", "trace_id": trace_id_2},
                    timestamp=self.eleven_mins_ago,
                ),
            ]
        )

        response = self.client.get(
            self.url,
            data={"traceId": [trace_id_1, trace_id_2]},
            format="json",
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        log_data = data[0]
        assert log_data["project.id"] == self.project.id
        assert log_data["trace"] == trace_id_1
        assert log_data["message"] == "foo"
        log_data = data[1]
        assert log_data["project.id"] == self.project.id
        assert log_data["trace"] == trace_id_2
        assert log_data["message"] == "bar"

    def test_orderby(self):
        trace_id_1 = "1" * 32
        trace_id_2 = "2" * 32
        self.store_ourlogs(
            [
                self.create_ourlog(
                    {"body": "foo", "trace_id": trace_id_1},
                    timestamp=self.ten_mins_ago,
                ),
                self.create_ourlog(
                    {"body": "bar", "trace_id": trace_id_2},
                    timestamp=self.eleven_mins_ago,
                ),
            ]
        )

        response = self.client.get(
            self.url,
            data={"traceId": [trace_id_1, trace_id_2], "orderby": "timestamp"},
            format="json",
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        log_data = data[0]
        assert log_data["project.id"] == self.project.id
        assert log_data["trace"] == trace_id_2
        assert log_data["message"] == "bar"
        log_data = data[1]
        assert log_data["project.id"] == self.project.id
        assert log_data["trace"] == trace_id_1
        assert log_data["message"] == "foo"

    def test_orderby_validation(self):
        trace_id_1 = "1" * 32
        trace_id_2 = "2" * 32
        self.store_ourlogs(
            [
                self.create_ourlog(
                    {"body": "foo", "trace_id": trace_id_1},
                    timestamp=self.ten_mins_ago,
                ),
                self.create_ourlog(
                    {"body": "bar", "trace_id": trace_id_2},
                    timestamp=self.eleven_mins_ago,
                ),
            ]
        )

        response = self.client.get(
            self.url,
            data={"traceId": [trace_id_1, trace_id_2], "orderby": "foobar"},
            format="json",
        )
        assert response.status_code == 400, response.content

    def test_cross_project_query(self):
        trace_id_1 = "1" * 32
        trace_id_2 = "2" * 32
        project2 = self.create_project(organization=self.organization)
        self.store_ourlogs(
            [
                self.create_ourlog(
                    {"body": "foo", "trace_id": trace_id_1},
                    timestamp=self.ten_mins_ago,
                ),
                self.create_ourlog(
                    {"body": "bar", "trace_id": trace_id_2},
                    timestamp=self.eleven_mins_ago,
                    project=project2,
                ),
            ]
        )

        response = self.client.get(
            self.url,
            data={"traceId": [trace_id_1, trace_id_2]},
            format="json",
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        log_data = data[0]
        assert log_data["project.id"] == self.project.id
        assert log_data["trace"] == trace_id_1
        assert log_data["message"] == "foo"
        log_data = data[1]
        assert log_data["project.id"] == project2.id
        assert log_data["trace"] == trace_id_2
        assert log_data["message"] == "bar"

    def test_query_field(self):
        trace_id_1 = "1" * 32
        trace_id_2 = "2" * 32
        self.store_ourlogs(
            [
                self.create_ourlog(
                    {"body": "foo", "trace_id": trace_id_1},
                    timestamp=self.ten_mins_ago,
                ),
                self.create_ourlog(
                    {"body": "bar", "trace_id": trace_id_2},
                    timestamp=self.ten_mins_ago,
                ),
            ]
        )

        response = self.client.get(
            self.url,
            data={"traceId": [trace_id_1, trace_id_2], "query": "message:foo"},
            format="json",
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        log_data = data[0]
        assert log_data["project.id"] == self.project.id
        assert log_data["trace"] == trace_id_1
        assert log_data["message"] == "foo"

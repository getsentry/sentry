from typing import int
import logging
from unittest.mock import patch
from uuid import uuid4

from django.urls import reverse

from sentry.search.eap import constants
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase

logger = logging.getLogger(__name__)


class OrganizationEventsTraceEndpointTest(OrganizationEventsEndpointTestBase):
    url_name = "sentry-api-0-organization-trace-logs"

    def setUp(self) -> None:
        super().setUp()
        self.features = {
            "organizations:ourlogs-enabled": True,
        }
        self.login_as(user=self.user)
        self.url = reverse(
            self.url_name,
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def test_no_projects(self) -> None:
        response = self.client.get(
            self.url,
            data={"traceId": uuid4().hex},
            format="json",
        )

        assert response.status_code == 404, response.content

    def test_invalid_trace_id(self) -> None:
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

    def test_simple(self) -> None:
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

    def test_multiple_traces(self) -> None:
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

    def test_sort(self) -> None:
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
            data={"traceId": [trace_id_1, trace_id_2], "sort": "timestamp"},
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

    def test_orderby_validation(self) -> None:
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
            data={"traceId": [trace_id_1, trace_id_2], "sort": "foobar"},
            format="json",
        )
        assert response.status_code == 400, response.content
        assert "foobar must be one of" in response.data["detail"]

    def test_cross_project_query(self) -> None:
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

    def test_query_field(self) -> None:
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

    def test_pagelimit(self) -> None:
        trace_id = "1" * 32
        log = self.create_ourlog(
            {"body": "test", "trace_id": trace_id},
            timestamp=self.ten_mins_ago,
        )
        self.store_ourlogs([log])

        response = self.client.get(
            self.url,
            data={
                "traceId": trace_id,
                "per_page": "9999",
            },
            format="json",
        )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["message"] == "test"

        response = self.client.get(
            self.url,
            data={
                "traceId": trace_id,
                "per_page": "10000",
            },
            format="json",
        )
        assert response.status_code == 400
        assert response.data["detail"] == "Invalid per_page value. Must be between 1 and 9999."

    def test_timestamp_precise_alias_and_orderby(self) -> None:
        trace_id = "1" * 32
        logs = [
            self.create_ourlog(
                {"body": "foo", "trace_id": trace_id},
                timestamp=self.ten_mins_ago,
            )
        ]
        self.store_ourlogs(logs)

        with patch("sentry.snuba.rpc_dataset_common.RPCBase._run_table_query") as mock_run_query:
            mock_run_query.return_value = {
                "data": [
                    {
                        # Data not relevant for this test
                    }
                ],
                "meta": {"fields": {}, "units": {}},
            }

            response = self.client.get(
                self.url,
                data={"traceId": trace_id, "sort": "timestamp"},
                format="json",
            )

        assert response.status_code == 200, response.content
        mock_run_query.assert_called_once()

        call_args = mock_run_query.call_args
        query = call_args.args[0]
        selected_columns = query.selected_columns
        orderby = query.orderby

        assert constants.TIMESTAMP_PRECISE_ALIAS in selected_columns
        assert orderby == [
            constants.TIMESTAMP_ALIAS,
            constants.TIMESTAMP_PRECISE_ALIAS,
        ]

    def test_timestamp_precise_alias_and_orderby_desc(self) -> None:
        trace_id = "1" * 32
        logs = [
            self.create_ourlog(
                {"body": "foo", "trace_id": trace_id},
                timestamp=self.ten_mins_ago,
            )
        ]
        self.store_ourlogs(logs)

        with patch("sentry.snuba.rpc_dataset_common.RPCBase._run_table_query") as mock_run_query:
            mock_run_query.return_value = {
                "data": [
                    {
                        # Data not relevant for this test
                    }
                ],
                "meta": {"fields": {}, "units": {}},
            }

            response = self.client.get(
                self.url,
                data={"traceId": trace_id, "sort": "-timestamp"},
                format="json",
            )

        assert response.status_code == 200, response.content
        mock_run_query.assert_called_once()

        call_args = mock_run_query.call_args
        query = call_args.args[0]
        selected_columns = query.selected_columns
        orderby = query.orderby

        assert constants.TIMESTAMP_PRECISE_ALIAS in selected_columns
        assert orderby == [
            f"-{constants.TIMESTAMP_ALIAS}",
            f"-{constants.TIMESTAMP_PRECISE_ALIAS}",
        ]

    def test_replay_id_simple(self) -> None:
        replay_id = "1" * 32
        self.store_ourlogs(
            [
                self.create_ourlog(
                    {"body": "foo", "replay_id": replay_id},
                    timestamp=self.ten_mins_ago,
                ),
                self.create_ourlog(
                    {"body": "bar", "replay_id": "2" * 32},
                    timestamp=self.ten_mins_ago,
                ),
            ]
        )

        response = self.client.get(
            self.url,
            data={"replayId": replay_id},
            format="json",
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 1
        log_data = data[0]
        assert log_data["project.id"] == self.project.id
        assert log_data["message"] == "foo"

    def test_replay_id_invalid(self) -> None:
        self.store_ourlogs(
            [
                self.create_ourlog(
                    {"body": "foo", "replay_id": "1" * 32},
                    timestamp=self.ten_mins_ago,
                ),
            ]
        )
        for replay_id in ["1" * 16, "test"]:
            response = self.client.get(
                self.url,
                data={"replayId": replay_id},
                format="json",
            )
            assert response.status_code == 400, response.content

    def test_trace_and_replay_id_combined(self) -> None:
        trace_id = "1" * 32
        replay_id = "2" * 32
        self.store_ourlogs(
            [
                self.create_ourlog(
                    {"body": "trace_log", "trace_id": trace_id},
                    timestamp=self.ten_mins_ago,
                ),
                self.create_ourlog(
                    {"body": "replay_log", "replay_id": replay_id},
                    timestamp=self.eleven_mins_ago,
                ),
                self.create_ourlog(
                    {"body": "other_log", "trace_id": "3" * 32},
                    timestamp=self.ten_mins_ago,
                ),
            ]
        )

        response = self.client.get(
            self.url,
            data={"traceId": trace_id, "replayId": replay_id},
            format="json",
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 2
        messages = {log["message"] for log in data}
        assert messages == {"trace_log", "replay_log"}

    def test_no_trace_or_replay_id(self) -> None:
        self.store_ourlogs(
            [
                self.create_ourlog(
                    {"body": "foo", "trace_id": "1" * 32},
                    timestamp=self.ten_mins_ago,
                ),
            ]
        )
        response = self.client.get(
            self.url,
            data={"project": self.project.id},
            format="json",
        )
        assert response.status_code == 400, response.content
        assert "Need to pass at least one traceId or replayId" in response.data["detail"]

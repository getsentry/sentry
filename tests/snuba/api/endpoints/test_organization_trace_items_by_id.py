import uuid
from unittest import mock

from django.urls import reverse

from sentry.models.project import Project
from sentry.testutils.cases import APITestCase, OurLogTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.snuba_rpc import trace_item_details_rpc


class OrganizationTraceItemsByIdEndpointTest(APITestCase, SnubaTestCase, OurLogTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.one_min_ago = before_now(minutes=1)
        self.trace_uuid = str(uuid.uuid4()).replace("-", "")
        self.url = reverse(
            "sentry-api-0-organization-trace-items-by-id",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def store_log(self, body: str, project: Project | None = None) -> str:
        log = self.create_ourlog(
            {"body": body, "trace_id": self.trace_uuid},
            project=project or self.project,
            timestamp=self.one_min_ago,
        )
        self.store_eap_items([log])
        return log.item_id.hex()

    def item(self, item_id: str, project: Project | None = None, with_timestamp: bool = True):
        result = {
            "id": item_id,
            "traceId": self.trace_uuid,
            "projectId": (project or self.project).id,
        }
        if with_timestamp:
            result["timestamp"] = self.one_min_ago.isoformat()
        return result

    def do_request(self, data: dict):
        with self.feature({"organizations:discover-basic": True}):
            return self.client.post(self.url, data, format="json")

    def test_returns_requested_columns_when_id_resolves(self) -> None:
        item_id = self.store_log("foo")

        response = self.do_request(
            {
                "itemType": "logs",
                "columns": ["id", "message", "trace"],
                "items": [self.item(item_id)],
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["notFoundIds"] == []
        assert response.data["errorIds"] == []
        assert response.data["data"] == [
            {"id": item_id, "message": "foo", "trace": self.trace_uuid}
        ]

    def test_resolves_logs_across_multiple_projects(self) -> None:
        other_project = self.create_project(organization=self.organization)
        item_id = self.store_log("foo")
        other_item_id = self.store_log("bar", project=other_project)

        response = self.do_request(
            {
                "itemType": "logs",
                "columns": ["id", "message"],
                "items": [
                    self.item(item_id),
                    self.item(other_item_id, project=other_project),
                ],
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["notFoundIds"] == []
        assert sorted(response.data["data"], key=lambda row: row["message"]) == [
            {"id": other_item_id, "message": "bar"},
            {"id": item_id, "message": "foo"},
        ]

    def test_resolves_without_timestamp_using_wide_window(self) -> None:
        item_id = self.store_log("foo")

        response = self.do_request(
            {
                "itemType": "logs",
                "columns": ["id", "message"],
                "items": [self.item(item_id, with_timestamp=False)],
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["data"] == [{"id": item_id, "message": "foo"}]

    def test_returns_unresolved_ids_in_not_found_when_id_is_missing(self) -> None:
        item_id = self.store_log("foo")
        missing_id = uuid.uuid4().hex

        response = self.do_request(
            {
                "itemType": "logs",
                "columns": ["id", "message"],
                "items": [self.item(item_id), self.item(missing_id)],
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["notFoundIds"] == [missing_id]
        assert response.data["errorIds"] == []
        assert response.data["data"] == [{"id": item_id, "message": "foo"}]

    @mock.patch(
        "sentry.api.endpoints.organization_trace_items_by_id.trace_item_details_rpc",
        side_effect=Exception("snuba is down"),
    )
    def test_returns_errored_ids_when_lookup_fails(self, _mock_rpc: mock.MagicMock) -> None:
        item_id = self.store_log("foo")

        response = self.do_request(
            {
                "itemType": "logs",
                "columns": ["id", "message"],
                "items": [self.item(item_id)],
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["data"] == []
        assert response.data["notFoundIds"] == []
        assert response.data["errorIds"] == [item_id]

    def test_returns_found_and_errored_ids_in_the_same_batch(self) -> None:
        good_id = self.store_log("foo")
        bad_id = self.store_log("bar")

        def side_effect(req, *args, **kwargs):
            if req.item_id == bad_id:
                raise Exception("snuba is down")
            return trace_item_details_rpc(req, *args, **kwargs)

        with mock.patch(
            "sentry.api.endpoints.organization_trace_items_by_id.trace_item_details_rpc",
            side_effect=side_effect,
        ):
            response = self.do_request(
                {
                    "itemType": "logs",
                    "columns": ["id", "message"],
                    "items": [self.item(good_id), self.item(bad_id)],
                }
            )

        assert response.status_code == 200, response.content
        assert response.data["data"] == [{"id": good_id, "message": "foo"}]
        assert response.data["notFoundIds"] == []
        assert response.data["errorIds"] == [bad_id]

    @mock.patch(
        "sentry.api.endpoints.organization_trace_items_by_id.convert_rpc_attribute_to_json",
        side_effect=Exception("malformed attribute"),
    )
    def test_routes_serialization_failures_to_error_ids(self, _mock: mock.MagicMock) -> None:
        item_id = self.store_log("foo")

        response = self.do_request(
            {
                "itemType": "logs",
                "columns": ["id", "message"],
                "items": [self.item(item_id)],
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["data"] == []
        assert response.data["errorIds"] == [item_id]

    def test_rejects_project_the_user_cannot_access(self) -> None:
        other_organization = self.create_organization()
        other_project = self.create_project(organization=other_organization)

        response = self.do_request(
            {
                "itemType": "logs",
                "columns": ["id"],
                "items": [self.item(uuid.uuid4().hex, project=other_project)],
            }
        )

        assert response.status_code == 403, response.content

    def test_rejects_request_with_no_items(self) -> None:
        response = self.do_request({"itemType": "logs", "columns": ["id"], "items": []})

        assert response.status_code == 400, response.content

    def test_rejects_request_with_too_many_items(self) -> None:
        items = [self.item(uuid.uuid4().hex) for _ in range(101)]

        response = self.do_request({"itemType": "logs", "columns": ["id"], "items": items})

        assert response.status_code == 400, response.content

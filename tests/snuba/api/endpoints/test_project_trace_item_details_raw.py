import uuid

from django import urls

from sentry.testutils.cases import APITestCase, OurLogTestCase, SnubaTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now


class ProjectTraceItemDetailsRawEndpointTest(
    APITestCase,
    SnubaTestCase,
    OurLogTestCase,
    SpanTestCase,
):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.one_min_ago = before_now(minutes=1)
        self.trace_uuid = str(uuid.uuid4()).replace("-", "")

    def do_request(self, event_type: str, item_id: str):
        url = urls.reverse(
            "sentry-api-0-project-trace-item-details-raw",
            kwargs={
                "item_id": item_id,
                "project_id_or_slug": self.project.slug,
                "organization_id_or_slug": self.project.organization.slug,
            },
        )
        return self.client.get(
            url,
            {
                "item_type": event_type,
                "trace_id": self.trace_uuid,
            },
        )

    def test_requires_superuser(self) -> None:
        log = self.create_ourlog(
            {"body": "foo", "trace_id": self.trace_uuid},
            attributes={"str_attr": {"string_value": "1"}},
            timestamp=self.one_min_ago,
        )
        self.store_eap_items([log])
        item_id = log.item_id.hex()

        response = self.do_request("logs", item_id)
        assert response.status_code == 403

    def test_superuser_gets_raw_response(self) -> None:
        superuser = self.create_user(is_superuser=True)
        self.create_member(user=superuser, organization=self.organization)
        self.login_as(user=superuser, superuser=True)

        log = self.create_ourlog(
            {"body": "foo", "trace_id": self.trace_uuid},
            attributes={"str_attr": {"string_value": "1"}},
            timestamp=self.one_min_ago,
        )
        self.store_eap_items([log])
        item_id = log.item_id.hex()

        response = self.do_request("logs", item_id)
        assert response.status_code == 200

        assert "itemId" in response.data
        assert "attributes" in response.data
        attrs_by_name = {attr["name"]: attr["value"] for attr in response.data["attributes"]}
        assert attrs_by_name["str_attr"] == {"valStr": "1"}

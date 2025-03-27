import uuid

from django.urls import reverse

from sentry.testutils.cases import APITestCase, OurLogTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now


class ProjectEventDetailsTest(APITestCase, SnubaTestCase, OurLogTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.features = {
            "organizations:ourlogs-enabled": True,
        }

    def test_simple(self):
        one_min_ago = before_now(minutes=1)
        trace_uuid = str(uuid.uuid4())
        logs = [
            self.create_ourlog(
                {
                    "body": "foo",
                    "trace_id": trace_uuid,
                },
                attributes={
                    "str_attr": {
                        "string_value": "1",
                    },
                    "int_attr": {"int_value": 2},
                    "float_attr": {
                        "double_value": 3.0,
                    },
                    "bool_attr": {
                        "bool_value": True,
                    },
                },
                timestamp=one_min_ago,
            ),
        ]
        self.store_ourlogs(logs)
        item_list_url = reverse(
            "sentry-api-0-organization-events",
            kwargs={
                "organization_id_or_slug": self.project.organization.slug,
            },
        )
        with self.feature(self.features):
            item_list_response = self.client.get(
                item_list_url,
                {
                    "field": ["log.body", "sentry.item_id", "sentry.trace_id"],
                    "query": "",
                    "orderby": "sentry.item_id",
                    "project": self.project.id,
                    "dataset": "ourlogs",
                    "useRpc": "1",
                },
            )
        assert item_list_response.data is not None
        item_id = item_list_response.data["data"][0]["sentry.item_id"]
        trace_id = item_list_response.data["data"][0]["sentry.trace_id"]

        item_details_url = reverse(
            "sentry-api-0-project-trace-item-details",
            kwargs={
                "item_id": item_id,
                "project_id_or_slug": self.project.slug,
                "organization_id_or_slug": self.project.organization.slug,
            },
        )
        with self.feature(self.features):
            trace_details_response = self.client.get(
                item_details_url + f"?dataset=ourlogs&trace_id={trace_id}", format="json"
            )

        assert trace_details_response.status_code == 200, trace_details_response.content
        assert trace_details_response.data == {
            "attributes": [
                {"name": "bool_attr", "type": "bool", "value": True},
                {"name": "bool_attr", "type": "float", "value": 1.0},
                {"name": "float_attr", "type": "float", "value": 3.0},
                {"name": "int_attr", "type": "float", "value": 2.0},
                {"name": "log.severity_number", "type": "float", "value": 0.0},
                {"name": "int_attr", "type": "int", "value": "2"},
                {"name": "log.severity_number", "type": "int", "value": "0"},
                {"name": "sentry.item_type", "type": "int", "value": "3"},
                {
                    "name": "sentry.organization_id",
                    "type": "int",
                    "value": str(self.project.organization.id),
                },
                {"name": "sentry.project_id", "type": "int", "value": str(self.project.id)},
                {"name": "log.body", "type": "str", "value": "foo"},
                {"name": "log.severity_text", "type": "str", "value": "INFO"},
                {"name": "str_attr", "type": "str", "value": "1"},
                {"name": "trace", "type": "str", "value": trace_uuid},
            ],
            "itemId": item_id,
            "timestamp": one_min_ago.replace(microsecond=0, tzinfo=None).isoformat() + "Z",
        }, trace_details_response.data

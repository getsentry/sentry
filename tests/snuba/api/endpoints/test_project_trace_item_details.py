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
        trace_id = str(uuid.uuid4())
        logs = [
            self.create_ourlog(
                {
                    "body": "foo",
                    "trace_id": trace_id,
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
                    "field": ["log.body", "sentry.item_id"],
                    "query": "",
                    "orderby": "sentry.item_id",
                    "project": self.project.id,
                    "dataset": "ourlogs",
                    "useRpc": "1",
                },
            )
        assert item_list_response.data is not None
        item_id = item_list_response.data["data"][0]["sentry.item_id"]

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
                item_details_url + "?dataset=ourlogs", format="json"
            )

        assert trace_details_response.status_code == 200, trace_details_response.content
        assert trace_details_response.data == {
            "attributes": {
                "bool_attr": {
                    "value": True,
                    "type": "bool",
                },
                "float_attr": {"value": 3.0, "type": "float"},
                "int_attr": {"value": "2", "type": "int"},
                "sentry.body": {"value": "foo", "type": "str"},
                "sentry.item_type": {"value": "3", "type": "int"},
                "sentry.organization_id": {
                    "value": str(self.project.organization.id),
                    "type": "int",
                },
                "sentry.project_id": {"value": str(self.project.id), "type": "int"},
                "sentry.severity_number": {"value": "0", "type": "int"},
                "sentry.severity_text": {"value": "INFO", "type": "str"},
                "sentry.trace_id": {"value": trace_id, "type": "str"},
                "str_attr": {"value": "1", "type": "str"},
            },
            "itemId": item_id,
            "timestamp": one_min_ago.replace(microsecond=0, tzinfo=None).isoformat() + "Z",
        }, trace_details_response.data

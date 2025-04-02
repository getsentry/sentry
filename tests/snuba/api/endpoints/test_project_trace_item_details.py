import uuid

import pytest
from django.urls import reverse

from sentry.testutils.cases import APITestCase, OurLogTestCase, SnubaTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now


class ProjectEventDetailsTest(APITestCase, SnubaTestCase, OurLogTestCase, SpanTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.features = {
            "organizations:discover-basic": True,
        }
        self.one_min_ago = before_now(minutes=1)
        self.trace_uuid = str(uuid.uuid4()).replace("-", "")

    def do_request(self, event_type: str, item_id: str):
        item_details_url = reverse(
            "sentry-api-0-project-trace-item-details",
            kwargs={
                "item_id": item_id,
                "project_id_or_slug": self.project.slug,
                "organization_id_or_slug": self.project.organization.slug,
            },
        )
        with self.feature(self.features):
            return self.client.get(
                item_details_url,
                {
                    "item_type": event_type,
                    "trace_id": self.trace_uuid,
                },
            )

    def test_simple(self):
        logs = [
            self.create_ourlog(
                {
                    "body": "foo",
                    "trace_id": self.trace_uuid,
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
                timestamp=self.one_min_ago,
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
                },
            )
        assert item_list_response.data is not None
        item_id = item_list_response.data["data"][0]["sentry.item_id"]

        trace_details_response = self.do_request("logs", item_id)

        assert trace_details_response.status_code == 200, trace_details_response.content
        assert trace_details_response.data["attributes"] == [
            {"name": "bool_attr", "type": "bool", "value": True},
            {"name": "log.severity_number", "type": "float", "value": 0.0},
            {"name": "tags[bool_attr,number]", "type": "float", "value": 1.0},
            {"name": "tags[float_attr,number]", "type": "float", "value": 3.0},
            {"name": "tags[int_attr,number]", "type": "float", "value": 2.0},
            {"name": "log.severity_number", "type": "int", "value": "0"},
            {"name": "project_id", "type": "int", "value": str(self.project.id)},
            {"name": "tags[int_attr,number]", "type": "int", "value": "2"},
            {"name": "log.body", "type": "str", "value": "foo"},
            {"name": "log.severity_text", "type": "str", "value": "INFO"},
            {"name": "str_attr", "type": "str", "value": "1"},
            {"name": "trace", "type": "str", "value": self.trace_uuid},
        ]
        assert trace_details_response.data["itemId"] == item_id
        assert (
            trace_details_response.data["timestamp"]
            == self.one_min_ago.replace(microsecond=0, tzinfo=None).isoformat() + "Z"
        )

    def test_simple_using_logs_item_type(self):
        logs = [
            self.create_ourlog(
                {
                    "body": "foo",
                    "trace_id": self.trace_uuid,
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
                timestamp=self.one_min_ago,
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
                },
            )
        assert item_list_response.data is not None
        item_id = item_list_response.data["data"][0]["sentry.item_id"]

        trace_details_response = self.do_request("logs", item_id)

        assert trace_details_response.status_code == 200, trace_details_response.content
        assert trace_details_response.data == {
            "attributes": [
                {"name": "bool_attr", "type": "bool", "value": True},
                {"name": "log.severity_number", "type": "float", "value": 0.0},
                {"name": "tags[bool_attr,number]", "type": "float", "value": 1.0},
                {"name": "tags[float_attr,number]", "type": "float", "value": 3.0},
                {"name": "tags[int_attr,number]", "type": "float", "value": 2.0},
                {"name": "log.severity_number", "type": "int", "value": "0"},
                {"name": "project_id", "type": "int", "value": str(self.project.id)},
                {"name": "tags[int_attr,number]", "type": "int", "value": "2"},
                {"name": "log.body", "type": "str", "value": "foo"},
                {"name": "log.severity_text", "type": "str", "value": "INFO"},
                {"name": "str_attr", "type": "str", "value": "1"},
                {"name": "trace", "type": "str", "value": self.trace_uuid},
            ],
            "itemId": item_id,
            "timestamp": self.one_min_ago.replace(microsecond=0, tzinfo=None).isoformat() + "Z",
        }, trace_details_response.data

    def test_simple_using_spans_item_type(self):
        span_1 = self.create_span(
            {"description": "foo", "sentry_tags": {"status": "success"}},
            start_ts=self.one_min_ago,
        )
        span_1["trace_id"] = self.trace_uuid
        item_id = span_1["span_id"]

        self.store_span(span_1, is_eap=True)

        trace_details_response = self.do_request("spans", item_id)
        assert trace_details_response.status_code == 200, trace_details_response.content
        assert trace_details_response.data["attributes"] == [
            {"name": "is_segment", "type": "bool", "value": False},
            {"name": "is_transaction", "type": "float", "value": 0.0},
            {
                "name": "received",
                "type": "float",
                "value": pytest.approx(self.one_min_ago.timestamp()),
            },
            {"name": "span.duration", "type": "float", "value": 1000.0},
            {"name": "span.self_time", "type": "float", "value": 1000.0},
            {
                "name": "tags[end_timestamp_precise,number]",
                "type": "float",
                "value": pytest.approx(self.one_min_ago.timestamp()),
            },
            {
                "name": "tags[start_timestamp_precise,number]",
                "type": "float",
                "value": pytest.approx(self.one_min_ago.timestamp()),
            },
            {"name": "project_id", "type": "int", "value": str(self.project.id)},
            {"name": "span.duration", "type": "int", "value": "1000"},
            {"name": "event_id", "type": "str", "value": span_1["event_id"]},
            {"name": "parent_span", "type": "str", "value": span_1["parent_span_id"]},
            {"name": "profile.id", "type": "str", "value": span_1["profile_id"]},
            {"name": "raw_description", "type": "str", "value": "foo"},
            {"name": "span.status", "type": "str", "value": "success"},
            {"name": "trace", "type": "str", "value": self.trace_uuid},
            {"name": "transaction.span_id", "type": "str", "value": span_1["segment_id"]},
        ]
        assert trace_details_response.data["itemId"] == item_id
        assert (
            trace_details_response.data["timestamp"]
            == self.one_min_ago.replace(microsecond=0, tzinfo=None).isoformat() + "Z"
        )

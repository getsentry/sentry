import uuid

import pytest
from django.urls import reverse

from sentry.testutils.cases import APITestCase, OurLogTestCase, SnubaTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now


class ProjectTraceItemDetailsEndpointTest(APITestCase, SnubaTestCase, OurLogTestCase, SpanTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.features = {
            "organizations:discover-basic": True,
        }
        self.one_min_ago = before_now(minutes=1)
        self.trace_uuid = str(uuid.uuid4()).replace("-", "")

    def do_request(self, event_type: str, item_id: str, features=None):
        item_details_url = reverse(
            "sentry-api-0-project-trace-item-details",
            kwargs={
                "item_id": item_id,
                "project_id_or_slug": self.project.slug,
                "organization_id_or_slug": self.project.organization.slug,
            },
        )
        if features is None:
            features = self.features
        with self.feature(features):
            return self.client.get(
                item_details_url,
                {
                    "item_type": event_type,
                    "trace_id": self.trace_uuid,
                },
            )

    def test_simple(self):
        log = self.create_ourlog(
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
        )
        self.store_ourlogs([log])
        item_id = uuid.UUID(bytes=bytes(reversed(log.item_id))).hex

        trace_details_response = self.do_request("logs", item_id)

        assert trace_details_response.status_code == 200, trace_details_response.content

        timestamp_nanos = int(self.one_min_ago.timestamp() * 1_000_000_000)
        assert trace_details_response.data["attributes"] == [
            {"name": "bool_attr", "type": "bool", "value": True},
            {"name": "tags[float_attr,number]", "type": "float", "value": 3.0},
            {"name": "project_id", "type": "int", "value": str(self.project.id)},
            {"name": "severity_number", "type": "int", "value": "0"},
            {"name": "tags[int_attr,number]", "type": "int", "value": "2"},
            {
                "name": "tags[sentry.timestamp_nanos,number]",
                "type": "int",
                "value": str(timestamp_nanos),
            },
            {
                "name": "tags[sentry.timestamp_precise,number]",
                "type": "int",
                "value": str(timestamp_nanos),
            },
            {"name": "message", "type": "str", "value": "foo"},
            {"name": "severity", "type": "str", "value": "INFO"},
            {"name": "str_attr", "type": "str", "value": "1"},
            {"name": "trace", "type": "str", "value": self.trace_uuid},
        ]
        assert trace_details_response.data["itemId"] == item_id
        assert (
            trace_details_response.data["timestamp"]
            == self.one_min_ago.replace(microsecond=0, tzinfo=None).isoformat() + "Z"
        )

    def test_simple_using_logs_item_type(self):
        log = self.create_ourlog(
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
        )
        self.store_ourlogs([log])
        item_id = uuid.UUID(bytes=bytes(reversed(log.item_id))).hex

        trace_details_response = self.do_request("logs", item_id)

        assert trace_details_response.status_code == 200, trace_details_response.content

        timestamp_nanos = int(self.one_min_ago.timestamp() * 1_000_000_000)
        assert trace_details_response.data == {
            "attributes": [
                {"name": "bool_attr", "type": "bool", "value": True},
                {"name": "tags[float_attr,number]", "type": "float", "value": 3.0},
                {"name": "project_id", "type": "int", "value": str(self.project.id)},
                {"name": "severity_number", "type": "int", "value": "0"},
                {"name": "tags[int_attr,number]", "type": "int", "value": "2"},
                {
                    "name": "tags[sentry.timestamp_nanos,number]",
                    "type": "int",
                    "value": str(timestamp_nanos),
                },
                {
                    "name": "tags[sentry.timestamp_precise,number]",
                    "type": "int",
                    "value": str(timestamp_nanos),
                },
                {"name": "message", "type": "str", "value": "foo"},
                {"name": "severity", "type": "str", "value": "INFO"},
                {"name": "str_attr", "type": "str", "value": "1"},
                {"name": "trace", "type": "str", "value": self.trace_uuid},
            ],
            "meta": {},
            "itemId": item_id,
            "timestamp": self.one_min_ago.replace(
                microsecond=0,
                tzinfo=None,
            ).isoformat()
            + "Z",
        }

    def test_simple_using_spans_item_type(self):
        span_1 = self.create_span(
            {"description": "foo", "sentry_tags": {"status": "success"}},
            measurements={
                "code.lineno": {"value": 420},
                "http.response_content_length": {"value": 100},
                "http.response.body.size": {"value": 100},
            },
            start_ts=self.one_min_ago,
        )
        span_1["trace_id"] = self.trace_uuid
        item_id = span_1["span_id"]

        self.store_span(span_1, is_eap=True)

        trace_details_response = self.do_request("spans", item_id)
        assert trace_details_response.status_code == 200, trace_details_response.content
        assert trace_details_response.data["attributes"] == [
            {"name": "code.lineno", "type": "float", "value": 420.0},
            {"name": "http.response_content_length", "type": "float", "value": 100.0},
            {"name": "is_transaction", "type": "float", "value": 0.0},
            {
                "name": "precise.finish_ts",
                "type": "float",
                "value": pytest.approx(self.one_min_ago.timestamp()),
            },
            {
                "name": "precise.start_ts",
                "type": "float",
                "value": pytest.approx(self.one_min_ago.timestamp()),
            },
            {
                "name": "received",
                "type": "float",
                "value": pytest.approx(self.one_min_ago.timestamp()),
            },
            {"name": "span.self_time", "type": "float", "value": 1000.0},
            {"name": "project_id", "type": "int", "value": str(self.project.id)},
            {"name": "span.duration", "type": "int", "value": "1000"},
            {"name": "parent_span", "type": "str", "value": span_1["parent_span_id"]},
            {"name": "profile.id", "type": "str", "value": span_1["profile_id"]},
            {"name": "sdk.name", "type": "str", "value": "sentry.test.sdk"},
            {"name": "sdk.version", "type": "str", "value": "1.0"},
            {"name": "span.description", "type": "str", "value": "foo"},
            {"name": "span.status", "type": "str", "value": "success"},
            {"name": "trace", "type": "str", "value": self.trace_uuid},
            {
                "name": "transaction.event_id",
                "type": "str",
                "value": span_1["event_id"],
            },
            {
                "name": "transaction.span_id",
                "type": "str",
                "value": span_1["segment_id"],
            },
        ]
        assert trace_details_response.data["itemId"] == item_id
        assert (
            trace_details_response.data["timestamp"]
            == self.one_min_ago.replace(microsecond=0, tzinfo=None).isoformat() + "Z"
        )

    def test_simple_using_spans_item_type_with_sentry_conventions(self):
        span_1 = self.create_span(
            {"description": "foo", "sentry_tags": {"status": "success"}},
            measurements={
                "code.lineno": {"value": 420},
                "http.response_content_length": {"value": 100},
                "http.response.body.size": {"value": 100},
            },
            start_ts=self.one_min_ago,
        )
        span_1["trace_id"] = self.trace_uuid
        item_id = span_1["span_id"]

        self.store_span(span_1, is_eap=True)

        trace_details_response = self.do_request(
            "spans",
            item_id,
            features={
                "organizations:discover-basic": True,
                "organizations:performance-sentry-conventions-fields": True,
            },
        )
        assert trace_details_response.status_code == 200, trace_details_response.content
        assert trace_details_response.data["attributes"] == [
            {"name": "code.lineno", "type": "float", "value": 420.0},
            {"name": "http.response.body.size", "type": "float", "value": 100.0},
            {"name": "is_transaction", "type": "float", "value": 0.0},
            {
                "name": "precise.finish_ts",
                "type": "float",
                "value": pytest.approx(self.one_min_ago.timestamp()),
            },
            {
                "name": "precise.start_ts",
                "type": "float",
                "value": pytest.approx(self.one_min_ago.timestamp()),
            },
            {
                "name": "received",
                "type": "float",
                "value": pytest.approx(self.one_min_ago.timestamp()),
            },
            {"name": "span.self_time", "type": "float", "value": 1000.0},
            {"name": "project_id", "type": "int", "value": str(self.project.id)},
            {"name": "span.duration", "type": "int", "value": "1000"},
            {"name": "parent_span", "type": "str", "value": span_1["parent_span_id"]},
            {"name": "profile.id", "type": "str", "value": span_1["profile_id"]},
            {"name": "sdk.name", "type": "str", "value": "sentry.test.sdk"},
            {"name": "sdk.version", "type": "str", "value": "1.0"},
            {"name": "span.description", "type": "str", "value": "foo"},
            {"name": "span.status", "type": "str", "value": "success"},
            {"name": "trace", "type": "str", "value": self.trace_uuid},
            {
                "name": "transaction.event_id",
                "type": "str",
                "value": span_1["event_id"],
            },
            {
                "name": "transaction.span_id",
                "type": "str",
                "value": span_1["segment_id"],
            },
        ]
        assert trace_details_response.data["itemId"] == item_id
        assert (
            trace_details_response.data["timestamp"]
            == self.one_min_ago.replace(microsecond=0, tzinfo=None).isoformat() + "Z"
        )

    def test_logs_with_a_meta_key(self):
        log = self.create_ourlog(
            {
                "body": "[Filtered]",
                "trace_id": self.trace_uuid,
            },
            attributes={
                "str_attr": {
                    "string_value": "1",
                },
                "sentry._meta.fields.attributes.sentry.body": '{"length": 300, "reason": "value too long"}',
                "sentry._meta.fields.attributes.float_attr": '{"unit": "float"}',
                "int_attr": {"int_value": 2},
                "float_attr": {
                    "double_value": 3.0,
                },
                "bool_attr": {
                    "bool_value": True,
                },
            },
            timestamp=self.one_min_ago,
        )
        self.store_ourlogs([log])
        item_id = uuid.UUID(bytes=bytes(reversed(log.item_id))).hex

        trace_details_response = self.do_request("logs", item_id)

        assert trace_details_response.status_code == 200, trace_details_response.content

        timestamp_nanos = int(self.one_min_ago.timestamp() * 1_000_000_000)
        assert trace_details_response.data == {
            "attributes": [
                {"name": "bool_attr", "type": "bool", "value": True},
                {"name": "tags[float_attr,number]", "type": "float", "value": 3.0},
                {"name": "project_id", "type": "int", "value": str(self.project.id)},
                {"name": "severity_number", "type": "int", "value": "0"},
                {"name": "tags[int_attr,number]", "type": "int", "value": "2"},
                {
                    "name": "tags[sentry.timestamp_nanos,number]",
                    "type": "int",
                    "value": str(timestamp_nanos),
                },
                {
                    "name": "tags[sentry.timestamp_precise,number]",
                    "type": "int",
                    "value": str(timestamp_nanos),
                },
                {"name": "message", "type": "str", "value": "[Filtered]"},
                {"name": "severity", "type": "str", "value": "INFO"},
                {"name": "str_attr", "type": "str", "value": "1"},
                {"name": "trace", "type": "str", "value": self.trace_uuid},
            ],
            "meta": {
                "tags[float_attr,number]": {"unit": "float"},
                "message": {"length": 300, "reason": "value too long"},
            },
            "itemId": item_id,
            "timestamp": self.one_min_ago.replace(
                microsecond=0,
                tzinfo=None,
            ).isoformat()
            + "Z",
        }

    def test_user_attributes_collide_with_sentry_attributes(self):
        log = self.create_ourlog(
            {
                "body": "foo",
                "trace_id": self.trace_uuid,
            },
            attributes={"timestamp": "bar", "severity": "baz"},
            timestamp=self.one_min_ago,
        )

        self.store_ourlogs([log])
        item_id = uuid.UUID(bytes=bytes(reversed(log.item_id))).hex

        trace_details_response = self.do_request("logs", item_id)
        assert trace_details_response.status_code == 200, trace_details_response.content

        timestamp_nanos = int(self.one_min_ago.timestamp() * 1_000_000_000)
        assert trace_details_response.data == {
            "attributes": [
                {"name": "project_id", "type": "int", "value": str(self.project.id)},
                {"name": "severity_number", "type": "int", "value": "0"},
                {
                    "name": "tags[sentry.timestamp_nanos,number]",
                    "type": "int",
                    "value": str(timestamp_nanos),
                },
                {
                    "name": "tags[sentry.timestamp_precise,number]",
                    "type": "int",
                    "value": str(timestamp_nanos),
                },
                {"name": "message", "type": "str", "value": "foo"},
                {"name": "severity", "type": "str", "value": "INFO"},
                {"name": "tags[severity,string]", "type": "str", "value": "baz"},
                {"name": "tags[timestamp,string]", "type": "str", "value": "bar"},
                {"name": "trace", "type": "str", "value": self.trace_uuid},
            ],
            "meta": {},
            "itemId": item_id,
            "timestamp": self.one_min_ago.replace(
                microsecond=0,
                tzinfo=None,
            ).isoformat()
            + "Z",
        }

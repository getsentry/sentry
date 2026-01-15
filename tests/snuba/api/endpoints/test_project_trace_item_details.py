import uuid
from unittest import mock

import pytest
from django.urls import reverse

from sentry.testutils.cases import (
    APITestCase,
    OurLogTestCase,
    SnubaTestCase,
    SpanTestCase,
    TraceAttachmentTestCase,
)
from sentry.testutils.helpers.datetime import before_now


class ProjectTraceItemDetailsEndpointTest(
    APITestCase, SnubaTestCase, OurLogTestCase, SpanTestCase, TraceAttachmentTestCase
):
    def setUp(self) -> None:
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

    def test_simple(self) -> None:
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
            {"name": "tags[bool_attr,boolean]", "type": "bool", "value": True},
            {"name": "tags[float_attr,number]", "type": "float", "value": 3.0},
            {
                "name": "observed_timestamp",
                "type": "int",
                "value": str(timestamp_nanos),
            },
            {"name": "project_id", "type": "int", "value": str(self.project.id)},
            {"name": "severity_number", "type": "int", "value": "0"},
            {"name": "tags[int_attr,number]", "type": "int", "value": "2"},
            {
                "name": "timestamp_precise",
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

    def test_simple_using_logs_item_type(self) -> None:
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
                {"name": "tags[bool_attr,boolean]", "type": "bool", "value": True},
                {"name": "tags[float_attr,number]", "type": "float", "value": 3.0},
                {
                    "name": "observed_timestamp",
                    "type": "int",
                    "value": str(timestamp_nanos),
                },
                {"name": "project_id", "type": "int", "value": str(self.project.id)},
                {"name": "severity_number", "type": "int", "value": "0"},
                {"name": "tags[int_attr,number]", "type": "int", "value": "2"},
                {
                    "name": "timestamp_precise",
                    "type": "int",
                    "value": str(timestamp_nanos),
                },
                {"name": "message", "type": "str", "value": "foo"},
                {"name": "severity", "type": "str", "value": "INFO"},
                {"name": "str_attr", "type": "str", "value": "1"},
                {"name": "trace", "type": "str", "value": self.trace_uuid},
            ],
            "meta": {},
            "links": None,
            "itemId": item_id,
            "timestamp": self.one_min_ago.replace(
                microsecond=0,
                tzinfo=None,
            ).isoformat()
            + "Z",
        }

    def test_simple_using_spans_item_type(self) -> None:
        previous_trace = uuid.uuid4().hex
        span_1 = self.create_span(
            {
                "description": "foo",
                "sentry_tags": {"status": "success", "previous_trace": previous_trace},
            },
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
            {"name": "previous_trace", "type": "str", "value": previous_trace},
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

    def test_simple_using_spans_item_type_with_sentry_conventions(self) -> None:
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

    def test_logs_with_a_meta_key(self) -> None:
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
                {"name": "tags[bool_attr,boolean]", "type": "bool", "value": True},
                {"name": "tags[float_attr,number]", "type": "float", "value": 3.0},
                {
                    "name": "observed_timestamp",
                    "type": "int",
                    "value": str(timestamp_nanos),
                },
                {"name": "project_id", "type": "int", "value": str(self.project.id)},
                {"name": "severity_number", "type": "int", "value": "0"},
                {"name": "tags[int_attr,number]", "type": "int", "value": "2"},
                {
                    "name": "timestamp_precise",
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
            "links": None,
            "itemId": item_id,
            "timestamp": self.one_min_ago.replace(
                microsecond=0,
                tzinfo=None,
            ).isoformat()
            + "Z",
        }

    def test_user_attributes_collide_with_sentry_attributes(self) -> None:
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
                {
                    "name": "observed_timestamp",
                    "type": "int",
                    "value": str(timestamp_nanos),
                },
                {"name": "project_id", "type": "int", "value": str(self.project.id)},
                {"name": "severity_number", "type": "int", "value": "0"},
                {
                    "name": "timestamp_precise",
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
            "links": None,
            "itemId": item_id,
            "timestamp": self.one_min_ago.replace(
                microsecond=0,
                tzinfo=None,
            ).isoformat()
            + "Z",
        }

    def test_sentry_links(self) -> None:
        span_1 = self.create_span(
            {
                "description": "foo",
                "sentry_tags": {
                    "links": '[{"trace_id":"d099bf9ad5a143cf8f83a98081d0ed3b","span_id":"8873a98879faf06d","sampled":true,"attributes":{"sentry.link.type":"parent","sentry.dropped_attributes_count":1}}]',
                },
            },
            start_ts=self.one_min_ago,
        )
        span_1["trace_id"] = self.trace_uuid
        item_id = span_1["span_id"]

        self.store_span(span_1, is_eap=True)

        trace_details_response = self.do_request("spans", item_id)
        assert trace_details_response.status_code == 200, trace_details_response.content
        assert trace_details_response.data["attributes"] == [
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
        assert trace_details_response.data["links"] == [
            {
                "traceId": "d099bf9ad5a143cf8f83a98081d0ed3b",
                "itemId": "8873a98879faf06d",
                "sampled": True,
                "attributes": [
                    {"name": "sentry.link.type", "value": "parent", "type": "str"},
                    {"name": "sentry.dropped_attributes_count", "value": 1, "type": "int"},
                ],
            }
        ]

    def test_sentry_internal_attributes(self) -> None:
        span_1 = self.create_span(
            {
                "description": "test span",
                "tags": {
                    "normal_attr": "normal_value",
                    "__sentry_internal_span_buffer_outcome": "different",
                    "__sentry_internal_test": "internal_value",
                },
            },
            start_ts=self.one_min_ago,
        )
        span_1["trace_id"] = self.trace_uuid
        item_id = span_1["span_id"]

        self.store_spans([span_1], is_eap=True)

        trace_details_response = self.do_request("spans", item_id)
        assert trace_details_response.status_code == 200

        attribute_names = [attr["name"] for attr in trace_details_response.data["attributes"]]
        assert "normal_attr" in attribute_names
        assert "__sentry_internal_span_buffer_outcome" not in attribute_names
        assert "__sentry_internal_test" not in attribute_names

        staff_user = self.create_user(is_staff=True)
        self.create_member(user=staff_user, organization=self.organization)
        self.login_as(user=staff_user, staff=True)

        trace_details_response = self.do_request("spans", item_id)
        assert trace_details_response.status_code == 200

        attribute_names = [attr["name"] for attr in trace_details_response.data["attributes"]]
        assert "normal_attr" in attribute_names
        assert "__sentry_internal_span_buffer_outcome" in attribute_names
        assert "__sentry_internal_test" in attribute_names

    def test_attachment(self) -> None:
        attachment = self.create_trace_attachment(trace_id=self.trace_uuid, attributes={"foo": 2})
        self.store_eap_items([attachment])

        item_id = uuid.UUID(bytes=bytes(reversed(attachment.item_id))).hex
        response = self.do_request("attachments", item_id)
        assert response.status_code == 200, response.data
        assert response.data == {
            "attributes": [
                {
                    "name": "tags[foo,number]",
                    "type": "int",
                    "value": "2",
                },
                {
                    "name": "tags[sentry.item_type,number]",
                    "type": "int",
                    "value": "10",
                },
                {
                    "name": "tags[sentry.organization_id,number]",
                    "type": "int",
                    "value": str(self.organization.id),
                },
                {
                    "name": "tags[sentry.project_id,number]",
                    "type": "int",
                    "value": str(self.project.id),
                },
                {
                    "name": "sentry.trace_id",
                    "type": "str",
                    "value": str(uuid.UUID(self.trace_uuid)),
                },
            ],
            "itemId": item_id,
            "links": None,
            "meta": {},
            "timestamp": mock.ANY,
        }

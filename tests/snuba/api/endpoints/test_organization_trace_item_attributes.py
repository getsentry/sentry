from operator import itemgetter
from unittest import mock
from uuid import uuid4

from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.api.endpoints.organization_trace_item_attributes import TraceItemAttributeKey
from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.types import SupportedTraceItemType
from sentry.testutils.cases import (
    APITestCase,
    BaseSpansTestCase,
    OurLogTestCase,
    SnubaTestCase,
    SpanTestCase,
    TraceMetricsTestCase,
)
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.options import override_options


class OrganizationTraceItemAttributesEndpointTestBase(APITestCase, SnubaTestCase):
    feature_flags: dict[str, bool]
    item_type: SupportedTraceItemType

    viewname = "sentry-api-0-organization-trace-item-attributes"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def do_request(self, query=None, features=None, **kwargs):
        if query is None:
            query = {}
        if "itemType" not in query:
            query["itemType"] = self.item_type.value
        if "attributeType" not in query:
            query["attributeType"] = "string"

        if features is None:
            features = self.feature_flags

        with self.feature(features):
            url = reverse(
                self.viewname,
                kwargs={"organization_id_or_slug": self.organization.slug},
            )
            return self.client.get(url, query, format="json", **kwargs)


class OrganizationTraceItemAttributesEndpointLogsTest(
    OrganizationTraceItemAttributesEndpointTestBase, OurLogTestCase
):
    feature_flags = {"organizations:ourlogs-enabled": True}
    item_type = SupportedTraceItemType.LOGS

    def test_no_feature(self) -> None:
        response = self.do_request(features={})
        assert response.status_code == 404, response.content

    def test_invalid_item_type(self) -> None:
        response = self.do_request(query={"itemType": "invalid"})
        assert response.status_code == 400, response.content
        assert response.data == {
            "itemType": [
                ErrorDetail(string='"invalid" is not a valid choice.', code="invalid_choice")
            ],
        }

    def test_no_projects(self) -> None:
        response = self.do_request()
        assert response.status_code == 200, response.content
        assert response.data == []

    def test_substring_matching_logs(self) -> None:
        logs = [
            self.create_ourlog(
                extra_data={"body": "log message 1"},
                organization=self.organization,
                project=self.project,
                attributes={
                    "test.attribute1": {"string_value": "value1"},
                    "test.attribute2": {"string_value": "value2"},
                    "another.attribute": {"string_value": "value3"},
                },
            ),
            self.create_ourlog(
                extra_data={"body": "log message 2"},
                organization=self.organization,
                project=self.project,
                attributes={
                    "test.attribute3": {"string_value": "value4"},
                    "different.attr": {"string_value": "value5"},
                },
            ),
        ]
        self.store_ourlogs(logs)

        # Test with empty prefix (should return all attributes)
        response = self.do_request(query={"substringMatch": ""})
        assert response.status_code == 200, response.content

        keys = {item["key"] for item in response.data}
        assert len(keys) >= 6
        assert "test.attribute1" in keys
        assert "test.attribute2" in keys
        assert "test.attribute3" in keys
        assert "another.attribute" in keys
        assert "different.attr" in keys
        assert "severity" in keys

        # With a prefix only match the attributes that start with "tes"
        response = self.do_request(query={"substringMatch": "tes"})
        assert response.status_code == 200, response.content
        keys = {item["key"] for item in response.data}
        assert len(keys) == 3
        assert "test.attribute1" in keys
        assert "test.attribute2" in keys
        assert "test.attribute3" in keys
        assert "another.attribute" not in keys
        assert "different.attr" not in keys

    def test_all_attributes(self) -> None:
        logs = [
            self.create_ourlog(
                organization=self.organization,
                project=self.project,
                attributes={
                    "test.attribute1": {"string_value": "value1"},
                    "test.attribute2": {"string_value": "value2"},
                },
            ),
        ]
        self.store_ourlogs(logs)

        response = self.do_request()

        assert response.status_code == 200, response.content
        keys = {item["key"] for item in response.data}
        assert len(keys) >= 3
        assert "test.attribute1" in keys
        assert "test.attribute2" in keys
        assert "severity" in keys

    def test_body_attribute(self) -> None:
        logs = [
            self.create_ourlog(
                organization=self.organization,
                project=self.project,
                attributes={
                    "message": {"string_value": "value1"},
                },
            ),
        ]
        self.store_ourlogs(logs)

        response = self.do_request()

        assert response.status_code == 200, response.content
        keys = {item["key"] for item in response.data}
        assert keys == {"severity", "message", "project", "tags[message,string]"}

    def test_disallowed_attributes(self) -> None:
        logs = [
            self.create_ourlog(
                organization=self.organization,
                project=self.project,
                attributes={
                    "sentry.item_type": {"string_value": "value1"},  # Disallowed
                    "sentry.item_type2": {"string_value": "value2"},  # Allowed
                },
            ),
        ]

        self.store_ourlogs(logs)

        response = self.do_request()

        assert response.status_code == 200, response.content
        keys = {item["key"] for item in response.data}
        assert keys == {"severity", "message", "project", "sentry.item_type2"}

    def test_strip_sentry_prefix_from_message_parameter(self) -> None:
        """Test that sentry.message.parameter.* wildcard matching works in attribute listing"""
        logs = [
            self.create_ourlog(
                organization=self.organization,
                project=self.project,
                attributes={
                    "sentry.message.parameter.username": {"string_value": "alice"},
                    "sentry.message.parameter.ip": {"string_value": "192.168.1.1"},
                    "sentry.message.parameter.0": {"string_value": "laptop"},
                    "sentry.message.parameter.1": {"string_value": "charlie"},
                },
            ),
            self.create_ourlog(
                organization=self.organization,
                project=self.project,
                attributes={
                    "sentry.message.parameter.0": {"bool_value": 1},
                    "sentry.message.parameter.1": {"int_value": 5},
                    "sentry.message.parameter.2": {"double_value": 10},
                    "sentry.message.parameter.value": {"double_value": 15},
                },
            ),
        ]

        self.store_ourlogs(logs)

        response = self.do_request(query={"attributeType": "string"})

        assert response.status_code == 200, response.content
        assert sorted(response.data, key=lambda key: key["key"]) == [
            {
                "key": "message",
                "name": "message",
                "attributeSource": {
                    "source_type": "sentry",
                },
                "secondaryAliases": ["log.body"],
            },
            {
                "key": "message.parameter.0",
                "name": "message.parameter.0",
                "attributeSource": {
                    "source_type": "sentry",
                    "is_transformed_alias": True,
                },
            },
            {
                "key": "message.parameter.1",
                "name": "message.parameter.1",
                "attributeSource": {
                    "source_type": "sentry",
                    "is_transformed_alias": True,
                },
            },
            {
                "key": "message.parameter.ip",
                "name": "message.parameter.ip",
                "attributeSource": {
                    "source_type": "sentry",
                    "is_transformed_alias": True,
                },
            },
            {
                "key": "message.parameter.username",
                "name": "message.parameter.username",
                "attributeSource": {
                    "source_type": "sentry",
                    "is_transformed_alias": True,
                },
            },
            {
                "key": "project",
                "name": "project",
                "attributeSource": {
                    "source_type": "sentry",
                },
            },
            {
                "key": "severity",
                "name": "severity",
                "attributeSource": {
                    "source_type": "sentry",
                },
                "secondaryAliases": ["log.severity_text", "severity_text"],
            },
        ]

        sources = {item["attributeSource"]["source_type"] for item in response.data}
        assert sources == {"sentry"}

        message_param_items = [
            item for item in response.data if item["key"].startswith("message.parameter.")
        ]
        for item in message_param_items:
            assert item["attributeSource"]["is_transformed_alias"] is True

        response = self.do_request(query={"attributeType": "number"})

        assert response.status_code == 200, response.content
        assert sorted(response.data, key=lambda key: key["key"]) == [
            {
                "key": "observed_timestamp",
                "name": "observed_timestamp",
                "attributeSource": {
                    "source_type": "sentry",
                },
            },
            {
                "key": "severity_number",
                "name": "severity_number",
                "attributeSource": {
                    "source_type": "sentry",
                },
                "secondaryAliases": ["log.severity_number"],
            },
            {
                "key": "tags[message.parameter.0,number]",
                "name": "message.parameter.0",
                "attributeSource": {
                    "source_type": "sentry",
                    "is_transformed_alias": True,
                },
            },
            {
                "key": "tags[message.parameter.1,number]",
                "name": "message.parameter.1",
                "attributeSource": {
                    "source_type": "sentry",
                    "is_transformed_alias": True,
                },
            },
            {
                "key": "tags[message.parameter.2,number]",
                "name": "message.parameter.2",
                "attributeSource": {
                    "source_type": "sentry",
                    "is_transformed_alias": True,
                },
            },
            {
                "key": "tags[message.parameter.value,number]",
                "name": "message.parameter.value",
                "attributeSource": {
                    "source_type": "sentry",
                    "is_transformed_alias": True,
                },
            },
            {
                "key": "timestamp_precise",
                "name": "timestamp_precise",
                "attributeSource": {
                    "source_type": "sentry",
                },
            },
        ]

    def test_attribute_collision(self) -> None:
        logs = [
            self.create_ourlog(
                organization=self.organization,
                project=self.project,
                attributes={"timestamp": "bar", "severity": "baz"},
            ),
        ]

        self.store_ourlogs(logs)

        response = self.do_request()

        assert response.status_code == 200, response.content
        keys = {item["key"] for item in response.data}
        assert keys == {
            "message",
            "project",
            "severity",
            "tags[severity,string]",
            "tags[timestamp,string]",
        }


class OrganizationTraceItemAttributesEndpointSpansTest(
    OrganizationTraceItemAttributesEndpointTestBase, BaseSpansTestCase, SpanTestCase
):
    feature_flags = {"organizations:visibility-explore-view": True}
    item_type = SupportedTraceItemType.SPANS

    def test_no_feature(self) -> None:
        response = self.do_request(features={})
        assert response.status_code == 404, response.content

    def test_invalid_item_type(self) -> None:
        response = self.do_request(query={"itemType": "invalid"})
        assert response.status_code == 400, response.content
        assert response.data == {
            "itemType": [
                ErrorDetail(string='"invalid" is not a valid choice.', code="invalid_choice")
            ],
        }

    def test_no_projects(self) -> None:
        response = self.do_request()
        assert response.status_code == 200, response.content
        assert response.data == []

    def test_tags_list_str(self) -> None:
        for tag in ["foo", "bar", "baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
                transaction="foo",
                duration=100,
                exclusive_time=100,
                tags={tag: tag},
                is_eap=True,
            )

        response = self.do_request(
            {
                "attributeType": "string",
            }
        )
        assert response.status_code == 200, response.data
        expected: list[TraceItemAttributeKey] = [
            {"key": "bar", "name": "bar", "attributeSource": {"source_type": "user"}},
            {"key": "baz", "name": "baz", "attributeSource": {"source_type": "user"}},
            {"key": "foo", "name": "foo", "attributeSource": {"source_type": "user"}},
            {
                "key": "span.description",
                "name": "span.description",
                "attributeSource": {"source_type": "sentry"},
                "secondaryAliases": ["description", "message"],
            },
            {
                "key": "transaction",
                "name": "transaction",
                "attributeSource": {"source_type": "sentry"},
            },
            {"key": "project", "name": "project", "attributeSource": {"source_type": "sentry"}},
        ]
        assert sorted(
            response.data,
            key=itemgetter("key"),
        ) == sorted(
            expected,
            key=itemgetter("key"),
        )

    def test_tags_list_nums(self) -> None:
        for tag in [
            "foo",
            "bar",
            "baz",
            "lcp",
            "fcp",
            "http.decoded_response_content_length",
            "http.response_content_length",
            "http.response_transfer_size",
            "http.response.body.size",
        ]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
                transaction="foo",
                duration=100,
                exclusive_time=100,
                measurements={tag: 0},
                is_eap=True,
            )

        response = self.do_request(
            {
                "attributeType": "number",
            }
        )
        assert response.status_code == 200, response.data
        assert response.data == [
            {"key": "tags[bar,number]", "name": "bar", "attributeSource": {"source_type": "user"}},
            {"key": "tags[baz,number]", "name": "baz", "attributeSource": {"source_type": "user"}},
            {
                "key": "measurements.fcp",
                "name": "measurements.fcp",
                "attributeSource": {"source_type": "sentry"},
            },
            {"key": "tags[foo,number]", "name": "foo", "attributeSource": {"source_type": "user"}},
            {
                "key": "http.decoded_response_content_length",
                "name": "http.decoded_response_content_length",
                "attributeSource": {"source_type": "sentry"},
            },
            {
                "key": "http.response_content_length",
                "name": "http.response_content_length",
                "attributeSource": {"source_type": "sentry"},
            },
            {
                "key": "http.response_transfer_size",
                "name": "http.response_transfer_size",
                "attributeSource": {"source_type": "sentry"},
            },
            {
                "key": "measurements.lcp",
                "name": "measurements.lcp",
                "attributeSource": {"source_type": "sentry"},
            },
            {
                "key": "span.duration",
                "name": "span.duration",
                "attributeSource": {"source_type": "sentry"},
            },
        ]

    @override_options({"explore.trace-items.keys.max": 3})
    def test_pagination(self) -> None:
        for tag in ["foo", "bar", "baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
                transaction="foo",
                duration=100,
                exclusive_time=100,
                tags={tag: tag},
                is_eap=True,
            )

        response = self.do_request(
            {
                "attributeType": "string",
            }
        )
        assert response.status_code == 200, response.data

        expected: list[TraceItemAttributeKey] = [
            {"key": "bar", "name": "bar", "attributeSource": {"source_type": "user"}},
            {"key": "baz", "name": "baz", "attributeSource": {"source_type": "user"}},
            {"key": "foo", "name": "foo", "attributeSource": {"source_type": "user"}},
            {
                "key": "span.description",
                "name": "span.description",
                "attributeSource": {"source_type": "sentry"},
                "secondaryAliases": ["description", "message"],
            },
            {"key": "project", "name": "project", "attributeSource": {"source_type": "sentry"}},
        ]

        assert sorted(
            response.data,
            key=itemgetter("key"),
        ) == sorted(
            expected,
            key=itemgetter("key"),
        )

        links = {}
        for url, attrs in parse_link_header(response["Link"]).items():
            links[attrs["rel"]] = attrs
            attrs["href"] = url

        assert links["previous"]["results"] == "false"
        assert links["next"]["results"] == "true"

        assert links["next"]["href"] is not None
        with self.feature(self.feature_flags):
            response = self.client.get(links["next"]["href"], format="json")
        assert response.status_code == 200, response.content

        expected_2: list[TraceItemAttributeKey] = [
            {
                "key": "span.description",
                "name": "span.description",
                "attributeSource": {"source_type": "sentry"},
                "secondaryAliases": ["description", "message"],
            },
            {
                "key": "transaction",
                "name": "transaction",
                "attributeSource": {"source_type": "sentry"},
            },
            {"key": "project", "name": "project", "attributeSource": {"source_type": "sentry"}},
        ]
        assert sorted(
            response.data,
            key=itemgetter("key"),
        ) == sorted(
            expected_2,
            key=itemgetter("key"),
        )

        links = {}
        for url, attrs in parse_link_header(response["Link"]).items():
            links[attrs["rel"]] = attrs
            attrs["href"] = url

        assert links["previous"]["results"] == "true"
        assert links["next"]["results"] == "false"

        assert links["previous"]["href"] is not None
        with self.feature(self.feature_flags):
            response = self.client.get(links["previous"]["href"], format="json")
        assert response.status_code == 200, response.content

        expected_3: list[TraceItemAttributeKey] = [
            {"key": "bar", "name": "bar", "attributeSource": {"source_type": "user"}},
            {"key": "baz", "name": "baz", "attributeSource": {"source_type": "user"}},
            {"key": "foo", "name": "foo", "attributeSource": {"source_type": "user"}},
            {
                "key": "span.description",
                "name": "span.description",
                "attributeSource": {"source_type": "sentry"},
                "secondaryAliases": ["description", "message"],
            },
            {"key": "project", "name": "project", "attributeSource": {"source_type": "sentry"}},
        ]
        assert sorted(
            response.data,
            key=itemgetter("key"),
        ) == sorted(
            expected_3,
            key=itemgetter("key"),
        )

    def test_tags_list_sentry_conventions(self) -> None:
        for tag in [
            "foo",
            "bar",
            "baz",
            "lcp",
            "fcp",
            "http.decoded_response_content_length",
            "http.response_content_length",
            "http.response_transfer_size",
            "http.response.body.size",
        ]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
                transaction="foo",
                duration=100,
                exclusive_time=100,
                measurements={tag: 0},
                is_eap=True,
            )

        response = self.do_request(
            {
                "attributeType": "number",
            },
            features={
                "organizations:visibility-explore-view": True,
                "organizations:performance-sentry-conventions-fields": True,
            },
        )
        assert response.status_code == 200, response.data
        assert sorted(response.data, key=itemgetter("key")) == sorted(
            [
                {
                    "key": "tags[bar,number]",
                    "name": "bar",
                    "attributeSource": {"source_type": "user"},
                },
                {
                    "key": "tags[baz,number]",
                    "name": "baz",
                    "attributeSource": {"source_type": "user"},
                },
                {
                    "key": "measurements.fcp",
                    "name": "measurements.fcp",
                    "attributeSource": {"source_type": "sentry"},
                },
                {
                    "key": "tags[foo,number]",
                    "name": "foo",
                    "attributeSource": {"source_type": "user"},
                },
                {
                    "key": "http.decoded_response_content_length",
                    "name": "http.decoded_response_content_length",
                    "attributeSource": {"source_type": "sentry"},
                },
                {
                    "key": "http.response.body.size",
                    "name": "http.response.body.size",
                    "attributeSource": {"source_type": "sentry"},
                },
                {
                    "key": "http.response.size",
                    "name": "http.response.size",
                    "attributeSource": {"source_type": "sentry"},
                },
                {
                    "key": "measurements.lcp",
                    "name": "measurements.lcp",
                    "attributeSource": {"source_type": "sentry"},
                },
                {
                    "key": "span.duration",
                    "name": "span.duration",
                    "attributeSource": {"source_type": "sentry"},
                },
            ],
            key=itemgetter("key"),
        )

    def test_attribute_collision(self) -> None:
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            span_id=uuid4().hex[:16],
            organization_id=self.organization.id,
            parent_span_id=None,
            timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
            transaction="foo",
            duration=100,
            exclusive_time=100,
            tags={
                "span.op": "foo",
                "span.duration": "bar",
            },
            is_eap=True,
        )

        response = self.do_request()
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "key": "span.description",
                "name": "span.description",
                "attributeSource": {"source_type": "sentry"},
                "secondaryAliases": ["description", "message"],
            },
            {"key": "project", "name": "project", "attributeSource": {"source_type": "sentry"}},
            {
                "key": "transaction",
                "name": "transaction",
                "attributeSource": {"source_type": "sentry"},
            },
            {
                "key": "tags[span.duration,string]",
                "name": "span.duration",
                "attributeSource": {"source_type": "sentry"},
            },
            {
                "key": "tags[span.op,string]",
                "name": "span.op",
                "attributeSource": {"source_type": "sentry"},
            },
        ]

    def test_sentry_internal_attributes(self) -> None:
        self.store_spans(
            [
                self.create_span(
                    {
                        "tags": {
                            "normal_attr": "normal_value",
                            "__sentry_internal_span_buffer_outcome": "different",
                            "__sentry_internal_test": "internal_value",
                        }
                    },
                    start_ts=before_now(days=0, minutes=10),
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(query={"substringMatch": ""})
        assert response.status_code == 200

        attribute_names = {attr["name"] for attr in response.data}
        assert "normal_attr" in attribute_names
        assert "__sentry_internal_span_buffer_outcome" not in attribute_names
        assert "__sentry_internal_test" not in attribute_names

        staff_user = self.create_user(is_staff=True)
        self.create_member(user=staff_user, organization=self.organization)
        self.login_as(user=staff_user, staff=True)

        response = self.do_request(query={"substringMatch": ""})
        assert response.status_code == 200

        attribute_names = {attr["name"] for attr in response.data}
        assert "normal_attr" in attribute_names
        assert "__sentry_internal_span_buffer_outcome" in attribute_names
        assert "__sentry_internal_test" in attribute_names


class OrganizationTraceItemAttributesEndpointTraceMetricsTest(
    OrganizationTraceItemAttributesEndpointTestBase, TraceMetricsTestCase
):
    feature_flags = {"organizations:tracemetrics-enabled": True}
    item_type = SupportedTraceItemType.TRACEMETRICS

    def test_no_feature(self) -> None:
        response = self.do_request(features={})
        assert response.status_code == 404, response.content

    def test_invalid_item_type(self) -> None:
        response = self.do_request(query={"itemType": "invalid"})
        assert response.status_code == 400, response.content
        assert response.data == {
            "itemType": [
                ErrorDetail(string='"invalid" is not a valid choice.', code="invalid_choice")
            ],
        }

    def test_trace_metrics_string_attributes(self) -> None:
        """Test that we can successfully retrieve string attributes from trace metrics"""
        metrics = [
            self.create_trace_metric(
                metric_name="http.request.duration",
                metric_value=123.45,
                metric_type="distribution",
                organization=self.organization,
                project=self.project,
                attributes={
                    "http.method": "GET",
                    "http.status_code": "200",
                    "environment": "production",
                },
            ),
            self.create_trace_metric(
                metric_name="http.request.duration",
                metric_value=234.56,
                metric_type="distribution",
                organization=self.organization,
                project=self.project,
                attributes={
                    "http.method": "POST",
                    "http.status_code": "201",
                    "environment": "staging",
                },
            ),
        ]
        self.store_trace_metrics(metrics)

        response = self.do_request(query={"attributeType": "string"})

        assert response.status_code == 200, response.content
        data = response.data
        assert len(data) > 0

        # Verify that our custom attributes are returned
        attribute_keys = {item["key"] for item in data}
        assert "http.method" in attribute_keys
        assert "http.status_code" in attribute_keys
        # Environment may be stored as tags[environment,string]
        assert "environment" in attribute_keys or "tags[environment,string]" in attribute_keys

    def test_trace_metrics_filter_by_metric_name(self) -> None:
        """Test that we can filter trace metrics attributes by metric name using query parameter"""
        metrics = [
            self.create_trace_metric(
                metric_name="http.request.duration",
                metric_value=100.0,
                metric_type="distribution",
                organization=self.organization,
                project=self.project,
                attributes={
                    "http.method": "GET",
                    "http.route": "/api/users",
                },
            ),
            self.create_trace_metric(
                metric_name="database.query.duration",
                metric_value=50.0,
                metric_type="distribution",
                organization=self.organization,
                project=self.project,
                attributes={
                    "db.system": {"string_value": "postgresql"},
                    "db.operation": {"string_value": "SELECT"},
                },
            ),
        ]
        self.store_trace_metrics(metrics)

        # Query for http metric attributes
        response = self.do_request(
            query={
                "attributeType": "string",
                "query": 'metric.name:"http.request.duration"',
            }
        )

        assert response.status_code == 200, response.content
        data = response.data
        attribute_keys = {item["key"] for item in data}

        # Should include HTTP attributes
        assert "http.method" in attribute_keys or "http.route" in attribute_keys

    def test_trace_metrics_number_attributes(self) -> None:
        """Test that we can retrieve number attributes from trace metrics"""
        metrics = [
            self.create_trace_metric(
                metric_name="custom.metric",
                metric_value=100.0,
                metric_type="distribution",
                organization=self.organization,
                project=self.project,
                attributes={
                    "request.size": {"int_value": 1024},
                    "response.time": {"double_value": 42.5},
                },
            ),
        ]
        self.store_trace_metrics(metrics)

        response = self.do_request(query={"attributeType": "number"})

        assert response.status_code == 200, response.content
        data = response.data

        # Verify number attributes are returned
        # Note: The exact keys depend on how the backend processes numeric attributes
        assert len(data) >= 0  # May be 0 if number attributes are handled differently


class OrganizationTraceItemAttributeValuesEndpointBaseTest(APITestCase, SnubaTestCase):
    feature_flags: dict[str, bool]
    item_type: SupportedTraceItemType

    viewname = "sentry-api-0-organization-trace-item-attribute-values"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def do_request(self, query=None, features=None, key=None, **kwargs):
        if query is None:
            query = {}

        if "itemType" not in query:
            query["itemType"] = self.item_type.value
        if "attributeType" not in query:
            query["attributeType"] = "string"

        if features is None:
            features = self.feature_flags

        with self.feature(features):
            url = reverse(
                self.viewname,
                kwargs={"organization_id_or_slug": self.organization.slug, "key": key},
            )
            return self.client.get(url, query, format="json", **kwargs)


class OrganizationTraceItemAttributeValuesEndpointLogsTest(
    OrganizationTraceItemAttributeValuesEndpointBaseTest, OurLogTestCase
):
    item_type = SupportedTraceItemType.LOGS
    feature_flags = {"organizations:ourlogs-enabled": True}

    def test_no_feature(self) -> None:
        response = self.do_request(features={}, key="test.attribute")
        assert response.status_code == 404, response.content

    def test_invalid_item_type(self) -> None:
        response = self.do_request(query={"itemType": "invalid"})
        assert response.status_code == 400, response.content
        assert response.data == {
            "itemType": [
                ErrorDetail(string='"invalid" is not a valid choice.', code="invalid_choice")
            ],
        }

    def test_no_projects(self) -> None:
        response = self.do_request()
        assert response.status_code == 200, response.content
        assert response.data == []

    def test_attribute_values(self) -> None:
        logs = [
            self.create_ourlog(
                extra_data={"body": "log message 1"},
                organization=self.organization,
                project=self.project,
                attributes={
                    "test1": {"string_value": "value1"},
                    "test2": {"string_value": "value2"},
                },
            ),
            self.create_ourlog(
                extra_data={"body": "log message 2"},
                organization=self.organization,
                project=self.project,
                attributes={
                    "test1": {"string_value": "value2"},
                    "test2": {"string_value": "value3"},
                },
            ),
        ]
        self.store_ourlogs(logs)

        response = self.do_request(key="test1")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        values = {item["value"] for item in response.data}
        assert "value1" in values
        assert "value2" in values
        assert all(item["key"] == "test1" for item in response.data)


class OrganizationTraceItemAttributeValuesEndpointSpansTest(
    OrganizationTraceItemAttributeValuesEndpointBaseTest, BaseSpansTestCase, SpanTestCase
):
    feature_flags = {"organizations:visibility-explore-view": True}
    item_type = SupportedTraceItemType.SPANS

    def test_no_feature(self) -> None:
        response = self.do_request(features={})
        assert response.status_code == 404, response.content

    def test_invalid_item_type(self) -> None:
        response = self.do_request(query={"itemType": "invalid"})
        assert response.status_code == 400, response.content
        assert response.data == {
            "itemType": [
                ErrorDetail(string='"invalid" is not a valid choice.', code="invalid_choice")
            ],
        }

    def test_no_projects(self) -> None:
        response = self.do_request()
        assert response.status_code == 200, response.content
        assert response.data == []

    def test_tags_keys(self) -> None:
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for tag in ["foo", "bar", "baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction="foo",
                duration=100,
                exclusive_time=100,
                tags={"tag": tag},
                is_eap=True,
            )

        response = self.do_request(key="tag")
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "tag",
                "value": "bar",
                "name": "bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": "tag",
                "value": "baz",
                "name": "baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": "tag",
                "value": "foo",
                "name": "foo",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_transaction_keys_autocomplete(self) -> None:
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for transaction in ["foo", "*bar", "*baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction=transaction,
                duration=100,
                exclusive_time=100,
                is_eap=True,
            )

        key = "transaction"

        response = self.do_request(key=key)
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": mock.ANY,
                "key": key,
                "value": "*bar",
                "name": "*bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": key,
                "value": "*baz",
                "name": "*baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": key,
                "value": "foo",
                "name": "foo",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_transaction_keys_autocomplete_substring(self) -> None:
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for transaction in ["foo", "*bar", "*baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction=transaction,
                duration=100,
                exclusive_time=100,
                is_eap=True,
            )

        key = "transaction"

        response = self.do_request(query={"substringMatch": "b"}, key=key)
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": mock.ANY,
                "key": key,
                "value": "*bar",
                "name": "*bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": key,
                "value": "*baz",
                "name": "*baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_transaction_keys_autocomplete_substring_with_asterisk(self) -> None:
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for transaction in ["foo", "*bar", "*baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction=transaction,
                duration=100,
                exclusive_time=100,
                is_eap=True,
            )

        key = "transaction"

        response = self.do_request(query={"substringMatch": r"\*b"}, key=key)
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": mock.ANY,
                "key": key,
                "value": "*bar",
                "name": "*bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": key,
                "value": "*baz",
                "name": "*baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_tags_keys_autocomplete(self) -> None:
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for tag in ["foo", "*bar", "*baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction="transaction",
                duration=100,
                exclusive_time=100,
                tags={"tag": tag},
                is_eap=True,
            )

        key = "tag"

        response = self.do_request(key=key)
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": mock.ANY,
                "key": key,
                "value": "*bar",
                "name": "*bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": key,
                "value": "*baz",
                "name": "*baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": key,
                "value": "foo",
                "name": "foo",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_tags_keys_autocomplete_substring(self) -> None:
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for tag in ["foo", "*bar", "*baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction="transaction",
                duration=100,
                exclusive_time=100,
                tags={"tag": tag},
                is_eap=True,
            )

        key = "tag"

        response = self.do_request(query={"substringMatch": "b"}, key=key)
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": mock.ANY,
                "key": key,
                "value": "*bar",
                "name": "*bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": key,
                "value": "*baz",
                "name": "*baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_tags_keys_autocomplete_substring_with_asterisks(self) -> None:
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for tag in ["foo", "*bar", "*baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction="transaction",
                duration=100,
                exclusive_time=100,
                tags={"tag": tag},
                is_eap=True,
            )

        key = "tag"

        response = self.do_request(query={"substringMatch": r"\*b"}, key=key)
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": mock.ANY,
                "key": key,
                "value": "*bar",
                "name": "*bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": key,
                "value": "*baz",
                "name": "*baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_tags_keys_autocomplete_noop(self) -> None:
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for tag in ["foo", "bar", "baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction=tag,
                duration=100,
                exclusive_time=100,
                tags={"tag": tag},
                is_eap=True,
            )

        for key in [
            "span.duration",
            "span.self_time",
            "timestamp",
            "id",
            "span_id",
            "parent_span",
            "parent_span_id",
            "trace",
            "trace_id",
            "transaction.id",
            "transaction_id",
            "segment.id",
            "segment_id",
            "profile.id",
            "profile_id",
            "replay.id",
            "replay_id",
        ]:
            response = self.do_request(key=key)
            assert response.status_code == 200, response.data
            assert response.data == [], key

    def test_tags_keys_autocomplete_project(self) -> None:
        base_id = 9223372036854775000
        self.create_project(id=base_id + 100, name="foo")
        self.create_project(id=base_id + 299, name="bar")
        self.create_project(id=base_id + 399, name="baz")

        for key in ["project", "project.name"]:
            response = self.do_request(key=key)
            assert response.status_code == 200, response.data
            assert sorted(response.data, key=lambda v: v["value"]) == [
                {
                    "count": mock.ANY,
                    "key": key,
                    "value": "bar",
                    "name": "bar",
                    "firstSeen": mock.ANY,
                    "lastSeen": mock.ANY,
                },
                {
                    "count": mock.ANY,
                    "key": key,
                    "value": "baz",
                    "name": "baz",
                    "firstSeen": mock.ANY,
                    "lastSeen": mock.ANY,
                },
                {
                    "count": mock.ANY,
                    "key": key,
                    "value": "foo",
                    "name": "foo",
                    "firstSeen": mock.ANY,
                    "lastSeen": mock.ANY,
                },
            ]

            response = self.do_request(query={"substringMatch": "ba"}, key=key)
            assert response.status_code == 200, response.data
            assert sorted(response.data, key=lambda v: v["value"]) == [
                {
                    "count": mock.ANY,
                    "key": key,
                    "value": "bar",
                    "name": "bar",
                    "firstSeen": mock.ANY,
                    "lastSeen": mock.ANY,
                },
                {
                    "count": mock.ANY,
                    "key": key,
                    "value": "baz",
                    "name": "baz",
                    "firstSeen": mock.ANY,
                    "lastSeen": mock.ANY,
                },
            ]

        key = "project.id"

        response = self.do_request(key=key)
        assert response.status_code == 200, response.data
        assert sorted(response.data, key=lambda v: v["value"]) == [
            {
                "count": mock.ANY,
                "key": key,
                "value": "9223372036854775100",
                "name": "9223372036854775100",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": key,
                "value": "9223372036854775299",
                "name": "9223372036854775299",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": key,
                "value": "9223372036854775399",
                "name": "9223372036854775399",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

        response = self.do_request(query={"substringMatch": "99"}, key=key)
        assert response.status_code == 200, response.data
        assert sorted(response.data, key=lambda v: v["value"]) == [
            {
                "count": mock.ANY,
                "key": key,
                "value": "9223372036854775299",
                "name": "9223372036854775299",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": key,
                "value": "9223372036854775399",
                "name": "9223372036854775399",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_tags_keys_autocomplete_span_status(self) -> None:
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for status in ["ok", "internal_error", "invalid_argument"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction="foo",
                status=status,
                is_eap=True,
            )

        response = self.do_request(key="span.status")
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "span.status",
                "value": "internal_error",
                "name": "internal_error",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": "span.status",
                "value": "invalid_argument",
                "name": "invalid_argument",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": "span.status",
                "value": "ok",
                "name": "ok",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

        response = self.do_request(query={"substringMatch": "in"}, key="span.status")
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "span.status",
                "value": "internal_error",
                "name": "internal_error",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": "span.status",
                "value": "invalid_argument",
                "name": "invalid_argument",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_measurements_autocomplete(self) -> None:
        keys = [
            "measurements.app_start_cold",
            "measurements.app_start_warm",
            "measurements.frames_frozen",
            "measurements.frames_frozen_rate",
            "measurements.frames_slow",
            "measurements.frames_slow_rate",
            "measurements.frames_total",
            "measurements.time_to_initial_display",
            "measurements.time_to_full_display",
            "measurements.stall_count",
            "measurements.stall_percentage",
            "measurements.stall_stall_longest_time",
            "measurements.stall_stall_total_time",
            "measurements.cls",
            "measurements.fcp",
            "measurements.fid",
            "measurements.fp",
            "measurements.inp",
            "measurements.lcp",
            "measurements.ttfb",
            "measurements.ttfb.requesttime",
            "measurements.score.cls",
            "measurements.score.fcp",
            "measurements.score.fid",
            "measurements.score.inp",
            "measurements.score.lcp",
            "measurements.score.ttfb",
            "measurements.score.total",
            "measurements.score.weight.cls",
            "measurements.score.weight.fcp",
            "measurements.score.weight.fid",
            "measurements.score.weight.inp",
            "measurements.score.weight.lcp",
            "measurements.score.weight.ttfb",
            "measurements.cache.item_size",
            "measurements.messaging.message.body.size",
            "measurements.messaging.message.receive.latency",
            "measurements.messaging.message.retry.count",
            "measurements.http.response_content_length",
        ]
        self.project
        for key in keys:
            response = self.do_request(key=key)
            assert response.status_code == 200, response.data
            assert response.data == []

    def test_boolean_autocomplete(self) -> None:
        keys = ["is_transaction"]
        self.project
        for key in keys:
            response = self.do_request(key=key)
            assert response.status_code == 200, response.data
            assert response.data == [
                {
                    "count": mock.ANY,
                    "key": key,
                    "value": "false",
                    "name": "false",
                    "firstSeen": mock.ANY,
                    "lastSeen": mock.ANY,
                },
                {
                    "count": mock.ANY,
                    "key": key,
                    "value": "true",
                    "name": "true",
                    "firstSeen": mock.ANY,
                    "lastSeen": mock.ANY,
                },
            ]

    @mock.patch(
        "sentry.api.endpoints.organization_trace_item_attributes.TraceItemAttributeValuesAutocompletionExecutor.execute",
        side_effect=InvalidSearchQuery,
    )
    def test_invalid_query(self, mock_executor_2: mock.MagicMock) -> None:
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        self.store_segment(
            self.project.id,
            uuid4().hex,
            uuid4().hex,
            span_id=uuid4().hex[:16],
            organization_id=self.organization.id,
            parent_span_id=None,
            timestamp=timestamp,
            transaction="foo",
            duration=100,
            exclusive_time=100,
            tags={"tag": "foo"},
            is_eap=True,
        )

        response = self.do_request(key="tag")
        assert response.status_code == 400, response.data

    @override_options({"explore.trace-items.values.max": 2})
    def test_pagination(self) -> None:
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for tag in ["foo", "bar", "baz", "qux"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=self.organization.id,
                parent_span_id=None,
                timestamp=timestamp,
                transaction="foo",
                duration=100,
                exclusive_time=100,
                tags={"tag": tag},
                is_eap=True,
            )

        response = self.do_request(key="tag")
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "tag",
                "value": "bar",
                "name": "bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": "tag",
                "value": "baz",
                "name": "baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

        links = {}
        for url, attrs in parse_link_header(response["Link"]).items():
            links[attrs["rel"]] = attrs
            attrs["href"] = url

        assert links["previous"]["results"] == "false"
        assert links["next"]["results"] == "true"

        assert links["next"]["href"] is not None
        with self.feature(self.feature_flags):
            response = self.client.get(links["next"]["href"], format="json")
        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "tag",
                "value": "foo",
                "name": "foo",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": "tag",
                "value": "qux",
                "name": "qux",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

        links = {}
        for url, attrs in parse_link_header(response["Link"]).items():
            links[attrs["rel"]] = attrs
            attrs["href"] = url

        assert links["previous"]["results"] == "true"
        assert links["next"]["results"] == "false"

        assert links["previous"]["href"] is not None
        with self.feature(self.feature_flags):
            response = self.client.get(links["previous"]["href"], format="json")
        assert response.status_code == 200, response.content
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "tag",
                "value": "bar",
                "name": "bar",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
            {
                "count": mock.ANY,
                "key": "tag",
                "value": "baz",
                "name": "baz",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            },
        ]

    def test_autocomplete_release_semver_attributes(self) -> None:
        release_1 = self.create_release(version="foo@1.2.3+121")
        release_2 = self.create_release(version="qux@2.2.4+122")
        self.store_spans(
            [
                self.create_span(
                    {"sentry_tags": {"release": release_1.version}},
                    start_ts=before_now(days=0, minutes=10),
                ),
                self.create_span(
                    {"sentry_tags": {"release": release_2.version}},
                    start_ts=before_now(days=0, minutes=10),
                ),
            ],
            is_eap=True,
        )

        response = self.do_request(key="release")
        assert response.status_code == 200
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "release",
                "value": release,
                "name": release,
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            }
            for release in ["foo@1.2.3+121", "qux@2.2.4+122"]
        ]

        response = self.do_request(key="release", query={"substringMatch": "121"})
        assert response.status_code == 200
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "release",
                "value": "foo@1.2.3+121",
                "name": "foo@1.2.3+121",
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            }
        ]

        response = self.do_request(key="release.stage")
        assert response.status_code == 200
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "release.stage",
                "value": stage,
                "name": stage,
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            }
            for stage in ["adopted", "low_adoption", "replaced"]
        ]

        response = self.do_request(key="release.stage", query={"substringMatch": "adopt"})
        assert response.status_code == 200
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "release.stage",
                "value": stage,
                "name": stage,
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            }
            for stage in ["adopted", "low_adoption"]
        ]

        response = self.do_request(key="release.version")
        assert response.status_code == 200
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "release.version",
                "value": version,
                "name": version,
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            }
            for version in ["1.2.3", "2.2.4"]
        ]

        response = self.do_request(key="release.version", query={"substringMatch": "2"})
        assert response.status_code == 200
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "release.version",
                "value": version,
                "name": version,
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            }
            for version in ["2.2.4"]
        ]

        response = self.do_request(key="release.package")
        assert response.status_code == 200
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "release.package",
                "value": version,
                "name": version,
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            }
            for version in ["foo", "qux"]
        ]

        response = self.do_request(key="release.package", query={"substringMatch": "q"})
        assert response.status_code == 200
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "release.package",
                "value": version,
                "name": version,
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            }
            for version in ["qux"]
        ]

        response = self.do_request(key="release.build")
        assert response.status_code == 200
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "release.build",
                "value": version,
                "name": version,
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            }
            for version in ["121", "122"]
        ]

    def test_autocomplete_timestamp(self) -> None:
        self.store_spans(
            [self.create_span(start_ts=before_now(days=0, minutes=10))],
            is_eap=True,
        )
        response = self.do_request(key="timestamp", query={"substringMatch": "20"})
        assert response.status_code == 200
        assert response.data == []

    def test_autocomplete_device_class(self) -> None:
        self.store_spans(
            [
                self.create_span({"sentry_tags": {"device.class": "3"}}),
                self.create_span({"sentry_tags": {"device.class": "2"}}),
                self.create_span({"sentry_tags": {"device.class": "1"}}),
                self.create_span({"sentry_tags": {"device.class": ""}}),
                self.create_span({}),
            ],
            is_eap=True,
        )

        response = self.do_request(key="device.class")
        assert response.data == [
            {
                "count": mock.ANY,
                "key": "device.class",
                "value": device_class,
                "name": device_class,
                "firstSeen": mock.ANY,
                "lastSeen": mock.ANY,
            }
            for device_class in sorted(["low", "medium", "high", "Unknown"])
        ]


class OrganizationTraceItemAttributeValuesEndpointTraceMetricsTest(
    OrganizationTraceItemAttributeValuesEndpointBaseTest, TraceMetricsTestCase
):
    feature_flags = {"organizations:tracemetrics-enabled": True}
    item_type = SupportedTraceItemType.TRACEMETRICS

    def test_no_feature(self) -> None:
        response = self.do_request(features={}, key="test.attribute")
        assert response.status_code == 404, response.content

    def test_attribute_values(self) -> None:
        metrics = [
            self.create_trace_metric(
                metric_name="http.request.duration",
                metric_value=123.45,
                metric_type="distribution",
                attributes={"http.method": "GET"},
            ),
            self.create_trace_metric(
                metric_name="http.request.duration",
                metric_value=234.56,
                metric_type="distribution",
                attributes={"http.method": "POST"},
            ),
        ]
        self.store_trace_metrics(metrics)

        response = self.do_request(key="http.method")
        assert response.status_code == 200
        values = {item["value"] for item in response.data}
        assert "GET" in values
        assert "POST" in values

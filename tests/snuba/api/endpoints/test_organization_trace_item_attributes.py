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
)
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.options import override_options


class OrganizationTraceItemAttributesEndpointTestBase(APITestCase, SnubaTestCase):
    feature_flags: dict[str, bool]
    item_type: SupportedTraceItemType

    viewname = "sentry-api-0-organization-trace-item-attributes"

    def setUp(self):
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

    def test_no_feature(self):
        response = self.do_request(features={})
        assert response.status_code == 404, response.content

    def test_invalid_item_type(self):
        response = self.do_request(query={"itemType": "invalid"})
        assert response.status_code == 400, response.content
        assert response.data == {
            "itemType": [
                ErrorDetail(string='"invalid" is not a valid choice.', code="invalid_choice")
            ],
        }

    def test_no_projects(self):
        response = self.do_request()
        assert response.status_code == 200, response.content
        assert response.data == []

    def test_substring_matching_logs(self):
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

    def test_all_attributes(self):
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

    def test_body_attribute(self):
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
        assert keys == {"severity", "message", "project"}

    def test_disallowed_attributes(self):
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

    def test_attribute_collision(self):
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
    OrganizationTraceItemAttributesEndpointTestBase, BaseSpansTestCase
):
    feature_flags = {"organizations:visibility-explore-view": True}
    item_type = SupportedTraceItemType.SPANS

    def test_no_feature(self):
        response = self.do_request(features={})
        assert response.status_code == 404, response.content

    def test_invalid_item_type(self):
        response = self.do_request(query={"itemType": "invalid"})
        assert response.status_code == 400, response.content
        assert response.data == {
            "itemType": [
                ErrorDetail(string='"invalid" is not a valid choice.', code="invalid_choice")
            ],
        }

    def test_no_projects(self):
        response = self.do_request()
        assert response.status_code == 200, response.content
        assert response.data == []

    def test_tags_list_str(self):
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
            {"key": "bar", "name": "bar"},
            {"key": "baz", "name": "baz"},
            {"key": "foo", "name": "foo"},
            {
                "key": "span.description",
                "name": "span.description",
                "secondaryAliases": ["description", "message"],
            },
            {"key": "transaction", "name": "transaction"},
            {"key": "project", "name": "project"},
        ]
        assert sorted(
            response.data,
            key=itemgetter("key"),
        ) == sorted(
            expected,
            key=itemgetter("key"),
        )

    def test_tags_list_nums(self):
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
            {"key": "tags[bar,number]", "name": "bar"},
            {"key": "tags[baz,number]", "name": "baz"},
            {"key": "measurements.fcp", "name": "measurements.fcp"},
            {"key": "tags[foo,number]", "name": "foo"},
            {
                "key": "http.decoded_response_content_length",
                "name": "http.decoded_response_content_length",
            },
            {
                "key": "http.response_content_length",
                "name": "http.response_content_length",
            },
            {
                "key": "http.response_transfer_size",
                "name": "http.response_transfer_size",
            },
            {"key": "measurements.lcp", "name": "measurements.lcp"},
            {"key": "span.duration", "name": "span.duration"},
        ]

    @override_options({"explore.trace-items.keys.max": 3})
    def test_pagination(self):
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
            {"key": "bar", "name": "bar"},
            {"key": "baz", "name": "baz"},
            {"key": "foo", "name": "foo"},
            {
                "key": "span.description",
                "name": "span.description",
                "secondaryAliases": ["description", "message"],
            },
            {"key": "project", "name": "project"},
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
                "secondaryAliases": ["description", "message"],
            },
            {"key": "transaction", "name": "transaction"},
            {"key": "project", "name": "project"},
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
            {"key": "bar", "name": "bar"},
            {"key": "baz", "name": "baz"},
            {"key": "foo", "name": "foo"},
            {
                "key": "span.description",
                "name": "span.description",
                "secondaryAliases": ["description", "message"],
            },
            {"key": "project", "name": "project"},
        ]
        assert sorted(
            response.data,
            key=itemgetter("key"),
        ) == sorted(
            expected_3,
            key=itemgetter("key"),
        )

    def test_tags_list_sentry_conventions(self):
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
                {"key": "tags[bar,number]", "name": "bar"},
                {"key": "tags[baz,number]", "name": "baz"},
                {"key": "measurements.fcp", "name": "measurements.fcp"},
                {"key": "tags[foo,number]", "name": "foo"},
                {
                    "key": "http.decoded_response_content_length",
                    "name": "http.decoded_response_content_length",
                },
                {"key": "http.response.body.size", "name": "http.response.body.size"},
                {"key": "http.response.size", "name": "http.response.size"},
                {"key": "measurements.lcp", "name": "measurements.lcp"},
                {"key": "span.duration", "name": "span.duration"},
            ],
            key=itemgetter("key"),
        )

    def test_attribute_collision(self):
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
                "secondaryAliases": ["description", "message"],
            },
            {"key": "project", "name": "project"},
            {"key": "transaction", "name": "transaction"},
            {"key": "tags[span.duration,string]", "name": "tags[span.duration,string]"},
            {"key": "tags[span.op,string]", "name": "tags[span.op,string]"},
        ]


class OrganizationTraceItemAttributeValuesEndpointBaseTest(APITestCase, SnubaTestCase):
    feature_flags: dict[str, bool]
    item_type: SupportedTraceItemType

    viewname = "sentry-api-0-organization-trace-item-attribute-values"

    def setUp(self):
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

    def test_no_feature(self):
        response = self.do_request(features={}, key="test.attribute")
        assert response.status_code == 404, response.content

    def test_invalid_item_type(self):
        response = self.do_request(query={"itemType": "invalid"})
        assert response.status_code == 400, response.content
        assert response.data == {
            "itemType": [
                ErrorDetail(string='"invalid" is not a valid choice.', code="invalid_choice")
            ],
        }

    def test_no_projects(self):
        response = self.do_request()
        assert response.status_code == 200, response.content
        assert response.data == []

    def test_attribute_values(self):
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

    def test_no_feature(self):
        response = self.do_request(features={})
        assert response.status_code == 404, response.content

    def test_invalid_item_type(self):
        response = self.do_request(query={"itemType": "invalid"})
        assert response.status_code == 400, response.content
        assert response.data == {
            "itemType": [
                ErrorDetail(string='"invalid" is not a valid choice.', code="invalid_choice")
            ],
        }

    def test_no_projects(self):
        response = self.do_request()
        assert response.status_code == 200, response.content
        assert response.data == []

    def test_tags_keys(self):
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

    def test_transaction_keys_autocomplete(self):
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

    def test_transaction_keys_autocomplete_substring(self):
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

    def test_transaction_keys_autocomplete_substring_with_asterisk(self):
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

    def test_tags_keys_autocomplete(self):
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

    def test_tags_keys_autocomplete_substring(self):
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

    def test_tags_keys_autocomplete_substring_with_asterisks(self):
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

    def test_tags_keys_autocomplete_noop(self):
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

    def test_tags_keys_autocomplete_project(self):
        base_id = 9223372036854775000
        self.create_project(id=base_id + 100, name="foo")
        self.create_project(id=base_id + 299, name="bar")
        self.create_project(id=base_id + 399, name="baz")

        features = {
            **self.feature_flags,
            "organizations:global-views": True,
        }

        for key in ["project", "project.name"]:
            response = self.do_request(features=features, key=key)
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

            response = self.do_request(query={"substringMatch": "ba"}, features=features, key=key)
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

        response = self.do_request(features=features, key=key)
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

        response = self.do_request(query={"substringMatch": "99"}, features=features, key=key)
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

    def test_tags_keys_autocomplete_span_status(self):
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

    def test_measurements_autocomplete(self):
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

    def test_boolean_autocomplete(self):
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
    def test_invalid_query(self, mock_executor_2):
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
    def test_pagination(self):
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

    def test_autocomplete_release_semver_attributes(self):
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

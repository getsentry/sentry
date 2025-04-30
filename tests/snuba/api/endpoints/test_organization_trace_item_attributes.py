from unittest import mock
from uuid import uuid4

from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.types import SupportedTraceItemType
from sentry.testutils.cases import APITestCase, BaseSpansTestCase, OurLogTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now


# temporary helper to rewrite snake case to camel tests in the tests
# eventually, we should just use camel case
def snake_to_camel_query(query):
    query["itemType"] = query.pop("item_type")
    query["attributeType"] = query.pop("attribute_type")
    if "substring_match" in query:
        query["substringMatch"] = query.pop("substring_match")


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
        if "item_type" not in query:
            query["item_type"] = self.item_type.value
        if "attribute_type" not in query:
            query["attribute_type"] = "string"

        if features is None:
            features = self.feature_flags

        with self.feature(features):
            url = reverse(self.viewname, kwargs={"organization_id_or_slug": self.organization.slug})
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
        response = self.do_request(query={"item_type": "invalid"})
        assert response.status_code == 400, response.content
        # This error message doesn't quite make sense because we're trying
        # to transition from snake case to camel case
        assert response.data == {
            "itemType": [ErrorDetail(string="This field is required.", code="required")],
            "attributeType": [ErrorDetail(string="This field is required.", code="required")],
        }

    def test_no_projects(self):
        response = self.do_request(query={"item_type": SupportedTraceItemType.LOGS.value})
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
        response = self.do_request(query={"substring_match": ""})
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
        response = self.do_request(query={"substring_match": "tes"})
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


class OrganizationTraceItemAttributesEndpointLogsCamelCaseTest(
    OrganizationTraceItemAttributesEndpointLogsTest
):
    def do_request(self, query=None, features=None, **kwargs):
        if query is None:
            query = {}
        if "item_type" not in query:
            query["item_type"] = self.item_type.value
        if "attribute_type" not in query:
            query["attribute_type"] = "string"

        snake_to_camel_query(query)

        if features is None:
            features = self.feature_flags

        with self.feature(features):
            url = reverse(self.viewname, kwargs={"organization_id_or_slug": self.organization.slug})
            return self.client.get(url, query, format="json", **kwargs)

    def test_invalid_item_type(self):
        response = self.do_request(query={"item_type": "invalid"})
        assert response.status_code == 400, response.content
        assert response.data == {
            "itemType": [
                ErrorDetail(string='"invalid" is not a valid choice.', code="invalid_choice")
            ],
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
        response = self.do_request(query={"item_type": "invalid"})
        assert response.status_code == 400, response.content
        # This error message doesn't quite make sense because we're trying
        # to transition from snake case to camel case
        assert response.data == {
            "itemType": [ErrorDetail(string="This field is required.", code="required")],
            "attributeType": [ErrorDetail(string="This field is required.", code="required")],
        }

    def test_no_projects(self):
        response = self.do_request(query={"item_type": SupportedTraceItemType.LOGS.value})
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
                "attribute_type": "string",
            }
        )
        assert response.status_code == 200, response.data
        assert response.data == [
            {"key": "bar", "name": "bar"},
            {"key": "baz", "name": "baz"},
            {"key": "foo", "name": "foo"},
            {"key": "span.description", "name": "span.description"},
            {"key": "transaction", "name": "transaction"},
            {"key": "project", "name": "project"},
        ]

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
                "attribute_type": "number",
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


class OrganizationTraceItemAttributesEndpointSpansCamelCaseTest(
    OrganizationTraceItemAttributesEndpointSpansTest
):
    def do_request(self, query=None, features=None, **kwargs):
        if query is None:
            query = {}
        if "item_type" not in query:
            query["item_type"] = self.item_type.value
        if "attribute_type" not in query:
            query["attribute_type"] = "string"

        snake_to_camel_query(query)

        if features is None:
            features = self.feature_flags

        with self.feature(features):
            url = reverse(self.viewname, kwargs={"organization_id_or_slug": self.organization.slug})
            return self.client.get(url, query, format="json", **kwargs)

    def test_invalid_item_type(self):
        response = self.do_request(query={"item_type": "invalid"})
        assert response.status_code == 400, response.content
        assert response.data == {
            "itemType": [
                ErrorDetail(string='"invalid" is not a valid choice.', code="invalid_choice")
            ],
        }


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

        if "item_type" not in query:
            query["item_type"] = self.item_type.value
        if "attribute_type" not in query:
            query["attribute_type"] = "string"

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
        response = self.do_request(query={"item_type": "invalid"})
        assert response.status_code == 400, response.content
        # This error message doesn't quite make sense because we're trying
        # to transition from snake case to camel case
        assert response.data == {
            "itemType": [ErrorDetail(string="This field is required.", code="required")],
            "attributeType": [ErrorDetail(string="This field is required.", code="required")],
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


class OrganizationTraceItemAttributeValuesEndpointLogsCamelCaseTest(
    OrganizationTraceItemAttributeValuesEndpointLogsTest
):
    def do_request(self, query=None, features=None, key=None, **kwargs):
        if query is None:
            query = {}

        if "item_type" not in query:
            query["item_type"] = self.item_type.value
        if "attribute_type" not in query:
            query["attribute_type"] = "string"

        snake_to_camel_query(query)

        if features is None:
            features = self.feature_flags

        with self.feature(features):
            url = reverse(
                self.viewname,
                kwargs={"organization_id_or_slug": self.organization.slug, "key": key},
            )
            return self.client.get(url, query, format="json", **kwargs)

    def test_invalid_item_type(self):
        response = self.do_request(query={"item_type": "invalid"})
        assert response.status_code == 400, response.content
        assert response.data == {
            "itemType": [
                ErrorDetail(string='"invalid" is not a valid choice.', code="invalid_choice")
            ],
        }


class OrganizationTraceItemAttributeValuesEndpointSpansTest(
    OrganizationTraceItemAttributeValuesEndpointBaseTest, BaseSpansTestCase
):
    feature_flags = {"organizations:visibility-explore-view": True}
    item_type = SupportedTraceItemType.SPANS

    def test_no_feature(self):
        response = self.do_request(features={})
        assert response.status_code == 404, response.content

    def test_invalid_item_type(self):
        response = self.do_request(query={"item_type": "invalid"})
        assert response.status_code == 400, response.content
        # This error message doesn't quite make sense because we're trying
        # to transition from snake case to camel case
        assert response.data == {
            "itemType": [ErrorDetail(string="This field is required.", code="required")],
            "attributeType": [ErrorDetail(string="This field is required.", code="required")],
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

        response = self.do_request(query={"substring_match": "b"}, key=key)
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

        response = self.do_request(query={"substring_match": r"\*b"}, key=key)
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

        response = self.do_request(query={"substring_match": "b"}, key=key)
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

        response = self.do_request(query={"substring_match": r"\*b"}, key=key)
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

            response = self.do_request(query={"substring_match": "ba"}, features=features, key=key)
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

        response = self.do_request(query={"substring_match": "99"}, features=features, key=key)
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

        response = self.do_request(query={"substring_match": "in"}, key="span.status")
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


class OrganizationTraceItemAttributeValuesEndpointSpansCamelCaseTest(
    OrganizationTraceItemAttributeValuesEndpointSpansTest
):
    def do_request(self, query=None, features=None, key=None, **kwargs):
        if query is None:
            query = {}

        if "item_type" not in query:
            query["item_type"] = self.item_type.value
        if "attribute_type" not in query:
            query["attribute_type"] = "string"

        snake_to_camel_query(query)

        if features is None:
            features = self.feature_flags

        with self.feature(features):
            url = reverse(
                self.viewname,
                kwargs={"organization_id_or_slug": self.organization.slug, "key": key},
            )
            return self.client.get(url, query, format="json", **kwargs)

    def test_invalid_item_type(self):
        response = self.do_request(query={"item_type": "invalid"})
        assert response.status_code == 400, response.content
        assert response.data == {
            "itemType": [
                ErrorDetail(string='"invalid" is not a valid choice.', code="invalid_choice")
            ],
        }

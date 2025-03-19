from django.urls import reverse

from sentry.api.endpoints.organization_trace_item_attributes import TraceItemType
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationTraceItemAttributesEndpointTest(OrganizationEventsEndpointTestBase):
    viewname = "sentry-api-0-organization-trace-item-attributes"
    item_type = TraceItemType.LOGS.value  # Can subclass this to test other item types

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.features = {
            "organizations:ourlogs-enabled": True,
        }

    def do_request(self, query=None, features=None, **kwargs):
        if query is None:
            query = {}
        if "item_type" not in query:
            query["item_type"] = self.item_type
        if "attribute_type" not in query:
            query["attribute_type"] = "string"
        if features is None:
            features = self.features
        with self.feature(features):
            return self.client_get(self.reverse_url(), query, format="json", **kwargs)

    def test_no_feature(self):
        response = self.do_request(features={})
        assert response.status_code == 404, response.content

    def test_invalid_item_type(self):
        response = self.do_request(query={"item_type": "invalid"})
        assert response.status_code == 400, response.content
        assert "item_type" in response.data
        assert response.data["item_type"][0].code == "invalid_choice"
        assert '"invalid" is not a valid choice.' in str(response.data["item_type"][0])

    def test_no_projects(self):
        response = self.do_request(query={"item_type": TraceItemType.LOGS.value})
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
        assert len(keys) == 6
        assert "test.attribute1" in keys
        assert "test.attribute2" in keys
        assert "test.attribute3" in keys
        assert "another.attribute" in keys
        assert "different.attr" in keys
        assert "sentry.severity_text" in keys

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
        assert len(keys) == 3
        assert "test.attribute1" in keys
        assert "test.attribute2" in keys
        assert "sentry.severity_text" in keys


class OrganizationTraceItemAttributeValuesEndpointTest(OrganizationEventsEndpointTestBase):
    viewname = "sentry-api-0-organization-trace-item-attribute-values"
    item_type = TraceItemType.LOGS.value

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.features = {
            "organizations:ourlogs-enabled": True,
        }

    def reverse_url(self, key="test.attribute"):
        return reverse(
            self.viewname,
            kwargs={"organization_id_or_slug": self.organization.slug, "key": key},
        )

    def do_request(self, query=None, features=None, key=None, **kwargs):
        if query is None:
            query = {}

        if "item_type" not in query:
            query["item_type"] = self.item_type
        if "attribute_type" not in query:
            query["attribute_type"] = "string"

        if features is None:
            features = self.features

        with self.feature(features):
            return self.client_get(self.reverse_url(key=key), query, format="json", **kwargs)

    def test_no_feature(self):
        response = self.do_request(features={}, key="test.attribute")
        assert response.status_code == 404, response.content

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

import pytest

from sentry.api.endpoints.organization_trace_item_attributes import TraceItemType
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationTraceItemAttributesEndpointTest(OrganizationEventsEndpointTestBase):
    viewname = "sentry-api-0-organization-trace-item-attributes"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.features = {
            "organizations:performance-trace-explorer": True,
        }

    def do_request(self, query=None, features=None, **kwargs):
        if query is None:
            query = {}
        if "dataset" not in query:
            query["dataset"] = "logs"
        if "attribute_type" not in query:
            query["attribute_type"] = "string"
        if features is None:
            features = self.features
        with self.feature(features):
            return self.client_get(self.reverse_url(), query, format="json", **kwargs)

    def test_no_feature(self):
        response = self.do_request(features={})
        assert response.status_code == 404, response.content

    def test_invalid_dataset(self):
        response = self.do_request(query={"dataset": "invalid"})
        assert response.status_code == 400, response.content
        assert "dataset" in response.data
        assert response.data["dataset"][0].code == "invalid_choice"
        assert '"invalid" is not a valid choice.' in str(response.data["dataset"][0])

    def test_no_projects(self):
        response = self.do_request(query={"dataset": "logs"})
        assert response.status_code == 200, response.content
        assert response.data == []

    def test_prefix_matching(self):
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
        response = self.do_request(query={"prefix_match": ""})
        assert response.status_code == 200, response.content

        keys = {item["key"] for item in response.data}
        assert len(keys) == 6
        assert "test.attribute1" in keys
        assert "test.attribute2" in keys
        assert "test.attribute3" in keys
        assert "another.attribute" in keys
        assert "different.attr" in keys
        assert "sentry.severity_text" in keys

        response = self.do_request(query={"prefix_match": "tes"})
        assert response.status_code == 200, response.content
        keys = {item["key"] for item in response.data}
        assert len(keys) == 3
        assert "test.attribute1" in keys
        assert "test.attribute2" in keys
        assert "test.attribute3" in keys
        assert "another.attribute" not in keys
        assert "different.attr" not in keys

    @pytest.mark.skip(
        reason="This should eventually work once TraceItemAttributeNamesRequest is fixed"
    )
    def test_get_attribute_names_logs(self):
        # Create logs with attributes
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
        assert len(keys) == 2


class OrganizationTraceItemAttributeValuesEndpointTest(OrganizationEventsEndpointTestBase):
    viewname = "sentry-api-0-organization-trace-item-attribute-values"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.features = {
            "organizations:performance-trace-explorer": True,
        }

    def do_request(self, query=None, features=None, **kwargs):
        if query is None:
            query = {}
        if "dataset" not in query:
            query["dataset"] = "logs"
        if "attribute_type" not in query:
            query["attribute_type"] = "string"
        if features is None:
            features = self.features
        with self.feature(features):
            return self.client_get(self.reverse_url(), query, format="json", **kwargs)

    def test_no_feature(self):
        response = self.do_request(key="test.attribute")
        assert response.status_code == 404, response.content

    def test_get_attribute_values_logs(self):
        # Create logs with attributes
        logs = [
            self.create_ourlog(
                extra_data={"body": "log message 1"},
                organization=self.organization,
                project=self.project,
                attributes={
                    "test.attribute": "value1",
                },
            ),
            self.create_ourlog(
                extra_data={"body": "log message 2"},
                organization=self.organization,
                project=self.project,
                attributes={
                    "test.attribute": "value2",
                },
            ),
        ]
        self.store_ourlogs(logs)

        response = self.do_request(key="test.attribute")

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        values = {item["value"] for item in response.data}
        assert "value1" in values
        assert "value2" in values
        assert all(item["key"] == "test.attribute" for item in response.data)


class TestTraceItemType:
    def test_trace_item_type_enum(self):
        # Test that the enum values are valid
        assert TraceItemType.LOGS.value == "logs"
        assert TraceItemType.SPANS.value == "spans"

        # Test conversion from string to enum
        assert TraceItemType("logs") == TraceItemType.LOGS
        assert TraceItemType("spans") == TraceItemType.SPANS

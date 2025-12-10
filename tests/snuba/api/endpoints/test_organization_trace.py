import logging
from unittest import mock
from uuid import uuid4

from django.conf import settings
from django.test import override_settings
from django.urls import reverse
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry.conf.types.uptime import UptimeRegionConfig
from sentry.search.events.types import SnubaParams
from sentry.testutils.cases import UptimeResultEAPTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.options import override_options
from sentry.utils.samples import load_data
from tests.snuba.api.endpoints.test_organization_events_trace import (
    OrganizationEventsTraceEndpointBase,
)

logger = logging.getLogger(__name__)

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeValue as ProtoAttributeValue

from sentry.snuba.trace import _serialize_columnar_uptime_item
from sentry.testutils.cases import TestCase

# Test regions for uptime item serialization tests
TEST_UPTIME_REGIONS = [
    UptimeRegionConfig(
        slug="us-east-1",
        name="US East (N. Virginia)",
        config_redis_cluster=settings.SENTRY_UPTIME_DETECTOR_CLUSTER,
        config_redis_key_prefix="us1",
    ),
    UptimeRegionConfig(
        slug="eu-west-1",
        name="Europe (Ireland)",
        config_redis_cluster=settings.SENTRY_UPTIME_DETECTOR_CLUSTER,
        config_redis_key_prefix="eu1",
    ),
]


class TestSerializeColumnarUptimeItem(TestCase):
    """Test serialization of columnar uptime data to span format."""

    def setUp(self) -> None:
        super().setUp()
        self.project_slugs = {1: "test-project", 2: "another-project"}
        self.snuba_params = mock.MagicMock(spec=SnubaParams)
        self.snuba_params.project_ids = [1]

    def test_basic_uptime_item_serialization(self):
        """Test basic serialization with all required fields."""
        row_dict = {
            "sentry.item_id": ProtoAttributeValue(val_str="check-123"),
            "sentry.project_id": ProtoAttributeValue(val_int=1),
            "guid": ProtoAttributeValue(val_str="check-123"),
            "sentry.trace_id": ProtoAttributeValue(val_str="a" * 32),
            "check_status": ProtoAttributeValue(val_str="success"),
            "http_status_code": ProtoAttributeValue(val_int=200),
            "request_url": ProtoAttributeValue(val_str="https://example.com"),
            "original_url": ProtoAttributeValue(val_str="https://example.com"),
            "actual_check_time_us": ProtoAttributeValue(val_int=1700000000000000),
            "check_duration_us": ProtoAttributeValue(val_int=500000),
            "subscription_id": ProtoAttributeValue(val_str="sub-456"),
            "region": ProtoAttributeValue(val_str="us-east-1"),
            "request_sequence": ProtoAttributeValue(val_int=0),
        }

        with override_settings(UPTIME_REGIONS=TEST_UPTIME_REGIONS):
            result = _serialize_columnar_uptime_item(row_dict, self.project_slugs)

        assert result["event_id"] == "check-123"
        assert result["project_id"] == 1
        assert result["project_slug"] == "test-project"
        assert result["transaction_id"] == "a" * 32
        assert result["transaction"] == "uptime.check"
        assert result["event_type"] == "uptime_check"
        assert result["op"] == "uptime.request"
        assert result["duration"] == 500.0
        assert result["name"] == "https://example.com"
        assert result["description"] == "Uptime Check Request [success]"
        assert result["region_name"] == "US East (N. Virginia)"
        assert result["start_timestamp"] == 1700000000
        assert result["end_timestamp"] == 1700000000.5
        attrs = result["additional_attributes"]
        assert attrs["guid"] == "check-123"
        assert attrs["check_status"] == "success"
        assert attrs["http_status_code"] == 200
        assert attrs["request_url"] == "https://example.com"
        assert attrs["original_url"] == "https://example.com"
        assert attrs["subscription_id"] == "sub-456"
        assert attrs["region"] == "us-east-1"
        assert attrs["request_sequence"] == 0
        assert "project_id" not in attrs
        assert "organization.id" not in attrs
        assert "timestamp" not in attrs

    def test_redirect_chain_serialization(self):
        """Test serialization of redirect chain with different URLs."""
        row_dict = {
            "sentry.item_id": ProtoAttributeValue(val_str="check-789"),
            "sentry.project_id": ProtoAttributeValue(val_int=1),
            "guid": ProtoAttributeValue(val_str="check-789"),
            "sentry.trace_id": ProtoAttributeValue(val_str="b" * 32),
            "check_status": ProtoAttributeValue(val_str="success"),
            "http_status_code": ProtoAttributeValue(val_int=301),
            "request_url": ProtoAttributeValue(val_str="https://www.example.com"),
            "original_url": ProtoAttributeValue(val_str="https://example.com"),
            "actual_check_time_us": ProtoAttributeValue(val_int=1700000000000000),
            "check_duration_us": ProtoAttributeValue(val_int=300000),
            "region": ProtoAttributeValue(val_str="eu-west-1"),
            "request_sequence": ProtoAttributeValue(val_int=1),
        }

        result = _serialize_columnar_uptime_item(row_dict, self.project_slugs)

        assert result["description"] == "Uptime Check Request [success]"
        assert result["name"] == "https://www.example.com"
        assert result["additional_attributes"]["request_url"] == "https://www.example.com"
        assert result["additional_attributes"]["original_url"] == "https://example.com"
        assert result["additional_attributes"]["request_sequence"] == 1

    def test_null_and_missing_fields(self):
        """Test handling of null and missing optional fields."""
        row_dict = {
            "sentry.item_id": ProtoAttributeValue(val_str="check-null"),
            "sentry.project_id": ProtoAttributeValue(val_int=1),
            "guid": ProtoAttributeValue(val_str="check-null"),
            "sentry.trace_id": ProtoAttributeValue(val_str="c" * 32),
            "check_status": ProtoAttributeValue(val_str="failure"),
            "http_status_code": ProtoAttributeValue(is_null=True),
            "request_url": ProtoAttributeValue(val_str="https://test.com"),
            "actual_check_time_us": ProtoAttributeValue(val_int=1700000000000000),
            "dns_lookup_duration_us": ProtoAttributeValue(val_int=50000),
            "tcp_connection_duration_us": ProtoAttributeValue(is_null=True),
            "region": ProtoAttributeValue(val_str="us-east-1"),
        }

        result = _serialize_columnar_uptime_item(row_dict, self.project_slugs)

        assert result["duration"] == 0.0
        assert result["name"] == "https://test.com"
        assert result["description"] == "Uptime Check Request [failure]"
        attrs = result["additional_attributes"]
        assert "http_status_code" not in attrs
        assert "original_url" not in attrs
        assert attrs["dns_lookup_duration_us"] == 50000
        assert "tcp_connection_duration_us" not in attrs

    def test_region_name_mapping(self):
        """Test that region codes are properly mapped to region names."""
        test_cases = [
            ("us-east-1", "US East (N. Virginia)"),
            ("eu-west-1", "Europe (Ireland)"),
            ("nonexistent-region", "Unknown"),
        ]

        for region_code, expected_name in test_cases:
            row_dict = {
                "sentry.item_id": ProtoAttributeValue(val_str=f"check-{region_code}"),
                "sentry.project_id": ProtoAttributeValue(val_int=1),
                "guid": ProtoAttributeValue(val_str=f"check-{region_code}"),
                "sentry.trace_id": ProtoAttributeValue(val_str="a" * 32),
                "check_status": ProtoAttributeValue(val_str="success"),
                "request_url": ProtoAttributeValue(val_str="https://example.com"),
                "actual_check_time_us": ProtoAttributeValue(val_int=1700000000000000),
                "check_duration_us": ProtoAttributeValue(val_int=500000),
                "region": ProtoAttributeValue(val_str=region_code),
            }

            with override_settings(UPTIME_REGIONS=TEST_UPTIME_REGIONS):
                result = _serialize_columnar_uptime_item(row_dict, self.project_slugs)

            assert result["region_name"] == expected_name


class OrganizationEventsTraceEndpointTest(
    OrganizationEventsTraceEndpointBase, UptimeResultEAPTestCase
):
    url_name = "sentry-api-0-organization-trace"
    FEATURES = ["organizations:trace-spans-format"]

    def assert_event(self, result, event_data, message):
        assert result["transaction"] == event_data.transaction, message
        assert result["event_id"] == event_data.data["contexts"]["trace"]["span_id"], message
        assert result["start_timestamp"] == event_data.data["start_timestamp"], message
        assert result["project_slug"] == event_data.project.slug, message
        assert result["sdk_name"] == event_data.data["sdk"]["name"], message
        assert result["transaction_id"] == event_data.event_id, message

    def get_transaction_children(self, event):
        """Assumes that the test setup only gives each event 1 txn child"""
        children = []
        for child in event["children"]:
            if child["is_transaction"]:
                children.append(child)
            elif child["event_type"] == "span":
                children.extend(child["children"])
        return sorted(children, key=lambda event: event["description"])

    def assert_trace_data(self, root, gen2_no_children=True):
        """see the setUp docstring for an idea of what the response structure looks like"""
        self.assert_event(root, self.root_event, "root")
        assert root["parent_span_id"] is None
        assert root["duration"] == 3000
        # 3 transactions, 2 child spans
        assert len(root["children"]) == 5
        transaction_children = self.get_transaction_children(root)
        assert len(transaction_children) == 3
        assert (
            root["measurements"]["measurements.lcp"]
            == self.root_event.data["measurements"]["lcp"]["value"]
        )
        assert (
            root["measurements"]["measurements.fcp"]
            == self.root_event.data["measurements"]["fcp"]["value"]
        )
        self.assert_performance_issues(root)

        for i, gen1 in enumerate(transaction_children):
            self.assert_event(gen1, self.gen1_events[i], f"gen1_{i}")
            assert gen1["parent_span_id"] == self.root_span_ids[i]
            assert gen1["duration"] == 2000
            assert len(gen1["children"]) == 1

            gen2 = self.get_transaction_children(gen1)[0]
            self.assert_event(gen2, self.gen2_events[i], f"gen2_{i}")
            assert gen2["parent_span_id"] == self.gen1_span_ids[i]
            assert gen2["duration"] == 1000

            # Only the first gen2 descendent has a child
            if i == 0:
                assert len(gen2["children"]) == 4
                gen3 = self.get_transaction_children(gen2)[0]
                self.assert_event(gen3, self.gen3_event, f"gen3_{i}")
                assert gen3["parent_span_id"] == self.gen2_span_id
                assert gen3["duration"] == 500
                assert len(gen3["children"]) == 0
            elif gen2_no_children:
                assert len(gen2["children"]) == 0

    def assert_performance_issues(self, root):
        """Broken in the non-spans endpoint, but we're not maintaining that anymore"""

    def client_get(self, data, url=None):
        if url is None:
            url = self.url
        return self.client.get(
            url,
            data,
            format="json",
        )

    def test_no_projects(self) -> None:
        user = self.create_user()
        org = self.create_organization(owner=user)
        self.login_as(user=user)

        url = reverse(
            self.url_name,
            kwargs={"organization_id_or_slug": org.slug, "trace_id": uuid4().hex},
        )

        with self.feature(self.FEATURES):
            response = self.client.get(
                url,
                format="json",
            )

        assert response.status_code == 404, response.content

    def test_simple(self) -> None:
        self.load_trace(is_eap=True)
        with self.feature(self.FEATURES):
            response = self.client_get(
                data={"timestamp": self.day_ago},
            )
        assert response.status_code == 200, response.content
        data = response.data
        assert len(data) == 1
        self.assert_trace_data(data[0])

    @override_options(
        {
            "performance.traces.pagination.max-iterations": 30,
            "performance.traces.pagination.max-timeout": 15,
            "performance.traces.pagination.query-limit": 5,
        }
    )
    def test_pagination(self) -> None:
        """Test is identical to test_simple, but with the limit override, we'll need to make multiple requests to get
        all of the trace"""
        self.load_trace(is_eap=True)
        with self.feature(self.FEATURES):
            response = self.client_get(
                data={"timestamp": self.day_ago},
            )
        assert response.status_code == 200, response.content
        data = response.data
        assert len(data) == 1
        self.assert_trace_data(data[0])

    def test_ignore_project_param(self) -> None:
        self.load_trace(is_eap=True)
        with self.feature(self.FEATURES):
            # The trace endpoint should ignore the project param
            response = self.client_get(
                data={"project": self.project.id, "timestamp": self.day_ago},
            )
        assert response.status_code == 200, response.content
        data = response.data
        assert len(data) == 1
        self.assert_trace_data(data[0])

    def test_with_errors_data(self) -> None:
        self.load_trace(is_eap=True)
        _, start = self.get_start_end_from_day_ago(123)
        error_data = load_data(
            "javascript",
            timestamp=start,
        )
        error_data["contexts"]["trace"] = {
            "type": "trace",
            "trace_id": self.trace_id,
            "span_id": self.root_event.data["contexts"]["trace"]["span_id"],
        }
        error_data["tags"] = [["transaction", "/transaction/gen1-0"]]
        error = self.store_event(error_data, project_id=self.gen1_project.id)

        with self.feature(self.FEATURES):
            response = self.client_get(
                data={"timestamp": self.day_ago},
            )
        assert response.status_code == 200, response.content
        data = response.data
        assert len(data) == 1
        self.assert_trace_data(data[0])
        assert len(data[0]["errors"]) == 1
        error_event = data[0]["errors"][0]
        assert error_event is not None
        assert error_event["event_id"] == error.data["event_id"]
        assert error_event["project_slug"] == self.gen1_project.slug
        assert error_event["level"] == "error"
        assert error_event["issue_id"] == error.group_id
        assert error_event["start_timestamp"] == error_data["timestamp"]

    def test_with_errors_data_with_overlapping_span_id(self) -> None:
        self.load_trace(is_eap=True)
        _, start = self.get_start_end_from_day_ago(123)
        error_data = load_data(
            "javascript",
            timestamp=start,
        )
        error_data["contexts"]["trace"] = {
            "type": "trace",
            "trace_id": self.trace_id,
            "span_id": self.root_event.data["contexts"]["trace"]["span_id"],
        }
        error_data["tags"] = [["transaction", "/transaction/gen1-0"]]
        error = self.store_event(error_data, project_id=self.gen1_project.id)
        error_2 = self.store_event(error_data, project_id=self.gen1_project.id)

        with self.feature(self.FEATURES):
            response = self.client_get(
                data={"timestamp": self.day_ago},
            )
        assert response.status_code == 200, response.content
        data = response.data
        assert len(data) == 1
        self.assert_trace_data(data[0])
        assert len(data[0]["errors"]) == 2
        error_event_1 = data[0]["errors"][0]
        error_event_2 = data[0]["errors"][1]
        assert error_event_1["event_id"] in [error.event_id, error_2.event_id]
        assert error_event_2["event_id"] in [error.event_id, error_2.event_id]
        assert error_event_1["event_id"] != error_event_2["event_id"]

    def test_with_performance_issues(self) -> None:
        self.load_trace(is_eap=True)
        with self.feature(self.FEATURES):
            response = self.client_get(
                data={"timestamp": self.day_ago},
            )
        assert response.status_code == 200, response.content
        data = response.data
        assert len(data) == 1
        self.assert_trace_data(data[0])
        for child in data[0]["children"]:
            if child["event_id"] == "0012001200120012":
                break
        assert len(child["occurrences"]) == 1
        error_event = child["occurrences"][0]
        assert error_event is not None
        assert error_event["event_id"] == self.root_event.event_id
        assert error_event["description"] == "File IO on Main Thread"
        assert error_event["project_slug"] == self.project.slug
        assert error_event["level"] == "info"

    def test_with_only_errors(self) -> None:
        start, _ = self.get_start_end_from_day_ago(1000)
        error_data = load_data(
            "javascript",
            timestamp=start,
        )
        error_data["contexts"]["trace"] = {
            "type": "trace",
            "trace_id": self.trace_id,
            "span_id": "a" * 16,
        }
        error_data["tags"] = [["transaction", "/transaction/gen1-0"]]
        error = self.store_event(error_data, project_id=self.project.id)

        with self.feature(self.FEATURES):
            response = self.client_get(
                data={"timestamp": self.day_ago},
            )
        assert response.status_code == 200, response.content
        data = response.data
        assert len(data) == 1
        assert data[0]["event_id"] == error.event_id

    def test_with_additional_attributes(self) -> None:
        self.load_trace(is_eap=True)
        with self.feature(self.FEATURES):
            response = self.client_get(
                data={
                    "timestamp": self.day_ago,
                    "additional_attributes": [
                        "gen_ai.request.model",
                        "gen_ai.usage.total_tokens",
                    ],
                },
            )
        assert response.status_code == 200, response.content
        data = response.data
        assert len(data) == 1

        # The root span doesn't have any of the additional attributes and returns defaults
        assert data[0]["additional_attributes"]["gen_ai.request.model"] == ""
        assert data[0]["additional_attributes"]["gen_ai.usage.total_tokens"] == 0

        assert data[0]["children"][0]["additional_attributes"]["gen_ai.request.model"] == "gpt-4o"
        assert data[0]["children"][0]["additional_attributes"]["gen_ai.usage.total_tokens"] == 100

    def test_with_target_error(self) -> None:
        start, _ = self.get_start_end_from_day_ago(1000)
        error_data = load_data(
            "javascript",
            timestamp=start,
        )
        error_data["contexts"]["trace"] = {
            "type": "trace",
            "trace_id": self.trace_id,
            "span_id": "a" * 16,
        }
        error_data["tags"] = [["transaction", "/transaction/gen1-0"]]
        error = self.store_event(error_data, project_id=self.project.id)
        for _ in range(5):
            self.store_event(error_data, project_id=self.project.id)

        with mock.patch("sentry.snuba.trace.ERROR_LIMIT", 1):
            with self.feature(self.FEATURES):
                response = self.client_get(
                    data={"timestamp": self.day_ago, "errorId": error.event_id},
                )
        assert response.status_code == 200, response.content
        data = response.data
        assert len(data) == 1
        assert data[0]["event_id"] == error.event_id

    def test_with_invalid_error_id(self) -> None:
        with self.feature(self.FEATURES):
            response = self.client_get(
                data={"timestamp": self.day_ago, "errorId": ",blah blah,"},
            )

        assert response.status_code == 400, response.content

    def test_with_date_outside_retention(self) -> None:
        with self.options({"system.event-retention-days": 10}):
            with self.feature(self.FEATURES):
                response = self.client_get(
                    data={"timestamp": before_now(days=120)},
                )

        assert response.status_code == 400, response.content

    def test_orphan_trace(self) -> None:
        self.load_trace(is_eap=True)
        orphan_event = self.create_event(
            trace_id=self.trace_id,
            transaction="/transaction/orphan",
            spans=[],
            project_id=self.project.id,
            # Random span id so there's no parent
            parent_span_id=uuid4().hex[:16],
            milliseconds=500,
            is_eap=True,
        )
        with self.feature(self.FEATURES):
            response = self.client_get(
                data={"timestamp": self.day_ago},
            )
        assert response.status_code == 200, response.content
        data = response.data
        assert len(data) == 2
        if len(data[0]["children"]) == 0:
            orphan = data[0]
        else:
            orphan = data[1]
        self.assert_event(orphan, orphan_event, "orphan")

    def _find_uptime_checks(self, data):
        """Helper to find all uptime checks in the response data"""
        uptime_checks = []
        for item in data:
            if item.get("event_type") == "uptime_check":
                uptime_checks.append(item)
        return uptime_checks

    def _create_uptime_result_with_original_url(self, original_url=None, **kwargs):
        """Helper to create uptime result with original_url attribute"""
        if original_url is None:
            original_url = kwargs.get("request_url", "https://example.com")
        kwargs["original_url"] = original_url
        kwargs.setdefault("request_body_size_bytes", None)
        kwargs.setdefault("response_body_size_bytes", None)
        return self.create_eap_uptime_result(**kwargs)

    def assert_expected_results(self, response_data, input_trace_items, expected_children_ids=None):
        """Assert that API response matches expected results from input trace items."""
        uptime_checks = [item for item in response_data if item.get("event_type") == "uptime_check"]

        def sort_key(item):
            guid = (
                item.attributes.get("guid", ProtoAttributeValue(val_str="")).string_value
                if hasattr(item, "attributes")
                else item.get("additional_attributes", {}).get("guid", "")
            )
            seq = (
                item.attributes.get("request_sequence", ProtoAttributeValue(val_int=0)).int_value
                if hasattr(item, "attributes")
                else item.get("additional_attributes", {}).get("request_sequence", 0)
            )
            return guid, seq

        sorted_items = sorted(input_trace_items, key=sort_key)
        uptime_checks.sort(key=lambda s: sort_key(s))

        for i, (actual, expected_item) in enumerate(zip(uptime_checks, sorted_items)):
            expected = self._trace_item_to_api_span(expected_item)
            actual_without_children = {k: v for k, v in actual.items() if k != "children"}
            expected_without_children = {k: v for k, v in expected.items() if k != "children"}
            assert (
                actual_without_children == expected_without_children
            ), f"Span {i} differs (excluding children)"

        if expected_children_ids:
            final_span = max(
                uptime_checks,
                key=lambda s: s.get("additional_attributes", {}).get("request_sequence", -1),
            )
            actual_children = final_span.get("children", [])
            assert len(actual_children) == len(
                expected_children_ids
            ), f"Expected {len(expected_children_ids)} children, got {len(actual_children)}"

            actual_child_txns = {child.get("transaction") for child in actual_children}
            for expected_id in expected_children_ids:
                assert (
                    expected_id in actual_child_txns
                ), f"Expected '{expected_id}' transaction in children"

    def _trace_item_to_api_span(self, trace_item: TraceItem, children=None) -> dict:
        """Convert a TraceItem to the exact format returned by the API."""
        attrs = trace_item.attributes
        row_dict = {}
        for attr_name, attr_value in attrs.items():
            if attr_value.HasField("string_value"):
                row_dict[attr_name] = ProtoAttributeValue(val_str=attr_value.string_value)
            elif attr_value.HasField("int_value"):
                row_dict[attr_name] = ProtoAttributeValue(val_int=attr_value.int_value)
            elif attr_value.HasField("double_value"):
                row_dict[attr_name] = ProtoAttributeValue(val_double=attr_value.double_value)
            elif attr_value.HasField("bool_value"):
                row_dict[attr_name] = ProtoAttributeValue(val_bool=attr_value.bool_value)

        row_dict["sentry.item_id"] = ProtoAttributeValue(val_str=trace_item.item_id.hex())
        row_dict["sentry.project_id"] = ProtoAttributeValue(val_int=trace_item.project_id)
        row_dict["sentry.organization_id"] = ProtoAttributeValue(val_int=trace_item.organization_id)
        row_dict["sentry.trace_id"] = ProtoAttributeValue(val_str=trace_item.trace_id)
        row_dict["sentry.timestamp"] = ProtoAttributeValue(
            val_double=trace_item.timestamp.ToSeconds()
        )
        row_dict["sentry.item_type"] = ProtoAttributeValue(val_int=trace_item.item_type)
        project_slugs = {trace_item.project_id: self.project.slug}
        span = _serialize_columnar_uptime_item(row_dict, project_slugs)

        if children:
            span["children"] = children

        return span

    def test_with_uptime_results(self):
        """Test that uptime results are included when include_uptime=1"""
        self.load_trace(is_eap=True)

        features = self.FEATURES
        redirect_result = self._create_uptime_result_with_original_url(
            organization=self.organization,
            project=self.project,
            trace_id=self.trace_id,
            guid="check-123",
            subscription_id="sub-456",
            check_status="success",
            http_status_code=301,
            request_sequence=0,
            request_url="https://example.com",
            scheduled_check_time=self.day_ago,
            check_duration_us=300000,
        )
        final_result = self._create_uptime_result_with_original_url(
            organization=self.organization,
            project=self.project,
            trace_id=self.trace_id,
            guid="check-123",
            subscription_id="sub-456",
            check_status="success",
            http_status_code=200,
            request_sequence=1,
            request_url="https://www.example.com",
            original_url="https://example.com",
            scheduled_check_time=self.day_ago,
            check_duration_us=500000,
        )

        self.store_uptime_results([redirect_result, final_result])

        with self.feature(features):
            response = self.client_get(
                data={"timestamp": self.day_ago, "include_uptime": "1"},
            )

        assert response.status_code == 200, response.content
        data = response.data

        self.assert_expected_results(
            data, [redirect_result, final_result], expected_children_ids=["root"]
        )

    def test_without_uptime_results(self):
        """Test that uptime results are not queried when include_uptime is not set"""
        self.load_trace(is_eap=True)
        uptime_result = self._create_uptime_result_with_original_url(
            organization=self.organization,
            project=self.project,
            trace_id=self.trace_id,
            guid="check-456",
            subscription_id="sub-789",
            check_status="success",
            http_status_code=200,
            request_sequence=0,
            request_url="https://test.com",
            scheduled_check_time=self.day_ago,
        )

        self.store_uptime_results([uptime_result])

        with self.feature(self.FEATURES):
            response = self.client_get(
                data={"timestamp": self.day_ago},
            )

        assert response.status_code == 200, response.content
        data = response.data
        assert len(data) == 1
        self.assert_trace_data(data[0])

        uptime_checks = self._find_uptime_checks(data)
        assert len(uptime_checks) == 0

    def test_uptime_root_tree_with_orphaned_spans(self):
        """Test that orphaned spans are parented to the final uptime request"""
        self.load_trace(is_eap=True)

        self.create_event(
            trace_id=self.trace_id,
            transaction="/transaction/orphan",
            spans=[],
            project_id=self.project.id,
            parent_span_id=uuid4().hex[:16],
            milliseconds=500,
            is_eap=True,
        )
        redirect_result = self._create_uptime_result_with_original_url(
            organization=self.organization,
            project=self.project,
            trace_id=self.trace_id,
            guid="check-123",
            check_status="success",
            http_status_code=301,
            request_sequence=0,
            request_url="https://example.com",
            scheduled_check_time=self.day_ago,
            check_duration_us=300000,
        )

        final_result = self._create_uptime_result_with_original_url(
            organization=self.organization,
            project=self.project,
            trace_id=self.trace_id,
            guid="check-123",
            check_status="success",
            http_status_code=200,
            request_sequence=1,
            request_url="https://www.example.com",
            scheduled_check_time=self.day_ago,
        )

        features = self.FEATURES

        self.store_uptime_results([redirect_result, final_result])

        with self.feature(features):
            response = self.client_get(
                data={"timestamp": self.day_ago, "include_uptime": "1"},
            )

        assert response.status_code == 200, response.content
        data = response.data

        self.assert_expected_results(
            data,
            [redirect_result, final_result],
            expected_children_ids=["root", "/transaction/orphan"],
        )

    def test_uptime_root_tree_without_orphans(self):
        """Test uptime results when there are no orphaned spans"""
        self.load_trace(is_eap=True)

        uptime_result = self._create_uptime_result_with_original_url(
            organization=self.organization,
            project=self.project,
            trace_id=self.trace_id,
            guid="check-456",
            check_status="success",
            http_status_code=200,
            request_sequence=0,
            request_url="https://test.com",
            scheduled_check_time=self.day_ago,
            check_duration_us=200000,
        )

        features = self.FEATURES

        self.store_uptime_results([uptime_result])

        with self.feature(features):
            response = self.client_get(
                data={"timestamp": self.day_ago, "include_uptime": "1"},
            )

        assert response.status_code == 200, response.content
        data = response.data

        self.assert_expected_results(data, [uptime_result], expected_children_ids=["root"])

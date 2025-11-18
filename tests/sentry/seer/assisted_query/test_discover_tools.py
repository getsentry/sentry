import pytest

from sentry.seer.assisted_query.discover_tools import (
    get_event_filter_key_values,
    get_event_filter_keys,
)
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now


@pytest.mark.django_db(databases=["default", "control"])
class TestGetEventFilterKeys(APITestCase, SnubaTestCase):
    databases = "__all__"

    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)

    def test_get_event_filter_keys_success(self):
        """Test that get_event_filter_keys returns tags, feature flags, and static fields"""
        # Create an error event with custom tags
        self.store_event(
            data={
                "event_id": "a" * 32,
                "tags": {"fruit": "apple", "color": "red"},
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )

        # Create an event with feature flags
        self.store_event(
            data={
                "contexts": {
                    "flags": {
                        "values": [
                            {"flag": "feature_a", "result": True},
                            {"flag": "feature_b", "result": False},
                        ]
                    }
                },
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )

        result = get_event_filter_keys(
            org_id=self.organization.id,
            project_ids=[self.project.id],
        )

        assert result is not None
        assert "tags" in result
        assert "feature_flags" in result
        assert "static_fields" in result

        # Check tags
        tags = result["tags"]
        assert isinstance(tags, list)
        assert len(tags) > 0
        # Check that our custom tags are present
        assert "fruit" in tags
        assert "color" in tags

        # Check feature flags
        feature_flags = result["feature_flags"]
        assert isinstance(feature_flags, list)
        assert "feature_a" in feature_flags
        assert "feature_b" in feature_flags

        # Check static fields
        static_fields = result["static_fields"]
        assert isinstance(static_fields, list)
        assert len(static_fields) > 0
        # Should include common fields like timestamp, message, etc.
        assert "timestamp" in static_fields
        assert "message" in static_fields

    def test_get_event_filter_keys_multiple_projects(self):
        """Test with multiple projects"""
        project2 = self.create_project(organization=self.organization)

        # Create events in both projects
        self.store_event(
            data={
                "event_id": "a" * 32,
                "tags": {"project1_tag": "value1"},
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )

        self.store_event(
            data={
                "event_id": "b" * 32,
                "tags": {"project2_tag": "value2"},
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=project2.id,
        )

        # Empty projects should be treated as a query for all projects.
        for pids in [[self.project.id, project2.id], [], None]:
            result = get_event_filter_keys(
                org_id=self.organization.id,
                project_ids=pids,
            )

            assert result is not None
            assert "tags" in result

            tags = result["tags"]
            # Both project tags should be present
            assert "project1_tag" in tags
            assert "project2_tag" in tags

    def test_get_event_filter_keys_deduplicates_static_and_tags(self):
        """Test that tags appearing in both static fields and tags are only returned as tags"""
        # Create an event with a tag that might also be a static field
        self.store_event(
            data={
                "event_id": "a" * 32,
                "tags": {"environment": "production"},
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )

        result = get_event_filter_keys(
            org_id=self.organization.id,
            project_ids=[self.project.id],
        )

        assert result is not None
        tags = result["tags"]
        static_fields = result["static_fields"]

        # If environment appears as a tag, it should not also be in static_fields
        assert "environment" in tags
        assert "environment" not in static_fields


@pytest.mark.django_db(databases=["default", "control"])
class TestGetEventFilterKeyValues(APITestCase, SnubaTestCase):
    databases = "__all__"

    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)

    def test_get_event_filter_key_values_tag_key(self):
        """Test getting values for a tag key"""
        # Create events with the same tag key but different values
        self.store_event(
            data={
                "event_id": "a" * 32,
                "tags": {"environment": "production"},
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "tags": {"environment": "staging"},
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "tags": {"environment": "production"},
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )

        result = get_event_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            filter_key="environment",
            is_feature_flag=False,
        )

        assert result is not None
        assert isinstance(result, list)
        assert len(result) > 0

        # Check structure of returned values
        for item in result:
            assert "value" in item
            assert "count" in item
            assert "lastSeen" in item
            assert "firstSeen" in item

        # Check that we have our environment values
        values = {item["value"] for item in result}
        assert "production" in values
        assert "staging" in values

        # Check counts
        value_counts = {item["value"]: item["count"] for item in result}
        assert value_counts["production"] == 2
        assert value_counts["staging"] == 1

    def test_get_event_filter_key_values_feature_flag(self):
        """Test getting values for a feature flag"""
        # Create events with feature flags
        self.store_event(
            data={
                "contexts": {
                    "flags": {
                        "values": [
                            {"flag": "organizations:test-feature", "result": True},
                        ]
                    }
                },
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "contexts": {
                    "flags": {
                        "values": [
                            {"flag": "organizations:test-feature", "result": False},
                        ]
                    }
                },
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )

        result = get_event_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            filter_key="organizations:test-feature",
            is_feature_flag=True,
        )

        assert result is not None
        assert isinstance(result, list)
        # Should have flag values
        if len(result) > 0:
            for item in result:
                assert "value" in item
                assert "count" in item

    def test_get_event_filter_key_values_boolean_field(self):
        """Test that boolean fields return predefined values"""
        result = get_event_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            filter_key="error.handled",
            is_feature_flag=False,
        )

        assert result is not None
        assert isinstance(result, list)
        # Should return true/false values
        assert len(result) == 2
        values = {item["value"] for item in result}
        assert "true" in values
        assert "false" in values

    def test_get_event_filter_key_values_date_field(self):
        """Test that date fields return predefined relative date suggestions"""
        result = get_event_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            filter_key="timestamp",
            is_feature_flag=False,
        )

        assert result is not None
        assert isinstance(result, list)
        # Should return relative date suggestions like "-1h", "-24h", etc.
        assert len(result) > 0
        values = {item["value"] for item in result}
        # Should include common relative dates
        assert "-1h" in values
        assert "-24h" in values
        assert "-7d" in values

    def test_get_event_filter_key_values_has_key(self):
        """Test that 'has' key returns all available tag keys"""
        # Create event with custom tag
        self.store_event(
            data={
                "event_id": "a" * 32,
                "tags": {"custom_tag": "value", "custom2": "value2"},
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )

        result = get_event_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            filter_key="has",
            is_feature_flag=False,
        )

        assert result is not None
        assert isinstance(result, list)
        assert len(result) > 0
        values = {item["value"] for item in result}
        assert "custom_tag" in values
        assert "custom2" in values

    def test_get_event_filter_key_values_aggregate_function_returns_empty(self):
        """Test that aggregate functions return empty list"""
        result = get_event_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            filter_key="count()",
            is_feature_flag=False,
        )

        assert result == []

    def test_get_event_filter_key_values_measurement_returns_empty(self):
        """Test that measurements return empty list"""
        result = get_event_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            filter_key="measurements.lcp",
            is_feature_flag=False,
        )

        assert result == []

    def test_get_event_filter_key_values_device_class_returns_empty(self):
        """Test that device.class returns empty list"""
        result = get_event_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            filter_key="device.class",
            is_feature_flag=False,
        )

        assert result == []

    def test_get_event_filter_key_values_with_substring_filter(self):
        """Test substring filtering of filter key values"""
        # Create events with different environment values
        self.store_event(
            data={
                "event_id": "a" * 32,
                "tags": {"environment": "production"},
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "tags": {"environment": "production-eu"},
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "tags": {"environment": "staging"},
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "d" * 32,
                "tags": {"environment": "development"},
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )

        # Filter for "prod" substring - should only return production values
        result = get_event_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            filter_key="environment",
            is_feature_flag=False,
            substring="prod",
        )

        assert result is not None
        assert isinstance(result, list)
        assert len(result) > 0

        # Should only contain values with "prod" in them
        values = {item["value"] for item in result}
        assert "production" in values
        assert "production-eu" in values
        assert "staging" not in values
        assert "development" not in values

    def test_get_event_filter_key_values_nonexistent_tag(self):
        """Test that nonexistent filter key returns empty list"""
        result = get_event_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            filter_key="nonexistent_tag_key_12345",
            is_feature_flag=False,
        )
        # Should return empty list, not None
        assert result == []

    def test_get_event_filter_key_values_multiple_projects(self):
        """Test getting filter key values across multiple projects"""
        project2 = self.create_project(organization=self.organization)

        # Create events in both projects with same tag key
        self.store_event(
            data={
                "event_id": "a" * 32,
                "tags": {"region": "us-east"},
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "tags": {"region": "us-west"},
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=project2.id,
        )

        # Empty projects should be treated as a query for all projects.
        for pids in [[self.project.id, project2.id], [], None]:
            result = get_event_filter_key_values(
                org_id=self.organization.id,
                project_ids=pids,
                filter_key="region",
                is_feature_flag=False,
            )

            assert result is not None
            assert isinstance(result, list)
            assert len(result) > 0

            # Should have values from both projects
            values = {item["value"] for item in result}
            assert "us-east" in values
            assert "us-west" in values

    def test_get_event_filter_key_values_different_stats_periods(self):
        """Test that different stats periods affect results"""
        # Create an event 2 days ago
        two_days_ago = before_now(days=2)
        self.store_event(
            data={
                "event_id": "a" * 32,
                "tags": {"test_tag": "old_value"},
                "timestamp": two_days_ago.isoformat(),
            },
            project_id=self.project.id,
        )

        # Create a recent event
        self.store_event(
            data={
                "event_id": "b" * 32,
                "tags": {"test_tag": "new_value"},
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )

        # Query with 1 day period - should only get recent
        result_1d = get_event_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            filter_key="test_tag",
            is_feature_flag=False,
            stats_period="24h",
        )

        # Query with 7 day period - should get both
        result_7d = get_event_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            filter_key="test_tag",
            is_feature_flag=False,
            stats_period="7d",
        )

        assert result_1d is not None
        assert result_7d is not None

        values_1d = {item["value"] for item in result_1d}
        values_7d = {item["value"] for item in result_7d}

        # Recent value should be in both
        assert "new_value" in values_1d
        assert "new_value" in values_7d

        # Old value should only be in 7d results
        assert "old_value" not in values_1d
        assert "old_value" in values_7d

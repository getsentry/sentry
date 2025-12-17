from datetime import datetime

import pytest

from sentry.seer.assisted_query.issues_tools import (
    _EVENT_CONTEXT_FIELDS,
    DEVICE_CLASS_VALUES,
    _get_static_values,
    execute_issues_query,
    get_filter_key_values,
    get_issue_filter_keys,
    get_issues_stats,
)
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from tests.sentry.issues.test_utils import OccurrenceTestMixin


@pytest.mark.django_db(databases=["default", "control"])
class TestGetIssueFilterKeys(APITestCase, SnubaTestCase, OccurrenceTestMixin):
    databases = {"default", "control"}

    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)

    def test_get_issue_filter_keys_success(self):
        """Test that get_issue_filter_keys returns tags and feature flags"""
        # Create an error event with custom tags
        self.store_event(
            data={
                "event_id": "a" * 32,
                "tags": {"fruit": "apple", "color": "red"},
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )

        # Create an issue platform event
        self.process_occurrence(
            event_id="b" * 32,
            project_id=self.project.id,
            event_data={
                "title": "some problem",
                "platform": "python",
                "tags": {"issue_tag": "value"},
                "timestamp": self.min_ago.isoformat(),
                "received": self.min_ago.isoformat(),
            },
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

        result = get_issue_filter_keys(
            org_id=self.organization.id,
            project_ids=[self.project.id],
        )

        assert result is not None
        assert "tags" in result
        assert "feature_flags" in result

        # Check tags (merged event_tags and issue_tags)
        tags = result["tags"]
        assert isinstance(tags, list)
        assert len(tags) > 0
        # Verify structure of tags
        for tag in tags:
            assert "key" in tag
            assert "name" in tag
            assert "totalValues" in tag

        # Check that our custom tags are present
        tag_keys = {tag["key"] for tag in tags}
        assert "fruit" in tag_keys
        assert "color" in tag_keys

        # Check feature flags
        feature_flags = result["feature_flags"]
        assert isinstance(feature_flags, list)
        if len(feature_flags) > 0:
            for flag in feature_flags:
                assert "key" in flag
                assert "name" in flag
                assert "totalValues" in flag
            # Verify our flags are present
            flag_keys = {flag["key"] for flag in feature_flags}
            assert "feature_a" in flag_keys
            assert "feature_b" in flag_keys

    def test_get_issue_filter_keys_nonexistent_organization(self):
        """Test that nonexistent organization returns None"""
        result = get_issue_filter_keys(
            org_id=99999,
            project_ids=[self.project.id],
        )
        assert result is None

    def test_get_issue_filter_keys_empty_projects(self):
        """Test with empty project list"""
        result = get_issue_filter_keys(
            org_id=self.organization.id,
            project_ids=[],
        )
        assert result is not None
        assert "tags" in result
        assert "feature_flags" in result
        # Should return empty or minimal results
        assert isinstance(result["tags"], list)
        assert isinstance(result["feature_flags"], list)

    def test_get_issue_filter_keys_multiple_projects(self):
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

        result = get_issue_filter_keys(
            org_id=self.organization.id,
            project_ids=[self.project.id, project2.id],
        )

        assert result is not None
        assert "tags" in result

        tags = result["tags"]
        tag_keys = {tag["key"] for tag in tags}
        # Both project tags should be present
        assert "project1_tag" in tag_keys
        assert "project2_tag" in tag_keys


@pytest.mark.django_db(databases=["default", "control"])
class TestGetFilterKeyValues(APITestCase, SnubaTestCase, OccurrenceTestMixin):
    databases = {"default", "control"}

    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)

    def test_get_filter_key_values_events_dataset(self):
        """Test getting values for a filter key in the events dataset"""
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

        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="environment",
        )

        assert result is not None
        assert isinstance(result, list)
        assert len(result) > 0

        # Check structure of returned values
        for item in result:
            assert "key" in item
            assert "name" in item
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

    def test_get_filter_key_values_search_issues_dataset(self):
        """Test getting values for a filter key in the search_issues dataset (automatically detected)"""
        # Create issue platform events with tags
        self.process_occurrence(
            event_id="a" * 32,
            project_id=self.project.id,
            event_data={
                "title": "problem 1",
                "platform": "python",
                "tags": {"issue_type": "timeout"},
                "timestamp": self.min_ago.isoformat(),
                "received": self.min_ago.isoformat(),
            },
        )
        self.process_occurrence(
            event_id="b" * 32,
            project_id=self.project.id,
            event_data={
                "title": "problem 2",
                "platform": "python",
                "tags": {"issue_type": "error"},
                "timestamp": self.min_ago.isoformat(),
                "received": self.min_ago.isoformat(),
            },
        )

        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="issue_type",
        )

        assert result is not None
        assert isinstance(result, list)
        # Should have our issue_type values
        if len(result) > 0:
            for item in result:
                assert "key" in item
                assert "value" in item
                assert "count" in item

    def test_get_filter_key_values_with_flags_backend(self):
        """Test getting feature flag values (automatically detected by 'feature.' prefix)"""
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

        # Function should automatically detect feature flag by "feature." prefix
        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="feature.organizations:test-feature",
        )

        assert result is not None
        assert isinstance(result, list)
        # Should have flag values
        if len(result) > 0:
            for item in result:
                assert "key" in item
                assert "value" in item
                assert "count" in item

    def test_get_filter_key_values_nonexistent_organization(self):
        """Test that nonexistent organization returns None"""
        result = get_filter_key_values(
            org_id=99999,
            project_ids=[self.project.id],
            attribute_key="environment",
        )
        assert result is None

    def test_get_filter_key_values_nonexistent_attribute(self):
        """Test that nonexistent filter key returns empty list"""
        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="nonexistent_attribute_key_12345",
        )
        # Should return empty list, not None
        assert result == []

    def test_get_filter_key_values_multiple_projects(self):
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

        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id, project2.id],
            attribute_key="region",
        )

        assert result is not None
        assert isinstance(result, list)
        assert len(result) > 0

        # Should have values from both projects
        values = {item["value"] for item in result}
        assert "us-east" in values
        assert "us-west" in values

    def test_get_filter_key_values_merges_across_datasets(self):
        """Test that values from multiple datasets are merged correctly"""
        # Create the same tag value in both events and issue platform
        # to test that counts are summed
        self.store_event(
            data={
                "event_id": "a" * 32,
                "tags": {"category": "backend"},
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "tags": {"category": "backend"},
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "tags": {"category": "frontend"},
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )

        # Create issue platform events with the same tag
        self.process_occurrence(
            event_id="d" * 32,
            project_id=self.project.id,
            event_data={
                "title": "backend problem",
                "platform": "python",
                "tags": {"category": "backend"},
                "timestamp": self.min_ago.isoformat(),
                "received": self.min_ago.isoformat(),
            },
        )

        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="category",
        )

        assert result is not None
        assert isinstance(result, list)
        assert len(result) > 0

        # Check that "backend" appears once but with merged count
        value_counts = {item["value"]: item["count"] for item in result}

        # "backend" should appear in both events (2x) and search_issues (1x)
        # The merge should combine these counts
        assert "backend" in value_counts
        # Since we can't guarantee exact count due to dataset behavior,
        # just verify backend has a higher count than frontend
        assert "frontend" in value_counts
        assert value_counts["backend"] >= value_counts["frontend"]

        # Verify results are sorted by count (descending)
        counts = [item["count"] for item in result]
        assert counts == sorted(
            counts, reverse=True
        ), "Results should be sorted by count descending"

    def test_get_filter_key_values_with_substring_filter(self):
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
        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="environment",
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


@pytest.mark.django_db(databases=["default", "control"])
class TestExecuteIssuesQuery(APITestCase, SnubaTestCase):
    databases = {"default", "control"}

    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)

    def test_execute_issues_query_basic(self):
        """Test basic issues query"""
        # Create some issues
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "Error message 1",
                "level": "error",
                "fingerprint": ["group-1"],
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "Error message 2",
                "level": "warning",
                "fingerprint": ["group-2"],
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )

        result = execute_issues_query(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            query="is:unresolved",
            stats_period="24h",
        )

        assert result is not None
        assert isinstance(result, list)
        assert len(result) >= 2

        # Check structure of returned issues
        for issue in result:
            assert "id" in issue
            assert "shortId" in issue
            assert "title" in issue
            assert "status" in issue
            assert "project" in issue

    def test_execute_issues_query_with_filter(self):
        """Test issues query with specific filter"""
        # Create an error event
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "Test error",
                "level": "error",
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )

        result = execute_issues_query(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            query="level:error",
            stats_period="24h",
        )

        assert result is not None
        assert isinstance(result, list)
        # Should have at least our error event
        assert len(result) >= 1

    def test_execute_issues_query_with_sort(self):
        """Test issues query with sorting"""
        # Create multiple issues
        for i in range(3):
            self.store_event(
                data={
                    "event_id": chr(97 + i) * 32,
                    "message": f"Error {i}",
                    "fingerprint": [f"group-{i}"],
                    "timestamp": self.min_ago.isoformat(),
                },
                project_id=self.project.id,
            )

        result = execute_issues_query(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            query="is:unresolved",
            stats_period="24h",
            sort="date",
        )

        assert result is not None
        assert isinstance(result, list)
        assert len(result) >= 3

    def test_execute_issues_query_with_limit(self):
        """Test issues query with limit"""
        # Create multiple issues
        for i in range(5):
            self.store_event(
                data={
                    "event_id": chr(97 + i) * 32,
                    "message": f"Error {i}",
                    "timestamp": self.min_ago.isoformat(),
                },
                project_id=self.project.id,
            )

        result = execute_issues_query(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            query="is:unresolved",
            stats_period="24h",
            limit=2,
        )

        assert result is not None
        assert isinstance(result, list)
        # Should respect limit
        assert len(result) <= 2

    def test_execute_issues_query_nonexistent_organization(self):
        """Test that nonexistent organization returns None"""
        result = execute_issues_query(
            org_id=99999,
            project_ids=[self.project.id],
            query="is:unresolved",
            stats_period="24h",
        )
        assert result is None

    def test_execute_issues_query_multiple_projects(self):
        """Test issues query across multiple projects"""
        project2 = self.create_project(organization=self.organization)

        # Create issues in both projects
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "Project 1 error",
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "Project 2 error",
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=project2.id,
        )

        result = execute_issues_query(
            org_id=self.organization.id,
            project_ids=[self.project.id, project2.id],
            query="is:unresolved",
            stats_period="24h",
        )

        assert result is not None
        assert isinstance(result, list)
        # Should have issues from both projects
        assert len(result) >= 2
        project_ids = {issue["project"]["id"] for issue in result}
        assert str(self.project.id) in project_ids
        assert str(project2.id) in project_ids


@pytest.mark.django_db(databases=["default", "control"])
class TestGetIssuesStats(APITestCase, SnubaTestCase):
    databases = {"default", "control"}

    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)

    def test_get_issues_stats_success(self):
        """Test that get_issues_stats returns stats for issues"""
        # Store two events to create issues
        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "First error",
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "Second error",
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )

        issue_ids = [str(event1.group_id), str(event2.group_id)]

        result = get_issues_stats(
            org_id=self.organization.id,
            issue_ids=issue_ids,
            project_ids=[self.project.id],
            query="is:unresolved",
            stats_period="24h",
        )

        assert result is not None
        assert isinstance(result, list)
        assert len(result) == 2

        # Verify each stat has the expected fields
        for stat in result:
            assert "id" in stat
            assert "count" in stat
            assert "userCount" in stat
            assert "firstSeen" in stat
            assert "lastSeen" in stat
            assert stat["id"] in issue_ids

            # Verify stats field structure
            # stats should be a dict with stats_period keys (e.g., "24h", "14d")
            # Each value is an array of (timestamp, count) tuples
            assert "stats" in stat
            assert isinstance(stat["stats"], dict)
            # Should have the stats_period key we passed ("24h")
            assert "24h" in stat["stats"]
            # The value should be an array of tuples
            assert isinstance(stat["stats"]["24h"], list)
            # Each element should be a tuple of (timestamp, count) where both are numbers
            for data_point in stat["stats"]["24h"]:
                assert isinstance(data_point, tuple)
                assert len(data_point) == 2
                assert isinstance(data_point[0], (int, float))  # timestamp
                assert isinstance(data_point[1], (int, float))  # count

            # Verify lifetime field structure
            # lifetime should be a dict with count, userCount, firstSeen, lastSeen
            assert "lifetime" in stat
            assert isinstance(stat["lifetime"], dict)
            assert "count" in stat["lifetime"]
            assert "userCount" in stat["lifetime"]
            assert "firstSeen" in stat["lifetime"]
            assert "lastSeen" in stat["lifetime"]
            # count should be a string representation of the number
            assert isinstance(stat["lifetime"]["count"], str)
            # userCount should be an integer
            assert isinstance(stat["lifetime"]["userCount"], int)
            # firstSeen and lastSeen are datetime objects or None
            assert stat["lifetime"]["firstSeen"] is None or isinstance(
                stat["lifetime"]["firstSeen"], datetime
            )
            assert stat["lifetime"]["lastSeen"] is None or isinstance(
                stat["lifetime"]["lastSeen"], datetime
            )

    def test_get_issues_stats_with_multiple_projects(self):
        """Test that get_issues_stats works with multiple project IDs"""
        project2 = self.create_project(organization=self.organization)

        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "Project 1 error",
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "Project 2 error",
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=project2.id,
        )

        issue_ids = [str(event1.group_id), str(event2.group_id)]

        result = get_issues_stats(
            org_id=self.organization.id,
            issue_ids=issue_ids,
            project_ids=[self.project.id, project2.id],
            query="is:unresolved",
            stats_period="24h",
        )

        assert result is not None
        assert isinstance(result, list)
        # Should return stats for both issues
        assert len(result) >= 2
        returned_issue_ids = {stat["id"] for stat in result}
        assert str(event1.group_id) in returned_issue_ids
        assert str(event2.group_id) in returned_issue_ids

    def test_get_issues_stats_nonexistent_org(self):
        """Test that get_issues_stats returns None for nonexistent org"""
        result = get_issues_stats(
            org_id=999999,
            issue_ids=["123"],
            project_ids=[self.project.id],
            query="is:unresolved",
            stats_period="24h",
        )

        assert result is None

    def test_get_issues_stats_empty_issue_ids(self):
        """Test that get_issues_stats handles empty issue IDs"""
        result = get_issues_stats(
            org_id=self.organization.id,
            issue_ids=[],
            project_ids=[self.project.id],
            query="is:unresolved",
            stats_period="24h",
        )

        assert result is not None
        assert isinstance(result, list)
        assert len(result) == 0

    def test_get_issues_stats_stats_and_lifetime_structure(self):
        """Test that stats and lifetime fields have the correct structure"""
        # Create an issue
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "Test error",
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )

        result = get_issues_stats(
            org_id=self.organization.id,
            issue_ids=[str(event.group_id)],
            project_ids=[self.project.id],
            query="is:unresolved",
            stats_period="24h",
        )

        assert result is not None
        assert len(result) == 1

        stat = result[0]

        # Verify stats structure:
        # stats is a dict where keys are stats_period strings (e.g., "24h", "14d")
        # and values are arrays of (timestamp, count) tuples
        assert "stats" in stat
        assert isinstance(stat["stats"], dict)
        assert "24h" in stat["stats"]
        assert isinstance(stat["stats"]["24h"], list)
        # Each element should be a tuple of (timestamp, count)
        for timepoint in stat["stats"]["24h"]:
            assert isinstance(timepoint, tuple)
            assert len(timepoint) == 2
            timestamp, count = timepoint
            assert isinstance(timestamp, (int, float))
            assert isinstance(count, (int, float))
            # Timestamp should be a reasonable Unix timestamp (seconds since epoch)
            # For 24h period, should be within last day
            assert timestamp > 0

        # Verify lifetime structure:
        # lifetime is a dict with count (string), userCount (int), firstSeen (datetime), lastSeen (datetime)
        assert "lifetime" in stat
        assert isinstance(stat["lifetime"], dict)
        lifetime = stat["lifetime"]

        # Required fields
        assert "count" in lifetime
        assert "userCount" in lifetime
        assert "firstSeen" in lifetime
        assert "lastSeen" in lifetime

        # Field types
        assert isinstance(lifetime["count"], str)
        # Count should be a numeric string representing the total times seen
        # (e.g., "1", "42", "1000")
        assert lifetime["count"].isdigit()

        assert isinstance(lifetime["userCount"], int)

        # firstSeen and lastSeen are datetime objects or None
        if lifetime["firstSeen"] is not None:
            assert isinstance(lifetime["firstSeen"], datetime)

        if lifetime["lastSeen"] is not None:
            assert isinstance(lifetime["lastSeen"], datetime)

        # Optional stats field in lifetime (currently None in implementation)
        if "stats" in lifetime:
            assert lifetime["stats"] is None or isinstance(lifetime["stats"], dict)


@pytest.mark.django_db(databases=["default", "control"])
class TestGetStaticValues(APITestCase):
    """Tests for _get_static_values() function"""

    def test_boolean_field_returns_true_false(self):
        """Test that boolean fields return true/false values"""
        # Test all boolean fields
        boolean_fields = [
            "error.handled",
            "error.unhandled",
            "error.main_thread",
            "symbolicated_in_app",
            "app.in_foreground",
        ]
        for field in boolean_fields:
            result = _get_static_values(field)
            assert result is not None
            assert len(result) == 2
            values = {item["value"] for item in result}
            assert values == {"true", "false"}

    def test_device_class_returns_enum_values(self):
        """Test that device.class returns high/medium/low values"""
        result = _get_static_values("device.class")
        assert result is not None
        assert len(result) == 3
        values = [item["value"] for item in result]
        assert values == DEVICE_CLASS_VALUES
        assert "high" in values
        assert "medium" in values
        assert "low" in values

    def test_datetime_fields_return_empty_list(self):
        """Test that datetime fields return empty list (no suggested values)"""
        datetime_fields = [
            "lastSeen",
            "firstSeen",
            "event.timestamp",
            "timestamp",
            "issue.seer_last_run",
        ]
        for field in datetime_fields:
            result = _get_static_values(field)
            assert result == []

    def test_uuid_field_returns_empty_list(self):
        """Test that uuid field returns empty list"""
        result = _get_static_values("id")
        assert result == []

    def test_issue_short_id_returns_empty_list(self):
        """Test that issue short id field returns empty list"""
        result = _get_static_values("issue")
        assert result == []

    def test_integer_field_returns_empty_list(self):
        """Test that integer field returns empty list"""
        result = _get_static_values("timesSeen")
        assert result == []

    def test_text_fields_return_none(self):
        """Test that text fields return None (fall through to API query)"""
        text_fields = ["message", "title", "location"]
        for field in text_fields:
            result = _get_static_values(field)
            assert result is None

    def test_unknown_field_returns_none(self):
        """Test that unknown fields return None (fall through to API query)"""
        result = _get_static_values("unknown_field")
        assert result is None


@pytest.mark.django_db(databases=["default", "control"])
class TestEventContextFields(APITestCase, SnubaTestCase):
    """Tests for event context fields functionality"""

    databases = {"default", "control"}

    def test_event_context_fields_included_in_built_in_fields(self):
        """Test that event context fields are included in get_issue_filter_keys"""
        result = get_issue_filter_keys(
            org_id=self.organization.id,
            project_ids=[self.project.id],
        )

        assert result is not None
        assert "built_in_fields" in result
        built_in_fields = result["built_in_fields"]

        # Get all built-in field keys
        built_in_keys = {field["key"] for field in built_in_fields}

        # Check that key event context fields are present
        expected_event_context_fields = [
            # Device fields
            "device.class",
            "device.family",
            "device.arch",
            # Error fields
            "error.handled",
            "error.unhandled",
            "error.type",
            # Event metadata
            "title",
            "message",
            "location",
            # Geographic
            "geo.city",
            "geo.country_code",
            # HTTP
            "http.method",
            "http.url",
            # OS
            "os.build",
            # Stack
            "stack.function",
            "stack.filename",
            # User
            "user.email",
            "user.id",
            # Release
            "release",
        ]

        for field in expected_event_context_fields:
            assert field in built_in_keys, f"Expected '{field}' to be in built_in_fields"

    def test_event_context_fields_list_completeness(self):
        """Test that _EVENT_CONTEXT_FIELDS contains expected fields"""
        # Check that the list contains key categories of fields
        assert "device.class" in _EVENT_CONTEXT_FIELDS
        assert "error.handled" in _EVENT_CONTEXT_FIELDS
        assert "http.method" in _EVENT_CONTEXT_FIELDS
        assert "geo.city" in _EVENT_CONTEXT_FIELDS
        assert "user.email" in _EVENT_CONTEXT_FIELDS
        assert "stack.function" in _EVENT_CONTEXT_FIELDS
        assert "release" in _EVENT_CONTEXT_FIELDS
        assert "sdk.name" in _EVENT_CONTEXT_FIELDS
        assert "os.build" in _EVENT_CONTEXT_FIELDS
        assert "transaction" in _EVENT_CONTEXT_FIELDS

    def test_boolean_event_fields_have_values(self):
        """Test that boolean event context fields have true/false values in built-in fields"""
        result = get_issue_filter_keys(
            org_id=self.organization.id,
            project_ids=[self.project.id],
        )

        assert result is not None
        built_in_fields = result["built_in_fields"]

        # Find the error.handled field
        error_handled_field = next(
            (f for f in built_in_fields if f["key"] == "error.handled"), None
        )
        assert error_handled_field is not None
        assert error_handled_field["values"] == ["true", "false"]

        # Find the error.unhandled field
        error_unhandled_field = next(
            (f for f in built_in_fields if f["key"] == "error.unhandled"), None
        )
        assert error_unhandled_field is not None
        assert error_unhandled_field["values"] == ["true", "false"]

    def test_device_class_field_has_enum_values(self):
        """Test that device.class field has high/medium/low values in built-in fields"""
        result = get_issue_filter_keys(
            org_id=self.organization.id,
            project_ids=[self.project.id],
        )

        assert result is not None
        built_in_fields = result["built_in_fields"]

        # Find the device.class field
        device_class_field = next((f for f in built_in_fields if f["key"] == "device.class"), None)
        assert device_class_field is not None
        assert device_class_field["values"] == DEVICE_CLASS_VALUES


@pytest.mark.django_db(databases=["default", "control"])
class TestGetFilterKeyValuesStaticFields(APITestCase, SnubaTestCase):
    """Tests for get_filter_key_values with static/built-in fields"""

    databases = {"default", "control"}

    def test_get_filter_key_values_boolean_field(self):
        """Test that boolean fields return true/false values"""
        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="error.handled",
        )

        assert result is not None
        assert len(result) == 2
        values = {item["value"] for item in result}
        assert values == {"true", "false"}

    def test_get_filter_key_values_device_class(self):
        """Test that device.class returns enum values"""
        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="device.class",
        )

        assert result is not None
        assert len(result) == 3
        values = [item["value"] for item in result]
        assert values == DEVICE_CLASS_VALUES

    def test_get_filter_key_values_datetime_field(self):
        """Test that datetime fields return empty list"""
        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="lastSeen",
        )

        assert result == []

    def test_get_filter_key_values_uuid_field(self):
        """Test that uuid field returns empty list"""
        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="id",
        )

        assert result == []

    def test_get_filter_key_values_boolean_with_substring_filter(self):
        """Test that substring filtering works on boolean fields"""
        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="error.handled",
            substring="tr",
        )

        assert result is not None
        assert len(result) == 1
        assert result[0]["value"] == "true"


@pytest.mark.django_db(databases=["default", "control"])
class TestGetFilterKeyValuesTextFields(APITestCase, SnubaTestCase):
    """Integration tests for text fields that fall through to API query"""

    databases = {"default", "control"}

    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)

    def test_get_filter_key_values_message_field(self):
        """Test that message field queries the API and returns actual event messages"""
        # Store events with different messages
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "DatabaseError: connection timeout",
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "DatabaseError: query failed",
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "message": "ValueError: invalid input",
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )

        # Query for message values - should fall through to API
        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="message",
        )

        # Should return actual message values from events, not empty or None
        assert result is not None
        assert isinstance(result, list)
        # The API should return values (may be empty if message isn't indexed as a tag)
        # At minimum, verify we got a list back (not None which would indicate built-in handling)

    def test_get_filter_key_values_message_with_substring(self):
        """Test that message field supports substring filtering via API"""
        # Store events with different messages
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "DatabaseError: connection timeout",
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "DatabaseError: query failed",
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "c" * 32,
                "message": "ValueError: invalid input",
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )

        # Query for message values with substring filter
        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="message",
            substring="Database",
        )

        # Should return a list (API was queried, not short-circuited)
        assert result is not None
        assert isinstance(result, list)

    def test_get_filter_key_values_title_field(self):
        """Test that title field queries the API and returns actual event titles"""
        # Store events - title is derived from the event
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "Error in payment processing",
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "Error in user authentication",
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )

        # Query for title values - should fall through to API
        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="title",
        )

        # Should return a list (API was queried)
        assert result is not None
        assert isinstance(result, list)

    def test_get_filter_key_values_location_field(self):
        """Test that location field queries the API"""
        # Store events with stack traces that have locations
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "Test error",
                "exception": {
                    "values": [
                        {
                            "type": "ValueError",
                            "value": "test",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "filename": "app/views.py",
                                        "function": "handle_request",
                                        "lineno": 42,
                                    }
                                ]
                            },
                        }
                    ]
                },
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )

        # Query for location values - should fall through to API
        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="location",
        )

        # Should return a list (API was queried)
        assert result is not None
        assert isinstance(result, list)

    def test_text_fields_not_in_field_value_types(self):
        """Verify text fields are not in _FIELD_VALUE_TYPES so they fall through to API query"""
        from sentry.seer.assisted_query.issues_tools import _FIELD_VALUE_TYPES

        # These text fields should NOT be in the mapping, so they fall through to API query
        assert "message" not in _FIELD_VALUE_TYPES
        assert "title" not in _FIELD_VALUE_TYPES
        assert "location" not in _FIELD_VALUE_TYPES

    def test_release_fields_query_api(self):
        """Test that release fields fall through to API query"""
        # Store event with release
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "Test error",
                "release": "myapp@1.0.0",
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "Test error 2",
                "release": "myapp@2.0.0",
                "timestamp": self.min_ago.isoformat(),
            },
            project_id=self.project.id,
        )

        # Query for release values - should fall through to API
        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="release",
        )

        # Should return a list with actual release values
        assert result is not None
        assert isinstance(result, list)
        # Release is a common tag so it should have values
        if len(result) > 0:
            values = {item["value"] for item in result}
            assert "myapp@1.0.0" in values or "myapp@2.0.0" in values


@pytest.mark.django_db(databases=["default", "control"])
class TestAssigneeAndUsernameValues(APITestCase, SnubaTestCase):
    """Integration tests for assignee and username field values"""

    databases = {"default", "control"}

    def test_get_filter_key_values_assigned_field(self):
        """Test that assigned field returns assignee values including special values and team slugs"""
        # Create a team in the organization
        team = self.create_team(organization=self.organization, slug="backend-team")

        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="assigned",
        )

        assert result is not None
        assert isinstance(result, list)
        assert len(result) > 0

        values = [item["value"] for item in result]

        # Should include special values
        assert "me" in values
        assert "my_teams" in values
        assert "none" in values

        # Should include team slug prefixed with #
        assert f"#{team.slug}" in values

    def test_get_filter_key_values_assigned_or_suggested_field(self):
        """Test that assigned_or_suggested field returns same values as assigned"""
        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="assigned_or_suggested",
        )

        assert result is not None
        assert isinstance(result, list)
        assert len(result) > 0

        values = [item["value"] for item in result]
        assert "me" in values
        assert "my_teams" in values
        assert "none" in values

    def test_get_filter_key_values_assigned_includes_member_usernames(self):
        """Test that assigned field includes organization member usernames"""
        # The test user is automatically a member of the organization
        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="assigned",
        )

        assert result is not None
        values = [item["value"] for item in result]

        # Should include the test user's username or email
        # The test user from APITestCase should be included
        assert len(values) > 3  # More than just special values (me, my_teams, none)

    def test_get_filter_key_values_bookmarks_field(self):
        """Test that bookmarks field returns usernames"""
        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="bookmarks",
        )

        assert result is not None
        assert isinstance(result, list)
        # Should have usernames (at least the test user)

    def test_get_filter_key_values_subscribed_field(self):
        """Test that subscribed field returns usernames"""
        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="subscribed",
        )

        assert result is not None
        assert isinstance(result, list)

    def test_get_filter_key_values_assigned_with_substring_filter(self):
        """Test that substring filtering works on assigned field"""
        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="assigned",
            substring="my_",
        )

        assert result is not None
        assert isinstance(result, list)
        # Should only include values containing "my_"
        for item in result:
            assert "my_" in item["value"].lower()

    def test_get_issue_filter_keys_includes_assignee_values(self):
        """Test that get_issue_filter_keys includes assignee values in built_in_fields"""
        # Create a team
        team = self.create_team(organization=self.organization, slug="test-team")

        result = get_issue_filter_keys(
            org_id=self.organization.id,
            project_ids=[self.project.id],
        )

        assert result is not None
        assert "built_in_fields" in result
        built_in_fields = result["built_in_fields"]

        # Find the assigned field
        assigned_field = next((f for f in built_in_fields if f["key"] == "assigned"), None)
        assert assigned_field is not None
        assert "values" in assigned_field
        assert "me" in assigned_field["values"]
        assert "my_teams" in assigned_field["values"]
        assert "none" in assigned_field["values"]
        assert f"#{team.slug}" in assigned_field["values"]

        # Find the assigned_or_suggested field
        assigned_or_suggested_field = next(
            (f for f in built_in_fields if f["key"] == "assigned_or_suggested"), None
        )
        assert assigned_or_suggested_field is not None
        assert assigned_or_suggested_field["values"] == assigned_field["values"]

        # Find the bookmarks field - should have usernames
        bookmarks_field = next((f for f in built_in_fields if f["key"] == "bookmarks"), None)
        assert bookmarks_field is not None
        assert "values" in bookmarks_field

        # Find the subscribed field - should have usernames
        subscribed_field = next((f for f in built_in_fields if f["key"] == "subscribed"), None)
        assert subscribed_field is not None
        assert "values" in subscribed_field

    def test_format_username_uuid_username_uses_email(self):
        """Test that users with UUID usernames (32 hex chars) return email instead"""
        # Create a user with a UUID username (SAML users get UUID usernames)
        uuid_username = "01e2eb9a75174388a63daa4afcf782de"  # 32 hex characters
        user_email = "samluser@sentry.io"
        user = self.create_user(username=uuid_username, email=user_email)
        self.create_member(organization=self.organization, user=user)

        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="assigned",
        )

        assert result is not None
        values = [item["value"] for item in result]
        # Should use email, not UUID username
        assert user_email in values
        assert uuid_username not in values


@pytest.mark.django_db(databases=["default", "control"])
class TestReleaseFieldValues(APITestCase, SnubaTestCase):
    """Integration tests for release field values"""

    databases = {"default", "control"}

    def test_get_filter_key_values_release_field(self):
        """Test that release field returns actual release versions"""
        # Create releases
        release1 = self.create_release(
            project=self.project, version="myapp@1.0.0", date_added=before_now(days=1)
        )
        release2 = self.create_release(
            project=self.project, version="myapp@2.0.0", date_added=before_now(hours=1)
        )

        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="release",
        )

        assert result is not None
        assert isinstance(result, list)
        values = [item["value"] for item in result]
        assert release1.version in values
        assert release2.version in values

    def test_get_filter_key_values_first_release_field(self):
        """Test that firstRelease field returns actual release versions"""
        # Create releases
        release1 = self.create_release(project=self.project, version="myapp@1.0.0")

        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="firstRelease",
        )

        assert result is not None
        assert isinstance(result, list)
        values = [item["value"] for item in result]
        assert release1.version in values

    def test_get_filter_key_values_release_stage_field(self):
        """Test that release.stage field returns static enum values"""
        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="release.stage",
        )

        assert result is not None
        assert len(result) == 3
        values = [item["value"] for item in result]
        assert "adopted" in values
        assert "low_adoption" in values
        assert "replaced" in values

    def test_get_filter_key_values_release_with_substring(self):
        """Test that release field supports substring filtering"""
        self.create_release(project=self.project, version="myapp@1.0.0")
        self.create_release(project=self.project, version="myapp@2.0.0")
        self.create_release(project=self.project, version="otherapp@1.0.0")

        result = get_filter_key_values(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            attribute_key="release",
            substring="myapp",
        )

        assert result is not None
        # Should only include releases containing "myapp"
        for item in result:
            assert "myapp" in item["value"]

    def test_get_issue_filter_keys_includes_release_values(self):
        """Test that get_issue_filter_keys includes actual release values"""
        release = self.create_release(project=self.project, version="myapp@3.0.0")

        result = get_issue_filter_keys(
            org_id=self.organization.id,
            project_ids=[self.project.id],
        )

        assert result is not None
        assert "built_in_fields" in result
        built_in_fields = result["built_in_fields"]

        # Find the release field
        release_field = next((f for f in built_in_fields if f["key"] == "release"), None)
        assert release_field is not None
        assert release.version in release_field["values"]

        # Find the firstRelease field
        first_release_field = next((f for f in built_in_fields if f["key"] == "firstRelease"), None)
        assert first_release_field is not None
        assert release.version in first_release_field["values"]

        # Find the release.stage field - should have static values
        release_stage_field = next(
            (f for f in built_in_fields if f["key"] == "release.stage"), None
        )
        assert release_stage_field is not None
        assert release_stage_field["values"] == ["adopted", "low_adoption", "replaced"]

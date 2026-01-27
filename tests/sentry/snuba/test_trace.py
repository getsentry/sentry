from datetime import datetime
from unittest import mock

import pytest

from sentry.models.group import Group
from sentry.snuba.trace import _serialize_rpc_issue
from sentry.testutils.cases import TestCase


class SerializeRPCIssueTest(TestCase):
    def test_serialize_rpc_issue_with_missing_group_occurrence(self):
        """Test that _serialize_rpc_issue returns None when the group doesn't exist for an occurrence"""
        group_cache = {}
        event = {
            "event_type": "occurrence",
            "issue_data": {
                "issue_id": 999999999,  # Non-existent group ID
                "occurrence": mock.Mock(
                    event_id="test_event_id",
                    project_id=self.project.id,
                    issue_title="Test Issue",
                    level="error",
                    id="test_occurrence_id",
                ),
            },
            "span": {
                "project.slug": self.project.slug,
                "precise.start_ts": datetime.now(),
                "precise.finish_ts": datetime.now(),
                "transaction": "test_transaction",
            },
        }

        result = _serialize_rpc_issue(event, group_cache)
        assert result is None

    def test_serialize_rpc_issue_with_missing_group_error(self):
        """Test that _serialize_rpc_issue returns None when the group doesn't exist for an error"""
        group_cache = {}
        event = {
            "event_type": "error",
            "issue.id": 999999999,  # Non-existent group ID
            "id": "test_event_id",
            "project.id": self.project.id,
            "project.name": self.project.slug,
            "timestamp": "2024-01-01T00:00:00",
            "transaction": "test_transaction",
            "message": "Test error message",
            "tags[level]": "error",
        }

        result = _serialize_rpc_issue(event, group_cache)
        assert result is None

    def test_serialize_rpc_issue_with_existing_group_occurrence(self):
        """Test that _serialize_rpc_issue works correctly when the group exists for an occurrence"""
        group = self.create_group(project=self.project)
        group_cache = {}

        occurrence = mock.Mock(
            event_id="test_event_id",
            project_id=self.project.id,
            issue_title="Test Issue",
            level="error",
            id="test_occurrence_id",
        )

        event = {
            "event_type": "occurrence",
            "issue_data": {
                "issue_id": group.id,
                "occurrence": occurrence,
            },
            "span": {
                "project.slug": self.project.slug,
                "precise.start_ts": datetime.now(),
                "precise.finish_ts": datetime.now(),
                "transaction": "test_transaction",
            },
        }

        result = _serialize_rpc_issue(event, group_cache)
        assert result is not None
        assert result["issue_id"] == group.id
        assert result["event_id"] == "test_event_id"
        assert result["event_type"] == "occurrence"
        # Verify group is cached
        assert group.id in group_cache
        assert group_cache[group.id] == group

    def test_serialize_rpc_issue_uses_cache(self):
        """Test that _serialize_rpc_issue uses the group cache to avoid repeated queries"""
        group = self.create_group(project=self.project)
        group_cache = {group.id: group}

        occurrence = mock.Mock(
            event_id="test_event_id",
            project_id=self.project.id,
            issue_title="Test Issue",
            level="error",
            id="test_occurrence_id",
        )

        event = {
            "event_type": "occurrence",
            "issue_data": {
                "issue_id": group.id,
                "occurrence": occurrence,
            },
            "span": {
                "project.slug": self.project.slug,
                "precise.start_ts": datetime.now(),
                "precise.finish_ts": datetime.now(),
                "transaction": "test_transaction",
            },
        }

        # Mock Group.objects.get to ensure it's not called (since we're using cache)
        with mock.patch.object(Group.objects, "get") as mock_get:
            result = _serialize_rpc_issue(event, group_cache)
            mock_get.assert_not_called()

        assert result is not None
        assert result["issue_id"] == group.id

from unittest.mock import patch

import pytest

from sentry.seer.fetch_issues.utils import (
    RepoProjects,
    as_issue_details,
    bulk_serialize_for_seer,
    get_latest_issue_event,
    get_repo_and_projects,
    handle_fetch_issues_exceptions,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data


class TestGetRepoAndProjects(TestCase):
    def test_get_repo_and_projects_success(self):
        repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )
        self.create_code_mapping(project=self.project, repo=repo)

        result = get_repo_and_projects(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123",
        )

        assert isinstance(result, RepoProjects)
        assert result.organization_id == self.organization.id
        assert result.provider == "integrations:github"
        assert result.external_id == "123"
        assert result.repo == repo
        assert len(result.repo_configs) == 1
        assert len(result.projects) == 1
        assert result.projects[0] == self.project

    def test_get_repo_and_projects_multiple_projects(self):
        repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )
        project2 = self.create_project(organization=self.organization)

        self.create_code_mapping(project=self.project, repo=repo)
        self.create_code_mapping(project=project2, repo=repo)

        result = get_repo_and_projects(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id="123",
        )

        assert len(result.repo_configs) == 2
        assert len(result.projects) == 2
        project_ids = {proj.id for proj in result.projects}
        assert project_ids == {self.project.id, project2.id}

    def test_get_repo_and_projects_no_configs(self):
        self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )

        with pytest.raises(ValueError, match="No Sentry projects found for repo"):
            get_repo_and_projects(
                organization_id=self.organization.id,
                provider="integrations:github",
                external_id="123",
            )

    def test_get_repo_and_projects_repo_not_found(self):
        from sentry.models.repository import Repository

        with pytest.raises(Repository.DoesNotExist):
            get_repo_and_projects(
                organization_id=self.organization.id,
                provider="integrations:github",
                external_id="nonexistent",
            )


class TestAsIssueDetails(TestCase):
    def test_as_issue_details_success(self):
        data = load_data("python", timestamp=before_now(minutes=1))
        event = self.store_event(data=data, project_id=self.project.id)
        group = event.group

        result = as_issue_details(group)

        assert result is not None
        assert group is not None
        assert result.id == group.id
        assert result.title == group.title
        assert result.culprit == group.culprit
        assert result.transaction is None
        assert result.events == []

    def test_as_issue_details_with_none_group(self):
        result = as_issue_details(None)
        assert result is None

    def test_as_issue_details_serialization_fails(self):
        data = load_data("python", timestamp=before_now(minutes=1))
        event = self.store_event(data=data, project_id=self.project.id)
        group = event.group

        with patch("sentry.seer.fetch_issues.utils.serialize", return_value=None):
            result = as_issue_details(group)
            assert result is None

    def test_as_issue_details_includes_message(self):
        data = load_data("python", timestamp=before_now(minutes=1))
        event = self.store_event(data=data, project_id=self.project.id)
        group = event.group

        result = as_issue_details(group)

        assert result is not None
        # The message field is added to the serialized group data
        # We can't easily test the exact value without knowing the serializer internals


class TestBulkSerializeForSeer(TestCase):
    def test_bulk_serialize_for_seer_success(self):
        data = load_data("python", timestamp=before_now(minutes=1))
        event1 = self.store_event(data=data, project_id=self.project.id)
        event2 = self.store_event(data=data, project_id=self.project.id)

        groups = [event1.group, event2.group]
        # Filter out None groups for type checking
        non_null_groups = [group for group in groups if group is not None]
        result = bulk_serialize_for_seer(non_null_groups)

        assert len(result["issues"]) == 2
        assert len(result["issues_full"]) == 2
        assert all(isinstance(item, dict) for item in result["issues_full"])

        # Check that each dict has the expected IssueDetails fields with correct values
        for item, group in zip(result["issues_full"], non_null_groups):
            assert item["id"] == str(group.id)  # IDs are converted to strings
            assert item["title"] == group.title
            assert item["culprit"] == group.culprit
            assert item["transaction"] is None
            assert item["events"] == []

    def test_bulk_serialize_for_seer_with_none_groups(self):
        data = load_data("python", timestamp=before_now(minutes=1))
        event = self.store_event(data=data, project_id=self.project.id)

        groups = [event.group, None, event.group]
        # Filter out None groups for type checking
        non_null_groups = [group for group in groups if group is not None]
        result = bulk_serialize_for_seer(non_null_groups)

        assert len(result["issues"]) == 2
        assert len(result["issues_full"]) == 2
        assert all(item is not None for item in result["issues_full"])

        # Check that the non-None items have the correct values
        assert event.group is not None
        for group_serialized in result["issues_full"]:
            assert group_serialized["id"] == str(event.group.id)  # IDs are converted to strings
            assert group_serialized["title"] == event.group.title
            assert group_serialized["culprit"] == event.group.culprit
            assert group_serialized["transaction"] is None
            assert group_serialized["events"] == []

    def test_bulk_serialize_for_seer_serialization_fails(self):
        data = load_data("python", timestamp=before_now(minutes=1))
        event = self.store_event(data=data, project_id=self.project.id)

        groups = [event.group]
        # Filter out None groups for type checking
        non_null_groups = [group for group in groups if group is not None]

        with patch("sentry.seer.fetch_issues.utils.as_issue_details", return_value=None):
            result = bulk_serialize_for_seer(non_null_groups)
            assert result == {"issues": [], "issues_full": []}


class TestGetLatestIssueEvent(TestCase):
    def test_get_latest_issue_event_success(self):
        data = load_data("python", timestamp=before_now(minutes=1))
        event = self.store_event(data=data, project_id=self.project.id)
        group = event.group

        assert group is not None
        result = get_latest_issue_event(group.id, self.organization.id)

        assert result is not None
        assert isinstance(result, dict)
        assert result["id"] == group.id
        assert result["title"] == group.title
        assert len(result["events"]) == 1
        assert result["events"][0]["id"] == event.event_id

    def test_get_latest_issue_event_not_found(self):
        nonexistent_group_id = 999999
        result = get_latest_issue_event(nonexistent_group_id, self.organization.id)
        assert result == {}

    def test_get_latest_issue_event_with_short_id(self):
        data = load_data("python", timestamp=before_now(minutes=1))
        event = self.store_event(data=data, project_id=self.project.id)
        group = event.group

        assert group is not None
        result = get_latest_issue_event(group.qualified_short_id, self.organization.id)

        assert result is not None
        assert isinstance(result, dict)
        assert result["id"] == group.id
        assert result["title"] == group.title
        assert len(result["events"]) == 1
        assert result["events"][0]["id"] == event.event_id

    def test_get_latest_issue_event_with_short_id_not_found(self):
        result = get_latest_issue_event("INVALID-SHORT-ID", self.organization.id)
        assert result == {}

    def test_get_latest_issue_event_no_events(self):
        # Create a group but don't store any events for it
        group = self.create_group(project=self.project)
        result = get_latest_issue_event(group.id, self.organization.id)
        assert result == {}

    def test_get_latest_issue_event_wrong_organization(self):
        event = self.store_event(data={}, project_id=self.project.id)
        group = event.group
        assert group is not None
        results = get_latest_issue_event(group.id, self.organization.id + 1)
        assert results == {}


class TestHandleFetchIssuesExceptions(TestCase):
    def test_handle_fetch_issues_exceptions_success(self):
        @handle_fetch_issues_exceptions
        def test_function():
            return {"success": True}

        result = test_function()
        assert result == {"success": True}

    def test_handle_fetch_issues_exceptions_handles_exception(self):
        @handle_fetch_issues_exceptions
        def test_function():
            raise ValueError("test error")

        result = test_function()
        assert result == {"error": "test error"}

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from sentry.integrations.github.integration import GitHubIntegrationProvider
from sentry.models.group import Group
from sentry.models.repository import Repository
from sentry.seer.fetch_issues.by_function_name import (
    NUM_DAYS_AGO,
    STACKFRAME_COUNT,
    _fetch_issues_from_repo_projects,
    _get_issues_for_file,
    _get_projects_and_filenames_from_source_file,
    _left_truncated_paths,
    fetch_issues,
)
from sentry.seer.fetch_issues.utils import RepoProjects, get_repo_and_projects
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.helpers.datetime import before_now
from tests.sentry.seer.fetch_issues.test_by_text_query import CreateEventTestCase


class TestLeftTruncatedPaths(CreateEventTestCase):
    def test_simple_filename(self):
        assert _left_truncated_paths("foo.py") == []

    def test_single_directory(self):
        assert _left_truncated_paths("path/foo.py") == ["foo.py"]

    def test_multiple_directories(self):
        assert _left_truncated_paths("path/to/foo.py") == ["to/foo.py", "foo.py"]

    def test_max_num_paths_limit(self):
        assert _left_truncated_paths("path/to/foo/bar.py", max_num_paths=2) == [
            "to/foo/bar.py",
            "foo/bar.py",
        ]

    def test_max_num_paths_larger_than_available(self):
        assert _left_truncated_paths("path/to/foo/bar.py", max_num_paths=5) == [
            "to/foo/bar.py",
            "foo/bar.py",
            "bar.py",
        ]


class TestGetProjectsAndFilenamesFromSourceFile(IntegrationTestCase, CreateEventTestCase):
    provider = GitHubIntegrationProvider

    def setUp(self):
        super().setUp()
        self.gh_repo: Repository = self.create_repo(
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=self.integration.id,
            project=self.project,
            url="https://github.com/getsentry/sentry",
            external_id="123456",
        )
        self.code_mapping = self.create_code_mapping(
            project=self.project,
            repo=self.gh_repo,
            source_root="src/",
            stack_root="sentry/",
        )

    def test_file_with_matching_code_mapping(self):
        projects, filenames = _get_projects_and_filenames_from_source_file(
            self.organization.id, self.gh_repo.id, "src/sentry/models/user.py"
        )
        assert projects == {self.project}
        assert "sentry/models/user.py" in filenames
        assert "src/sentry/models/user.py" in filenames
        assert "models/user.py" in filenames

    def test_file_without_matching_code_mapping(self):
        _, filenames = _get_projects_and_filenames_from_source_file(
            self.organization.id, self.gh_repo.id, "other/path/file.py"
        )
        # Should still add the filename and truncated paths
        assert "other/path/file.py" in filenames
        assert "path/file.py" in filenames
        assert "file.py" in filenames


class TestGetIssuesForFile(CreateEventTestCase):
    def setUp(self):
        super().setUp()
        self.event_timestamp_start = datetime.now(UTC) - timedelta(days=NUM_DAYS_AGO)
        self.event_timestamp_end = datetime.now(UTC)

    def test_empty_projects_list(self):
        result = _get_issues_for_file(
            projects=[],
            sentry_filenames=["foo.py"],
            function_names=["test_func"],
            event_timestamp_start=self.event_timestamp_start,
            event_timestamp_end=self.event_timestamp_end,
        )
        assert result == []

    @patch("sentry.seer.fetch_issues.by_function_name.raw_snql_query")
    def test_snuba_query_exception(self, mock_query):
        mock_query.side_effect = Exception("Snuba error")

        result = _get_issues_for_file(
            projects=[self.project],
            sentry_filenames=["foo.py"],
            function_names=["test_func"],
            event_timestamp_start=self.event_timestamp_start,
            event_timestamp_end=self.event_timestamp_end,
        )
        assert result == []

    def test_basic_matching(self):
        # Create events that should match our search criteria
        group = self._create_event(
            function_names=["target_func", "other_func"],
            filenames=["test.py", "other.py"],
            user_id="1",
        ).group

        result = _get_issues_for_file(
            projects=[self.project],
            sentry_filenames=["test.py"],
            function_names=["target_func"],
            event_timestamp_start=self.event_timestamp_start,
            event_timestamp_end=self.event_timestamp_end,
        )

        # Should find the matching issue
        assert len(result) > 0
        group_ids = [issue["group_id"] for issue in result]
        assert group.id in group_ids

    def test_filename_mismatch(self):
        # Create event with different filename
        group = self._create_event(
            function_names=["target_func"],
            filenames=["other.py"],
            user_id="1",
        ).group

        result = _get_issues_for_file(
            projects=[self.project],
            sentry_filenames=["test.py"],  # Different filename
            function_names=["target_func"],
            event_timestamp_start=self.event_timestamp_start,
            event_timestamp_end=self.event_timestamp_end,
        )

        # Should not find the issue due to filename mismatch
        group_ids = [issue["group_id"] for issue in result]
        assert group.id not in group_ids

    def test_function_name_mismatch(self):
        # Create event with different function name
        group = self._create_event(
            function_names=["other_func"],
            filenames=["test.py"],
            user_id="1",
        ).group

        result = _get_issues_for_file(
            projects=[self.project],
            sentry_filenames=["test.py"],
            function_names=["target_func"],  # Different function name
            event_timestamp_start=self.event_timestamp_start,
            event_timestamp_end=self.event_timestamp_end,
        )

        # Should not find the issue due to function name mismatch
        group_ids = [issue["group_id"] for issue in result]
        assert group.id not in group_ids

    def test_event_too_old(self):
        # Create old event - use a smaller offset to avoid timestamp validation errors
        group = self._create_event(
            function_names=["target_func"],
            filenames=["test.py"],
            timestamp=before_now(days=NUM_DAYS_AGO + 1).isoformat(),
            user_id="1",
        ).group

        result = _get_issues_for_file(
            projects=[self.project],
            sentry_filenames=["test.py"],
            function_names=["target_func"],
            event_timestamp_start=self.event_timestamp_start,
            event_timestamp_end=self.event_timestamp_end,
        )

        # Should not find the old event
        group_ids = [issue["group_id"] for issue in result]
        assert group.id not in group_ids

    def test_javascript_simple(self):
        # Test with JavaScript files to ensure language-agnostic functionality
        group = self._create_event(
            function_names=["component.blue", "world"],
            filenames=["foo.js", "baz.js"],
            user_id="1",
        ).group

        result = _get_issues_for_file(
            projects=[self.project],
            sentry_filenames=["baz.js"],
            function_names=["world"],
            event_timestamp_start=self.event_timestamp_start,
            event_timestamp_end=self.event_timestamp_end,
        )

        # Should find the matching JS issue
        assert len(result) > 0
        group_ids = [issue["group_id"] for issue in result]
        assert group.id in group_ids

    def test_stackframe_limit_edge_case(self):
        # Create event with function name within the searchable stackframe range
        # The query searches the last STACKFRAME_COUNT frames (negative indices)
        # So put our target function in the last frame (which will be index -1)
        function_names = ["other_func" for _ in range(STACKFRAME_COUNT - 1)] + ["world"]
        filenames = ["other.py" for _ in range(STACKFRAME_COUNT - 1)] + ["test.py"]

        group = self._create_event(
            function_names=function_names,
            filenames=filenames,
            user_id="1",
        ).group

        result = _get_issues_for_file(
            projects=[self.project],
            sentry_filenames=["test.py"],
            function_names=["world"],  # Should find this in last frame
            event_timestamp_start=self.event_timestamp_start,
            event_timestamp_end=self.event_timestamp_end,
        )

        # Should find the issue if the function is within stackframe limit
        group_ids = [issue["group_id"] for issue in result]
        assert group.id in group_ids

    def test_multiple_matching_issues(self):
        # Create multiple events that should match
        group1 = self._create_event(
            function_names=["target_func"], filenames=["test.py"], user_id="1", culprit="issue1"
        ).group

        group2 = self._create_event(
            function_names=["target_func"], filenames=["test.py"], user_id="2", culprit="issue2"
        ).group

        result = _get_issues_for_file(
            projects=[self.project],
            sentry_filenames=["test.py"],
            function_names=["target_func"],
            event_timestamp_start=self.event_timestamp_start,
            event_timestamp_end=self.event_timestamp_end,
        )

        # Should find both matching issues
        group_ids = [issue["group_id"] for issue in result]
        assert group1.id in group_ids
        assert group2.id in group_ids


class TestFetchIssues(IntegrationTestCase, CreateEventTestCase):
    provider = GitHubIntegrationProvider

    def setUp(self):
        super().setUp()
        self.gh_repo: Repository = self.create_repo(
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=self.integration.id,
            project=self.project,
            url="https://github.com/getsentry/sentry",
            external_id="123456",
        )
        self.code_mapping = self.create_code_mapping(
            project=self.project,
            repo=self.gh_repo,
        )

    def test_successful_fetch(self):
        # Create some test events
        group = self._create_event(
            filenames=["test.py", "other.py"],
            function_names=["target_function", "other_func"],
            user_id="1",
        ).group

        with patch(
            "sentry.seer.fetch_issues.by_function_name._fetch_issues_from_repo_projects"
        ) as mock_fetch:
            mock_fetch.return_value = [group]

            with patch("sentry.seer.fetch_issues.utils.bulk_serialize_for_seer") as mock_serialize:
                mock_serialize.return_value = {
                    "issues": [group.id],
                    "issues_full": [{"id": str(group.id), "title": "Test Issue"}],
                }

                assert self.gh_repo.external_id is not None
                seer_response = fetch_issues(
                    organization_id=self.organization.id,
                    provider="integrations:github",
                    external_id=self.gh_repo.external_id,
                    filename="test.py",
                    function_name="target_function",
                )

                assert seer_response == {
                    "issues": [group.id],
                    "issues_full": [{"id": str(group.id), "title": "Test Issue"}],
                }
                mock_fetch.assert_called_once()
                mock_serialize.assert_called_once_with([group])

    def test_custom_max_num_issues(self):
        group = self._create_event(
            filenames=["test.py"],
            function_names=["target_function"],
        ).group

        with patch(
            "sentry.seer.fetch_issues.by_function_name._fetch_issues_from_repo_projects"
        ) as mock_fetch:
            mock_fetch.return_value = [group]

            with patch("sentry.seer.fetch_issues.utils.bulk_serialize_for_seer") as mock_serialize:
                mock_serialize.return_value = {
                    "issues": [group.id],
                    "issues_full": [{"id": str(group.id)}],
                }

                assert self.gh_repo.external_id is not None
                fetch_issues(
                    organization_id=self.organization.id,
                    provider="integrations:github",
                    external_id=self.gh_repo.external_id,
                    filename="test.py",
                    function_name="target_function",
                    max_num_issues_per_file=10,
                )

                # Verify the custom limit was passed through
                mock_fetch.assert_called_once()
                call_args = mock_fetch.call_args
                assert call_args[1]["max_num_issues_per_file"] == 10

    def test_with_run_id(self):
        group = self._create_event().group

        with patch(
            "sentry.seer.fetch_issues.by_function_name._fetch_issues_from_repo_projects"
        ) as mock_fetch:
            mock_fetch.return_value = [group]

            with patch("sentry.seer.fetch_issues.utils.bulk_serialize_for_seer") as mock_serialize:
                mock_serialize.return_value = {
                    "issues": [group.id],
                    "issues_full": [{"id": str(group.id)}],
                }

                assert self.gh_repo.external_id is not None
                fetch_issues(
                    organization_id=self.organization.id,
                    provider="integrations:github",
                    external_id=self.gh_repo.external_id,
                    filename="test.py",
                    function_name="target_function",
                    run_id=12345,
                )

                # Verify run_id was passed through
                call_args = mock_fetch.call_args
                assert call_args[1]["run_id"] == 12345

    def test_fetch_issues_end_to_end_with_metadata_and_message(self):
        """Test end-to-end fetch_issues call to verify metadata and message fields are present."""
        # Create an event with specific data that will show up in metadata
        event = self._create_event(
            filenames=["test.py", "other.py"],
            function_names=["target_function", "other_func"],
            user_id="1",
        )
        group = event.group
        assert group is not None

        # Call fetch_issues end-to-end without mocking bulk_serialize_for_seer
        assert self.gh_repo.external_id is not None
        seer_response = fetch_issues(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id=self.gh_repo.external_id,
            filename="test.py",
            function_name="target_function",
        )

        # Basic structure checks
        assert "error" not in seer_response
        assert "issues" in seer_response
        assert "issues_full" in seer_response
        assert len(seer_response["issues"]) > 0
        assert len(seer_response["issues_full"]) > 0

        # Check the first issue's metadata and message
        first_issue = seer_response["issues_full"][0]
        assert "metadata" in first_issue
        assert "message" in first_issue
        # Message should be present (don't check exact content since it's auto-generated)

        # Verify the metadata is non-empty and has expected content
        metadata = first_issue["metadata"]
        assert isinstance(metadata, dict)
        assert len(metadata) > 0, "metadata should not be empty"

        message = first_issue["message"]
        assert isinstance(message, str)
        assert len(message) > 0, "message should not be empty"

        # Check that the group ID matches
        assert first_issue["id"] == str(group.id)


class TestFetchIssuesFromRepoProjects(IntegrationTestCase, CreateEventTestCase):
    provider = GitHubIntegrationProvider

    def setUp(self):
        super().setUp()
        self.gh_repo: Repository = self.create_repo(
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=self.integration.id,
            project=self.project,
            url="https://github.com/getsentry/sentry",
            external_id="123456",
        )
        self.code_mapping = self.create_code_mapping(
            project=self.project,
            repo=self.gh_repo,
        )

    @patch("sentry.seer.fetch_issues.by_function_name._get_projects_and_filenames_from_source_file")
    @patch("sentry.seer.fetch_issues.by_function_name._get_issues_for_file")
    def test_no_projects_found_fallback(self, mock_get_issues, mock_get_projects):

        # Mock no projects found initially
        mock_get_projects.return_value = (set(), {"test.py"})
        mock_get_issues.return_value = []

        assert self.gh_repo.external_id is not None
        repo_projects = RepoProjects(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id=self.gh_repo.external_id,
            repo=self.gh_repo,
            repo_configs=[],
            projects=[self.project],
        )

        _fetch_issues_from_repo_projects(
            repo_projects=repo_projects,
            filename="test.py",
            function_name="target_function",
        )

        # Should fall back to using all repo projects
        mock_get_issues.assert_called_once()
        call_args = mock_get_issues.call_args[0]
        assert self.project in call_args[0]  # Should use fallback projects

    @patch("sentry.seer.fetch_issues.by_function_name._get_projects_and_filenames_from_source_file")
    @patch("sentry.seer.fetch_issues.by_function_name._get_issues_for_file")
    def test_projects_found_no_fallback(self, mock_get_issues, mock_get_projects):

        # Mock projects found
        mock_get_projects.return_value = ({self.project}, {"test.py"})
        mock_get_issues.return_value = []

        assert self.gh_repo.external_id is not None
        repo_projects = RepoProjects(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id=self.gh_repo.external_id,
            repo=self.gh_repo,
            repo_configs=[],
            projects=[self.project],
        )

        _fetch_issues_from_repo_projects(
            repo_projects=repo_projects,
            filename="test.py",
            function_name="target_function",
        )

        # Should use the found projects, not fallback
        mock_get_issues.assert_called_once()
        call_args = mock_get_issues.call_args[0]
        assert call_args[0] == [self.project]

    def test_fetch_issues_from_repo_projects_returns_groups(self):
        """Test that _fetch_issues_from_repo_projects returns a list of Group objects."""
        # Create a group that should match
        event = self._create_event(
            filenames=["test.py", "other.py"],
            function_names=["target_function", "other_func"],
            user_id="1",
        )
        expected_group = event.group

        # Get repo projects
        assert self.gh_repo.external_id is not None
        repo_projects = get_repo_and_projects(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id=self.gh_repo.external_id,
        )

        # Test the internal function directly with real search behavior
        # Based on existing tests, we know _get_issues_for_file works in test environment
        results = _fetch_issues_from_repo_projects(
            repo_projects=repo_projects, filename="test.py", function_name="target_function"
        )

        # Verify it returns a list of Group objects
        assert isinstance(results, list)
        assert len(results) > 0, "Expected to find at least one matching group"
        for result in results:
            assert isinstance(result, Group)

        assert expected_group.id in [result.id for result in results]

    def test_fetch_issues_from_repo_projects_empty_result(self):
        """Test that _fetch_issues_from_repo_projects returns empty list when no matches."""
        # Get repo projects but don't create any matching events
        assert self.gh_repo.external_id is not None
        repo_projects = get_repo_and_projects(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id=self.gh_repo.external_id,
        )

        # Test the internal function with non-matching criteria
        results = _fetch_issues_from_repo_projects(
            repo_projects=repo_projects,
            filename="nonexistent.py",
            function_name="nonexistent_function",
        )

        # Verify it returns an empty list
        assert isinstance(results, list)
        assert len(results) == 0

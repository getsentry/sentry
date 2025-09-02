from sentry.integrations.github.integration import GitHubIntegrationProvider
from sentry.models.group import Group
from sentry.models.repository import Repository
from sentry.seer.fetch_issues.by_text_query import _fetch_issues_from_repo_projects, fetch_issues
from sentry.seer.fetch_issues.utils import get_repo_and_projects
from sentry.testutils.cases import IntegrationTestCase
from tests.sentry.integrations.github.tasks.test_open_pr_comment import CreateEventTestCase


class TestFetchIssuesByTextQuery(IntegrationTestCase, CreateEventTestCase):
    provider = GitHubIntegrationProvider

    def setUp(self):
        super().setUp()
        self.gh_repo: Repository = self.create_repo(
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=self.integration.id,
            project=self.project,
            url="https://github.com/getsentry/sentry",
        )
        self.code_mapping = self.create_code_mapping(
            project=self.project,
            repo=self.gh_repo,
        )

    def test_fetch_issues_message_substring_search(self):
        """Test that text queries do case-insensitive substring search in issue messages."""
        group = self._create_event(
            filenames=["auth.py", "utils.py"],
            function_names=["authenticate", "validate"],
            culprit="Authentication failed",
            user_id="1",
        ).group

        # Test queries that should match content in the message
        # Message will be something like: "hello! Error auth.py authenticate Authentication failed"

        # Test 1: Should find with substring from event message
        result = fetch_issues(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id=self.gh_repo.external_id,
            query="hello",
        )
        assert len(result) > 0, "Should find issue with 'hello' substring"
        assert group.id in [r["id"] for r in result if r]

        # Test 2: Should find with substring from filename in message
        result = fetch_issues(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id=self.gh_repo.external_id,
            query="auth",
        )
        assert len(result) > 0, "Should find issue with 'auth' substring"
        assert group.id in [r["id"] for r in result if r]

    def test_fetch_issues_no_match(self):
        """Test that non-matching queries return empty results."""
        self._create_event(
            filenames=["models/user.py"],
            function_names=["validate_user"],
            culprit="Authentication error",
            user_id="1",
        )

        # Query for something that shouldn't match anything in the message
        result = fetch_issues(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id=self.gh_repo.external_id,
            query="nonexistent_keyword_xyz123",
        )

        # Should return empty results
        matching_results = [r for r in result if r is not None]
        assert len(matching_results) == 0

    def test_fetch_issues_culprit_search(self):
        """Test that queries match content in the culprit field."""
        group = self._create_event(
            filenames=["test.py"],
            function_names=["test_func"],
            culprit="Database connection timeout",
            user_id="1",
        ).group

        # Query for a keyword from the culprit
        result = fetch_issues(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id=self.gh_repo.external_id,
            query="database conn",
        )

        assert len(result) > 0
        assert group.id in [r["id"] for r in result if r]

    def test_fetch_issues_limit_parameter(self):
        """Test that the limit parameter is respected."""
        # Create multiple matching events
        for i in range(5):
            self._create_event(
                filenames=["common.py"],
                function_names=[f"func_{i}"],
                culprit=f"Error {i}",
                user_id=str(i),
            )

        limit = 2
        result = fetch_issues(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id=self.gh_repo.external_id,
            query="common.py",
            limit=limit,
        )

        non_null_results = [r for r in result if r is not None]
        assert len(non_null_results) == limit

    def test_fetch_issues_from_repo_projects_returns_groups(self):
        """Test that _fetch_issues_from_repo_projects returns a list of Group objects."""
        # Create a group that should match the search query
        event = self._create_event(
            filenames=["auth.py", "utils.py"],
            function_names=["authenticate", "validate"],
            culprit="Authentication failed",
            user_id="1",
        )
        expected_group = event.group

        # Get repo projects
        repo_projects = get_repo_and_projects(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id=self.gh_repo.external_id,
        )

        # Test the internal function directly with a query that should match the created event
        # Use "hello" which appears in the event message (from other tests we know this works)
        results = _fetch_issues_from_repo_projects(repo_projects=repo_projects, query="hello")

        assert isinstance(results, list)
        assert len(results) > 0, "Expected to find at least one matching group"
        for result in results:
            assert isinstance(result, Group)

        # Verify our expected group is in the results
        result_ids = [result.id for result in results]
        assert expected_group.id in result_ids

    def test_fetch_issues_from_repo_projects_empty_result(self):
        """Test that _fetch_issues_from_repo_projects returns empty list when no matches."""
        # Get repo projects but don't create any matching events
        repo_projects = get_repo_and_projects(
            organization_id=self.organization.id,
            provider="integrations:github",
            external_id=self.gh_repo.external_id,
        )

        # Test the internal function with a query that won't match anything
        results = _fetch_issues_from_repo_projects(
            repo_projects=repo_projects, query="nonexistent_search_term_xyz123"
        )

        # Verify it returns an empty list
        assert isinstance(results, list)
        assert len(results) == 0

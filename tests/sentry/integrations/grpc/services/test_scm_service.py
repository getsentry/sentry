from unittest.mock import Mock

import grpc

from sentry.integrations.grpc.generated import scm_pb2
from sentry.integrations.grpc.services.scm_service import ScmServicer
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase


class TestScmService(TestCase):
    def setUp(self):
        super().setUp()
        self.servicer = ScmServicer()
        self.context = Mock()
        # Setup the mock context to bypass authentication
        self.context.invocation_metadata.return_value = []
        # Mock _check_auth to always return True for tests
        self.servicer._check_auth = Mock(return_value=True)

    def test_list_repositories(self):
        """Test listing repositories with real database objects."""
        # Create real test data
        org = self.create_organization()
        project = self.create_project(organization=org)
        self.create_repo(project=project, name="test-repo-1", provider="github", external_id="123")
        self.create_repo(project=project, name="test-repo-2", provider="gitlab", external_id="456")

        # Verify repos were created
        assert Repository.objects.filter(organization_id=org.id).count() == 2

        request = scm_pb2.ListRepositoriesRequest(organization_id=org.id)

        # Call the service - no mocking needed
        response = self.servicer.ListRepositories(request, self.context)

        # Verify response
        assert len(response.repositories) == 2
        repo_names = [r.name for r in response.repositories]
        assert "test-repo-1" in repo_names
        assert "test-repo-2" in repo_names

        # Verify provider mapping
        github_repo = next(r for r in response.repositories if r.name == "test-repo-1")
        assert github_repo.provider == scm_pb2.PROVIDER_GITHUB

    def test_list_repositories_with_provider_filter(self):
        """Test filtering repositories by provider."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        self.create_repo(project=project, name="github-repo", provider="github")
        self.create_repo(project=project, name="gitlab-repo", provider="gitlab")

        # Request only GitHub repos
        request = scm_pb2.ListRepositoriesRequest(
            organization_id=org.id, provider=scm_pb2.PROVIDER_GITHUB
        )

        response = self.servicer.ListRepositories(request, self.context)

        assert len(response.repositories) == 1
        assert response.repositories[0].name == "github-repo"

    def test_get_repository(self):
        """Test getting a single repository."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        repo = self.create_repo(
            project=project, name="test-repo", provider="github", url="https://github.com/test/repo"
        )

        request = scm_pb2.GetRepositoryRequest(repository_id=repo.id)

        response = self.servicer.GetRepository(request, self.context)

        assert response.id == repo.id
        assert response.name == "test-repo"
        assert response.url == "https://github.com/test/repo"
        assert response.provider == scm_pb2.PROVIDER_GITHUB

    def test_get_repository_not_found(self):
        """Test getting non-existent repository."""
        request = scm_pb2.GetRepositoryRequest(repository_id=99999)

        self.servicer.GetRepository(request, self.context)

        self.context.set_code.assert_called_with(grpc.StatusCode.NOT_FOUND)
        self.context.set_details.assert_called()

    def test_get_commit(self):
        """Test getting commit details."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        repo = self.create_repo(project=project)
        author = self.create_commit_author(name="Test Author", email="test@example.com")
        self.create_commit(
            repository=repo, key="abc123def456", message="Fix important bug", author=author
        )

        request = scm_pb2.GetCommitRequest(repository_id=repo.id, commit_sha="abc123def456")

        response = self.servicer.GetCommit(request, self.context)

        assert response.key == "abc123def456"
        assert response.message == "Fix important bug"
        assert response.author.name == "Test Author"
        assert response.author.email == "test@example.com"

    def test_create_code_mapping(self):
        """Test creating a code mapping."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        repo = self.create_repo(project=project)

        request = scm_pb2.CreateCodeMappingRequest(
            organization_id=org.id,
            project_id=project.id,
            repository_id=repo.id,
            stack_root="/app",
            source_root="/src",
            default_branch="main",
        )

        response = self.servicer.CreateCodeMapping(request, self.context)

        assert response.organization_id == org.id
        assert response.project_id == project.id
        assert response.repository_id == repo.id
        assert response.stack_root == "/app"
        assert response.source_root == "/src"
        assert response.default_branch == "main"

        # Verify it was actually created in the database
        from sentry.models.integrations.repository_project_path_config import (
            RepositoryProjectPathConfig,
        )

        mapping = RepositoryProjectPathConfig.objects.get(id=response.id)
        assert mapping.stack_root == "/app"
        assert mapping.source_root == "/src"

    def test_derive_code_mappings(self):
        """Test deriving code mappings from stacktrace paths."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        repo = self.create_repo(project=project)

        # Create a code mapping
        from sentry.models.integrations.repository_project_path_config import (
            RepositoryProjectPathConfig,
        )

        mapping = RepositoryProjectPathConfig.objects.create(
            organization_id=org.id,
            project_id=project.id,
            repository_id=repo.id,
            stack_root="/app",
            source_root="/src",
            default_branch="main",
        )

        request = scm_pb2.DeriveCodeMappingsRequest(
            organization_id=org.id,
            project_id=project.id,
            stacktrace_paths=[
                "/app/components/Button.jsx",
                "/app/utils/helper.js",
                "/other/path/file.py",  # Won't match
            ],
        )

        response = self.servicer.DeriveCodeMappings(request, self.context)

        # Should find the mapping for the /app paths
        assert len(response.mappings) == 1
        assert response.mappings[0].id == mapping.id
        assert response.mappings[0].stack_root == "/app"

    def test_create_external_issue(self):
        """Test creating an external issue."""
        org = self.create_organization()
        integration = self.create_integration(organization=org, provider="github")

        request = scm_pb2.CreateExternalIssueRequest(
            organization_id=org.id,
            integration_id=integration.id,
            title="Test Issue",
            description="This is a test issue",
            metadata={"priority": "high"},
        )

        response = self.servicer.CreateExternalIssue(request, self.context)

        assert response.organization_id == org.id
        assert response.integration_id == integration.id
        assert response.title == "Test Issue"
        assert response.description == "This is a test issue"
        assert "ISSUE-" in response.key
        assert response.metadata["priority"] == "high"

    def test_link_external_issue(self):
        """Test linking an external issue to a group."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        group = self.create_group(project=project)
        integration = self.create_integration(organization=org, provider="github")

        # Create an external issue
        from sentry.integrations.models.external_issue import ExternalIssue

        external_issue = ExternalIssue.objects.create(
            organization_id=org.id,
            integration_id=integration.id,
            key="GH-123",
            title="GitHub Issue",
            description="Test issue",
        )

        request = scm_pb2.LinkExternalIssueRequest(
            group_id=group.id, external_issue_id=external_issue.id
        )

        response = self.servicer.LinkExternalIssue(request, self.context)

        assert response.id == external_issue.id
        assert response.key == "GH-123"

        # Verify the link was created
        from sentry.models.grouplink import GroupLink

        link = GroupLink.objects.get(group_id=group.id, linked_id=external_issue.id)
        assert link.linked_type == GroupLink.LinkedType.issue

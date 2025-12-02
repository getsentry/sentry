from unittest.mock import Mock, patch

from sentry.integrations.grpc.generated import scm_pb2
from sentry.integrations.grpc.services.scm_service import ScmServicer
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
        self.org = self.create_organization(owner=self.user)
        self.integration = self.create_integration(
            organization=self.org, provider="github", external_id="github:123"
        )

    def _create_mock_installation(self, **methods):
        """Create a mock installation with the specified methods."""
        mock_installation = Mock()
        for method_name, return_value in methods.items():
            setattr(mock_installation, method_name, Mock(return_value=return_value))
        return mock_installation

    def _create_integration_context_manager(self, mock_installation):
        """Create a context manager mock for integration_installation."""
        mock_cm = Mock()
        mock_cm.__enter__ = Mock(return_value=mock_installation)
        mock_cm.__exit__ = Mock(return_value=None)
        return mock_cm

    def _patch_integration_installation(self, mock_installation):
        """Patch integration_installation to return the mock installation."""
        mock_cm = self._create_integration_context_manager(mock_installation)
        return patch.object(self.servicer, "integration_installation", return_value=mock_cm)

    def test_get_repositories(self):
        """Test listing repositories."""
        mock_installation = self._create_mock_installation(
            get_repositories=[
                {
                    "name": "test-repo-1",
                    "identifier": "test/test-repo-1",
                    "url": "https://github.com/test/test-repo-1",
                },
                {
                    "name": "test-repo-2",
                    "identifier": "test/test-repo-2",
                    "url": "https://github.com/test/test-repo-2",
                },
            ]
        )

        with self._patch_integration_installation(mock_installation):
            request = scm_pb2.GetRepositoriesRequest(organization_id=self.org.id)
            response = self.servicer.GetRepositories(request, self.context)

            # Verify response
            assert len(response.repositories) == 2
            repo_names = [r.name for r in response.repositories]
            assert "test-repo-1" in repo_names
            assert "test-repo-2" in repo_names

    def test_get_repositories_with_provider_filter(self):
        """Test filtering repositories by provider."""
        mock_installation = self._create_mock_installation(
            get_repositories=[
                {
                    "name": "github-repo",
                    "identifier": "test/github-repo",
                    "url": "https://github.com/test/github-repo",
                },
            ]
        )

        with self._patch_integration_installation(mock_installation):
            request = scm_pb2.GetRepositoriesRequest(
                organization_id=self.org.id, provider=scm_pb2.PROVIDER_GITHUB
            )
            response = self.servicer.GetRepositories(request, self.context)

            assert len(response.repositories) == 1
            assert response.repositories[0].name == "github-repo"

    def test_create_issue(self):
        """Test creating an issue."""
        mock_installation = self._create_mock_installation(
            create_issue={
                "key": "GH-123",
                "title": "Test Issue",
                "description": "This is a test issue",
                "url": "https://github.com/test/repo/issues/123",
                "metadata": {},
            }
        )

        with self._patch_integration_installation(mock_installation):
            request = scm_pb2.CreateIssueRequest(
                organization_id=self.org.id,
                integration_id=self.integration.id,
                title="Test Issue",
                description="This is a test issue",
            )
            response = self.servicer.CreateIssue(request, self.context)

            assert response is not None
            assert hasattr(response, "issue")
            assert response.issue.title == "Test Issue"
            assert response.issue.description == "This is a test issue"

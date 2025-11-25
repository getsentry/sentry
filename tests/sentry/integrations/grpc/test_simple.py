"""Simple test to debug issues."""

from unittest.mock import Mock, patch

from sentry.integrations.grpc.generated import scm_pb2
from sentry.integrations.grpc.services.scm_service import ScmServicer
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase


class TestSimple(TestCase):
    def test_simple_list(self):
        """Simple test to debug listing repositories."""
        # Create org and project
        org = self.create_organization(owner=self.user)
        project = self.create_project(organization=org)

        # Create repository
        self.create_repo(project=project, name="test-repo", provider="github")

        # Query directly
        repos = Repository.objects.filter(organization_id=org.id)
        assert repos.count() > 0, "Should have at least one repo"

        # Create servicer and mock context
        servicer = ScmServicer()
        context = Mock()
        servicer._check_auth = Mock(return_value=True)

        # Mock the integration_installation context manager
        mock_installation = Mock()
        mock_installation.get_repositories.return_value = [
            {
                "name": "test-repo",
                "identifier": "test-repo",
                "url": "https://github.com/test/test-repo",
            }
        ]

        # Create request
        request = scm_pb2.GetRepositoriesRequest(organization_id=org.id)

        # Mock the integration_installation context manager
        with patch.object(servicer, "integration_installation") as mock_integration:
            mock_integration.return_value.__enter__.return_value = mock_installation
            mock_integration.return_value.__exit__.return_value = None

            # Call service
            response = servicer.GetRepositories(request, context)

        assert len(response.repositories) > 0, "Should have at least one repo"

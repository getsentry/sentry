"""Simple test to debug issues."""

from unittest.mock import Mock

from sentry.integrations.grpc.generated import scm_pb2
from sentry.integrations.grpc.services.scm_service import ScmServicer
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase


class TestSimple(TestCase):
    def test_simple_list(self):
        """Simple test to debug listing repositories."""
        # Create org and project
        org = self.create_organization()
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

        # Create request
        request = scm_pb2.ListRepositoriesRequest(organization_id=org.id)

        # Call service
        response = servicer.ListRepositories(request, context)

        assert len(response.repositories) > 0, "Should have at least one repo"

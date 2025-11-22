"""Simple test to debug issues."""

from unittest.mock import Mock

from sentry.integrations.grpc.generated import scm_pb2
from sentry.integrations.grpc.services.scm_service import ScmServicer
from sentry.models import Repository
from sentry.testutils.cases import TestCase


class TestSimple(TestCase):
    def test_simple_list(self):
        """Simple test to debug listing repositories."""
        # Create org and project
        org = self.create_organization()
        project = self.create_project(organization=org)

        # Create repository
        repo = self.create_repo(project=project, name="test-repo", provider="github")

        # Check if repo exists
        print(f"Created repo: {repo.id}, org: {repo.organization_id}")
        print(f"Organization ID: {org.id}")

        # Query directly
        repos = Repository.objects.filter(organization_id=org.id)
        print(f"Direct query found {repos.count()} repos")
        for r in repos:
            print(f"  - {r.name} (id={r.id}, org={r.organization_id})")

        # Create servicer and mock context
        servicer = ScmServicer()
        context = Mock()
        servicer._check_auth = Mock(return_value=True)

        # Create request
        request = scm_pb2.ListRepositoriesRequest(organization_id=org.id)

        # Call service
        response = servicer.ListRepositories(request, context)

        print(f"Service response has {len(response.repositories)} repos")
        for r in response.repositories:
            print(f"  - {r.name} (id={r.id})")

        assert len(response.repositories) > 0, "Should have at least one repo"

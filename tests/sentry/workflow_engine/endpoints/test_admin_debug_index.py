from sentry.api.serializers import serialize
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.workflow_engine.endpoints.serializers.workflow_serializer import WorkflowSerializer


@region_silo_test
class AdminWorkflowDetailEndpointTest(APITestCase):
    endpoint = "sentry-api-0-admin-workflow-details"

    def test_requires_superuser(self) -> None:
        """Regular users cannot access admin endpoint."""
        workflow = self.create_workflow(organization_id=self.organization.id)
        self.login_as(user=self.user)
        self.get_error_response(workflow.id, status_code=403)

    def test_superuser_can_access(self) -> None:
        """Superusers can fetch workflow details."""
        workflow = self.create_workflow(organization_id=self.organization.id)
        superuser = self.create_user(is_superuser=True)
        self.login_as(user=superuser, superuser=True)

        response = self.get_success_response(workflow.id)
        assert response.data == serialize(workflow, superuser, WorkflowSerializer())

    def test_workflow_not_found(self) -> None:
        """Returns 404 for non-existent workflow."""
        superuser = self.create_user(is_superuser=True)
        self.login_as(user=superuser, superuser=True)
        self.get_error_response(999999, status_code=404)

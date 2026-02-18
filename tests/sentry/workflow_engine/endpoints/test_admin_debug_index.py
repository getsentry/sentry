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

    def test_unauthenticated_access_denied(self) -> None:
        """Unauthenticated users cannot access admin endpoint."""
        workflow = self.create_workflow(organization_id=self.organization.id)
        # No login_as() call - anonymous request
        self.get_error_response(workflow.id, status_code=401)

    def test_staff_user_access_denied(self) -> None:
        """Staff users (non-superuser) cannot access admin endpoint."""
        workflow = self.create_workflow(organization_id=self.organization.id)
        staff_user = self.create_user(is_staff=True, is_superuser=False)
        self.login_as(user=staff_user, staff=True)
        self.get_error_response(workflow.id, status_code=403)

    def test_invalid_workflow_id_format(self) -> None:
        """Non-numeric workflow IDs return 404."""
        superuser = self.create_user(is_superuser=True)
        self.login_as(user=superuser, superuser=True)

        # Test various invalid formats
        self.get_error_response("invalid-id", status_code=404)
        self.get_error_response("abc123", status_code=404)

    def test_superuser_cross_organization_access(self) -> None:
        """Superusers can access workflows from any organization (by design)."""
        # Create workflow in a different organization
        other_org = self.create_organization(name="Other Org")
        other_workflow = self.create_workflow(organization_id=other_org.id)

        # Superuser should be able to access workflow from any organization
        superuser = self.create_user(is_superuser=True)
        self.login_as(user=superuser, superuser=True)

        response = self.get_success_response(other_workflow.id)
        # Verify WorkflowSerializer was used (check response structure, not exact values)
        assert "id" in response.data
        assert response.data["id"] == str(other_workflow.id)

from sentry.api.serializers import serialize
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


class OrganizationWorkflowAPITestCase(APITestCase):
    endpoint = "sentry-api-0-organization-workflow-index"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)


@region_silo_test
class OrganizationWorkflowIndexBaseTest(OrganizationWorkflowAPITestCase):
    def test_simple(self):
        workflow = self.create_workflow(organization_id=self.organization.id, name="Test Workflow")

        workflow_two = self.create_workflow(
            organization_id=self.organization.id, name="Test Workflow 2"
        )

        response = self.get_success_response(self.organization.slug)
        assert response.data == serialize([workflow, workflow_two])

    def test_empty_result(self):
        response = self.get_success_response(self.organization.slug)
        assert response.data == []

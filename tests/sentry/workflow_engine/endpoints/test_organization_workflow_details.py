from sentry.api.serializers import serialize
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


class OrganizationWorkflowDetailsBaseTest(APITestCase):
    endpoint = "sentry-api-0-organization-workflow-details"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)


@region_silo_test
class OrganizationWorkflowIndexGetTest(OrganizationWorkflowDetailsBaseTest):
    def test_simple(self):
        workflow = self.create_workflow(organization_id=self.organization.id)
        response = self.get_success_response(self.organization.slug, workflow.id)
        assert response.data == serialize(workflow)

    def test_does_not_exist(self):
        self.get_error_response(self.organization.slug, 3, status_code=404)

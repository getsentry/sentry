from sentry.api.serializers import serialize
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


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


@region_silo_test
class OrganizationDeleteWorkflowTest(OrganizationWorkflowDetailsBaseTest, BaseWorkflowTest):
    def setUp(self):
        super().setUp()
        self.workflow = self.create_workflow(organization_id=self.organization.id)

    def test_simple(self):
        # delete the workflow
        pass

    def test_does_not_exist(self):
        # delete a workflow that does not exist, -1 id
        pass

    def test_delete_configured_workflow(self):
        # add data conditions
        # add actions
        pass

    def test_audit_entry(self):
        # ensure there is an audit entry for the deleted workflow
        pass

    def test_without_permissions(self):
        # delete a workflow that does not belong to this organization
        pass

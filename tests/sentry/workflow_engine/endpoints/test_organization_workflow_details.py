from sentry import audit_log
from sentry.api.serializers import serialize
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.models.auditlogentry import AuditLogEntry
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
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
    method = "DELETE"

    def setUp(self):
        super().setUp()
        self.workflow = self.create_workflow(organization_id=self.organization.id)

    def test_simple(self):
        with outbox_runner():
            self.get_success_response(self.organization.slug, self.workflow.id)

        assert RegionScheduledDeletion.objects.filter(
            model_name="Workflow",
            object_id=self.workflow.id,
        ).exists()

    def test_audit_entry(self):
        with outbox_runner():
            self.get_success_response(self.organization.slug, self.workflow.id)

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                target_object=self.workflow.id,
                event=audit_log.get_event_id("WORKFLOW_REMOVE"),
                actor=self.user,
            ).exists()

    def test_does_not_exist(self):
        # delete a workflow that does not exist, -1 id
        pass

    def test_delete_configured_workflow(self):
        # add data conditions
        # add actions
        pass

    def test_without_permissions(self):
        # delete a workflow that does not belong to this organization
        pass

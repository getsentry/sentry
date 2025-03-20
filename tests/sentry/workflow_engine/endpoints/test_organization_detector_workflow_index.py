from sentry import audit_log
from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.models.auditlogentry import AuditLogEntry
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.workflow_engine.models.detector_workflow import DetectorWorkflow


class OrganizationDetectorWorkflowAPITestCase(APITestCase):
    endpoint = "sentry-api-0-organization-detector-workflow-index"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        self.unconnected_workflow = self.create_workflow(organization_id=self.organization.id)
        self.unconnected_detector = self.create_detector()
        self.workflow_1 = self.create_workflow(organization_id=self.organization.id)
        self.workflow_2 = self.create_workflow(organization_id=self.organization.id)
        self.detector_1 = self.create_detector()
        self.detector_2 = self.create_detector()

        self.detector_1_workflow_1 = self.create_detector_workflow(
            detector=self.detector_1, workflow=self.workflow_1
        )
        self.detector_1_workflow_2 = self.create_detector_workflow(
            detector=self.detector_1, workflow=self.workflow_2
        )
        self.detector_2_workflow_1 = self.create_detector_workflow(
            detector=self.detector_2, workflow=self.workflow_1
        )

    def tearDown(self):
        return super().tearDown()


@region_silo_test
class OrganizationDetectorWorkflowIndexGetTest(OrganizationDetectorWorkflowAPITestCase):
    def test_detector_filter(self):
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"detector_id": self.detector_1.id},
            status_code=200,
        )
        assert len(response.data) == 2

        response = self.get_success_response(
            self.organization.slug,
            qs_params={"detector_id": self.unconnected_detector.id},
            status_code=200,
        )
        assert len(response.data) == 0

    def test_workflow_filter(self):
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"workflow_id": self.workflow_1.id},
            status_code=200,
        )
        assert len(response.data) == 2
        assert response.data == [
            {
                "id": str(self.detector_1_workflow_1.id),
                "detectorId": str(self.detector_1.id),
                "workflowId": str(self.workflow_1.id),
            },
            {
                "id": str(self.detector_2_workflow_1.id),
                "detectorId": str(self.detector_2.id),
                "workflowId": str(self.workflow_1.id),
            },
        ]

        response = self.get_success_response(
            self.organization.slug,
            qs_params={"workflow_id": self.unconnected_workflow.id},
            status_code=200,
        )
        assert len(response.data) == 0

    def test_detector_workflow_filter(self):
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"detector_id": self.detector_1.id, "workflow_id": self.workflow_1.id},
            status_code=200,
        )
        assert len(response.data) == 1
        assert response.data == [
            {
                "id": str(self.detector_1_workflow_1.id),
                "detectorId": str(self.detector_1.id),
                "workflowId": str(self.workflow_1.id),
            }
        ]

        response = self.get_success_response(
            self.organization.slug,
            qs_params={"detector_id": self.detector_2.id, "workflow_id": self.workflow_2.id},
            status_code=200,
        )
        assert len(response.data) == 0


@region_silo_test
class OrganizationDetectorWorkflowIndexPostTest(OrganizationDetectorWorkflowAPITestCase):
    method = "post"

    def test_simple(self):
        body_params = {
            "detectorId": self.unconnected_detector.id,
            "workflowId": self.unconnected_workflow.id,
        }
        response = self.get_success_response(
            self.organization.slug,
            **body_params,
            status_code=200,
        )
        detector_workflow = DetectorWorkflow.objects.get(
            detector_id=self.unconnected_detector.id, workflow_id=self.unconnected_workflow.id
        )
        assert response.data == {
            "id": str(detector_workflow.id),
            "detectorId": str(self.unconnected_detector.id),
            "workflowId": str(self.unconnected_workflow.id),
        }

    def test_audit_entry(self):
        body_params = {
            "detectorId": self.unconnected_detector.id,
            "workflowId": self.unconnected_workflow.id,
        }
        with outbox_runner():
            self.get_success_response(
                self.organization.slug,
                **body_params,
                status_code=200,
            )
        detector_workflow = DetectorWorkflow.objects.get(
            detector_id=self.unconnected_detector.id, workflow_id=self.unconnected_workflow.id
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                target_object=detector_workflow.id,
                event=audit_log.get_event_id("DETECTOR_WORKFLOW_ADD"),
                actor=self.user,
            ).exists()

    def test_duplicate(self):
        body_params = {"detectorId": self.detector_1.id, "workflowId": self.workflow_1.id}
        self.get_error_response(
            self.organization.slug,
            **body_params,
            status_code=409,
        )

    def test_invalid_id(self):
        body_params = {"detectorId": -1, "workflowId": self.workflow_1.id}
        self.get_error_response(
            self.organization.slug,
            **body_params,
            status_code=404,
        )

        body_params = {"detectorId": self.detector_1.id, "workflowId": -1}
        self.get_error_response(
            self.organization.slug,
            **body_params,
            status_code=404,
        )

    def test_missing_body_params(self):
        self.get_error_response(
            self.organization.slug,
            status_code=400,
        )


@region_silo_test
class OrganizationDetectorWorkflowIndexDeleteTest(OrganizationDetectorWorkflowAPITestCase):
    method = "delete"

    def test_simple_delete(self):
        self.get_success_response(
            self.organization.slug,
            qs_params={"detector_id": self.detector_1.id},
            status_code=204,
        )
        with self.tasks():
            run_scheduled_deletions()
        assert not DetectorWorkflow.objects.filter(detector_id=self.detector_1.id).exists()
        assert DetectorWorkflow.objects.filter(detector_id=self.detector_2.id).exists()

    def test_audit_entry(self):
        with outbox_runner():
            self.get_success_response(
                self.organization.slug,
                qs_params={"detector_id": self.detector_1.id, "workflow_id": self.workflow_1.id},
                status_code=204,
            )
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                target_object=self.detector_1_workflow_1.id,
                event=audit_log.get_event_id("DETECTOR_WORKFLOW_REMOVE"),
                actor=self.user,
            ).exists()

    def test_invalid_id(self):
        self.get_error_response(
            self.organization.slug,
            qs_params={"detector_id": -1},
            status_code=404,
        )

    def test_missing_ids(self):
        self.get_error_response(
            self.organization.slug,
            status_code=400,
        )

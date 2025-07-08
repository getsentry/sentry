from unittest import mock

from sentry import audit_log
from sentry.api.serializers import serialize
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.testutils.cases import APITestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import region_silo_test
from sentry.workflow_engine.models.detector_workflow import DetectorWorkflow


class OrganizationDetectorWorkflowAPITestCase(APITestCase):
    endpoint = "sentry-api-0-organization-detector-workflow-details"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        self.workflow = self.create_workflow(organization_id=self.organization.id)
        self.detector = self.create_detector()
        self.detector_workflow = self.create_detector_workflow(
            detector=self.detector, workflow=self.workflow
        )

        # Add team admin and member users for permission tests
        self.team_admin_user = self.create_user()
        self.create_member(
            team_roles=[(self.team, "admin")],
            user=self.team_admin_user,
            role="member",
            organization=self.organization,
        )

        self.member_user = self.create_user()
        self.create_member(
            team_roles=[(self.team, "contributor")],
            user=self.member_user,
            role="member",
            organization=self.organization,
        )

    def tearDown(self):
        return super().tearDown()


@region_silo_test
class OrganizationDetectorWorkflowDetailsGetTest(OrganizationDetectorWorkflowAPITestCase):
    def test_simple(self):
        response = self.get_success_response(
            self.organization.slug,
            self.detector_workflow.id,
        )
        assert response.data == serialize(self.detector_workflow)

    def test_does_not_exist(self):
        self.get_error_response(self.organization.slug, 500009, status_code=404)


@region_silo_test
class OrganizationDetectorWorkflowDetailsDeleteTest(OrganizationDetectorWorkflowAPITestCase):
    method = "delete"

    @mock.patch(
        "sentry.workflow_engine.endpoints.organization_detector_workflow_details.create_audit_entry"
    )
    def test_simple(self, mock_audit):
        with outbox_runner():
            self.get_success_response(
                self.organization.slug,
                self.detector_workflow.id,
            )

        # verify the DetectorWorkflow was scheduled for deletion
        assert RegionScheduledDeletion.objects.filter(
            model_name="DetectorWorkflow",
            object_id=self.detector_workflow.id,
        ).exists()

        # delete the DetectorWorkflow
        with self.tasks():
            run_scheduled_deletions()

        # verify it was deleted
        assert not DetectorWorkflow.objects.filter(id=self.detector_workflow.id).exists()

        # verify audit log
        mock_audit.assert_called_once_with(
            request=mock.ANY,
            organization=self.organization,
            target_object=self.detector_workflow.id,
            event=audit_log.get_event_id("DETECTOR_WORKFLOW_REMOVE"),
            data=self.detector_workflow.get_audit_log_data(),
        )

    def test_does_not_exist(self):
        with outbox_runner():
            self.get_error_response(self.organization.slug, 50000, status_code=404)

        # verify it wasn't deleted
        assert not RegionScheduledDeletion.objects.filter(
            model_name="DetectorWorkflow",
            object_id=self.detector_workflow.id,
        ).exists()

    def test_team_admin_can_disconnect_user_detectors(self):
        self.login_as(user=self.team_admin_user)

        detector = self.create_detector(
            project=self.create_project(organization=self.organization),
            created_by_id=self.user.id,
        )
        detector_workflow = self.create_detector_workflow(
            detector=detector,
            workflow=self.workflow,
        )
        with outbox_runner():
            self.get_success_response(
                self.organization.slug,
                detector_workflow.id,
            )

    def test_team_admin_can_disconnect_sentry_detectors(self):
        self.login_as(user=self.team_admin_user)

        sentry_detector = self.create_detector(
            project=self.create_project(organization=self.organization),
        )
        detector_workflow = self.create_detector_workflow(
            detector=sentry_detector,
            workflow=self.workflow,
        )
        with outbox_runner():
            self.get_success_response(
                self.organization.slug,
                detector_workflow.id,
            )

    def test_team_admin_can_disconnect_detectors_for_accessible_projects(self):
        self.login_as(user=self.team_admin_user)
        self.organization.update_option("sentry:alerts_member_write", False)

        project_detector = self.create_detector(
            project=self.create_project(organization=self.organization, teams=[self.team]),
            created_by_id=self.user.id,
        )
        detector_workflow = self.create_detector_workflow(
            detector=project_detector,
            workflow=self.workflow,
        )
        with outbox_runner():
            self.get_success_response(
                self.organization.slug,
                detector_workflow.id,
            )

    def test_team_admin_cannot_disconnect_detectors_for_other_projects(self):
        self.login_as(user=self.team_admin_user)
        self.organization.update_option("sentry:alerts_member_write", False)

        other_detector = self.create_detector(
            project=self.create_project(organization=self.organization, teams=[]),
            created_by_id=self.user.id,
        )
        detector_workflow = self.create_detector_workflow(
            detector=other_detector,
            workflow=self.workflow,
        )
        with outbox_runner():
            self.get_error_response(
                self.organization.slug,
                detector_workflow.id,
                status_code=403,
            )

    def test_member_can_disconnect_user_detectors(self):
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        self.login_as(user=self.member_user)

        detector = self.create_detector(
            project=self.create_project(organization=self.organization),
            created_by_id=self.user.id,
        )
        detector_workflow = self.create_detector_workflow(
            detector=detector,
            workflow=self.workflow,
        )
        with outbox_runner():
            self.get_success_response(
                self.organization.slug,
                detector_workflow.id,
            )

    def test_member_cannot_disconnect_detectors_for_other_projects(self):
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        self.login_as(user=self.member_user)

        other_detector = self.create_detector(
            project=self.create_project(organization=self.organization, teams=[]),
            created_by_id=self.user.id,
        )
        detector_workflow = self.create_detector_workflow(
            detector=other_detector,
            workflow=self.workflow,
        )
        with outbox_runner():
            self.get_error_response(
                self.organization.slug,
                detector_workflow.id,
                status_code=403,
            )

    def test_member_cannot_disconnect_sentry_detectors(self):
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        self.login_as(user=self.member_user)

        sentry_detector = self.create_detector(
            project=self.create_project(organization=self.organization),
        )
        detector_workflow = self.create_detector_workflow(
            detector=sentry_detector,
            workflow=self.workflow,
        )
        with outbox_runner():
            self.get_error_response(
                self.organization.slug,
                detector_workflow.id,
                status_code=403,
            )

    def test_member_cannot_disconnect_detectors_when_alerts_member_write_disabled(self):
        self.organization.update_option("sentry:alerts_member_write", False)
        self.organization.flags.allow_joinleave = True
        self.organization.save()
        self.login_as(user=self.member_user)

        detector = self.create_detector(
            project=self.create_project(organization=self.organization, teams=[self.team]),
            created_by_id=self.user.id,
        )
        detector_workflow = self.create_detector_workflow(
            detector=detector,
            workflow=self.workflow,
        )
        with outbox_runner():
            self.get_error_response(
                self.organization.slug,
                detector_workflow.id,
                status_code=403,
            )

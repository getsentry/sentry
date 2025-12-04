from unittest import mock
from unittest.mock import MagicMock, call

from sentry import audit_log
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.workflow_engine.models.detector_workflow import DetectorWorkflow


class OrganizationDetectorWorkflowAPITestCase(APITestCase):
    endpoint = "sentry-api-0-organization-detector-workflow-index"

    def setUp(self) -> None:
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

    def tearDown(self) -> None:
        return super().tearDown()


@region_silo_test
class OrganizationDetectorWorkflowIndexGetTest(OrganizationDetectorWorkflowAPITestCase):
    def test_detector_filter(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"detector_id": self.detector_1.id},
        )
        assert len(response.data) == 2
        assert response.data == [
            {
                "id": str(self.detector_1_workflow_1.id),
                "detectorId": str(self.detector_1.id),
                "workflowId": str(self.workflow_1.id),
            },
            {
                "id": str(self.detector_1_workflow_2.id),
                "detectorId": str(self.detector_1.id),
                "workflowId": str(self.workflow_2.id),
            },
        ]

        response = self.get_success_response(
            self.organization.slug,
            qs_params={"detector_id": self.unconnected_detector.id},
        )
        assert len(response.data) == 0

    def test_workflow_filter(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"workflow_id": self.workflow_1.id},
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
        )
        assert len(response.data) == 0

    def test_detector_workflow_filter(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            qs_params={"detector_id": self.detector_1.id, "workflow_id": self.workflow_1.id},
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
        )
        assert len(response.data) == 0


@region_silo_test
class OrganizationDetectorWorkflowIndexPostTest(OrganizationDetectorWorkflowAPITestCase):
    method = "post"

    @mock.patch("sentry.workflow_engine.endpoints.validators.detector_workflow.create_audit_entry")
    def test_simple(self, mock_audit: MagicMock) -> None:
        body_params = {
            "detectorId": self.unconnected_detector.id,
            "workflowId": self.unconnected_workflow.id,
        }
        response = self.get_success_response(
            self.organization.slug,
            **body_params,
        )
        detector_workflow = DetectorWorkflow.objects.get(
            detector_id=self.unconnected_detector.id, workflow_id=self.unconnected_workflow.id
        )
        assert response.data == {
            "id": str(detector_workflow.id),
            "detectorId": str(self.unconnected_detector.id),
            "workflowId": str(self.unconnected_workflow.id),
        }
        # verify audit log
        mock_audit.assert_called_once_with(
            request=mock.ANY,
            organization=self.organization,
            target_object=detector_workflow.id,
            event=audit_log.get_event_id("DETECTOR_WORKFLOW_ADD"),
            data=detector_workflow.get_audit_log_data(),
        )

    def test_duplicate(self) -> None:
        body_params = {"detectorId": self.detector_1.id, "workflowId": self.workflow_1.id}
        self.get_error_response(
            self.organization.slug,
            **body_params,
        )

    def test_invalid_id(self) -> None:
        body_params = {"detectorId": -1, "workflowId": self.workflow_1.id}
        self.get_error_response(
            self.organization.slug,
            **body_params,
        )

        body_params = {"detectorId": self.detector_1.id, "workflowId": -1}
        self.get_error_response(
            self.organization.slug,
            **body_params,
        )

    def test_missing_body_params(self) -> None:
        # missing detectorId
        body_params = {"workflowId": self.workflow_1.id}
        self.get_error_response(
            self.organization.slug,
            **body_params,
        )
        # missing workflowId
        body_params = {"detectorId": self.detector_1.id}
        self.get_error_response(
            self.organization.slug,
            **body_params,
        )
        # missing both params
        self.get_error_response(
            self.organization.slug,
        )

    def test_member_can_connect_detectors_with_alerts_write(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        self.organization.update_option("sentry:alerts_member_write", True)
        self.login_as(user=self.member_user)

        detector = self.create_detector(
            project=self.create_project(organization=self.organization),
            created_by_id=self.user.id,
        )
        body_params = {
            "detectorId": detector.id,
            "workflowId": self.unconnected_workflow.id,
        }
        self.get_success_response(
            self.organization.slug,
            **body_params,
        )

    def test_member_can_connect_detectors_for_other_projects_with_alerts_write(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        self.organization.update_option("sentry:alerts_member_write", True)
        self.login_as(user=self.member_user)

        other_detector = self.create_detector(
            project=self.create_project(organization=self.organization, teams=[]),
            created_by_id=self.user.id,
        )
        body_params = {
            "detectorId": other_detector.id,
            "workflowId": self.unconnected_workflow.id,
        }
        self.get_success_response(self.organization.slug, **body_params)

    def test_member_cannot_connect_detectors_without_alerts_write(self) -> None:
        self.organization.update_option("sentry:alerts_member_write", False)
        self.organization.flags.allow_joinleave = True
        self.organization.save()
        self.login_as(user=self.member_user)

        detector = self.create_detector(
            project=self.create_project(organization=self.organization, teams=[self.team]),
            created_by_id=self.user.id,
        )
        body_params = {
            "detectorId": detector.id,
            "workflowId": self.unconnected_workflow.id,
        }
        self.get_error_response(
            self.organization.slug,
            **body_params,
            status_code=403,
        )


@region_silo_test
class OrganizationDetectorWorkflowIndexDeleteTest(OrganizationDetectorWorkflowAPITestCase):
    method = "delete"

    @mock.patch(
        "sentry.workflow_engine.endpoints.organization_detector_workflow_index.create_audit_entry"
    )
    def test_simple(self, mock_audit: MagicMock) -> None:
        self.get_success_response(
            self.organization.slug,
            qs_params={"detector_id": self.detector_1.id, "workflow_id": self.workflow_1.id},
        )

        assert not DetectorWorkflow.objects.filter(
            detector_id=self.detector_1.id, workflow_id=self.workflow_1.id
        ).exists()

        # verify audit log
        mock_audit.assert_called_once_with(
            request=mock.ANY,
            organization=self.organization,
            target_object=self.detector_1_workflow_1.id,
            event=audit_log.get_event_id("DETECTOR_WORKFLOW_REMOVE"),
            data=self.detector_1_workflow_1.get_audit_log_data(),
        )

    @mock.patch(
        "sentry.workflow_engine.endpoints.organization_detector_workflow_index.create_audit_entry"
    )
    def test_batch_delete(self, mock_audit: MagicMock) -> None:
        self.get_success_response(
            self.organization.slug,
            qs_params={"detector_id": self.detector_1.id},
        )
        assert not DetectorWorkflow.objects.filter(detector_id=self.detector_1.id).exists()
        assert DetectorWorkflow.objects.filter(detector_id=self.detector_2.id).exists()

        # verify audit log
        expected_calls = [
            call(
                request=mock.ANY,
                organization=self.organization,
                target_object=self.detector_1_workflow_1.id,
                event=audit_log.get_event_id("DETECTOR_WORKFLOW_REMOVE"),
                data=self.detector_1_workflow_1.get_audit_log_data(),
            ),
            call(
                request=mock.ANY,
                organization=self.organization,
                target_object=self.detector_1_workflow_2.id,
                event=audit_log.get_event_id("DETECTOR_WORKFLOW_REMOVE"),
                data=self.detector_1_workflow_2.get_audit_log_data(),
            ),
        ]
        mock_audit.assert_has_calls(expected_calls)

    def test_invalid_id(self) -> None:
        self.get_error_response(
            self.organization.slug,
            qs_params={"detector_id": -1},
        )

    def test_missing_ids(self) -> None:
        self.get_error_response(
            self.organization.slug,
        )

    def test_member_can_disconnect_detectors_with_alerts_write(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        self.organization.update_option("sentry:alerts_member_write", True)
        self.login_as(user=self.member_user)

        detector = self.create_detector(
            project=self.create_project(organization=self.organization),
            created_by_id=self.user.id,
        )
        self.create_detector_workflow(
            detector=detector,
            workflow=self.workflow_1,
        )
        self.get_success_response(
            self.organization.slug,
            qs_params={"detector_id": detector.id, "workflow_id": self.workflow_1.id},
        )

    def test_member_cannot_disconnect_detectors_without_alerts_write(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        self.organization.update_option("sentry:alerts_member_write", False)
        self.login_as(user=self.member_user)

        other_detector = self.create_detector(
            project=self.create_project(organization=self.organization, teams=[]),
            created_by_id=self.user.id,
        )
        self.create_detector_workflow(
            detector=other_detector,
            workflow=self.workflow_1,
        )
        self.get_error_response(
            self.organization.slug,
            qs_params={"detector_id": other_detector.id, "workflow_id": self.workflow_1.id},
            status_code=403,
        )

    def test_batch_delete_no_permission(self) -> None:
        self.organization.update_option("sentry:alerts_member_write", False)
        self.login_as(user=self.member_user)

        # nothing is deleted when the user does not have permission to all detectors
        detector = self.create_detector(
            project=self.create_project(organization=self.organization, teams=[self.team]),
            created_by_id=self.user.id,
        )
        self.create_detector_workflow(
            detector=detector,
            workflow=self.workflow_1,
        )
        # Member lacks alerts:write because alerts_member_write is disabled
        self.get_error_response(
            self.organization.slug,
            qs_params={"workflow_id": self.workflow_1.id},
            status_code=403,
        )
        assert DetectorWorkflow.objects.filter(workflow_id=self.workflow_1.id).count() == 3

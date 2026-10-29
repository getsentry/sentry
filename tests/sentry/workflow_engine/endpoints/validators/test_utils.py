import pytest
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.serializers import ValidationError

from sentry.auth.access import Access, NoAccess, SystemAccess, from_user
from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.defaults.detectors import ensure_default_all_projects_detector
from sentry.workflow_engine.endpoints.validators.utils import (
    can_edit_detector,
    can_edit_detector_with_access,
    connect_detectors_to_workflows,
    validate_detectors_exist_and_have_permissions,
    validate_workflow_connections,
)
from sentry.workflow_engine.models import DetectorWorkflow
from tests.sentry.workflow_engine.test_base import ProjectAccessTestMixin


class TestValidateWorkflowConnections(ProjectAccessTestMixin):
    def setUp(self) -> None:
        super().setUp()
        self.setup_project_access_test_data()
        self.organization.update_option("sentry:alerts_member_write", True)
        self.request: Request = self.make_request(  # type: ignore[assignment]
            user=self.limited_user, method="POST"
        )
        self.request.access = from_user(self.limited_user, self.organization)

    def test_connection_helper_rejects_unauthorized_changes(self) -> None:
        # Enforce permissions even when called without serializer validation.
        assert self.request.access.has_scope("alerts:write")
        with pytest.raises(PermissionDenied):
            connect_detectors_to_workflows(
                self.request,
                self.organization,
                self.user_detector.id,
                [self.unattached_workflow.id, self.other_workflow.id],
                update=True,
            )

        assert list(
            DetectorWorkflow.objects.filter(detector=self.user_detector).values_list(
                "workflow_id", flat=True
            )
        ) == [self.user_workflow.id]

    def test_all_projects_requires_org_write(self) -> None:
        detector = ensure_default_all_projects_detector(self.organization.id)
        self.create_detector_workflow(workflow=self.user_workflow, detector=detector)
        with pytest.raises(PermissionDenied):
            validate_workflow_connections([self.user_workflow.id], self.organization, self.request)

        self.request.access = from_user(self.user, self.organization)
        validate_workflow_connections([self.user_workflow.id], self.organization, self.request)

    @with_feature("organizations:team-roles")
    def test_team_admin_shared_workflow_connections(self) -> None:
        self.organization.update_option("sentry:alerts_member_write", False)
        team_admin = self.create_user()
        self.create_member(
            user=team_admin,
            organization=self.organization,
            role="member",
            team_roles=[(self.user_team, "admin")],
        )
        self.request = self.make_request(user=team_admin, method="POST")  # type: ignore[assignment]
        self.request.access = from_user(team_admin, self.organization)
        validate_workflow_connections([self.user_workflow.id], self.organization, self.request)

        # Visibility through one project does not grant a team admin permission
        # to add connections to a workflow shared with an inaccessible project.
        self.create_detector_workflow(workflow=self.user_workflow, detector=self.other_detector)
        with pytest.raises(PermissionDenied):
            validate_workflow_connections([self.user_workflow.id], self.organization, self.request)

        # Retaining or removing their own existing connection remains allowed.
        validate_workflow_connections(
            [self.user_workflow.id], self.organization, self.request, self.user_detector.id
        )
        connect_detectors_to_workflows(
            self.request,
            self.organization,
            self.user_detector.id,
            [],
            update=True,
        )

        assert not DetectorWorkflow.objects.filter(detector=self.user_detector).exists()
        assert DetectorWorkflow.objects.filter(
            detector=self.other_detector, workflow=self.user_workflow
        ).exists()


class TestValidateDetectorsExistAndHavePermissions(TestCase):
    def _make_request_with_access(self, access: Access) -> Request:
        request: Request = self.make_request(user=self.user)  # type: ignore[assignment]
        request.access = access
        return request

    def test_project_scoped_detector(self) -> None:
        detector = self.create_detector(project=self.project)
        request = self._make_request_with_access(SystemAccess())

        result = validate_detectors_exist_and_have_permissions(
            [detector.id], self.organization, request
        )
        assert detector in result

    def test_null_project_detector(self) -> None:
        detector = ensure_default_all_projects_detector(self.organization.id)
        request = self._make_request_with_access(SystemAccess())

        result = validate_detectors_exist_and_have_permissions(
            [detector.id], self.organization, request
        )
        assert detector in result

    def test_mix_of_project_and_null_project_detectors(self) -> None:
        project_detector = self.create_detector(project=self.project)
        all_projects_detector = ensure_default_all_projects_detector(self.organization.id)
        request = self._make_request_with_access(SystemAccess())

        result = validate_detectors_exist_and_have_permissions(
            [project_detector.id, all_projects_detector.id], self.organization, request
        )
        assert {detector.id for detector in result} == {
            project_detector.id,
            all_projects_detector.id,
        }

    def test_nonexistent_detector_raises(self) -> None:
        request = self._make_request_with_access(SystemAccess())

        with pytest.raises(ValidationError, match="do not exist"):
            validate_detectors_exist_and_have_permissions([999999], self.organization, request)

    def test_detector_from_other_org_not_found(self) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_detector = self.create_detector(project=other_project)
        request = self._make_request_with_access(SystemAccess())

        with pytest.raises(ValidationError, match="do not exist"):
            validate_detectors_exist_and_have_permissions(
                [other_detector.id], self.organization, request
            )

    def test_null_project_detector_from_other_org_not_found(self) -> None:
        """
        A null-project detector belonging to another org should not be found
        since the query scopes by config__organization_id.
        """
        other_org = self.create_organization()
        other_all_projects_detector = ensure_default_all_projects_detector(other_org.id)
        request = self._make_request_with_access(NoAccess())

        with pytest.raises(ValidationError, match="do not exist"):
            validate_detectors_exist_and_have_permissions(
                [other_all_projects_detector.id], self.organization, request
            )

    def test_permission_denied_when_no_access(self) -> None:
        detector = self.create_detector(project=self.project)
        request = self._make_request_with_access(NoAccess())

        with pytest.raises(PermissionDenied):
            validate_detectors_exist_and_have_permissions([detector.id], self.organization, request)

    def test_null_project_detector_permission_denied_when_no_access(self) -> None:
        detector = ensure_default_all_projects_detector(self.organization.id)
        request = self._make_request_with_access(NoAccess())

        with pytest.raises(PermissionDenied):
            validate_detectors_exist_and_have_permissions([detector.id], self.organization, request)


class TestCanEditDetectorWithAccess(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization.update_option("sentry:alerts_member_write", False)
        self.member = self.create_user()
        self.create_member(user=self.member, organization=self.organization, role="member")
        self.metric_detector = self.create_detector(project=self.project, type=MetricIssue.slug)
        self.error_detector = self.create_detector(project=self.project, type=ErrorGroupType.slug)

    def test_user_created_detectors_need_alerts_write(self) -> None:
        assert can_edit_detector_with_access(
            self.metric_detector, from_user(self.user, self.organization)
        )
        assert not can_edit_detector_with_access(
            self.metric_detector, from_user(self.member, self.organization)
        )
        assert not can_edit_detector_with_access(self.metric_detector, NoAccess())

    def test_system_created_detectors_need_org_write(self) -> None:
        self.organization.update_option("sentry:alerts_member_write", True)
        member_access = from_user(self.member, self.organization)

        assert can_edit_detector_with_access(self.metric_detector, member_access)
        assert not can_edit_detector_with_access(self.error_detector, member_access)
        assert can_edit_detector_with_access(
            self.error_detector, from_user(self.user, self.organization)
        )

    def test_the_all_projects_detector_cannot_be_edited(self) -> None:
        detector = ensure_default_all_projects_detector(self.organization.id)

        assert detector.project_id is None
        assert not can_edit_detector_with_access(detector, from_user(self.user, self.organization))

    def test_request_variant_uses_the_request_access(self) -> None:
        request: Request = self.make_request(user=self.member)  # type: ignore[assignment]
        request.access = from_user(self.member, self.organization)
        assert not can_edit_detector(self.metric_detector, request)

        request.access = from_user(self.user, self.organization)
        assert can_edit_detector(self.metric_detector, request)

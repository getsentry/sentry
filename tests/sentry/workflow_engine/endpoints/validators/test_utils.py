import pytest
from rest_framework.exceptions import PermissionDenied
from rest_framework.serializers import ValidationError

from sentry.auth.access import NoAccess, SystemAccess
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.defaults.detectors import ensure_default_all_projects_detector
from sentry.workflow_engine.endpoints.validators.utils import (
    validate_detectors_exist_and_have_permissions,
)


class TestValidateDetectorsExistAndHavePermissions(TestCase):
    def _make_request_with_access(self, access):
        request = self.make_request(user=self.user)
        request.access = access
        return request

    def test_project_scoped_detector(self):
        detector = self.create_detector(project=self.project)
        request = self._make_request_with_access(SystemAccess())

        result = validate_detectors_exist_and_have_permissions(
            [detector.id], self.organization, request
        )
        assert detector in result

    def test_null_project_detector(self):
        detector = ensure_default_all_projects_detector(self.organization.id)
        request = self._make_request_with_access(SystemAccess())

        result = validate_detectors_exist_and_have_permissions(
            [detector.id], self.organization, request
        )
        assert detector in result

    def test_mix_of_project_and_null_project_detectors(self):
        project_detector = self.create_detector(project=self.project)
        all_projects_detector = ensure_default_all_projects_detector(self.organization.id)
        request = self._make_request_with_access(SystemAccess())

        result = validate_detectors_exist_and_have_permissions(
            [project_detector.id, all_projects_detector.id], self.organization, request
        )
        assert set(result.values_list("id", flat=True)) == {
            project_detector.id,
            all_projects_detector.id,
        }

    def test_nonexistent_detector_raises(self):
        request = self._make_request_with_access(SystemAccess())

        with pytest.raises(ValidationError, match="do not exist"):
            validate_detectors_exist_and_have_permissions([999999], self.organization, request)

    def test_detector_from_other_org_not_found(self):
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_detector = self.create_detector(project=other_project)
        request = self._make_request_with_access(SystemAccess())

        with pytest.raises(ValidationError, match="do not exist"):
            validate_detectors_exist_and_have_permissions(
                [other_detector.id], self.organization, request
            )

    def test_null_project_detector_from_other_org_permission_denied(self):
        """
        A null-project detector belonging to another org should be rejected
        by the permission check since the user won't have access.
        """
        other_org = self.create_organization()
        other_all_projects_detector = ensure_default_all_projects_detector(other_org.id)
        request = self._make_request_with_access(NoAccess())

        with pytest.raises(PermissionDenied):
            validate_detectors_exist_and_have_permissions(
                [other_all_projects_detector.id], self.organization, request
            )

    def test_permission_denied_when_no_access(self):
        detector = self.create_detector(project=self.project)
        request = self._make_request_with_access(NoAccess())

        with pytest.raises(PermissionDenied):
            validate_detectors_exist_and_have_permissions([detector.id], self.organization, request)

    def test_null_project_detector_permission_denied_when_no_access(self):
        detector = ensure_default_all_projects_detector(self.organization.id)
        request = self._make_request_with_access(NoAccess())

        with pytest.raises(PermissionDenied):
            validate_detectors_exist_and_have_permissions([detector.id], self.organization, request)

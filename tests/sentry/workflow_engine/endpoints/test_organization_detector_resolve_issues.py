import pytest

from sentry.models.group import GroupStatus
from sentry.testutils.cases import APITestCase
from sentry.types.group import GroupSubStatus
from sentry.workflow_engine.models.detector_group import DetectorGroup


@pytest.mark.snuba_ci
class OrganizationDetectorResolveIssuesTest(APITestCase):
    endpoint = "sentry-api-0-organization-detector-resolve-issues"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def test_resolve_issues_success(self):
        # Create a detector
        detector = self.create_detector(
            name="test-detector",
            project_id=self.project.id,
            type="error",
        )

        # Create some groups (issues) associated with the detector
        group1 = self.create_group(
            project=self.project, status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.NEW
        )
        group2 = self.create_group(
            project=self.project, status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.NEW
        )
        group3 = self.create_group(
            project=self.project, status=GroupStatus.RESOLVED
        )  # Already resolved

        # Link groups to detector
        DetectorGroup.objects.create(detector=detector, group=group1)
        DetectorGroup.objects.create(detector=detector, group=group2)
        DetectorGroup.objects.create(detector=detector, group=group3)

        response = self.get_success_response(self.organization.slug, detector.id, method="post")

        assert response.data["resolved_count"] == 2

        # Verify that groups are now resolved
        group1.refresh_from_db()
        group2.refresh_from_db()
        group3.refresh_from_db()

        assert group1.status == GroupStatus.RESOLVED
        assert group2.status == GroupStatus.RESOLVED
        assert group3.status == GroupStatus.RESOLVED  # Was already resolved

    def test_resolve_issues_no_groups(self):
        # Create a detector with no associated groups
        detector = self.create_detector(
            name="test-detector",
            project_id=self.project.id,
            type="error",
        )

        response = self.get_success_response(self.organization.slug, detector.id, method="post")

        assert response.data["resolved_count"] == 0

    def test_resolve_issues_all_already_resolved(self):
        # Create a detector
        detector = self.create_detector(
            name="test-detector",
            project_id=self.project.id,
            type="error",
        )

        # Create some groups that are already resolved
        group1 = self.create_group(project=self.project, status=GroupStatus.RESOLVED)
        group2 = self.create_group(project=self.project, status=GroupStatus.RESOLVED)

        # Link groups to detector
        DetectorGroup.objects.create(detector=detector, group=group1)
        DetectorGroup.objects.create(detector=detector, group=group2)

        response = self.get_success_response(self.organization.slug, detector.id, method="post")

        assert response.data["resolved_count"] == 0

    def test_resolve_issues_detector_not_found(self):
        non_existent_detector_id = 99999
        self.get_error_response(
            self.organization.slug, non_existent_detector_id, method="post", status_code=404
        )

    def test_resolve_issues_detector_different_org(self):
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)

        detector = self.create_detector(
            name="test-detector",
            project_id=other_project.id,
            type="error",
        )

        self.get_error_response(self.organization.slug, detector.id, method="post", status_code=404)

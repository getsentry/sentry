from rest_framework import status

from sentry.grouping.grouptype import ErrorGroupType
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import cell_silo_test
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType


@cell_silo_test
class OrganizationDetectorHealthCheckTest(APITestCase):
    endpoint = "sentry-api-0-organization-detector-health-check"
    method = "POST"

    def setUp(self) -> None:
        self.staff_user = self.create_user(is_staff=True)

    def test_requires_staff(self) -> None:
        self.login_as(user=self.user)
        self.get_error_response(self.organization.slug, status_code=status.HTTP_403_FORBIDDEN)

    def test_org_only(self) -> None:
        self.login_as(user=self.staff_user, staff=True)
        response = self.get_success_response(
            self.organization.slug, status_code=status.HTTP_201_CREATED
        )
        assert "organization" in response.data
        assert isinstance(response.data["organization"], dict)
        assert response.data["projects"] is None

    def test_with_projects(self) -> None:
        self.login_as(user=self.staff_user, staff=True)
        response = self.get_success_response(
            self.organization.slug,
            projects=[self.project.id],
            status_code=status.HTTP_201_CREATED,
        )

        assert "organization" in response.data
        assert self.project.slug in response.data["projects"]

        project_detectors = response.data["projects"][self.project.slug]
        assert ErrorGroupType.slug in project_detectors
        assert IssueStreamGroupType.slug in project_detectors

    def test_multiple_projects(self) -> None:
        self.login_as(user=self.staff_user, staff=True)
        project_2 = self.create_project(organization=self.organization)
        response = self.get_success_response(
            self.organization.slug,
            projects=[self.project.id, project_2.id],
            status_code=status.HTTP_201_CREATED,
        )

        assert self.project.slug in response.data["projects"]
        assert project_2.slug in response.data["projects"]

    def test_invalid_project_returns_400(self) -> None:
        self.login_as(user=self.staff_user, staff=True)
        self.get_error_response(
            self.organization.slug,
            projects=["nonexistent-project"],
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    def test_inaccessible_project_returns_403(self) -> None:
        self.login_as(user=self.staff_user, staff=True)
        self.get_error_response(
            self.organization.slug,
            projects=[512345],
            status_code=status.HTTP_403_FORBIDDEN,
        )

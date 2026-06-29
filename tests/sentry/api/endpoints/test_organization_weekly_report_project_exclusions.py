from sentry.models.weeklyreportprojectexclusion import WeeklyReportProjectExclusion
from sentry.testutils.cases import APITestCase


class GetOrganizationWeeklyReportProjectExclusionsTest(APITestCase):
    endpoint = "sentry-api-0-organization-weekly-report-project-exclusions"
    method = "get"

    def setUp(self) -> None:
        self.login_as(user=self.user)

    def test_empty(self) -> None:
        with self.feature("organizations:weekly-report-project-exclusions"):
            response = self.get_success_response(self.organization.slug)
        assert response.data == []

    def test_returns_exclusions(self) -> None:
        project2 = self.create_project(organization=self.organization)
        exc1 = WeeklyReportProjectExclusion.objects.create(
            project=self.project, user_id=self.user.id
        )
        exc2 = WeeklyReportProjectExclusion.objects.create(project=project2, user_id=self.user.id)

        with self.feature("organizations:weekly-report-project-exclusions"):
            response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 2
        returned_ids = {item["id"] for item in response.data}
        assert returned_ids == {str(exc1.id), str(exc2.id)}

    def test_does_not_return_other_users_exclusions(self) -> None:
        other_user = self.create_user()
        WeeklyReportProjectExclusion.objects.create(project=self.project, user_id=other_user.id)
        with self.feature("organizations:weekly-report-project-exclusions"):
            response = self.get_success_response(self.organization.slug)
        assert response.data == []

    def test_does_not_return_other_org_exclusions(self) -> None:
        other_org = self.create_organization(owner=self.user)
        other_project = self.create_project(organization=other_org)
        WeeklyReportProjectExclusion.objects.create(project=other_project, user_id=self.user.id)
        with self.feature("organizations:weekly-report-project-exclusions"):
            response = self.get_success_response(self.organization.slug)
        assert response.data == []

    def test_feature_flag_required(self) -> None:
        response = self.get_response(self.organization.slug)
        assert response.status_code == 404


class PutOrganizationWeeklyReportProjectExclusionsTest(APITestCase):
    endpoint = "sentry-api-0-organization-weekly-report-project-exclusions"
    method = "put"

    def setUp(self) -> None:
        self.login_as(user=self.user)

    def test_set_exclusions(self) -> None:
        project2 = self.create_project(organization=self.organization)
        with self.feature("organizations:weekly-report-project-exclusions"):
            response = self.get_response(
                self.organization.slug,
                projectIds=[self.project.id, project2.id],
            )
        assert response.status_code == 204
        assert WeeklyReportProjectExclusion.objects.filter(user_id=self.user.id).count() == 2

    def test_replace_exclusions(self) -> None:
        project2 = self.create_project(organization=self.organization)
        WeeklyReportProjectExclusion.objects.create(project=self.project, user_id=self.user.id)
        with self.feature("organizations:weekly-report-project-exclusions"):
            response = self.get_response(
                self.organization.slug,
                projectIds=[project2.id],
            )
        assert response.status_code == 204
        exclusions = list(
            WeeklyReportProjectExclusion.objects.filter(user_id=self.user.id).values_list(
                "project_id", flat=True
            )
        )
        assert exclusions == [project2.id]

    def test_clear_exclusions(self) -> None:
        WeeklyReportProjectExclusion.objects.create(project=self.project, user_id=self.user.id)
        with self.feature("organizations:weekly-report-project-exclusions"):
            response = self.get_response(
                self.organization.slug,
                projectIds=[],
            )
        assert response.status_code == 204
        assert WeeklyReportProjectExclusion.objects.filter(user_id=self.user.id).count() == 0

    def test_does_not_affect_other_users(self) -> None:
        other_user = self.create_user()
        WeeklyReportProjectExclusion.objects.create(project=self.project, user_id=other_user.id)
        with self.feature("organizations:weekly-report-project-exclusions"):
            self.get_response(
                self.organization.slug,
                projectIds=[self.project.id],
            )
        assert WeeklyReportProjectExclusion.objects.filter(user_id=other_user.id).count() == 1

    def test_feature_flag_required(self) -> None:
        response = self.get_response(
            self.organization.slug,
            projectIds=[self.project.id],
        )
        assert response.status_code == 404

    def test_invalid_project_ids(self) -> None:
        with self.feature("organizations:weekly-report-project-exclusions"):
            response = self.get_response(
                self.organization.slug,
                projectIds="not-a-list",
            )
        assert response.status_code == 400


class DeleteOrganizationWeeklyReportProjectExclusionDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-weekly-report-project-exclusion-details"
    method = "delete"

    def setUp(self) -> None:
        self.login_as(user=self.user)

    def test_delete_by_slug(self) -> None:
        WeeklyReportProjectExclusion.objects.create(project=self.project, user_id=self.user.id)
        with self.feature("organizations:weekly-report-project-exclusions"):
            response = self.get_response(self.organization.slug, self.project.slug)
        assert response.status_code == 204
        assert not WeeklyReportProjectExclusion.objects.filter(
            project=self.project, user_id=self.user.id
        ).exists()

    def test_delete_by_id(self) -> None:
        WeeklyReportProjectExclusion.objects.create(project=self.project, user_id=self.user.id)
        with self.feature("organizations:weekly-report-project-exclusions"):
            response = self.get_response(self.organization.slug, self.project.id)
        assert response.status_code == 204

    def test_not_found_when_no_exclusion(self) -> None:
        with self.feature("organizations:weekly-report-project-exclusions"):
            response = self.get_response(self.organization.slug, self.project.slug)
        assert response.status_code == 404

    def test_feature_flag_required(self) -> None:
        response = self.get_response(self.organization.slug, self.project.slug)
        assert response.status_code == 404

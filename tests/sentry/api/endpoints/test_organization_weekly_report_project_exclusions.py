from sentry.models.weeklyreportprojectexclusion import WeeklyReportProjectExclusion
from sentry.testutils.cases import APITestCase


class GetOrganizationWeeklyReportProjectExclusionsTest(APITestCase):
    endpoint = "sentry-api-0-organization-weekly-report-project-exclusions"
    method = "get"

    def setUp(self) -> None:
        self.login_as(user=self.user)

    def test_empty(self) -> None:
        response = self.get_success_response(self.organization.slug)
        assert response.data == []

    def test_returns_exclusions(self) -> None:
        project2 = self.create_project(organization=self.organization)
        exc1 = self.create_weekly_report_project_exclusion(
            project=self.project, user_id=self.user.id
        )
        exc2 = self.create_weekly_report_project_exclusion(project=project2, user_id=self.user.id)

        response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 2
        returned_ids = {item["id"] for item in response.data}
        assert returned_ids == {str(exc1.id), str(exc2.id)}

    def test_does_not_return_other_users_exclusions(self) -> None:
        other_user = self.create_user()
        self.create_weekly_report_project_exclusion(project=self.project, user_id=other_user.id)
        response = self.get_success_response(self.organization.slug)
        assert response.data == []

    def test_does_not_return_other_org_exclusions(self) -> None:
        other_org = self.create_organization(owner=self.user)
        other_project = self.create_project(organization=other_org)
        self.create_weekly_report_project_exclusion(project=other_project, user_id=self.user.id)
        response = self.get_success_response(self.organization.slug)
        assert response.data == []


class PutOrganizationWeeklyReportProjectExclusionsTest(APITestCase):
    endpoint = "sentry-api-0-organization-weekly-report-project-exclusions"
    method = "put"

    def setUp(self) -> None:
        self.login_as(user=self.user)

    def test_set_exclusions(self) -> None:
        project2 = self.create_project(organization=self.organization)
        response = self.get_response(
            self.organization.slug,
            projectIds=[self.project.id, project2.id],
        )
        assert response.status_code == 204
        assert WeeklyReportProjectExclusion.objects.filter(user_id=self.user.id).count() == 2

    def test_replace_exclusions(self) -> None:
        project2 = self.create_project(organization=self.organization)
        self.create_weekly_report_project_exclusion(project=self.project, user_id=self.user.id)
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
        self.create_weekly_report_project_exclusion(project=self.project, user_id=self.user.id)
        response = self.get_response(
            self.organization.slug,
            projectIds=[],
        )
        assert response.status_code == 204
        assert WeeklyReportProjectExclusion.objects.filter(user_id=self.user.id).count() == 0

    def test_does_not_affect_other_users(self) -> None:
        other_user = self.create_user()
        self.create_weekly_report_project_exclusion(project=self.project, user_id=other_user.id)
        self.get_response(
            self.organization.slug,
            projectIds=[self.project.id],
        )
        assert WeeklyReportProjectExclusion.objects.filter(user_id=other_user.id).count() == 1

    def test_invalid_project_ids_not_a_list(self) -> None:
        response = self.get_response(
            self.organization.slug,
            projectIds="not-a-list",
        )
        assert response.status_code == 400

    def test_invalid_project_ids_non_integers(self) -> None:
        response = self.get_response(
            self.organization.slug,
            projectIds=["not-a-number"],
        )
        assert response.status_code == 400

    def test_project_user_not_member_of(self) -> None:
        user = self.create_user()
        org = self.create_organization(flags=0)
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, role="member", teams=[team])
        member_project = self.create_project(organization=org, teams=[team])
        non_member_project = self.create_project(organization=org)
        self.login_as(user=user)
        response = self.get_response(
            org.slug,
            projectIds=[member_project.id, non_member_project.id],
        )
        assert response.status_code == 403

    def test_project_in_other_org(self) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        response = self.get_response(
            self.organization.slug,
            projectIds=[other_project.id],
        )
        assert response.status_code == 403

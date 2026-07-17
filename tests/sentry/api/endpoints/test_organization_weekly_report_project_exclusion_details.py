from sentry.models.weeklyreportprojectexclusion import WeeklyReportProjectExclusion
from sentry.testutils.cases import APITestCase


class DeleteOrganizationWeeklyReportProjectExclusionDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-weekly-report-project-exclusion-details"
    method = "delete"

    def setUp(self) -> None:
        self.login_as(user=self.user)

    def test_delete_by_slug(self) -> None:
        self.create_weekly_report_project_exclusion(project=self.project, user_id=self.user.id)
        response = self.get_response(self.organization.slug, self.project.slug)
        assert response.status_code == 204
        assert not WeeklyReportProjectExclusion.objects.filter(
            project=self.project, user_id=self.user.id
        ).exists()

    def test_delete_by_id(self) -> None:
        self.create_weekly_report_project_exclusion(project=self.project, user_id=self.user.id)
        response = self.get_response(self.organization.slug, self.project.id)
        assert response.status_code == 204

    def test_not_found_when_no_exclusion(self) -> None:
        response = self.get_response(self.organization.slug, self.project.slug)
        assert response.status_code == 404

    def test_project_user_not_member_of(self) -> None:
        user = self.create_user()
        org = self.create_organization(flags=0)
        team = self.create_team(organization=org)
        self.create_member(organization=org, user=user, role="member", teams=[team])
        non_member_project = self.create_project(organization=org)
        self.login_as(user=user)
        response = self.get_response(org.slug, non_member_project.slug)
        assert response.status_code == 403

    def test_project_in_other_org(self) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        response = self.get_response(self.organization.slug, other_project.slug)
        assert response.status_code == 403

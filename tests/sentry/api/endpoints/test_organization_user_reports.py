from datetime import datetime, timedelta


from sentry.models import GroupStatus, UserReport
from sentry.ingest.userreport import save_userreport
from sentry.testutils import APITestCase, SnubaTestCase


class OrganizationUserReportListTest(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-organization-user-feedback"
    method = "get"

    def setUp(self):
        super().setUp()
        self.user = self.create_user("test@test.com")
        self.login_as(user=self.user)
        self.org = self.create_organization()
        self.team = self.create_team(organization=self.org)
        self.create_member(teams=[self.team], user=self.user, organization=self.org)

        self.project_1 = self.create_project(organization=self.org, teams=[self.team], name="wat")
        self.project_2 = self.create_project(organization=self.org, teams=[self.team], name="who")
        self.group_1 = self.create_group(project=self.project_1)
        self.group_2 = self.create_group(project=self.project_1, status=GroupStatus.RESOLVED)
        self.env_1 = self.create_environment(name="prod", project=self.project_1)
        self.env_2 = self.create_environment(name="dev", project=self.project_1)

        self.report_1 = UserReport.objects.create(
            project_id=self.project_1.id,
            event_id="a" * 32,
            name="Foo",
            email="foo@example.com",
            comments="Hello world",
            group_id=self.group_1.id,
            environment_id=self.env_1.id,
        )

        # should not be included due to missing link
        UserReport.objects.create(
            project_id=self.project_1.id,
            event_id="b" * 32,
            name="Bar",
            email="bar@example.com",
            comments="Hello world",
        )

        self.report_resolved_1 = UserReport.objects.create(
            project_id=self.project_1.id,
            event_id="c" * 32,
            name="Baz",
            email="baz@example.com",
            comments="Hello world",
            group_id=self.group_2.id,
        )

        self.report_2 = UserReport.objects.create(
            project_id=self.project_2.id,
            event_id="d" * 32,
            name="Wat",
            email="wat@example.com",
            comments="Hello world",
            group_id=self.group_1.id,
            environment_id=self.env_2.id,
            date_added=datetime.now() - timedelta(days=7),
        )

    def run_test(self, expected, **params):
        response = self.get_response(self.project_1.organization.slug, **params)

        assert response.status_code == 200, response.content
        result_ids = {report["id"] for report in response.data}
        assert result_ids == {str(report.id) for report in expected}

    def test_no_filters(self):
        self.run_test([self.report_1, self.report_2])

    def test_project_filter(self):
        self.run_test([self.report_1], project=[self.project_1.id])
        self.run_test([self.report_2], project=[self.project_2.id])

    def test_environment_filter(self):
        self.run_test([self.report_1], environment=[self.env_1.name])
        self.run_test([self.report_2], environment=[self.env_2.name])

    def test_date_filter(self):
        self.run_test(
            [self.report_1],
            start=(datetime.now() - timedelta(days=1)).isoformat() + "Z",
            end=datetime.now().isoformat() + "Z",
        )
        self.run_test(
            [self.report_1, self.report_2],
            start=(datetime.now() - timedelta(days=8)).isoformat() + "Z",
            end=datetime.now().isoformat() + "Z",
        )
        self.run_test([self.report_1, self.report_2], statsPeriod="14d")

    def test_all_reports(self):
        self.run_test([self.report_1, self.report_2, self.report_resolved_1], status="")

    def test_new_project(self):
        org2 = self.create_organization()
        self.team = self.create_team(organization=org2)
        self.create_member(teams=[self.team], user=self.user, organization=org2)
        response = self.get_response(org2.slug)
        assert response.status_code == 200, response.content
        assert response.data == []

    def test_invalid_date_params(self):
        response = self.get_response(
            self.project_1.organization.slug, **{"start": "null", "end": "null"}
        )
        assert response.status_code == 400

    def test_with_event_user(self):
        event = self.store_event(
            data={
                "event_id": "d" * 32,
                "message": "oh no",
                "environment": self.env_1.name,
                "user": {"id": 1234, "email": "alice@example.com"},
            },
            project_id=self.project_1.id,
        )

        # Simulate how ingest saves reports to get event_user connections
        report_data = {
            "event_id": event.event_id,
            "name": "",
            "email": "",
            "comments": "It broke",
        }
        save_userreport(self.project_1, report_data)

        response = self.get_response(self.project_1.organization.slug, project=[self.project_1.id])
        assert response.status_code == 200
        assert response.data[0]["comments"] == "It broke"
        assert response.data[0]["user"]["name"] == "alice@example.com"
        assert response.data[0]["user"]["email"] == "alice@example.com"

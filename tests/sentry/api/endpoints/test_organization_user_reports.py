from __future__ import absolute_import

from datetime import datetime, timedelta

import six

from sentry.models import GroupStatus, UserReport
from sentry.testutils import APITestCase


class OrganizationUserReportListTest(APITestCase):
    endpoint = "sentry-api-0-organization-user-feedback"
    method = "get"

    def setUp(self):
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
            project=self.project_1,
            event_id="a" * 32,
            name="Foo",
            email="foo@example.com",
            comments="Hello world",
            group=self.group_1,
            environment=self.env_1,
        )

        # should not be included due to missing link
        UserReport.objects.create(
            project=self.project_1,
            event_id="b" * 32,
            name="Bar",
            email="bar@example.com",
            comments="Hello world",
        )

        self.report_resolved_1 = UserReport.objects.create(
            project=self.project_1,
            event_id="c" * 32,
            name="Baz",
            email="baz@example.com",
            comments="Hello world",
            group=self.group_2,
        )

        self.report_2 = UserReport.objects.create(
            project=self.project_2,
            event_id="d" * 32,
            name="Wat",
            email="wat@example.com",
            comments="Hello world",
            group=self.group_1,
            environment=self.env_2,
            date_added=datetime.now() - timedelta(days=7),
        )

    def run_test(self, expected, **params):
        response = self.get_response(self.project_1.organization.slug, **params)

        assert response.status_code == 200, response.content
        result_ids = set(report["id"] for report in response.data)
        assert result_ids == set(six.text_type(report.id) for report in expected)

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

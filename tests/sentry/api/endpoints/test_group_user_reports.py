from __future__ import absolute_import
from exam import fixture

from sentry.models import Environment, UserReport
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class GroupUserReport(APITestCase, SnubaTestCase):
    def setUp(self):
        super(GroupUserReport, self).setUp()
        self.project = self.create_project()
        self.env1 = self.create_environment(self.project, "production")
        self.env2 = self.create_environment(self.project, "staging")

        self.env1_events = self.create_events_for_environment(self.env1, 5)
        self.env2_events = self.create_events_for_environment(self.env2, 5)

        self.group = self.env1_events[0].group

        self.env1_userreports = self.create_user_report_for_events(
            self.project, self.group, self.env1_events, self.env1
        )
        self.env2_userreports = self.create_user_report_for_events(
            self.project, self.group, self.env2_events, self.env2
        )

    @fixture
    def path(self):
        return u"/api/0/groups/{}/user-feedback/".format(self.group.id)

    def create_environment(self, project, name):
        env = Environment.objects.create(
            project_id=project.id, organization_id=project.organization_id, name=name
        )
        env.add_project(project)
        return env

    def create_events_for_environment(self, environment, num_events):
        return [
            self.store_event(
                data={
                    "fingerprint": ["group-1"],
                    "tags": {"environment": environment.name},
                    "timestamp": iso_format(before_now(seconds=1)),
                },
                project_id=self.project.id,
            )
            for __i in range(num_events)
        ]

    def create_user_report_for_events(self, project, group, events, environment):
        reports = []
        for i, event in enumerate(events):
            reports.append(
                UserReport.objects.create(
                    group=group,
                    project=project,
                    event_id=event.event_id,
                    name="foo%d" % i,
                    email="bar%d@example.com" % i,
                    comments="It Broke!!!",
                    environment=environment,
                )
            )
        return reports

    def assert_same_userreports(self, response_data, userreports):
        assert sorted(int(r.get("id")) for r in response_data) == sorted(r.id for r in userreports)
        assert sorted(r.get("eventID") for r in response_data) == sorted(
            r.event_id for r in userreports
        )

    def test_specified_environment(self):
        self.login_as(user=self.user)

        response = self.client.get(self.path + "?environment=" + self.env1.name)
        assert response.status_code == 200, response.content
        assert len(response.data) == len(self.env1_events)
        self.assert_same_userreports(response.data, self.env1_userreports)

        response = self.client.get(self.path + "?environment=" + self.env2.name)
        assert response.status_code == 200, response.content
        assert len(response.data) == len(self.env2_events)
        self.assert_same_userreports(response.data, self.env2_userreports)

    def test_no_environment_does_not_exists(self):
        self.login_as(user=self.user)
        response = self.client.get(self.path + "?environment=")
        assert response.status_code == 200
        assert response.data == []

    def test_no_environment(self):
        self.login_as(user=self.user)

        empty_env = self.create_environment(self.project, u"")
        empty_env_events = self.create_events_for_environment(empty_env, 5)
        userreports = self.create_user_report_for_events(
            self.project, self.group, empty_env_events, empty_env
        )
        response = self.client.get(self.path + "?environment=")

        assert response.status_code == 200, response.content
        assert len(response.data) == len(userreports)
        self.assert_same_userreports(response.data, userreports)

    def test_all_environments(self):
        self.login_as(user=self.user)
        response = self.client.get(self.path)
        userreports = self.env1_userreports + self.env2_userreports

        assert response.status_code == 200, response.content
        assert len(response.data) == len(userreports)
        self.assert_same_userreports(response.data, userreports)

    def test_invalid_environment(self):
        self.login_as(user=self.user)
        response = self.client.get(self.path + "?environment=invalid_env")
        assert response.status_code == 200
        assert response.data == []

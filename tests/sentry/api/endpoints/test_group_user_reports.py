from __future__ import absolute_import
from sentry.testutils import UserReportEnvironmentTestCase
from exam import fixture


class GroupUserReport(UserReportEnvironmentTestCase):
    @fixture
    def path(self):
        return '/api/0/groups/{}/user-feedback/'.format(
            self.group.id,
        )

    def test_specified_enviroment(self):
        self.login_as(user=self.user)

        response = self.client.get(self.path + '?environment=' + self.env1.name)
        assert response.status_code == 200, response.content
        assert len(response.data) == len(self.env1_events)
        self.assert_same_userreports(response.data, self.env1_userreports)

        response = self.client.get(self.path + '?environment=' + self.env2.name)
        assert response.status_code == 200, response.content
        assert len(response.data) == len(self.env2_events)
        self.assert_same_userreports(response.data, self.env2_userreports)

    def test_no_environment_does_not_exists(self):
        self.login_as(user=self.user)
        response = self.client.get(self.path + '?environment=')
        assert response.status_code == 200
        assert response.data == []

    def test_no_environment(self):
        self.login_as(user=self.user)

        empty_env = self.create_environment(self.project, u'')
        empty_env_events = self.create_events_for_environment(self.group, empty_env, 5)
        userreports = self.create_user_report_for_events(
            self.project, self.group, empty_env_events, empty_env)
        response = self.client.get(self.path + '?environment=')

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
        response = self.client.get(self.path + '?environment=invalid_env')
        assert response.status_code == 200
        assert response.data == []

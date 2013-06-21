import mock

from django.core.urlresolvers import reverse

from sentry.models import Team
from sentry.testutils import TestCase, fixture, before
from sentry.plugins.helpers import set_option


class DashboardTest(TestCase):
    @before
    def login_user(self):
        self.login()

    @fixture
    def path(self):
        return reverse('sentry')

    @mock.patch('sentry.web.frontend.generic.can_create_teams')
    def test_redirects_to_new_team_when_possible(self, can_create_teams):
        can_create_teams.return_value = True

        resp = self.client.get(self.path)

        can_create_teams.assert_called_once_with(self.user)
        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + reverse('sentry-new-team')

    @mock.patch('sentry.web.frontend.generic.can_create_teams', mock.Mock(return_value=True))
    def test_shows_team_selector_with_single(self):
        Team.objects.create(name='test', owner=self.user)

        resp = self.client.get(self.path)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/select_team.html')

    @mock.patch('sentry.web.frontend.generic.can_create_teams', mock.Mock(return_value=True))
    def test_renders_team_selector_with_multiple(self):
        Team.objects.create(name='test', owner=self.user)
        Team.objects.create(name='test2', owner=self.user)

        resp = self.client.get(self.path)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/select_team.html')

    @mock.patch('sentry.web.frontend.generic.can_create_teams', mock.Mock(return_value=False))
    def test_shows_error_when_no_teams_and_cannot_create(self):
        resp = self.client.get(self.path)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/generic_error.html')
        assert 'title' in resp.context
        assert 'message' in resp.context


class UpdateAvailableTest(TestCase):

    UPDATE_MESSAGE = "You're running a year old version of Sentry"

    @before
    def login_user(self):
        Team.objects.create(name='test', owner=self.user)
        self.login()

    @fixture
    def path(self):
        return reverse('sentry')

    def test_update_is_available(self):
        resp = self.client.get(self.path)
        assert self.UPDATE_MESSAGE not in resp.content

    def test_update_is_not_available(self):
        set_option('sentry:latest_version', '5.5.1')

        with mock.patch('sentry.get_version') as get_version:
            get_version.return_value = '5.5.0'
            resp = self.client.get(self.path)
            assert self.UPDATE_MESSAGE in resp.content

from __future__ import absolute_import

import mock

from django.core.urlresolvers import reverse

from sentry.models import Team, TeamStatus
from sentry.testutils import TestCase


class RemoveTeamTest(TestCase):
    def setUp(self):
        super(RemoveTeamTest, self).setUp()
        owner = self.create_user(email='example@example.com')
        organization = self.create_organization(owner=owner)
        self.team = self.create_team(name='bar', organization=organization)
        self.path = reverse('sentry-remove-team', args=[organization.slug, self.team.slug])
        self.login_as(self.organization.owner)

    @mock.patch('sentry.web.frontend.remove_team.can_remove_team', mock.Mock(return_value=True))
    def test_does_load(self):
        resp = self.client.get(self.path)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/teams/remove.html')

    @mock.patch('sentry.web.frontend.remove_team.can_remove_team', mock.Mock(return_value=False))
    def test_missing_permission(self):
        resp = self.client.post(self.path)

        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + reverse('sentry')

    @mock.patch('sentry.web.frontend.remove_team.can_remove_team', mock.Mock(return_value=True))
    def test_valid_params(self):
        resp = self.client.post(self.path)

        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + reverse('sentry')

        team = Team.objects.get(id=self.team.id)

        assert team.status == TeamStatus.PENDING_DELETION

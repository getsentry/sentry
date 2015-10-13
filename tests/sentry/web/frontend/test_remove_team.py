from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Team, TeamStatus
from sentry.testutils import TestCase, PermissionTestCase


class RemoveTeamPermissionTest(PermissionTestCase):
    def setUp(self):
        super(RemoveTeamPermissionTest, self).setUp()
        self.path = reverse('sentry-remove-team', args=[self.organization.slug, self.team.slug])

    def test_teamless_admin_cannot_load(self):
        self.assert_teamless_admin_cannot_access(self.path)

    def test_team_admin_can_load(self):
        self.assert_team_admin_can_access(self.path)

    def test_owner_can_load(self):
        self.assert_owner_can_access(self.path)


class RemoveTeamTest(TestCase):
    def setUp(self):
        super(RemoveTeamTest, self).setUp()
        self.owner = self.create_user(email='example@example.com')
        self.organization = self.create_organization(owner=self.owner)
        self.team = self.create_team(name='bar', organization=self.organization)
        self.path = reverse('sentry-remove-team', args=[self.organization.slug, self.team.slug])
        self.login_as(self.owner)

    def test_does_load(self):
        resp = self.client.get(self.path)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/teams/remove.html')

    def test_valid_params(self):
        resp = self.client.post(self.path)

        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + reverse('sentry')

        team = Team.objects.get(id=self.team.id)

        assert team.status == TeamStatus.PENDING_DELETION

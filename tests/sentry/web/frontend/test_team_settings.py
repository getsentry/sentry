from __future__ import absolute_import

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.models import Team
from sentry.testutils import TestCase, PermissionTestCase


class TeamSettingsPermissionTest(PermissionTestCase):
    def setUp(self):
        super(TeamSettingsPermissionTest, self).setUp()
        self.path = reverse('sentry-manage-team', args=[self.organization.slug, self.team.slug])

    def test_team_admin_can_load(self):
        self.assert_team_admin_can_access(self.path)

    def test_team_member_cannot_load(self):
        self.assert_team_member_cannot_access(self.path)

    def test_org_admin_can_load(self):
        self.assert_org_admin_can_access(self.path)

    def test_org_member_cannot_load(self):
        self.assert_org_member_cannot_access(self.path)


class TeamSettingsTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-manage-team', args=[self.organization.slug, self.team.slug])

    def test_renders_with_context(self):
        self.login_as(self.user)
        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/teams/manage.html')
        assert resp.context['team'] == self.team

    def test_valid_params(self):
        self.login_as(self.user)
        resp = self.client.post(self.path, {
            'name': 'bar',
            'slug': self.team.slug,
        })
        assert resp.status_code == 302
        self.assertEquals(resp['Location'], 'http://testserver' + self.path)
        team = Team.objects.get(pk=self.team.pk)
        self.assertEquals(team.name, 'bar')

from __future__ import absolute_import

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.models import Team, TeamMemberType
from sentry.testutils import TestCase


class TeamSettingsTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-manage-team', args=[self.team.slug])

    def test_renders_with_context(self):
        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/teams/manage.html')
        assert resp.context['team'] == self.team

    def test_valid_params(self):
        resp = self.client.post(self.path, {
            'name': 'bar',
            'slug': self.team.slug,
            'owner': self.team.owner.username,
        })
        assert resp.status_code == 302
        self.assertEquals(resp['Location'], 'http://testserver' + self.path)
        team = Team.objects.get(pk=self.team.pk)
        self.assertEquals(team.name, 'bar')

    def test_superuser_can_set_owner(self):
        user2 = self.create_user(username='other@example.com')

        resp = self.client.post(self.path, {
            'name': self.team.name,
            'slug': self.team.slug,
            'owner': user2.username,
        })
        assert resp.status_code == 302

        team = Team.objects.get(id=self.team.id)

        assert team.owner == user2

        members = [(t.user, t.type) for t in self.team.member_set.all()]

        assert (user2, TeamMemberType.ADMIN) in members
        assert (self.user, TeamMemberType.ADMIN) in members

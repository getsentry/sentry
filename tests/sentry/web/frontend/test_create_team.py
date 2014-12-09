from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Team
from sentry.testutils import TestCase


class CreateTeamTest(TestCase):
    def test_renders_with_context(self):
        organization = self.create_organization()
        path = reverse('sentry-create-team', args=[organization.slug])
        self.login_as(self.user)
        resp = self.client.get(path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/create-team.html')
        assert resp.context['organization'] == organization
        assert resp.context['form']

    def test_valid_params(self):
        organization = self.create_organization()
        path = reverse('sentry-create-team', args=[organization.slug])
        self.login_as(self.user)
        resp = self.client.post(path, {
            'name': 'bar',
        })
        assert resp.status_code == 302

        team = Team.objects.get(organization=organization, name='bar')

        assert team.name == 'bar'

        redirect_uri = reverse('sentry-create-project', args=[organization.slug])
        assert resp['Location'] == 'http://testserver%s?team=%s' % (redirect_uri, team.slug)

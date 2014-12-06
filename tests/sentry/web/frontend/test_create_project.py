from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Project
from sentry.testutils import TestCase


class CreateProjectTest(TestCase):
    def test_renders_with_context(self):
        organization = self.create_organization()
        team = self.create_team(organization=organization)
        path = reverse('sentry-create-project', args=[organization.id])
        self.login_as(self.user)
        resp = self.client.get(path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/create-project.html')
        assert resp.context['organization'] == organization
        assert resp.context['form']

    def test_valid_params(self):
        organization = self.create_organization()
        team = self.create_team(organization=organization, name='Foo', slug='foo')
        path = reverse('sentry-create-project', args=[organization.id])
        self.login_as(self.user)
        resp = self.client.post(path, {
            'name': 'bar',
            'team': team.slug,
            'platform': 'python',
        })
        assert resp.status_code == 302, resp.context['form'].errors

        project = Project.objects.get(team__organization=organization, name='bar')

        assert project.platform == 'python'
        assert project.team == team

        redirect_uri = reverse('sentry-docs-client', args=[team.slug, project.slug, project.platform])
        assert resp['Location'] == 'http://testserver' + redirect_uri

from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Project
from sentry.testutils import TestCase, PermissionTestCase
from sentry.utils.http import absolute_uri


class CreateProjectPermissionTest(PermissionTestCase):
    def setUp(self):
        super(CreateProjectPermissionTest, self).setUp()
        self.path = reverse('sentry-create-project', args=[self.organization.slug])

    def test_non_member_cannot_load(self):
        self.assert_non_member_cannot_access(self.path)

    def test_teamless_admin_cannot_load(self):
        self.assert_teamless_admin_cannot_access(self.path)

    def test_team_admin_can_load(self):
        self.assert_team_admin_can_access(self.path)

    def test_member_cannot_load(self):
        self.assert_member_cannot_access(self.path)

    def test_owner_can_load(self):
        self.assert_owner_can_access(self.path)


class CreateProjectTest(TestCase):
    def test_renders_with_context(self):
        organization = self.create_organization()
        self.create_team(organization=organization)
        path = reverse('sentry-create-project', args=[organization.slug])
        self.login_as(self.user)
        resp = self.client.get(path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/create-project.html')
        assert resp.context['organization'] == organization
        assert resp.context['form']

    def test_implicit_single_team(self):
        organization = self.create_organization()
        team = self.create_team(organization=organization, name='Foo', slug='foo')
        path = reverse('sentry-create-project', args=[organization.slug])
        self.login_as(self.user)
        resp = self.client.post(path, {
            'name': 'bar',
        })
        assert resp.status_code == 302, resp.context['form'].errors

        project = Project.objects.get(team__organization=organization, name='bar')

        assert project.team == team

        redirect_uri = '/{}/{}/getting-started/'.format(organization.slug, project.slug)
        assert resp['Location'] == absolute_uri(redirect_uri)

    def test_multiple_teams(self):
        organization = self.create_organization()
        team = self.create_team(organization=organization, name='Foo', slug='foo')
        team = self.create_team(organization=organization, name='Bar', slug='bar')
        path = reverse('sentry-create-project', args=[organization.slug])
        self.login_as(self.user)
        resp = self.client.post(path, {
            'name': 'bar',
            'team': team.slug,
        })
        assert resp.status_code == 302, resp.context['form'].errors

        project = Project.objects.get(team__organization=organization, name='bar')

        assert project.team == team

        redirect_uri = '/{}/{}/getting-started/'.format(organization.slug, project.slug)
        assert resp['Location'] == absolute_uri(redirect_uri)

from __future__ import absolute_import

from django import forms
from django.core.urlresolvers import reverse
from exam import fixture

from sentry.models import Project
from sentry.testutils import TestCase
from sentry.web.frontend.project_settings import OriginsField


class OriginsFieldTest(TestCase):
    @fixture
    def field(self):
        return OriginsField()

    def test_supports_wildcards(self):
        value = '*'
        result = self.field.clean(value)
        self.assertEquals(result, ['*'])

    def test_supports_wildcard_domains(self):
        value = '*.example.com'
        result = self.field.clean(value)
        self.assertEquals(result, ['*.example.com'])

    def test_supports_base_domains(self):
        value = 'example.com'
        result = self.field.clean(value)
        self.assertEquals(result, ['example.com'])

    def test_does_not_support_port(self):
        value = 'http://example.com:80'
        with self.assertRaises(forms.ValidationError):
            self.field.clean(value)

        value = 'example.com:80'
        with self.assertRaises(forms.ValidationError):
            self.field.clean(value)

    def test_doesnt_support_domain_with_port(self):
        value = 'example.com:80'
        with self.assertRaises(forms.ValidationError):
            self.field.clean(value)

    def test_doesnt_support_wildcard_domain_with_port(self):
        value = '*.example.com:80'
        with self.assertRaises(forms.ValidationError):
            self.field.clean(value)

    def test_supports_localhost(self):
        value = 'localhost'
        result = self.field.clean(value)
        self.assertEquals(result, ['localhost'])


class ProjectSettingsTest(TestCase):
    def setUp(self):
        super(ProjectSettingsTest, self).setUp()
        self.owner = self.create_user()
        self.organization = self.create_organization(owner=self.owner)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(team=self.team)

    @fixture
    def path(self):
        return reverse('sentry-manage-project', args=[self.organization.slug, self.project.slug])

    def test_renders_with_context(self):
        self.login_as(self.owner)
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/projects/manage.html')
        assert resp.context['project'] == self.project

    def test_valid_params(self):
        self.login_as(self.owner)
        resp = self.client.post(self.path, {
            'name': 'bar',
            'slug': self.project.slug,
            'team': self.team.id,
            'scrub_data': '1',
            'token': 'foobar',
        })
        assert resp.status_code == 302
        self.assertEquals(resp['Location'], 'http://testserver' + self.path)
        project = Project.objects.get(id=self.project.id)
        assert project.name == 'bar'

from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Project, Team
from sentry.testutils import TestCase
from sentry.web.frontend.create_team import NewTeamForm, NewProjectForm


class CreateTeamTest(TestCase):
    def test_step_0_renders(self):
        organization = self.create_organization()
        path = reverse('sentry-create-team', args=[organization.slug])
        self.login_as(self.user)
        resp = self.client.get(path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/create-team-step-0.html')
        assert resp.context['organization'] == organization
        assert resp.context['step'] == 0
        assert resp.context['form']
        assert type(resp.context['form']) == NewTeamForm

    def test_step_0_valid_params(self):
        organization = self.create_organization()
        path = reverse('sentry-create-team', args=[organization.slug])
        self.login_as(self.user)
        resp = self.client.post(path, {
            'op': 'submit',
            'step': '0',
            'ctwizard-0-name': 'bar',
        })
        assert resp.status_code == 200
        assert resp.context['step'] == 1, resp.context['form'].errors

    def test_step_1_renders(self):
        organization = self.create_organization()

        path = reverse('sentry-create-team', args=[organization.slug])

        self.login_as(self.user)

        self.session['ctwizard'] = {'step0': {'name': 'bar'}}
        self.save_session()

        resp = self.client.post(path, {'step': '1'})

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/create-team-step-1.html')
        assert resp.context['organization'] == organization
        assert resp.context['step'] == 1
        assert resp.context['form']
        # assert type(resp.context['form']) == NewProjectForm

    def test_step_1_valid_params(self):
        organization = self.create_organization()

        path = reverse('sentry-create-team', args=[organization.slug])

        self.login_as(self.user)

        self.session['ctwizard'] = {'step0': {'name': 'bar'}}
        self.save_session()

        resp = self.client.post(path, {
            'op': 'submit',
            'step': '1',
        })
        assert resp.status_code == 200
        assert resp.context['step'] == 2, resp.context['form'].errors

    def test_step_2_renders(self):
        organization = self.create_organization()

        path = reverse('sentry-create-team', args=[organization.slug])

        self.login_as(self.user)

        self.session['ctwizard'] = {
            'step0': {'name': 'bar'},
            'step1': {},
        }
        self.save_session()

        resp = self.client.post(path, {'step': '2'})

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/create-team-step-2.html')
        assert resp.context['organization'] == organization
        assert resp.context['step'] == 2
        assert resp.context['form']
        assert type(resp.context['form']) == NewProjectForm

    def test_step_2_valid_params(self):
        organization = self.create_organization()

        path = reverse('sentry-create-team', args=[organization.slug])

        self.login_as(self.user)

        self.session['ctwizard'] = {
            'step0': {'name': 'bar'},
            'step1': {},
        }
        self.save_session()

        resp = self.client.post(path, {
            'op': 'submit',
            'step': '2',
            'ctwizard-2-name': 'bar',
            'ctwizard-2-platform': 'python',
        })
        assert resp.status_code == 302

        team = Team.objects.get(organization=organization)

        assert team.name == 'bar'

        project = Project.objects.get(team=team)

        assert project.name == 'bar'
        assert project.platform == 'python'

        redirect_uri = reverse('sentry-docs-client', args=[
            organization.slug, project.slug, project.platform
        ])

        assert resp['Location'] == 'http://testserver%s' % (redirect_uri,)

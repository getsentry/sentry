from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Project, Team
from sentry.testutils import TestCase
from sentry.web.frontend.create_team import AddTeamForm, AddProjectForm


class CreateTeamTest(TestCase):
    def test_step_0_renders(self):
        organization = self.create_organization()
        path = reverse('sentry-create-team', args=[organization.slug])
        self.login_as(self.user)
        resp = self.client.get(path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/create-team-step-team.html')
        assert resp.context['organization'] == organization
        assert resp.context['step'] == 0
        assert resp.context['form']
        assert type(resp.context['form']) == AddTeamForm

    def test_step_0_valid_params(self):
        organization = self.create_organization()
        path = reverse('sentry-create-team', args=[organization.slug])
        self.login_as(self.user)
        resp = self.client.post(path, {
            'op': 'continue',
            'step': '0',
            'ctwizard-0-name': 'bar',
        })
        assert resp.status_code == 200
        assert resp.context['step'] == 1, resp.context['form'].errors

    def test_step_1_renders(self):
        organization = self.create_organization()

        path = reverse('sentry-create-team', args=[organization.slug])

        self.login_as(self.user)

        self.session['ctwizard'] = {
            'step0': {'name': 'bar'},
        }
        self.save_session()

        resp = self.client.post(path, {'step': '1'})

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/create-team-step-project.html')
        assert resp.context['organization'] == organization
        assert resp.context['step'] == 1
        assert resp.context['form']
        assert type(resp.context['form']) == AddProjectForm

    def test_step_2_valid_params(self):
        organization = self.create_organization()

        path = reverse('sentry-create-team', args=[organization.slug])

        self.login_as(self.user)

        self.session['ctwizard'] = {
            'step0': {'name': 'bar'},
        }
        self.save_session()

        resp = self.client.post(path, {
            'op': 'continue',
            'step': '1',
            'ctwizard-1-name': 'bar',
            'ctwizard-1-platform': 'python',
        })
        assert resp.status_code == 302

        team = Team.objects.get(organization=organization)

        assert team.name == 'bar'

        project = Project.objects.get(team=team)

        assert project.name == 'bar'
        assert project.platform == 'python'

        redirect_uri = reverse('sentry-stream', args=[organization.slug, project.slug])

        assert resp['Location'] == 'http://testserver%s?newinstall=1' % (redirect_uri,)

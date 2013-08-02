# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock
import logging

from django.core.urlresolvers import reverse

from sentry.constants import STATUS_HIDDEN
from sentry.models import Project, ProjectKey
from sentry.testutils import TestCase, fixture, before

logger = logging.getLogger(__name__)


class ManageProjectKeysTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-manage-project-keys', args=[self.team.slug, self.project.id])

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path)

    def test_renders_with_required_context(self):
        self.login_as(self.user)

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/projects/keys.html')
        assert 'key_list' in resp.context
        assert 'can_add_key' in resp.context


class NewProjectKeyTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-new-project-key', args=[self.team.slug, self.project.id])

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path)

    @mock.patch('sentry.models.ProjectKey.objects.create')
    def test_generates_new_key_and_redirects(self, create):
        self.login_as(self.user)

        resp = self.client.get(self.path)
        assert resp.status_code == 302
        create.assert_any_call(
            project=self.project, user_added=self.user
        )


class RemoveProjectKeyTest(TestCase):
    @before
    def create_key(self):
        self.key = ProjectKey.objects.create(project=self.project)

    @fixture
    def path(self):
        return reverse('sentry-remove-project-key', args=[self.team.slug, self.project.id, self.key.id])

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path, 'POST')

    def test_does_not_respond_to_get(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 405

    def test_removes_key_and_redirects(self):
        self.login_as(self.user)

        resp = self.client.post(self.path)
        assert resp.status_code == 302
        assert not ProjectKey.objects.filter(id=self.key.id).exists()


class DashboardTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry', args=[self.team.slug])

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path)

    @mock.patch('sentry.web.frontend.groups.can_create_projects')
    def test_redirects_to_create_project_if_none_and_can_create_projects(self, can_create_projects):
        self.login_as(self.user)

        can_create_projects.return_value = True

        resp = self.client.get(self.path)

        can_create_projects.assert_called_once_with(self.user, team=self.team)

        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + reverse('sentry-new-project', args=[self.team.slug])

    @mock.patch('sentry.web.frontend.groups.can_create_projects')
    def test_does_not_reidrect_if_missing_project_permission(self, can_create_projects):
        self.login_as(self.user)

        can_create_projects.return_value = False

        resp = self.client.get(self.path)

        can_create_projects.assert_called_once_with(self.user, team=self.team)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/dashboard.html')

    @mock.patch('sentry.web.frontend.groups.can_create_projects')
    def test_does_not_redirect_if_has_projects(self, can_create_projects):
        self.login_as(self.user)

        # HACK: force creation
        self.project

        resp = self.client.get(self.path)

        assert not can_create_projects.called

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/dashboard.html')
        assert resp.context['team'] == self.team
        assert resp.context['project_list'] == [self.project]


class GetStartedTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-get-started', args=[self.team.slug, self.project.slug])

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path)

    def test_renders_with_required_context(self):
        self.login_as(self.user)

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/get_started.html')
        assert resp.context['project'] == self.project
        assert resp.context['team'] == self.team


class RemoveProjectTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-remove-project', args=[self.team.slug, self.project.id])

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path, 'POST')

    def test_renders_template_with_get(self):
        self.login_as(self.user)

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/projects/remove.html')
        assert resp.context['team'] == self.team
        assert resp.context['project'] == self.project

    @mock.patch('sentry.tasks.deletion.delete_project')
    def test_deletion_flow(self, delete_project):
        self.login_as(self.user)

        # missing password
        resp = self.client.post(self.path, {'removal_type': '1', 'project': self.project.id})
        assert resp.status_code == 200
        assert 'password' in resp.context['form'].errors

        # set password to empty value so it doesnt require check
        self.user.password = ''
        self.user.save()

        resp = self.client.post(self.path, {'removal_type': '1', 'project': self.project.id})
        assert resp.status_code == 302
        delete_project.delay.assert_called_once_with(object_id=self.project.id)
        assert Project.objects.get(id=self.project.id).status == STATUS_HIDDEN

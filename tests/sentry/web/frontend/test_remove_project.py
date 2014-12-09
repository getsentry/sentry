from __future__ import absolute_import

import mock

from django.core.urlresolvers import reverse

from sentry.constants import STATUS_HIDDEN
from sentry.models import Project
from sentry.testutils import TestCase


class RemoveProjectTest(TestCase):
    def setUp(self):
        super(RemoveProjectTest, self).setUp()
        self.owner = self.create_user(email='example@example.com', is_superuser=False)
        organization = self.create_organization(owner=self.owner)
        self.team = self.create_team(name='bar', organization=organization)
        self.project = self.create_project(name='bar', team=self.team)
        self.path = reverse('sentry-remove-project', args=[organization.slug, self.project.slug])

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path, 'POST')

    def test_renders_template_with_get(self):
        self.login_as(self.owner)

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/projects/remove.html')
        assert resp.context['team'] == self.team
        assert resp.context['project'] == self.project

    @mock.patch('sentry.web.frontend.remove_project.delete_project')
    def test_deletion_flow(self, delete_project):
        self.login_as(self.owner)

        resp = self.client.post(self.path, {})
        assert resp.status_code == 302
        delete_project.delay.assert_called_once_with(
            object_id=self.project.id)
        assert Project.objects.get(id=self.project.id).status == STATUS_HIDDEN

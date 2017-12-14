from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import TestCase, PermissionTestCase


class TransferProjectPermissionTest(PermissionTestCase):
    def setUp(self):
        super(TransferProjectPermissionTest, self).setUp()
        self.project = self.create_project(teams=[self.team])
        self.path = reverse(
            'sentry-transfer-project', args=[self.organization.slug, self.project.slug]
        )

    def test_teamless_admin_cannot_load(self):
        self.assert_teamless_admin_cannot_access(self.path)

    def test_team_admin_can_load(self):
        self.assert_team_admin_can_access(self.path)

    def test_owner_can_load(self):
        self.assert_owner_can_access(self.path)


class TransferProjectTest(TestCase):
    def setUp(self):
        super(TransferProjectTest, self).setUp()
        self.owner = self.create_user(email='example@example.com', is_superuser=False)
        organization = self.create_organization(owner=self.owner)
        self.team = self.create_team(name='bar', organization=organization)
        self.project = self.create_project(name='bar', teams=[self.team])
        self.path = reverse('sentry-transfer-project', args=[organization.slug, self.project.slug])

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path, 'POST')

    def test_renders_template_with_get(self):
        self.login_as(self.owner)

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/projects/transfer.html')
        assert resp.context['project'] == self.project

    def test_deletion_flow(self):
        self.login_as(self.owner)
        email = self.owner.email

        resp = self.client.post(
            self.path, format='json', data={
                'email': email,
            }
        )
        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + \
            reverse('sentry-organization-home', args=[self.team.organization.slug])

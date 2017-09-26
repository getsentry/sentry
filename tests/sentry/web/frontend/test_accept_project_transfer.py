from __future__ import absolute_import

from uuid import uuid4
from six.moves.urllib.parse import urlencode
from django.core.urlresolvers import reverse
from sentry.utils.signing import sign

from sentry.testutils import TestCase, PermissionTestCase


class AcceptTransferProjectPermissionTest(PermissionTestCase):
    def setUp(self):
        super(AcceptTransferProjectPermissionTest, self).setUp()
        self.project = self.create_project(team=self.team)
        self.path = reverse('sentry-accept-project-transfer')

    def test_team_admin_cannot_load(self):
        self.assert_team_admin_cannot_access(self.path)


class AcceptTransferProjectTest(TestCase):
    def setUp(self):
        super(AcceptTransferProjectTest, self).setUp()
        self.owner = self.create_user(email='example@example.com', is_superuser=False)
        self.from_organization = self.create_organization(owner=self.owner)
        self.to_organization = self.create_organization(owner=self.owner)
        self.from_team = self.create_team(name='bar', organization=self.from_organization)
        user = self.create_user('admin@example.com')
        self.member = self.create_member(
            organization=self.from_organization,
            user=user,
            role='admin',
            teams=[self.from_team],
        )
        self.project = self.create_project(name='bar', team=self.from_team)
        self.path = reverse('sentry-accept-project-transfer')

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path, 'POST')

    def test_invalid_urldata_errors(self):
        self.login_as(self.owner)

    def test_renders_template_with_signed_link(self):
        self.login_as(self.owner)
        transaction_id = uuid4().hex
        url_data = sign(
            actor_id=self.member.id,
            from_organization_id=self.from_organization.id,
            project_id=self.project.id,
            user_id=self.owner.id,
            transaction_id=transaction_id)

        resp = self.client.get(self.path + '?' + urlencode({'data': url_data}))
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/projects/accept_project_transfer.html')
        assert resp.context['project'] == self.project

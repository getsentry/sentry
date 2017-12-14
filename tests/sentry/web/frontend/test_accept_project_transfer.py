from __future__ import absolute_import

from uuid import uuid4
from six.moves.urllib.parse import urlencode
from django.core.urlresolvers import reverse
from sentry.utils.signing import sign
from sentry.models import Project

from sentry.testutils import TestCase, PermissionTestCase


class AcceptTransferProjectPermissionTest(PermissionTestCase):
    def setUp(self):
        super(AcceptTransferProjectPermissionTest, self).setUp()
        self.project = self.create_project(teams=[self.team])
        self.path = reverse('sentry-accept-project-transfer')

    def test_team_admin_cannot_load(self):
        self.assert_team_admin_cannot_access(self.path)


class AcceptTransferProjectTest(TestCase):
    def setUp(self):
        super(AcceptTransferProjectTest, self).setUp()
        self.owner = self.create_user(email='example@example.com', is_superuser=False)
        self.from_organization = self.create_organization(name='love', owner=self.owner)
        self.to_organization = self.create_organization(name='lust', owner=self.owner)
        self.from_team = self.create_team(name='bar', organization=self.from_organization)
        self.to_team = self.create_team(name='bub', organization=self.to_organization)
        user = self.create_user('admin@example.com')
        self.member = self.create_member(
            organization=self.from_organization,
            user=user,
            role='admin',
            teams=[self.from_team],
        )
        self.project = self.create_project(name='proj', teams=[self.from_team])
        self.transaction_id = uuid4().hex
        self.path = reverse('sentry-accept-project-transfer')

    def test_requires_authentication(self):
        self.assertRequiresAuthentication(self.path, 'POST')

    def test_handle_incorrect_url_data(self):
        self.login_as(self.owner)
        url_data = sign(
            actor_id=self.member.id,
            # This is bad data
            from_organization_id=9999999,
            project_id=self.project.id,
            user_id=self.owner.id,
            transaction_id=self.transaction_id)
        resp = self.client.get(self.path + '?' + urlencode({'data': url_data}))
        assert resp.status_code == 302
        resp = self.client.get(self.path)
        assert resp.status_code == 404

    def test_renders_template_with_signed_link(self):
        self.login_as(self.owner)
        url_data = sign(
            actor_id=self.member.user_id,
            from_organization_id=self.from_organization.id,
            project_id=self.project.id,
            user_id=self.owner.id,
            transaction_id=self.transaction_id)

        resp = self.client.get(self.path + '?' + urlencode({'data': url_data}))
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/projects/accept_project_transfer.html')
        assert resp.context['project'] == self.project

    def test_transfers_project_to_correct_organization(self):
        self.login_as(self.owner)
        url_data = sign(
            actor_id=self.member.user_id,
            from_organization_id=self.from_organization.id,
            project_id=self.project.id,
            user_id=self.owner.id,
            transaction_id=self.transaction_id)

        url = self.path + '?' + urlencode({'data': url_data})
        resp = self.client.post(url, data={'team': self.to_team.id})
        assert resp['location'] == 'http://testserver' + \
            reverse('sentry-organization-home', args=[self.to_team.organization.slug])

        p = Project.objects.get(id=self.project.id)
        assert p.organization_id == self.to_organization.id
        assert p.team_id == self.to_team.id

    def test_non_owner_cannot_transfer_project(self):
        rando_user = self.create_user(email='blipp@bloop.com', is_superuser=False)
        rando_org = self.create_organization(name='supreme beans')

        self.login_as(rando_user)
        url_data = sign(
            actor_id=self.member.user_id,
            from_organization_id=rando_org.id,
            project_id=self.project.id,
            user_id=rando_user.id,
            transaction_id=self.transaction_id)

        url = self.path + '?' + urlencode({'data': url_data})
        resp = self.client.post(url, data={'team': self.to_team.id})
        assert resp.status_code == 302
        p = Project.objects.get(id=self.project.id)
        assert p.organization_id == self.from_organization.id

    def test_cannot_transfer_project_twice_from_same_org(self):
        self.login_as(self.owner)
        url_data = sign(
            actor_id=self.member.user_id,
            from_organization_id=self.from_organization.id,
            project_id=self.project.id,
            user_id=self.owner.id,
            transaction_id=self.transaction_id)

        url = self.path + '?' + urlencode({'data': url_data})
        resp = self.client.post(url, data={'team': self.to_team.id})
        assert resp['location'] == 'http://testserver' + \
            reverse('sentry-organization-home', args=[self.to_team.organization.slug])
        resp = self.client.get(url)
        assert resp.status_code == 302

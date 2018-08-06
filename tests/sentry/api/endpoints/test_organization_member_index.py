from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.core import mail

from sentry.testutils import APITestCase
from sentry.models import OrganizationMember, OrganizationMemberTeam
from sentry.testutils.helpers import Feature


class OrganizationMemberListTest(APITestCase):
    def setUp(self):
        self.owner_user = self.create_user('foo@localhost', username='foo')
        self.user_2 = self.create_user('bar@localhost', username='bar')
        self.create_user('baz@localhost', username='baz')

        self.org = self.create_organization(owner=self.owner_user)
        self.org.member_set.create(user=self.user_2)
        self.team = self.create_team(organization=self.org)

        self.login_as(user=self.owner_user)

        self.url = reverse(
            'sentry-api-0-organization-member-index', kwargs={
                'organization_slug': self.org.slug,
            }
        )

    def test_simple(self):
        response = self.client.get(self.url)

        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]['email'] == self.user_2.email
        assert response.data[1]['email'] == self.owner_user.email

    def test_empty_query(self):
        response = self.client.get(self.url + "?query=")

        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]['email'] == self.user_2.email
        assert response.data[1]['email'] == self.owner_user.email

    def test_query(self):
        response = self.client.get(self.url + "?query=bar")

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['email'] == "bar@localhost"

    def test_query_null_user(self):
        OrganizationMember.objects.create(email="billy@localhost", organization=self.org)
        response = self.client.get(self.url + "?query=bill")

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['email'] == "billy@localhost"

    def test_email_query(self):
        response = self.client.get(self.url + "?query=email:foo@localhost")

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['email'] == self.owner_user.email

    def test_user_email_email_query(self):
        self.create_useremail(self.owner_user, 'baz@localhost')
        response = self.client.get(self.url + "?query=email:baz@localhost")

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['email'] == self.owner_user.email

    def test_owner_invites(self):
        self.login_as(user=self.owner_user)
        response = self.client.post(
            self.url, {
                'email': 'eric@localhost', 'role': 'owner', 'teams': [self.team.slug]
            })

        assert response.status_code == 201
        assert response.data['email'] == 'eric@localhost'

    def test_valid_for_invites(self):
        self.login_as(user=self.owner_user)

        with self.settings(SENTRY_ENABLE_INVITES=True), self.tasks():
            resp = self.client.post(
                self.url,
                {'email': 'foo@example.com',
                 'role': 'admin',
                 'teams': [
                     self.team.slug,
                 ]}
            )
        assert resp.status_code == 201

        member = OrganizationMember.objects.get(
            organization=self.org,
            email='foo@example.com',
        )

        assert member.user is None
        assert member.role == 'admin'

        om_teams = OrganizationMemberTeam.objects.filter(
            organizationmember=member.id)

        assert len(om_teams) == 1
        assert om_teams[0].team_id == self.team.id

        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ['foo@example.com']
        assert mail.outbox[0].subject == 'Join {} in using Sentry'.format(
            self.org.name)

    def test_existing_user_for_invite(self):
        self.login_as(user=self.owner_user)

        user = self.create_user('foobar@example.com')

        member = OrganizationMember.objects.create(
            organization=self.org,
            user=user,
            role='member',
        )

        with self.settings(SENTRY_ENABLE_INVITES=True):
            resp = self.client.post(
                self.url, {'email': user.email, 'role': 'member', 'teams': [
                    self.team.slug,
                ]})

        assert resp.status_code == 409

        member = OrganizationMember.objects.get(id=member.id)

        assert member.email is None
        assert member.role == 'member'

    def test_valid_for_direct_add(self):
        self.login_as(user=self.owner_user)

        user = self.create_user('baz@example.com')

        with self.settings(SENTRY_ENABLE_INVITES=False):
            resp = self.client.post(
                self.url, {'email': user.email, 'role': 'member', 'teams': [
                    self.team.slug,
                ]})

        assert resp.status_code == 201

        member = OrganizationMember.objects.get(
            organization=self.org,
            email=user.email,
        )
        assert len(mail.outbox) == 0
        assert member.role == 'member'

    def test_invalid_user_for_direct_add(self):
        self.login_as(user=self.owner_user)

        with self.settings(SENTRY_ENABLE_INVITES=False):
            resp = self.client.post(
                self.url, {'email': 'notexisting@example.com', 'role': 'admin', 'teams': [
                    self.team.slug,
                ]})

        assert resp.status_code == 201

        member = OrganizationMember.objects.get(
            organization=self.org,
            email='notexisting@example.com',
        )
        assert len(mail.outbox) == 0
        # todo(maxbittker) this test is a false positive, need to figure out why
        assert member.role == 'admin'

    # permission role stuff:
    def test_manager_invites(self):
        manager_user = self.create_user('manager@localhost')
        self.manager = self.create_member(
            user=manager_user, organization=self.org, role='manager')
        self.login_as(user=manager_user)

        response = self.client.post(
            self.url, {
                'email': 'eric@localhost', 'role': 'owner', 'teams': [self.team.slug]
            })

        assert response.status_code == 403

        response = self.client.post(
            self.url, {
                'email': 'eric@localhost', 'role': 'manager', 'teams': [self.team.slug]
            })
        assert response.status_code == 201

        response = self.client.post(
            self.url, {
                'email': 'eric@localhost', 'role': 'member', 'teams': [self.team.slug]
            })

        assert response.status_code == 409

    def test_admin_invites(self):
        admin_user = self.create_user('admin22@localhost')
        self.admin = self.create_member(
            user=admin_user, organization=self.org, role='admin')

        self.login_as(user=admin_user)

        response = self.client.post(
            self.url, {
                'email': 'eric@localhost', 'role': 'owner', 'teams': [self.team.slug]
            })

        assert response.status_code == 403

        response = self.client.post(
            self.url, {
                'email': 'eric@localhost', 'role': 'manager', 'teams': [self.team.slug]
            })

        assert response.status_code == 403

        response = self.client.post(
            self.url, {
                'email': 'eric@localhost', 'role': 'member', 'teams': [self.team.slug]
            })

        assert response.status_code == 403  # is this one right?

    def test_member_invites(self):
        member_user = self.create_user('member@localhost')
        self.admin = self.create_member(
            user=member_user, organization=self.org, role='member')

        self.login_as(user=member_user)

        response = self.client.post(
            self.url, {
                'email': 'eric@localhost', 'role': 'owner', 'teams': [self.team.slug]
            })

        assert response.status_code == 403

        response = self.client.post(
            self.url, {
                'email': 'eric@localhost', 'role': 'manager', 'teams': [self.team.slug]
            })

        assert response.status_code == 403

        response = self.client.post(
            self.url, {
                'email': 'eric@localhost', 'role': 'member', 'teams': [self.team.slug]
            })

        assert response.status_code == 403

    def test_respects_feature_flag(self):
        self.login_as(user=self.owner_user)

        user = self.create_user('baz@example.com')

        with Feature({'organizations:invite-members': False}):
            resp = self.client.post(
                self.url, {'email': user.email, 'role': 'member', 'teams': [
                    self.team.slug,
                ]})

        assert resp.status_code == 403

    def test_no_team_invites(self):
        self.login_as(user=self.owner_user)
        response = self.client.post(
            self.url, {
                'email': 'eric@localhost', 'role': 'owner', 'teams': []
            })

        assert response.status_code == 201
        assert response.data['email'] == 'eric@localhost'

    def test_invalid_team_invites(self):
        self.login_as(user=self.owner_user)
        response = self.client.post(
            self.url, {
                'email': 'eric@localhost', 'role': 'owner', 'teams': ['faketeam']
            })

        assert response.status_code == 400

from __future__ import absolute_import

from django.core import mail
from django.core.urlresolvers import reverse
from mock import patch

from sentry.models import (
    AuthProvider, OrganizationMember, OrganizationMemberTeam)
from sentry.testutils import APITestCase


class UpdateOrganizationMemberTest(APITestCase):
    @patch('sentry.models.OrganizationMember.send_invite_email')
    def test_reinvite_pending_member(self, mock_send_invite_email):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)
        member_om = self.create_member(
            organization=organization,
            email='foo@example.com',
            role='member',
        )

        path = reverse(
            'sentry-api-0-organization-member-details', args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        resp = self.client.put(path, data={'reinvite': 1})

        assert resp.status_code == 200
        mock_send_invite_email.assert_called_once_with()

    @patch('sentry.models.OrganizationMember.send_invite_email')
    def test_member_no_regenerate_invite_pending_member(self, mock_send_invite_email):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)
        member_om = self.create_member(
            organization=organization,
            email='foo@example.com',
            role='member',
        )
        old_invite = member_om.get_invite_link()

        member = self.create_user('baz@example.com')
        self.create_member(
            organization=organization,
            user=member,
            role='member',
        )

        path = reverse(
            'sentry-api-0-organization-member-details', args=[organization.slug, member_om.id]
        )

        self.login_as(member)

        resp = self.client.put(path, data={'reinvite': 1, 'regenerate': 1})

        assert resp.status_code == 403
        member_om = OrganizationMember.objects.get(id=member_om.id)
        assert old_invite == member_om.get_invite_link()
        assert not mock_send_invite_email.mock_calls

    @patch('sentry.models.OrganizationMember.send_invite_email')
    def test_regenerate_invite_pending_member(self, mock_send_invite_email):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)
        member_om = self.create_member(
            organization=organization,
            email='foo@example.com',
            role='member',
        )
        old_invite = member_om.get_invite_link()

        path = reverse(
            'sentry-api-0-organization-member-details', args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        resp = self.client.put(path, data={'reinvite': 1, 'regenerate': 1})

        assert resp.status_code == 200
        member_om = OrganizationMember.objects.get(id=member_om.id)
        assert old_invite != member_om.get_invite_link()
        mock_send_invite_email.assert_called_once_with()
        assert resp.data['invite_link'] == member_om.get_invite_link()

    def test_reinvite_sso_link(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)
        member = self.create_user('bar@example.com')
        member_om = self.create_member(
            organization=organization,
            user=member,
            role='member',
        )
        AuthProvider.objects.create(
            organization=organization,
            provider='dummy',
            flags=1,
        )

        path = reverse(
            'sentry-api-0-organization-member-details', args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        with self.tasks():
            resp = self.client.put(path, data={'reinvite': 1})

        assert resp.status_code == 200
        assert len(mail.outbox) == 1

    # Normal users can not see invite link
    def test_get_member_invite_link_for_admin(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)

        # User that will be pending
        pending_member_om = self.create_member(
            user=None,
            email='bar@example.com',
            organization=organization,
            role='member',
            teams=[],
        )
        path = reverse(
            'sentry-api-0-organization-member-details', args=[organization.slug, pending_member_om.id]
        )

        self.login_as(self.user)

        resp = self.client.get(path)

        assert resp.status_code == 200
        assert resp.data['invite_link'] != ''

    # Normal users can not see invite link
    def test_get_member_no_invite_link(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)

        # User that will be pending
        pending_member_om = self.create_member(
            user=None,
            email='bar@example.com',
            organization=organization,
            role='member',
            teams=[],
        )

        member = self.create_user('baz@example.com')
        self.create_member(
            organization=organization,
            user=member,
            role='member',
        )

        path = reverse(
            'sentry-api-0-organization-member-details', args=[organization.slug, pending_member_om.id]
        )

        self.login_as(member)

        resp = self.client.get(path)

        assert resp.status_code == 200
        assert 'invite_link' not in resp.data

    def test_get_member_list_teams(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)
        team = self.create_team(organization=organization, name='Team')

        member = self.create_user('baz@example.com')
        member_om = self.create_member(
            organization=organization,
            user=member,
            role='member',
            teams=[team]
        )

        path = reverse(
            'sentry-api-0-organization-member-details', args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        resp = self.client.get(path)

        assert resp.status_code == 200
        assert team.slug in resp.data['teams']

    def test_can_update_member_membership(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)

        member = self.create_user('baz@example.com')
        member_om = self.create_member(
            organization=organization,
            user=member,
            role='member',
            teams=[]
        )

        path = reverse(
            'sentry-api-0-organization-member-details', args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        resp = self.client.put(path, data={
            'role': 'admin'
        })
        assert resp.status_code == 200

        member_om = OrganizationMember.objects.get(id=member_om.id)
        assert member_om.role == 'admin'

    def test_can_not_update_own_membership(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)

        member_om = OrganizationMember.objects.get(user_id=self.user.id)

        path = reverse(
            'sentry-api-0-organization-member-details', args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        resp = self.client.put(path, data={
            'role': 'admin'
        })
        assert resp.status_code == 400

        member_om = OrganizationMember.objects.get(user_id=self.user.id)
        assert member_om.role == 'owner'

    def test_can_update_teams(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)
        foo = self.create_team(organization=organization, name='Team Foo')
        bar = self.create_team(organization=organization, name='Team Bar')

        member = self.create_user('baz@example.com')
        member_om = self.create_member(
            organization=organization,
            user=member,
            role='member',
            teams=[]
        )

        path = reverse(
            'sentry-api-0-organization-member-details', args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        resp = self.client.put(path, data={
            'teams': [foo.slug, bar.slug]
        })
        assert resp.status_code == 200

        member_teams = OrganizationMemberTeam.objects.filter(
            organizationmember=member_om)
        team_ids = map(lambda x: x.team_id, member_teams)
        assert foo.id in team_ids
        assert bar.id in team_ids

        member_om = OrganizationMember.objects.get(id=member_om.id)

        teams = map(lambda team: team.slug, member_om.teams.all())
        assert foo.slug in teams
        assert bar.slug in teams

    def test_can_not_update_with_invalid_team(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)

        member = self.create_user('baz@example.com')
        member_om = self.create_member(
            organization=organization,
            user=member,
            role='member',
            teams=[]
        )

        path = reverse(
            'sentry-api-0-organization-member-details', args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        resp = self.client.put(path, data={
            'teams': ['invalid-team']
        })
        assert resp.status_code == 400

        member_om = OrganizationMember.objects.get(id=member_om.id)
        teams = map(lambda team: team.slug, member_om.teams.all())
        assert len(teams) == 0

    def test_can_update_role(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)
        member = self.create_user('baz@example.com')
        member_om = self.create_member(
            organization=organization,
            user=member,
            role='member',
            teams=[]
        )

        path = reverse(
            'sentry-api-0-organization-member-details', args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        resp = self.client.put(path, data={'role': 'admin'})
        assert resp.status_code == 200

        member_om = OrganizationMember.objects.get(
            organization=organization, user=member)
        assert member_om.role == 'admin'

    def test_can_not_update_with_invalid_role(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)
        member = self.create_user('baz@example.com')
        member_om = self.create_member(
            organization=organization,
            user=member,
            role='member',
            teams=[]
        )

        path = reverse(
            'sentry-api-0-organization-member-details', args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        resp = self.client.put(path, data={'role': 'invalid-role'})
        assert resp.status_code == 400
        member_om = OrganizationMember.objects.get(
            organization=organization, user=member)
        assert member_om.role == 'member'

    @patch('sentry.models.OrganizationMember.send_sso_link_email')
    def test_cannot_reinvite_normal_member(self, mock_send_sso_link_email):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)
        member = self.create_user('bar@example.com')
        member_om = self.create_member(
            organization=organization,
            user=member,
            role='member',
        )

        path = reverse(
            'sentry-api-0-organization-member-details', args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        resp = self.client.put(path, data={'reinvite': 1})

        assert resp.status_code == 400

    def test_cannot_lower_superior_role(self):
        organization = self.create_organization(name='foo', owner=self.user)
        owner = self.create_user('baz@example.com')
        owner_om = self.create_member(
            organization=organization,
            user=owner,
            role='owner',
            teams=[]
        )

        manager = self.create_user('foo@example.com')
        self.create_member(
            organization=organization,
            user=manager,
            role='manager',
            teams=[],
        )
        self.login_as(manager)

        path = reverse(
            'sentry-api-0-organization-member-details', args=[organization.slug, owner_om.id]
        )

        resp = self.client.put(path, data={'role': 'member'})
        assert resp.status_code == 403

        owner_om = OrganizationMember.objects.get(
            organization=organization, user=owner)
        assert owner_om.role == 'owner'


class DeleteOrganizationMemberTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)
        member = self.create_user('bar@example.com')

        member_om = self.create_member(
            organization=organization,
            user=member,
            role='member',
        )

        path = reverse(
            'sentry-api-0-organization-member-details', args=[organization.slug, member_om.id]
        )

        self.login_as(self.user)

        resp = self.client.delete(path)

        assert resp.status_code == 204

        assert not OrganizationMember.objects.filter(id=member_om.id).exists()

    def test_cannot_delete_member_with_higher_access(self):
        organization = self.create_organization(name='foo', owner=self.user)

        other_user = self.create_user('bar@example.com')

        self.create_member(
            organization=organization,
            role='manager',
            user=other_user,
        )

        owner_om = OrganizationMember.objects.get(
            organization=organization,
            user=self.user,
        )

        assert owner_om.role == 'owner'

        path = reverse(
            'sentry-api-0-organization-member-details', args=[organization.slug, owner_om.id]
        )

        self.login_as(other_user)

        resp = self.client.delete(path)

        assert resp.status_code == 400

        assert OrganizationMember.objects.filter(id=owner_om.id).exists()

    def test_cannot_delete_only_owner(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)

        # create a pending member, which shouldn't be counted in the checks
        self.create_member(
            organization=organization,
            role='owner',
            email='bar@example.com',
        )

        owner_om = OrganizationMember.objects.get(
            organization=organization,
            user=self.user,
        )

        assert owner_om.role == 'owner'

        path = reverse(
            'sentry-api-0-organization-member-details', args=[organization.slug, owner_om.id]
        )

        self.login_as(self.user)

        resp = self.client.delete(path)

        assert resp.status_code == 403

        assert OrganizationMember.objects.filter(id=owner_om.id).exists()

    def test_can_delete_self(self):
        organization = self.create_organization(name='foo', owner=self.user)

        other_user = self.create_user('bar@example.com')

        self.create_member(
            organization=organization,
            role='member',
            user=other_user,
        )

        path = reverse('sentry-api-0-organization-member-details',
                       args=[organization.slug, 'me'])

        self.login_as(other_user)

        resp = self.client.delete(path)

        assert resp.status_code == 204

        assert not OrganizationMember.objects.filter(
            user=other_user,
            organization=organization,
        ).exists()

    def test_missing_scope(self):
        organization = self.create_organization(name='foo', owner=self.user)

        admin_user = self.create_user('bar@example.com')

        self.create_member(
            organization=organization,
            role='admin',
            user=admin_user,
        )

        member_user = self.create_user('baz@example.com')

        member_om = self.create_member(
            organization=organization,
            role='member',
            user=member_user,
        )

        path = reverse(
            'sentry-api-0-organization-member-details', args=[
                organization.slug,
                member_om.id,
            ]
        )

        self.login_as(admin_user)

        resp = self.client.delete(path)

        assert resp.status_code == 400

        assert OrganizationMember.objects.filter(id=member_om.id).exists()

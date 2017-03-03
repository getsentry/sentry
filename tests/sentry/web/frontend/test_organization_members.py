from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import OrganizationAccessRequest, OrganizationMember, TotpInterface
from sentry.testutils import TestCase, PermissionTestCase


class OrganizationMembersPermissionTest(PermissionTestCase):
    def setUp(self):
        super(OrganizationMembersPermissionTest, self).setUp()
        self.path = reverse('sentry-organization-members', args=[self.organization.slug])

    def test_member_can_load(self):
        self.assert_member_can_access(self.path)

    def test_non_member_cannot_load(self):
        self.assert_non_member_cannot_access(self.path)


class OrganizationMembersTest(TestCase):
    def test_renders_with_context(self):
        organization = self.create_organization(name='foo', owner=self.user)
        self.create_team(name='foo', organization=organization)
        team_2 = self.create_team(name='bar', organization=organization)

        owner = self.user
        member = self.create_user('bar@example.com')

        TotpInterface().enroll(member)

        owner_om = OrganizationMember.objects.get(
            organization=organization,
            user=owner,
        )

        member_om = self.create_member(
            organization=organization,
            user=member,
            role='member',
            teams=[team_2],
        )

        path = reverse('sentry-organization-members', args=[organization.slug])

        self.login_as(self.user)

        resp = self.client.get(path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, 'sentry/organization-members.html')

        assert resp.context['organization'] == organization
        member_list = sorted(resp.context['member_list'], key=lambda x: x[0].id)

        assert member_list == [
            (owner_om, False, False),
            (member_om, False, True),
        ]

    def test_shows_access_requests_for_team_admin(self):
        organization = self.create_organization(
            name='foo',
            owner=self.user,
            flags=0,  # kill default allow_joinleave
        )
        team_1 = self.create_team(name='foo', organization=organization)
        team_2 = self.create_team(name='bar', organization=organization)

        team_admin = self.create_user('admin@example.com')
        self.create_member(
            organization=organization,
            user=team_admin,
            role='admin',
            teams=[team_1],
        )

        other_user = self.create_user('bar@example.com')
        other_member = self.create_member(
            organization=organization,
            user=other_user,
            role='member',
            teams=[],
        )

        request_1 = OrganizationAccessRequest.objects.create(
            member=other_member,
            team=team_1,
        )
        OrganizationAccessRequest.objects.create(
            member=other_member,
            team=team_2,
        )

        path = reverse('sentry-organization-members', args=[organization.slug])

        self.login_as(team_admin)

        resp = self.client.get(path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, 'sentry/organization-members.html')

        assert resp.context['organization'] == organization
        assert len(resp.context['request_list']) == 1
        assert resp.context['request_list'][0] == request_1

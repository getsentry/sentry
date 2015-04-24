from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import OrganizationMember, OrganizationMemberType
from sentry.testutils import TestCase, PermissionTestCase


class OrganizationMembersPermissionTest(PermissionTestCase):
    def setUp(self):
        super(OrganizationMembersPermissionTest, self).setUp()
        self.path = reverse('sentry-organization-members', args=[self.organization.slug])

    def test_teamless_member_can_load(self):
        self.assert_teamless_member_can_access(self.path)

    def test_org_member_can_load(self):
        self.assert_org_member_can_access(self.path)

    def test_non_member_cannot_load(self):
        self.assert_non_member_cannot_access(self.path)


class OrganizationMembersTest(TestCase):
    def test_renders_with_context(self):
        organization = self.create_organization(name='foo', owner=self.user)
        team_1 = self.create_team(name='foo', organization=organization)
        team_2 = self.create_team(name='bar', organization=organization)

        owner = self.user
        member = self.create_user('bar@example.com')

        owner_om = OrganizationMember.objects.get(
            organization=organization,
            user=owner,
        )

        member_om = self.create_member(
            organization=organization,
            user=member,
            type=OrganizationMemberType.MEMBER,
            has_global_access=False,
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
            (owner_om, [], False),
            (member_om, [team_2], False),
        ]

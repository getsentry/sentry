from __future__ import absolute_import

from sentry.models import OrganizationMember, OrganizationMemberTeam, Team
from sentry.testutils import TestCase


class OrganizationTest(TestCase):
    def test_merge_to(self):
        from_owner = self.create_user('foo@example.com')
        from_org = self.create_organization(owner=from_owner)
        from_team = self.create_team(organization=from_org)
        from_user = self.create_user('baz@example.com')
        other_user = self.create_user('bizbaz@example.com')
        self.create_member(organization=from_org, user=from_user)
        other_member = self.create_member(organization=from_org, user=other_user)

        OrganizationMemberTeam.objects.create(
            organizationmember=other_member,
            team=from_team,
        )

        to_owner = self.create_user('bar@example.com')
        to_org = self.create_organization(owner=to_owner)
        to_team = self.create_team(organization=to_org)
        to_member = self.create_member(organization=to_org, user=other_user)

        OrganizationMemberTeam.objects.create(
            organizationmember=to_member,
            team=to_team,
        )

        from_org.merge_to(to_org)

        assert OrganizationMember.objects.filter(
            organization=to_org,
            user=from_owner,
            role='owner',
        ).exists()

        team = Team.objects.get(id=from_team.id)
        assert team.organization == to_org

        member = OrganizationMember.objects.get(
            user=other_user,
            organization=to_org,
        )
        assert OrganizationMemberTeam.objects.filter(
            organizationmember=member,
            team=to_team,
            is_active=True,
        ).exists()
        assert OrganizationMemberTeam.objects.filter(
            organizationmember=member,
            team=from_team,
            is_active=True,
        ).exists()

    def test_get_default_owner(self):
        user = self.create_user('foo@example.com')
        org = self.create_organization(owner=user)
        assert org.get_default_owner() == user

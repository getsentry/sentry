from __future__ import absolute_import

from sentry.models import (
    OrganizationMember, OrganizationMemberTeam, OrganizationMemberType, Team
)
from sentry.testutils import TestCase


class OrganizationTest(TestCase):
    def test_merge_to(self):
        from_owner = self.create_user('foo@example.com')
        from_org = self.create_organization(owner=from_owner)
        from_team = self.create_team(organization=from_org)
        from_user = self.create_user('baz@example.com')
        other_user = self.create_user('bizbaz@example.com')
        self.create_member(organization=from_org, user=from_user,
                           has_global_access=True)
        self.create_member(organization=from_org, user=other_user,
                           has_global_access=True)

        to_owner = self.create_user('bar@example.com')
        to_org = self.create_organization(owner=to_owner)
        to_team = self.create_team(organization=to_org)
        self.create_member(organization=to_org, user=other_user)

        from_org.merge_to(to_org)

        assert OrganizationMember.objects.filter(
            organization=to_org,
            user=from_owner,
            type=OrganizationMemberType.OWNER,
            has_global_access=True,
        ).exists()

        team = Team.objects.get(id=from_team.id)
        assert team.organization == to_org

        member = OrganizationMember.objects.get(
            user=from_user,
            organization=to_org,
        )
        assert member.has_global_access
        assert OrganizationMemberTeam.objects.filter(
            organizationmember=member,
            team=to_team,
            is_active=False,
        ).exists()

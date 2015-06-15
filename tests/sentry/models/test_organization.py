from __future__ import absolute_import

from sentry.models import OrganizationMember, OrganizationMemberType, Team
from sentry.testutils import TestCase


class OrganizationTest(TestCase):
    def test_merge_to(self):
        from_owner = self.create_user('foo@example.com')
        from_org = self.create_organization(owner=from_owner)
        from_team = self.create_team(organization=from_org)

        to_owner = self.create_user('bar@example.com')
        to_org = self.create_organization(owner=to_owner)
        to_team = self.create_team(organization=to_org)

        from_org.merge_to(to_org)

        assert OrganizationMember.objects.filter(
            organization=to_org,
            user=from_owner,
            type=OrganizationMemberType.OWNER,
            has_global_access=True,
        ).exists()

        team = Team.objects.get(id=from_team.id)
        assert team.organization == to_org

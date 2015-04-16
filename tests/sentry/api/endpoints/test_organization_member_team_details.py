from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import OrganizationMemberTeam, OrganizationMemberType
from sentry.testutils import APITestCase


class UpdateOrganizationMemberTeamTest(APITestCase):
    def test_can_change_status_as_global_member(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)
        member_om = self.create_member(
            organization=organization,
            email='foo@example.com',
            type=OrganizationMemberType.MEMBER,
            has_global_access=True,
        )
        team = self.create_team(name='foo', organization=organization)

        path = reverse('sentry-api-0-organization-member-team-details', args=[
            organization.slug, member_om.id, team.slug,
        ])

        self.login_as(self.user)

        resp = self.client.put(path, data={'isActive': '1'})

        assert resp.status_code == 200

        omt = OrganizationMemberTeam.objects.get(
            team=team,
            organizationmember=member_om,
        )
        assert omt.is_active

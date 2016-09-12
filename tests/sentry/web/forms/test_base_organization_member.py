from __future__ import absolute_import

from sentry.web.forms.base_organization_member import BaseOrganizationMemberForm
from sentry.testutils import TestCase

from sentry.roles.manager import Role
from sentry.models import (
    Team,
    OrganizationMemberTeam,
)


class BaseOrganizationMemberFormTest(TestCase):
    def test_save_team_assignments(self):
        organization = self.create_organization(
            owner=self.create_user('owner@example.com'),
        )
        team1 = self.create_team(name='team1', organization=organization)
        team2 = self.create_team(name='team2', organization=organization)
        some_user = self.create_user('someuser@example.com')
        user_org_membership = self.create_member(
            teams=[team1],
            user=some_user,
            organization=organization
        )

        form = BaseOrganizationMemberForm(data={
            'teams': [team2.id],
            'role': 'member'
        },
            all_teams=Team.objects.filter(organization=organization),
            allowed_roles=[Role(1, 'member', 'Member')]
        )
        assert form.is_valid()

        form.save_team_assignments(user_org_membership)

        assigned_teams = OrganizationMemberTeam.objects.filter(organizationmember=user_org_membership)
        assert len(assigned_teams) == 1
        assert assigned_teams[0].team_id == team2.id

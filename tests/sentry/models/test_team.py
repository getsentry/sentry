# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.models import OrganizationMember, OrganizationMemberTeam
from sentry.testutils import TestCase


class TeamTest(TestCase):
    def test_global_member(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        member = OrganizationMember.objects.get(
            user=user,
            organization=org,
        )

        assert list(team.member_set.all()) == [member]

    def test_inactive_global_member(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        member = OrganizationMember.objects.get(
            user=user,
            organization=org,
        )
        OrganizationMemberTeam.objects.create(
            organizationmember=member,
            team=team,
            is_active=False
        )

        assert list(team.member_set.all()) == []

    def test_active_basic_member(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        user2 = self.create_user('foo@example.com')
        member = self.create_member(
            user=user2,
            organization=org,
            has_global_access=False,
            teams=[team]
        )

        assert member in team.member_set.all()

    def test_teamless_basic_member(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        user2 = self.create_user('foo@example.com')
        member = self.create_member(
            user=user2,
            organization=org,
            has_global_access=False,
        )

        assert member not in team.member_set.all()

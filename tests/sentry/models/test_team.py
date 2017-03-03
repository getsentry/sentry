# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.models import (
    OrganizationMember, OrganizationMemberTeam, Project, Team
)
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
        OrganizationMemberTeam.objects.create(
            organizationmember=member,
            team=team,
        )
        assert list(team.member_set.all()) == [member]

    def test_inactive_global_member(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        OrganizationMember.objects.get(
            user=user,
            organization=org,
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
            role='member',
            teams=[team],
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
            role='member',
            teams=[],
        )

        assert member not in team.member_set.all()


class TransferTest(TestCase):
    def test_simple(self):
        user = self.create_user()
        org = self.create_organization(name='foo', owner=user)
        org2 = self.create_organization(name='bar', owner=None)
        team = self.create_team(organization=org)
        project = self.create_project(team=team)
        user2 = self.create_user('foo@example.com')
        self.create_member(
            user=user2,
            organization=org,
            role='admin',
            teams=[team],
        )
        self.create_member(
            user=user2,
            organization=org2,
            role='member',
            teams=[],
        )
        team.transfer_to(org2)

        assert team.organization == org2
        team = Team.objects.get(id=team.id)
        assert team.organization == org2

        project = Project.objects.get(id=project.id)
        assert project.organization == org2

        # owner does not exist on new org, so should not be transferred
        assert not OrganizationMember.objects.filter(
            user=user,
            organization=org2,
        ).exists()

        # existing member should now have access
        member = OrganizationMember.objects.get(
            user=user2,
            organization=org2,
        )
        assert list(member.teams.all()) == [team]
        # role should not automatically upgrade
        assert member.role == 'member'

        # old member row should still exist
        assert OrganizationMember.objects.filter(
            user=user2,
            organization=org,
        ).exists()

        # no references to old org for this team should exist
        assert not OrganizationMemberTeam.objects.filter(
            organizationmember__organization=org,
            team=team,
        ).exists()

    def test_existing_team(self):
        org = self.create_organization(name='foo')
        org2 = self.create_organization(name='bar')
        team = self.create_team(name='foo', organization=org)
        team2 = self.create_team(name='foo', organization=org2)
        project = self.create_project(team=team)
        team.transfer_to(org2)

        project = Project.objects.get(id=project.id)
        assert project.team == team2

        assert not Team.objects.filter(id=team.id).exists()

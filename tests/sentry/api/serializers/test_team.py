# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from sentry.api.serializers import serialize
from sentry.api.serializers.models.team import TeamWithProjectsSerializer
from sentry.testutils import TestCase


class TeamSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user(username='foo')
        organization = self.create_organization(owner=user)
        team = self.create_team(organization=organization)

        result = serialize(team, user)
        result.pop('dateCreated')

        assert result == {
            'slug': team.slug,
            'name': team.name,
            'hasAccess': True,
            'isPending': False,
            'isMember': False,
            'id': six.text_type(team.id),
            'avatar': {
                'avatarType': 'letter_avatar',
                'avatarUuid': None,
            },
        }

    def test_member_access(self):
        user = self.create_user(username='foo')
        organization = self.create_organization()
        self.create_member(user=user, organization=organization)
        team = self.create_team(organization=organization)

        result = serialize(team, user)
        result.pop('dateCreated')

        assert result['hasAccess'] is True
        assert result['isMember'] is False

        organization.flags.allow_joinleave = False
        organization.save()
        result = serialize(team, user)
        # after changing to allow_joinleave=False
        assert result['hasAccess'] is False
        assert result['isMember'] is False

        self.create_team_membership(user=user, team=team)
        result = serialize(team, user)
        # after giving them access to team
        assert result['hasAccess'] is True
        assert result['isMember'] is True

    def test_admin_access(self):
        user = self.create_user(username='foo')
        organization = self.create_organization()
        self.create_member(user=user, organization=organization, role='admin')
        team = self.create_team(organization=organization)

        result = serialize(team, user)
        result.pop('dateCreated')

        assert result['hasAccess'] is True
        assert result['isMember'] is False

        organization.flags.allow_joinleave = False
        organization.save()
        result = serialize(team, user)
        # after changing to allow_joinleave=False
        assert result['hasAccess'] is False
        assert result['isMember'] is False

        self.create_team_membership(user=user, team=team)
        result = serialize(team, user)
        # after giving them access to team
        assert result['hasAccess'] is True
        assert result['isMember'] is True

    def test_manager_access(self):
        user = self.create_user(username='foo')
        organization = self.create_organization()
        self.create_member(user=user, organization=organization, role='manager')
        team = self.create_team(organization=organization)

        result = serialize(team, user)
        result.pop('dateCreated')

        assert result['hasAccess'] is True
        assert result['isMember'] is False

        organization.flags.allow_joinleave = False
        organization.save()
        result = serialize(team, user)
        # after changing to allow_joinleave=False
        assert result['hasAccess'] is True
        assert result['isMember'] is False

        self.create_team_membership(user=user, team=team)
        result = serialize(team, user)
        # after giving them access to team
        assert result['hasAccess'] is True
        assert result['isMember'] is True

    def test_owner_access(self):
        user = self.create_user(username='foo')
        organization = self.create_organization()
        self.create_member(user=user, organization=organization, role='owner')
        team = self.create_team(organization=organization)

        result = serialize(team, user)
        result.pop('dateCreated')

        assert result['hasAccess'] is True
        assert result['isMember'] is False

        organization.flags.allow_joinleave = False
        organization.save()
        result = serialize(team, user)
        # after changing to allow_joinleave=False
        assert result['hasAccess'] is True
        assert result['isMember'] is False

        self.create_team_membership(user=user, team=team)
        result = serialize(team, user)
        # after giving them access to team
        assert result['hasAccess'] is True
        assert result['isMember'] is True


class TeamWithProjectsSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user(username='foo')
        organization = self.create_organization(owner=user)
        team = self.create_team(organization=organization)
        project = self.create_project(teams=[team], organization=organization, name='foo')
        project2 = self.create_project(teams=[team], organization=organization, name='bar')

        result = serialize(team, user, TeamWithProjectsSerializer())
        result.pop('dateCreated')

        # don't compare dateCreated because of mysql
        serialized_projects = serialize([project2, project], user)
        for p in serialized_projects:
            p.pop('dateCreated')

        for p in result['projects']:
            p.pop('dateCreated')

        assert result == {
            'slug': team.slug,
            'name': team.name,
            'hasAccess': True,
            'isPending': False,
            'isMember': False,
            'id': six.text_type(team.id),
            'projects': serialized_projects,
            'avatar': {
                'avatarType': 'letter_avatar',
                'avatarUuid': None,
            },
        }

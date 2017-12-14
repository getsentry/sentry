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
        }


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
        }

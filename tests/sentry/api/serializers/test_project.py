# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six
import datetime
from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.api.serializers.models.project import (
    ProjectWithOrganizationSerializer, ProjectWithTeamSerializer, ProjectSummarySerializer
)
from sentry.models import Deploy, Environment, Release, ReleaseProjectEnvironment
from sentry.testutils import TestCase


class ProjectSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user(username='foo')
        organization = self.create_organization(owner=user)
        team = self.create_team(organization=organization)
        project = self.create_project(teams=[team], organization=organization, name='foo')

        result = serialize(project, user)

        assert result['slug'] == project.slug
        assert result['name'] == project.name
        assert result['id'] == six.text_type(project.id)

    def test_member_access(self):
        user = self.create_user(username='foo')
        organization = self.create_organization()
        self.create_member(user=user, organization=organization)
        team = self.create_team(organization=organization)
        project = self.create_project(teams=[team])

        result = serialize(project, user)

        assert result['hasAccess'] is True
        assert result['isMember'] is False

        organization.flags.allow_joinleave = False
        organization.save()
        result = serialize(project, user)
        # after changing to allow_joinleave=False
        assert result['hasAccess'] is False
        assert result['isMember'] is False

        self.create_team_membership(user=user, team=team)
        result = serialize(project, user)
        # after giving them access to team
        assert result['hasAccess'] is True
        assert result['isMember'] is True

    def test_admin_access(self):
        user = self.create_user(username='foo')
        organization = self.create_organization()
        self.create_member(user=user, organization=organization, role='admin')
        team = self.create_team(organization=organization)
        project = self.create_project(teams=[team])

        result = serialize(project, user)
        result.pop('dateCreated')

        assert result['hasAccess'] is True
        assert result['isMember'] is False

        organization.flags.allow_joinleave = False
        organization.save()
        result = serialize(project, user)
        # after changing to allow_joinleave=False
        assert result['hasAccess'] is False
        assert result['isMember'] is False

        self.create_team_membership(user=user, team=team)
        result = serialize(project, user)
        # after giving them access to team
        assert result['hasAccess'] is True
        assert result['isMember'] is True

    def test_manager_access(self):
        user = self.create_user(username='foo')
        organization = self.create_organization()
        self.create_member(user=user, organization=organization, role='manager')
        team = self.create_team(organization=organization)
        project = self.create_project(teams=[team])

        result = serialize(project, user)

        assert result['hasAccess'] is True
        assert result['isMember'] is False

        organization.flags.allow_joinleave = False
        organization.save()
        result = serialize(project, user)
        # after changing to allow_joinleave=False
        assert result['hasAccess'] is True
        assert result['isMember'] is False

        self.create_team_membership(user=user, team=team)
        result = serialize(project, user)
        # after giving them access to team
        assert result['hasAccess'] is True
        assert result['isMember'] is True

    def test_owner_access(self):
        user = self.create_user(username='foo')
        organization = self.create_organization()
        self.create_member(user=user, organization=organization, role='owner')
        team = self.create_team(organization=organization)
        project = self.create_project(teams=[team])

        result = serialize(project, user)

        assert result['hasAccess'] is True
        assert result['isMember'] is False

        organization.flags.allow_joinleave = False
        organization.save()
        result = serialize(project, user)
        # after changing to allow_joinleave=False
        assert result['hasAccess'] is True
        assert result['isMember'] is False

        self.create_team_membership(user=user, team=team)
        result = serialize(project, user)
        # after giving them access to team
        assert result['hasAccess'] is True
        assert result['isMember'] is True


class ProjectWithTeamSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user(username='foo')
        organization = self.create_organization(owner=user)
        team = self.create_team(organization=organization)
        project = self.create_project(teams=[team], organization=organization, name='foo')

        result = serialize(project, user, ProjectWithTeamSerializer())

        assert result['slug'] == project.slug
        assert result['name'] == project.name
        assert result['id'] == six.text_type(project.id)
        assert result['team'] == {
            'id': six.text_type(
                team.id),
            'slug': team.slug,
            'name': team.name}


class ProjectSummarySerializerTest(TestCase):
    def test_simple(self):
        date = datetime.datetime(2018, 1, 12, 3, 8, 25, tzinfo=timezone.utc)
        user = self.create_user(username='foo')
        organization = self.create_organization(owner=user)
        team = self.create_team(organization=organization)
        project = self.create_project(teams=[team], organization=organization, name='foo')

        release = Release.objects.create(
            organization_id=organization.id,
            version='1',
        )

        environment = Environment.objects.create(
            organization_id=organization.id,
            name='production',
        )

        deploy = Deploy.objects.create(
            environment_id=environment.id,
            organization_id=organization.id,
            release=release,
            date_finished=date
        )

        ReleaseProjectEnvironment.objects.create(
            project_id=project.id,
            release_id=release.id,
            environment_id=environment.id,
            last_deploy_id=deploy.id
        )

        result = serialize(project, user, ProjectSummarySerializer())

        assert result['latestDeploys'] == {
            'production': {'dateFinished': date, 'version': '1'}
        }


class ProjectWithOrganizationSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user(username='foo')
        organization = self.create_organization(owner=user)
        team = self.create_team(organization=organization)
        project = self.create_project(teams=[team], organization=organization, name='foo')

        result = serialize(project, user, ProjectWithOrganizationSerializer())

        assert result['slug'] == project.slug
        assert result['name'] == project.name
        assert result['id'] == six.text_type(project.id)
        assert result['organization'] == serialize(organization, user)

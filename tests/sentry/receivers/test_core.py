# coding: utf-8

from __future__ import absolute_import

from django.conf import settings

from sentry.models import (
    Organization, Project, ProjectKey, Team, User
)
from sentry.receivers.core import create_default_projects
from sentry.testutils import TestCase


class CreateDefaultProjectsTest(TestCase):
    def test_simple(self):
        user, _ = User.objects.get_or_create(is_superuser=True, defaults={
            'username': 'test'
        })
        Organization.objects.all().delete()
        Team.objects.filter(slug='sentry').delete()
        Project.objects.filter(id=settings.SENTRY_PROJECT).delete()

        create_default_projects(created_models=[Project])

        project = Project.objects.get(id=settings.SENTRY_PROJECT)
        assert project.public is False
        assert project.name == 'Internal'
        assert project.slug == 'internal'
        team = project.team
        assert team.slug == 'sentry'

        pk = ProjectKey.objects.get(project=project)
        assert not pk.roles.api
        assert pk.roles.store

        # ensure that we dont hit an error here
        create_default_projects(created_models=[Project])

    def test_without_user(self):
        User.objects.filter(is_superuser=True).delete()
        Team.objects.filter(slug='sentry').delete()
        Project.objects.filter(id=settings.SENTRY_PROJECT).delete()

        create_default_projects(created_models=[Project])

        project = Project.objects.get(id=settings.SENTRY_PROJECT)
        assert project.public is False
        assert project.name == 'Internal'
        assert project.slug == 'internal'
        team = project.team
        assert team.slug == 'sentry'

        pk = ProjectKey.objects.get(project=project)
        assert not pk.roles.api
        assert pk.roles.store

        # ensure that we dont hit an error here
        create_default_projects(created_models=[Project])

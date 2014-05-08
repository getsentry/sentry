# coding: utf-8

from __future__ import absolute_import

from django.conf import settings

from sentry.models import Project, ProjectKey, User
from sentry.receivers.core import create_default_project
from sentry.testutils import TestCase


class CreateDefaultProjectTest(TestCase):
    def test_simple(self):
        user, _ = User.objects.get_or_create(is_superuser=True, defaults={
            'username': 'test'
        })
        Project.objects.filter(id=settings.SENTRY_PROJECT).delete()

        create_default_project(created_models=[Project])

        project = Project.objects.get(id=settings.SENTRY_PROJECT)
        assert project.owner == user
        assert project.public is False
        assert project.name == 'Sentry (Internal)'
        assert project.slug == 'sentry'
        team = project.team
        assert team.owner == user
        assert team.slug == 'sentry'

        pk = ProjectKey.objects.get(project=project)
        assert not pk.roles.api
        assert pk.roles.store
        assert pk.user is None

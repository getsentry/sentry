# coding: utf-8

from __future__ import absolute_import

from django.conf import settings

from sentry.models import Project, Team, User
from sentry.receivers.core import create_default_project
from sentry.testutils import TestCase


class CreateDefaultProjectTest(TestCase):
    def test_simple(self):
        user, _ = User.objects.get_or_create(is_superuser=True, defaults={
            'username': 'test'
        })
        Team.objects.filter(project__id=settings.SENTRY_PROJECT).delete()
        Project.objects.filter(id=settings.SENTRY_PROJECT).delete()

        create_default_project(created_models=[Project])

        project = Project.objects.filter(id=settings.SENTRY_PROJECT)
        assert project.exists() is True
        project = project.get()
        assert project.owner == user
        assert project.public is False
        assert project.name == 'Sentry (Internal)'
        assert project.slug == 'sentry'
        team = project.team
        assert team.owner == user
        assert team.slug == 'sentry'

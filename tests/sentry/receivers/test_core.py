from django.conf import settings
from django.db import router
from django.test.utils import override_settings

from sentry.models.organization import Organization
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.project import Project
from sentry.models.projectkey import ProjectKey
from sentry.models.team import Team
from sentry.models.user import User
from sentry.receivers.core import DEFAULT_SENTRY_PROJECT_ID, create_default_projects
from sentry.silo import unguarded_write
from sentry.testutils.cases import TestCase


class CreateDefaultProjectsTest(TestCase):
    @override_settings(SENTRY_PROJECT=1)
    def test_simple(self):
        user, _ = User.objects.get_or_create(is_superuser=True, defaults={"username": "test"})
        Organization.objects.all().delete()

        with unguarded_write(using=router.db_for_write(OrganizationMapping)):
            OrganizationMapping.objects.all().delete()
        Team.objects.filter(slug="sentry").delete()
        Project.objects.filter(id=settings.SENTRY_PROJECT).delete()

        create_default_projects()
        project = Project.objects.get(id=settings.SENTRY_PROJECT)
        assert project.public is False
        assert project.name == "Internal"
        assert project.slug == "internal"
        team = project.teams.first()
        assert team.slug == "sentry"

        pk = ProjectKey.objects.get(project=project)
        assert not pk.roles.api
        assert pk.roles.store
        assert "dynamicSdkLoaderOptions" in pk.data
        assert pk.data["dynamicSdkLoaderOptions"] == {
            "hasPerformance": True,
            "hasReplay": True,
        }

        # ensure that we don't hit an error here
        create_default_projects()

    @override_settings(SENTRY_PROJECT=1)
    def test_without_user(self):
        User.objects.filter(is_superuser=True).delete()
        with unguarded_write(using=router.db_for_write(Team)):
            Team.objects.filter(slug="sentry").delete()
            Project.objects.filter(id=settings.SENTRY_PROJECT).delete()

        create_default_projects()

        project = Project.objects.get(id=settings.SENTRY_PROJECT)
        assert project.public is False
        assert project.name == "Internal"
        assert project.slug == "internal"
        team = project.teams.first()
        assert team.slug == "sentry"

        pk = ProjectKey.objects.get(project=project)
        assert not pk.roles.api
        assert pk.roles.store
        assert "dynamicSdkLoaderOptions" in pk.data
        assert pk.data["dynamicSdkLoaderOptions"] == {
            "hasPerformance": True,
            "hasReplay": True,
        }

        # ensure that we don't hit an error here
        create_default_projects()

    def test_no_sentry_project(self):
        with self.settings(SENTRY_PROJECT=None):
            User.objects.filter(is_superuser=True).delete()
            with unguarded_write(using=router.db_for_write(Team)):
                Team.objects.filter(slug="sentry").delete()
                Project.objects.filter(id=DEFAULT_SENTRY_PROJECT_ID).delete()

            create_default_projects()

            project = Project.objects.get(id=DEFAULT_SENTRY_PROJECT_ID)
            assert project.public is False
            assert project.name == "Internal"
            assert project.slug == "internal"
            team = project.teams.first()
            assert team.slug == "sentry"

            pk = ProjectKey.objects.get(project=project)
            assert not pk.roles.api
            assert pk.roles.store
            assert "dynamicSdkLoaderOptions" in pk.data
            assert pk.data["dynamicSdkLoaderOptions"] == {
                "hasPerformance": True,
                "hasReplay": True,
            }

            # ensure that we don't hit an error here
            create_default_projects()

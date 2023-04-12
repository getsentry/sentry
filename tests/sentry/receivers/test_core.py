from django.apps import apps
from django.conf import settings
from django.test.utils import override_settings

from sentry.db.postgres.roles import in_test_psql_role_override
from sentry.models import Organization, Project, ProjectKey, Team, User
from sentry.receivers.core import DEFAULT_SENTRY_PROJECT_ID, create_default_projects
from sentry.testutils import TestCase


class CreateDefaultProjectsTest(TestCase):
    @override_settings(SENTRY_PROJECT=1)
    def test_simple(self):
        user, _ = User.objects.get_or_create(is_superuser=True, defaults={"username": "test"})
        with in_test_psql_role_override("postgres"):
            Organization.objects.all().delete()
        Team.objects.filter(slug="sentry").delete()
        Project.objects.filter(id=settings.SENTRY_PROJECT).delete()
        config = apps.get_app_config("sentry")

        create_default_projects(config)
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
        create_default_projects(config)

    @override_settings(SENTRY_PROJECT=1)
    def test_without_user(self):
        User.objects.filter(is_superuser=True).delete()
        Team.objects.filter(slug="sentry").delete()
        with in_test_psql_role_override("postgres"):
            Project.objects.filter(id=settings.SENTRY_PROJECT).delete()
        config = apps.get_app_config("sentry")

        create_default_projects(config)

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
        create_default_projects(config)

    def test_no_sentry_project(self):
        with self.settings(SENTRY_PROJECT=None):
            User.objects.filter(is_superuser=True).delete()
            Team.objects.filter(slug="sentry").delete()
            with in_test_psql_role_override("postgres"):
                Project.objects.filter(id=DEFAULT_SENTRY_PROJECT_ID).delete()
            config = apps.get_app_config("sentry")

            create_default_projects(config)

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
            create_default_projects(config)

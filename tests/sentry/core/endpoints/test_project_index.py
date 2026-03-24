import responses
from django.db import router
from django.urls import reverse
from rest_framework import status

from sentry.constants import ObjectStatus
from sentry.deletions.tasks.hybrid_cloud import (
    schedule_hybrid_cloud_foreign_key_jobs,
    schedule_hybrid_cloud_foreign_key_jobs_control,
)
from sentry.models.apitoken import ApiToken
from sentry.models.project import Project
from sentry.models.projectkey import ProjectKey
from sentry.sentry_apps.models.sentry_app_installation_token import SentryAppInstallationToken
from sentry.silo.base import SiloMode
from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import APITestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode


class ProjectsListTest(APITestCase):
    endpoint = "sentry-api-0-projects"

    def test_member_constraints(self) -> None:
        user = self.create_user(is_superuser=True)
        org = self.create_organization()
        team = self.create_team(organization=org, members=[user])
        project = self.create_project(teams=[team])
        org2 = self.create_organization()
        team2 = self.create_team(organization=org2, members=[])
        self.create_project(teams=[team2])

        self.login_as(user=user, superuser=True)

        response = self.get_success_response()
        assert len(response.data) == 1

        assert response.data[0]["id"] == str(project.id)
        assert response.data[0]["organization"]["id"] == str(org.id)

    def test_show_all_with_superuser(self) -> None:
        with unguarded_write(using=router.db_for_write(Project)):
            Project.objects.all().delete()

        user = self.create_user(is_superuser=True)

        org = self.create_organization(owner=user)
        self.create_project(organization=org)

        org2 = self.create_organization()
        self.create_project(organization=org2)

        self.login_as(user=user, superuser=True)
        response = self.get_success_response(qs_params={"show": "all"})
        assert len(response.data) == 2

    def test_show_all_without_superuser(self) -> None:
        with unguarded_write(using=router.db_for_write(Project)):
            Project.objects.all().delete()

        user = self.create_user(is_superuser=False)

        org = self.create_organization(owner=user)
        self.create_project(organization=org)

        org2 = self.create_organization()
        self.create_project(organization=org2)

        self.login_as(user=user)
        response = self.get_success_response()
        assert len(response.data) == 0

    def test_filter_by_org_id(self) -> None:
        user = self.create_user(is_superuser=True)
        org = self.create_organization()
        team = self.create_team(organization=org, members=[user])
        project = self.create_project(teams=[team])
        org2 = self.create_organization()
        team2 = self.create_team(organization=org2, members=[user])
        self.create_project(teams=[team2])

        self.login_as(user=user, superuser=False)

        response = self.get_success_response(qs_params={"organizationId": str(org.id)})
        assert len(response.data) == 1

        assert response.data[0]["id"] == str(project.id)
        assert response.data[0]["organization"]["id"] == str(org.id)

    def test_status_filter(self) -> None:
        with unguarded_write(using=router.db_for_write(Project)):
            Project.objects.all().delete()

        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org, members=[user])
        project1 = self.create_project(teams=[team])
        project2 = self.create_project(teams=[team], status=ObjectStatus.PENDING_DELETION)

        self.login_as(user=user)

        response = self.get_success_response(qs_params={"status": "active"})
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(project1.id)

        response = self.get_success_response(qs_params={"status": "deleted"})
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(project2.id)

    def test_query_filter(self) -> None:
        with unguarded_write(using=router.db_for_write(Project)):
            Project.objects.all().delete()

        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org, members=[user])
        project1 = self.create_project(name="foo", teams=[team])
        self.create_project(name="bar", teams=[team])

        self.login_as(user=user)

        response = self.get_success_response(qs_params={"query": "foo"})
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(project1.id)

        response = self.get_success_response(qs_params={"query": "baz"})
        assert len(response.data) == 0

    def test_slug_query(self) -> None:
        with unguarded_write(using=router.db_for_write(Project)):
            Project.objects.all().delete()

        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org, members=[user])
        project1 = self.create_project(slug="foo", name="foo", teams=[team])
        self.create_project(name="bar", slug="bar", teams=[team])

        self.login_as(user=user)

        response = self.get_success_response(qs_params={"query": "slug:foo"})
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(project1.id)

        response = self.get_success_response(qs_params={"query": "slug:baz"})
        assert len(response.data) == 0

    def test_dsn_filter(self) -> None:
        with unguarded_write(using=router.db_for_write(Project)):
            Project.objects.all().delete()

        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org, members=[user])
        project1 = self.create_project(teams=[team])
        key = ProjectKey.objects.get_or_create(project=project1)[0]
        self.create_project(teams=[team])

        self.login_as(user=user)

        response = self.get_success_response(qs_params={"query": f"dsn:{key.public_key}"})
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(project1.id)

        response = self.get_success_response(qs_params={"query": "dsn:nope"})
        assert len(response.data) == 0

    def test_id_query(self) -> None:
        with unguarded_write(using=router.db_for_write(Project)):
            Project.objects.all().delete()

        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org, members=[user])
        project1 = self.create_project(teams=[team])
        self.create_project(teams=[team])

        self.login_as(user=user)

        response = self.get_success_response(qs_params={"query": f"id:{project1.id}"})
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(project1.id)

        response = self.get_success_response(qs_params={"query": "id:-1"})
        assert len(response.data) == 0

    def test_id_query_with_invalid_values(self) -> None:
        """Test that non-numeric ID values are gracefully handled"""
        with unguarded_write(using=router.db_for_write(Project)):
            Project.objects.all().delete()

        user = self.create_user()
        org = self.create_organization()
        team = self.create_team(organization=org, members=[user])
        self.create_project(teams=[team])

        self.login_as(user=user)

        self.get_error_response(qs_params={"query": "id:"}, status_code=400)
        self.get_error_response(qs_params={"query": "id:metric_issue"}, status_code=400)
        self.get_error_response(
            qs_params={"query": "id:https://redash.getsentry.net/queries/9850"}, status_code=400
        )
        self.get_error_response(qs_params={"query": "id:**"}, status_code=400)
        self.get_error_response(qs_params={"query": f"id:{123} id:invalid"}, status_code=400)

    def test_valid_with_internal_integration(self) -> None:
        project = self.create_project(organization=self.organization, teams=[self.team])
        internal_integration = self.create_internal_integration(
            name="my_app",
            organization=self.organization,
            scopes=("project:read",),
            webhook_url="http://example.com",
        )
        token = self.create_internal_integration_token(
            user=self.user, internal_integration=internal_integration
        )
        path = reverse(self.endpoint)
        response = self.client.get(path, HTTP_AUTHORIZATION=f"Bearer {token.token}")
        assert project.name.encode("utf-8") in response.content

    def test_deleted_token_with_internal_integration(self) -> None:
        internal_integration = self.create_internal_integration(
            name="my_app",
            organization=self.organization,
            scopes=("project:read",),
            webhook_url="http://example.com",
        )
        token = self.create_internal_integration_token(
            user=self.user, internal_integration=internal_integration
        )

        with self.tasks(), assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            # Fetch the record using the created token
            install_token = SentryAppInstallationToken.objects.get(api_token=token)
            # Delete the token
            install_token.delete()
            schedule_hybrid_cloud_foreign_key_jobs_control()

        with self.tasks():
            schedule_hybrid_cloud_foreign_key_jobs()

        self.get_error_response(
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    def get_installed_unpublished_sentry_app_access_token(self) -> ApiToken:
        self.project = self.create_project(organization=self.organization, teams=[self.team])
        sentry_app = self.create_sentry_app(
            scopes=("project:read",),
            published=False,
            verify_install=False,
            name="Super Awesome App",
        )
        installation = self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization, user=self.user
        )
        return installation.api_token.token

    def test_valid_with_public_integration(self) -> None:
        token = self.get_installed_unpublished_sentry_app_access_token()

        # there should only be one record created so just grab the first one
        response = self.get_success_response(
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token}"}
        )
        assert self.project.name.encode("utf-8") in response.content

    @responses.activate
    def test_deleted_token_with_public_integration(self) -> None:
        token = self.get_installed_unpublished_sentry_app_access_token()

        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            token = ApiToken.objects.get(token=token)
            token.delete()

        with self.tasks():
            schedule_hybrid_cloud_foreign_key_jobs()

        self.get_error_response(
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token}"},
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

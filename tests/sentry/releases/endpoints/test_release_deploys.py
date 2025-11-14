from typing import int
import datetime

from django.urls import reverse

from sentry.models.apitoken import ApiToken
from sentry.models.deploy import Deploy
from sentry.models.environment import Environment
from sentry.models.release import Release
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode


class ReleaseDeploysListTest(APITestCase):
    def test_simple(self) -> None:
        project = self.create_project(name="foo")
        release = Release.objects.create(
            organization_id=project.organization_id,
            # test unicode
            version="1–0",
        )
        release.add_project(project)
        production_env = Environment.objects.create(
            organization_id=project.organization_id,
            name="production",
        )

        prod_deploy = Deploy.objects.create(
            environment_id=production_env.id,
            organization_id=project.organization_id,
            release=release,
            date_finished=datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=1),
        )

        staging_env = Environment.objects.create(
            organization_id=project.organization_id,
            name="staging",
        )

        staging_deploy = Deploy.objects.create(
            environment_id=staging_env.id,
            organization_id=project.organization_id,
            release=release,
        )

        ReleaseProjectEnvironment.objects.create(
            project=project,
            release=release,
            environment=production_env,
            last_deploy_id=prod_deploy.id,
        )

        ReleaseProjectEnvironment.objects.create(
            project=project,
            release=release,
            environment=staging_env,
            last_deploy_id=staging_deploy.id,
        )

        url = reverse(
            "sentry-api-0-organization-release-deploys",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "version": release.version,
            },
        )

        self.login_as(user=self.user)

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data[0]["environment"] == "staging"
        assert response.data[1]["environment"] == "production"

    def test_with_project(self) -> None:
        project = self.create_project(name="bar")
        project2 = self.create_project(name="baz")

        release = Release.objects.create(
            organization_id=project.organization_id,
            # test unicode
            version="1–1",
        )

        release.add_project(project)
        release.add_project(project2)

        production_env = Environment.objects.create(
            organization_id=project.organization_id,
            name="production",
        )

        prod_deploy = Deploy.objects.create(
            environment_id=production_env.id,
            organization_id=project.organization_id,
            release=release,
            date_finished=datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=1),
        )

        ReleaseProjectEnvironment.objects.create(
            project=project,
            release=release,
            environment=production_env,
            last_deploy_id=prod_deploy.id,
        )

        url = reverse(
            "sentry-api-0-organization-release-deploys",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "version": release.version,
            },
        )

        self.login_as(user=self.user)

        # Test that the first project returns the deploy as expected
        response_bar = self.client.get(url + f"?project={project.id}")
        assert response_bar.status_code == 200, response_bar.content
        assert len(response_bar.data) == 1
        assert response_bar.data[0]["environment"] == "production"

        # Test that the second project does not return any deploys
        response_baz = self.client.get(url + f"?project={project2.id}")
        assert response_baz.status_code == 200, response_baz.content
        assert len(response_baz.data) == 0

        # Test that not setting the project id returns the deploy
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["environment"] == "production"

        # Negative ID set as the project_id is same as not setting it
        response_negative = self.client.get(url, data={"project": "-1"})
        assert response_negative.status_code == 200, response_negative.content
        assert len(response_negative.data) == 1
        assert response_negative.data[0]["environment"] == "production"


class ReleaseDeploysCreateTest(APITestCase):
    def setUp(self) -> None:
        user = self.create_user(is_staff=False, is_superuser=False)
        self.org = self.create_organization()
        self.org.save()

        team = self.create_team(organization=self.org)
        self.project = self.create_project(name="foo", organization=self.org, teams=[team])

        self.create_member(teams=[team], user=user, organization=self.org)
        self.login_as(user=user)

    def test_simple(self) -> None:
        release = Release.objects.create(organization_id=self.org.id, version="1", total_deploys=0)
        release.add_project(self.project)

        environment = Environment.objects.create(organization_id=self.org.id, name="production")

        url = reverse(
            "sentry-api-0-organization-release-deploys",
            kwargs={
                "organization_id_or_slug": self.org.slug,
                "version": release.version,
            },
        )

        response = self.client.post(
            url, data={"name": "foo", "environment": "production", "url": "https://www.example.com"}
        )
        assert response.status_code == 201, response.content
        assert response.data["name"] == "foo"
        assert response.data["url"] == "https://www.example.com"
        assert response.data["environment"] == "production"

        deploy = Deploy.objects.get(id=response.data["id"])

        assert deploy.name == "foo"
        assert deploy.environment_id == environment.id
        assert deploy.url == "https://www.example.com"
        assert deploy.release == release

        release = Release.objects.get(id=release.id)
        assert release.total_deploys == 1
        assert release.last_deploy_id == deploy.id

        rpe = ReleaseProjectEnvironment.objects.get(
            project=self.project, release=release, environment=environment
        )
        assert rpe.last_deploy_id == deploy.id

    def test_with_project_slugs(self) -> None:
        project_bar = self.create_project(organization=self.org, name="bar")
        release = Release.objects.create(organization_id=self.org.id, version="1", total_deploys=0)
        release.add_project(self.project)
        release.add_project(project_bar)

        environment = Environment.objects.create(organization_id=self.org.id, name="production")

        url = reverse(
            "sentry-api-0-organization-release-deploys",
            kwargs={
                "organization_id_or_slug": self.org.slug,
                "version": release.version,
            },
        )

        response = self.client.post(
            url,
            data={
                "name": "foo_bar",
                "environment": "production",
                "url": "https://www.example.com",
                "projects": [self.project.slug, project_bar.slug],
            },
        )
        assert response.status_code == 201, response.content
        assert response.data["name"] == "foo_bar"
        assert response.data["url"] == "https://www.example.com"
        assert response.data["environment"] == "production"

        deploy = Deploy.objects.get(id=response.data["id"])

        assert deploy.name == "foo_bar"
        assert deploy.environment_id == environment.id
        assert deploy.url == "https://www.example.com"
        assert deploy.release == release

        release = Release.objects.get(id=release.id)
        assert release.total_deploys == 1
        assert release.last_deploy_id == deploy.id

        rpe = ReleaseProjectEnvironment.objects.get(
            project=self.project, release=release, environment=environment
        )
        assert rpe.last_deploy_id == deploy.id

        rpe = ReleaseProjectEnvironment.objects.get(
            project=project_bar, release=release, environment=environment
        )
        assert rpe.last_deploy_id == deploy.id

    def test_with_multiple_projects(self) -> None:
        """
        Test that when a release is associated with multiple projects the user is still able to create
        a deploy to only one project
        """
        project_bar = self.create_project(organization=self.org, name="bar")
        release = Release.objects.create(organization_id=self.org.id, version="1", total_deploys=0)
        release.add_project(self.project)
        release.add_project(project_bar)

        environment = Environment.objects.create(organization_id=self.org.id, name="production")

        url = reverse(
            "sentry-api-0-organization-release-deploys",
            kwargs={
                "organization_id_or_slug": self.org.slug,
                "version": release.version,
            },
        )

        response = self.client.post(
            url,
            data={
                "name": "foo_bar",
                "environment": "production",
                "url": "https://www.example.com",
                "projects": [project_bar.slug],
            },
        )
        assert response.status_code == 201, response.content
        assert response.data["name"] == "foo_bar"
        assert response.data["url"] == "https://www.example.com"
        assert response.data["environment"] == "production"

        deploy = Deploy.objects.get(id=response.data["id"])

        assert deploy.name == "foo_bar"
        assert deploy.environment_id == environment.id
        assert deploy.url == "https://www.example.com"
        assert deploy.release == release

        release = Release.objects.get(id=release.id)
        assert release.total_deploys == 1
        assert release.last_deploy_id == deploy.id

        assert not ReleaseProjectEnvironment.objects.filter(
            project=self.project, release=release, environment=environment
        ).exists()

        rpe = ReleaseProjectEnvironment.objects.get(
            project=project_bar, release=release, environment=environment
        )
        assert rpe.last_deploy_id == deploy.id

    def test_with_project_ids(self) -> None:
        project_bar = self.create_project(organization=self.org, name="bar")
        release = Release.objects.create(organization_id=self.org.id, version="1", total_deploys=0)
        release.add_project(self.project)
        release.add_project(project_bar)

        environment = Environment.objects.create(organization_id=self.org.id, name="production")

        url = reverse(
            "sentry-api-0-organization-release-deploys",
            kwargs={
                "organization_id_or_slug": self.org.slug,
                "version": release.version,
            },
        )

        response = self.client.post(
            url,
            data={
                "name": "foo_bar",
                "environment": "production",
                "url": "https://www.example.com",
                "projects": [self.project.id, project_bar.id],
            },
        )
        assert response.status_code == 201, response.content
        assert response.data["name"] == "foo_bar"
        assert response.data["url"] == "https://www.example.com"
        assert response.data["environment"] == "production"

        deploy = Deploy.objects.get(id=response.data["id"])

        assert deploy.name == "foo_bar"
        assert deploy.environment_id == environment.id
        assert deploy.url == "https://www.example.com"
        assert deploy.release == release

        release = Release.objects.get(id=release.id)
        assert release.total_deploys == 1
        assert release.last_deploy_id == deploy.id

        rpe = ReleaseProjectEnvironment.objects.get(
            project=self.project, release=release, environment=environment
        )
        assert rpe.last_deploy_id == deploy.id

        rpe = ReleaseProjectEnvironment.objects.get(
            project=project_bar, release=release, environment=environment
        )
        assert rpe.last_deploy_id == deploy.id

    def test_with_invalid_project_slug(self) -> None:
        bar_project = self.create_project(organization=self.org, name="bar")
        release = Release.objects.create(organization_id=self.org.id, version="1", total_deploys=0)
        release.add_project(self.project)

        url = reverse(
            "sentry-api-0-organization-release-deploys",
            kwargs={
                "organization_id_or_slug": self.org.slug,
                "version": release.version,
            },
        )

        response = self.client.post(
            url,
            data={
                "name": "foo",
                "environment": "production",
                "url": "https://www.example.com",
                "projects": [bar_project.slug],
            },
        )
        assert response.status_code == 400, response.content
        assert response.data["detail"]["code"] == "parameter-validation-error"
        assert "Invalid projects" in response.data["detail"]["message"]
        assert 0 == Deploy.objects.count()

    def test_environment_validation_failure(self) -> None:
        release = Release.objects.create(
            organization_id=self.org.id, version="123", total_deploys=0
        )
        release.add_project(self.project)

        url = reverse(
            "sentry-api-0-organization-release-deploys",
            kwargs={
                "organization_id_or_slug": self.org.slug,
                "version": release.version,
            },
        )

        response = self.client.post(
            url, data={"name": "foo", "environment": "bad/name", "url": "https://www.example.com"}
        )
        assert response.status_code == 400, response.content
        assert 0 == Deploy.objects.count()

    def test_api_token_with_project_releases_scope(self) -> None:
        """
        Test that tokens with `project:releases` scope can create deploys for only one project
        when the release is associated with multiple projects.
        """
        # Create a second project
        project_bar = self.create_project(organization=self.org, name="bar")

        # Create a release for both projects
        release = Release.objects.create(organization_id=self.org.id, version="1", total_deploys=0)
        release.add_project(self.project)
        release.add_project(project_bar)

        # Create API token with project:releases scope
        user = self.create_user(is_staff=False, is_superuser=False)

        # Add user to the organization - they need to be a member to use the API
        self.create_member(user=user, organization=self.org)

        with assume_test_silo_mode(SiloMode.CONTROL):
            api_token = ApiToken.objects.create(user=user, scope_list=["project:releases"])

        url = reverse(
            "sentry-api-0-organization-release-deploys",
            kwargs={
                "organization_id_or_slug": self.org.slug,
                "version": release.version,
            },
        )

        # Create deploy for only one project (project_bar)
        response = self.client.post(
            url,
            data={
                "name": "single_project_deploy",
                "environment": "production",
                "url": "https://www.example.com",
                "projects": [project_bar.slug],  # Only one project specified
            },
            HTTP_AUTHORIZATION=f"Bearer {api_token.token}",
        )

        assert response.status_code == 201, response.content
        assert response.data["name"] == "single_project_deploy"
        assert response.data["environment"] == "production"

        environment = Environment.objects.get(name="production", organization_id=self.org.id)

        # Verify ReleaseProjectEnvironment was created only for project_bar
        assert ReleaseProjectEnvironment.objects.filter(
            project=project_bar, release=release, environment=environment
        ).exists()

        # Verify ReleaseProjectEnvironment was NOT created for self.project
        assert not ReleaseProjectEnvironment.objects.filter(
            project=self.project, release=release, environment=environment
        ).exists()

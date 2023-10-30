import datetime

from django.urls import reverse

from sentry.models.deploy import Deploy
from sentry.models.environment import Environment
from sentry.models.release import Release
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.testutils.cases import APITestCase


class ReleaseDeploysListTest(APITestCase):
    def test_simple(self):
        project = self.create_project(name="foo")
        release = Release.objects.create(
            organization_id=project.organization_id,
            # test unicode
            version="1–0",
        )
        release.add_project(project)
        Deploy.objects.create(
            environment_id=Environment.objects.create(
                organization_id=project.organization_id, name="production"
            ).id,
            organization_id=project.organization_id,
            release=release,
            date_finished=datetime.datetime.utcnow() - datetime.timedelta(days=1),
        )
        Deploy.objects.create(
            environment_id=Environment.objects.create(
                organization_id=project.organization_id, name="staging"
            ).id,
            organization_id=project.organization_id,
            release=release,
        )

        url = reverse(
            "sentry-api-0-organization-release-deploys",
            kwargs={"organization_slug": project.organization.slug, "version": release.version},
        )

        self.login_as(user=self.user)

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data[0]["environment"] == "staging"
        assert response.data[1]["environment"] == "production"


class ReleaseDeploysCreateTest(APITestCase):
    def setUp(self):
        user = self.create_user(is_staff=False, is_superuser=False)
        self.org = self.create_organization()
        self.org.save()

        team = self.create_team(organization=self.org)
        self.project = self.create_project(name="foo", organization=self.org, teams=[team])

        self.create_member(teams=[team], user=user, organization=self.org)
        self.login_as(user=user)

    def test_simple(self):
        release = Release.objects.create(organization_id=self.org.id, version="1", total_deploys=0)
        release.add_project(self.project)

        environment = Environment.objects.create(organization_id=self.org.id, name="production")

        url = reverse(
            "sentry-api-0-organization-release-deploys",
            kwargs={
                "organization_slug": self.org.slug,
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

    def test_with_project_slugs(self):
        project_bar = self.create_project(organization=self.org, name="bar")
        release = Release.objects.create(organization_id=self.org.id, version="1", total_deploys=0)
        release.add_project(self.project)
        release.add_project(project_bar)

        environment = Environment.objects.create(organization_id=self.org.id, name="production")

        url = reverse(
            "sentry-api-0-organization-release-deploys",
            kwargs={
                "organization_slug": self.org.slug,
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

    def test_with_invalid_project_slug(self):
        bar_project = self.create_project(organization=self.org, name="bar")
        release = Release.objects.create(organization_id=self.org.id, version="1", total_deploys=0)
        release.add_project(self.project)

        url = reverse(
            "sentry-api-0-organization-release-deploys",
            kwargs={
                "organization_slug": self.org.slug,
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

    def test_environment_validation_failure(self):
        release = Release.objects.create(
            organization_id=self.org.id, version="123", total_deploys=0
        )
        release.add_project(self.project)

        url = reverse(
            "sentry-api-0-organization-release-deploys",
            kwargs={
                "organization_slug": self.org.slug,
                "version": release.version,
            },
        )

        response = self.client.post(
            url, data={"name": "foo", "environment": "bad/name", "url": "https://www.example.com"}
        )
        assert response.status_code == 400, response.content
        assert 0 == Deploy.objects.count()

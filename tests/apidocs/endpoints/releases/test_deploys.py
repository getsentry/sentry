import datetime

from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.models.deploy import Deploy
from sentry.models.environment import Environment
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment


class ReleaseDeploysDocs(APIDocsTestCase):
    def setUp(self):
        project = self.create_project(name="foo")
        release = self.create_release(project=project, version="1")
        release.add_project(project)

        prod_deploy = Deploy.objects.create(
            environment_id=Environment.objects.create(
                organization_id=project.organization_id, name="production"
            ).id,
            organization_id=project.organization_id,
            release=release,
            date_finished=datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=1),
        )

        staging_deploy = Deploy.objects.create(
            environment_id=Environment.objects.create(
                organization_id=project.organization_id, name="staging"
            ).id,
            organization_id=project.organization_id,
            release=release,
        )

        ReleaseProjectEnvironment.objects.create(
            project=project,
            release_id=release.id,
            environment_id=prod_deploy.environment_id,
            last_deploy_id=prod_deploy.id,
        )

        ReleaseProjectEnvironment.objects.create(
            project=project,
            release_id=release.id,
            environment_id=staging_deploy.environment_id,
            last_deploy_id=staging_deploy.id,
        )

        self.url = reverse(
            "sentry-api-0-organization-release-deploys",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "version": release.version,
            },
        )

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    def test_post(self):
        data = {
            "name": "foo",
            "environment": "production",
            "url": "https://www.example.com",
        }
        response = self.client.post(self.url, data)
        request = RequestFactory().post(self.url, data)

        self.validate_schema(request, response)

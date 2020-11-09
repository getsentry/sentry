from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse
from sentry.utils.compat import mock

from sentry.integrations.example.integration import ExampleIntegration
from sentry.models import RepositoryProjectPathConfig, Integration, OrganizationIntegration
from sentry.testutils import APITestCase


class ProjectStacktraceLinkTest(APITestCase):
    def setUp(self):
        self.org = self.create_organization(owner=self.user, name="blap")
        self.project = self.create_project(
            name="foo", organization=self.org, teams=[self.create_team(organization=self.org)]
        )

        self.integration = Integration.objects.create(provider="example", name="Example")
        self.integration.add_organization(self.org, self.user)
        self.oi = OrganizationIntegration.objects.get(integration_id=self.integration.id)

        self.repo = self.create_repo(project=self.project, name="getsentry/sentry",)
        self.repo.integration_id = self.integration.id
        self.repo.provider = "example"
        self.repo.save()

        self.config = RepositoryProjectPathConfig.objects.create(
            organization_integration=self.oi,
            project=self.project,
            repository=self.repo,
            stack_root="/usr/src/getsentry",
            source_root="",
        )
        self.filepath = "/usr/src/getsentry/src/sentry/src/sentry/utils/safe.py"
        self.url = reverse(
            "sentry-api-0-project-stacktrace-link",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

    def test_no_filepath(self):
        self.login_as(user=self.user)

        response = self.client.get(self.url, format="json")
        assert response.status_code == 400, response.content

    def test_no_configs(self):
        self.login_as(user=self.user)
        # new project that has no configurations set up for it
        project = self.create_project(
            name="bloop", organization=self.org, teams=[self.create_team(organization=self.org)],
        )

        path = reverse(
            "sentry-api-0-project-stacktrace-link",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        url = u"{}?file={}".format(path, self.filepath)

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert not response.data["config"]

    def test_config_but_no_source_url(self):
        self.login_as(user=self.user)
        url = u"{}?file={}".format(self.url, self.filepath)

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data["config"] == {
            "id": six.text_type(self.config.id),
            "projectId": six.text_type(self.project.id),
            "projectSlug": self.project.slug,
            "repoId": six.text_type(self.repo.id),
            "repoName": self.repo.name,
            "provider": {
                "aspects": {},
                "features": ["commits", "issue-basic"],
                "name": "Example",
                "canDisable": False,
                "key": "example",
                "slug": "example",
                "canAdd": True,
            },
            "sourceRoot": self.config.source_root,
            "stackRoot": self.config.stack_root,
            "integrationId": six.text_type(self.integration.id),
            "defaultBranch": None,
        }
        assert not response.data["sourceUrl"]

    def test_config_and_source_url(self):
        self.login_as(user=self.user)
        url = u"{}?file={}".format(self.url, self.filepath)

        with mock.patch.object(
            ExampleIntegration, "get_stacktrace_link", return_value="https://sourceurl.com/"
        ):
            response = self.client.get(url)
            assert response.status_code == 200, response.content
            assert response.data["config"] == {
                "id": six.text_type(self.config.id),
                "projectId": six.text_type(self.project.id),
                "projectSlug": self.project.slug,
                "repoId": six.text_type(self.repo.id),
                "repoName": self.repo.name,
                "provider": {
                    "aspects": {},
                    "features": ["commits", "issue-basic"],
                    "name": "Example",
                    "canDisable": False,
                    "key": "example",
                    "slug": "example",
                    "canAdd": True,
                },
                "sourceRoot": self.config.source_root,
                "stackRoot": self.config.stack_root,
                "integrationId": six.text_type(self.integration.id),
                "defaultBranch": None,
            }
            assert response.data["sourceUrl"] == "https://sourceurl.com/"

from django.core.urlresolvers import reverse
from sentry.utils.compat import mock

from sentry.integrations.example.integration import ExampleIntegration
from sentry.models import Integration, OrganizationIntegration
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

        self.repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
        )
        self.repo.integration_id = self.integration.id
        self.repo.provider = "example"
        self.repo.save()

        self.config = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="usr/src/getsentry/",
            source_root="",
        )

        self.filepath = "usr/src/getsentry/src/sentry/src/sentry/utils/safe.py"
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
            name="bloop",
            organization=self.org,
            teams=[self.create_team(organization=self.org)],
        )

        path = reverse(
            "sentry-api-0-project-stacktrace-link",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        url = f"{path}?file={self.filepath}"

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data == {
            "config": None,
            "sourceUrl": None,
            "integrations": [self._serialized_integration()],
        }

    def test_file_not_found_error(self):
        self.login_as(user=self.user)
        url = f"{self.url}?file={self.filepath}"

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data["config"] == {
            "id": str(self.config.id),
            "projectId": str(self.project.id),
            "projectSlug": self.project.slug,
            "repoId": str(self.repo.id),
            "repoName": self.repo.name,
            "provider": {
                "aspects": {},
                "features": ["commits", "issue-basic", "stacktrace-link"],
                "name": "Example",
                "canDisable": False,
                "key": "example",
                "slug": "example",
                "canAdd": True,
            },
            "sourceRoot": self.config.source_root,
            "stackRoot": self.config.stack_root,
            "integrationId": str(self.integration.id),
            "defaultBranch": "master",
        }
        assert not response.data["sourceUrl"]
        assert response.data["error"] == "file_not_found"
        assert response.data["integrations"] == [self._serialized_integration()]
        assert (
            response.data["attemptedUrl"]
            == f"https://example.com/{self.repo.name}/blob/master/src/sentry/src/sentry/utils/safe.py"
        )

    def test_stack_root_mismatch_error(self):
        self.login_as(user=self.user)
        url = f"{self.url}?file=wrong/file/path"

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data["config"] == {
            "id": str(self.config.id),
            "projectId": str(self.project.id),
            "projectSlug": self.project.slug,
            "repoId": str(self.repo.id),
            "repoName": self.repo.name,
            "provider": {
                "aspects": {},
                "features": ["commits", "issue-basic", "stacktrace-link"],
                "name": "Example",
                "canDisable": False,
                "key": "example",
                "slug": "example",
                "canAdd": True,
            },
            "sourceRoot": self.config.source_root,
            "stackRoot": self.config.stack_root,
            "integrationId": str(self.integration.id),
            "defaultBranch": "master",
        }
        assert not response.data["sourceUrl"]
        assert response.data["error"] == "stack_root_mismatch"
        assert response.data["integrations"] == [self._serialized_integration()]

    def test_config_and_source_url(self):
        self.login_as(user=self.user)
        url = f"{self.url}?file={self.filepath}"

        with mock.patch.object(
            ExampleIntegration, "get_stacktrace_link", return_value="https://sourceurl.com/"
        ):
            response = self.client.get(url)
            assert response.status_code == 200, response.content
            assert response.data["config"] == {
                "id": str(self.config.id),
                "projectId": str(self.project.id),
                "projectSlug": self.project.slug,
                "repoId": str(self.repo.id),
                "repoName": self.repo.name,
                "provider": {
                    "aspects": {},
                    "features": ["commits", "issue-basic", "stacktrace-link"],
                    "name": "Example",
                    "canDisable": False,
                    "key": "example",
                    "slug": "example",
                    "canAdd": True,
                },
                "sourceRoot": self.config.source_root,
                "stackRoot": self.config.stack_root,
                "integrationId": str(self.integration.id),
                "defaultBranch": "master",
            }
            assert response.data["sourceUrl"] == "https://sourceurl.com/"
            assert response.data["integrations"] == [self._serialized_integration()]

    def _serialized_integration(self):
        return {
            "status": "active",
            "name": "Example",
            "domainName": None,
            "accountType": None,
            "provider": {
                "aspects": {},
                "features": ["commits", "issue-basic", "stacktrace-link"],
                "name": "Example",
                "canDisable": False,
                "key": "example",
                "slug": "example",
                "canAdd": True,
            },
            "id": str(self.integration.id),
            "icon": None,
        }

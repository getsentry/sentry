from uuid import uuid4

from sentry.models import Integration, Repository
from sentry.testutils import APITestCase
from sentry_plugins.github.testutils import INSTALLATION_REPO_EVENT


class InstallationRepoInstallEventWebhookTest(APITestCase):
    def test_simple(self):
        project = self.project  # force creation

        url = "/plugins/github/installations/webhook/"

        integration = Integration.objects.create(
            provider="github_apps", external_id="2", name="octocat"
        )

        integration.add_organization(project.organization)

        response = self.client.post(
            path=url,
            data=INSTALLATION_REPO_EVENT,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="installation_repositories",
            HTTP_X_HUB_SIGNATURE="sha1=6899797a97dc5bb6aab3af927e92e881d03a3bd2",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        assert Repository.objects.filter(
            provider="github",
            name="octocat/Hello-World",
            external_id=1296269,
            organization_id=project.organization_id,
        ).exists()

    def test_updates_existing_repo(self):
        project = self.project  # force creation

        url = "/plugins/github/installations/webhook/"

        integration = Integration.objects.create(
            provider="github_apps", external_id="2", name="octocat"
        )

        integration.add_organization(project.organization)

        repo = Repository.objects.create(
            provider="github",
            name="octocat/Hello-World",
            external_id=1296269,
            organization_id=project.organization_id,
        )
        assert "name" not in repo.config

        response = self.client.post(
            path=url,
            data=INSTALLATION_REPO_EVENT,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="installation_repositories",
            HTTP_X_HUB_SIGNATURE="sha1=6899797a97dc5bb6aab3af927e92e881d03a3bd2",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        repo = Repository.objects.get(id=repo.id)
        assert repo.integration_id == integration.id
        assert repo.config["name"] == repo.name

from __future__ import absolute_import

import logging

from sentry.models import Integration
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.integrations.github.repository import GitHubRepositoryProvider


WEBHOOK_EVENTS = ["push", "pull_request"]


class GitHubEnterpriseRepositoryProvider(GitHubRepositoryProvider):
    name = "GitHub Enterprise"
    logger = logging.getLogger("sentry.plugins.github_enterprise")
    repo_provider = "github_enterprise"

    def _validate_repo(self, client, installation, repo):
        try:
            repo_data = client.get_repo(repo)
        except Exception as e:
            installation.raise_error(e)

        try:
            # make sure installation has access to this specific repo
            client.get_commits(repo)
        except ApiError:
            raise IntegrationError(u"You must grant Sentry access to {}".format(repo))

        return repo_data

    def build_repository_config(self, organization, data):
        integration = Integration.objects.get(
            id=data["integration_id"], provider=self.repo_provider
        )

        base_url = integration.metadata["domain_name"].split("/")[0]
        return {
            "name": data["identifier"],
            "external_id": data["external_id"],
            "url": u"https://{}/{}".format(base_url, data["identifier"]),
            "config": {"name": data["identifier"]},
            "integration_id": data["integration_id"],
        }

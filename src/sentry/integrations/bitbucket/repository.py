from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any

from sentry.integrations.services.repository.model import RpcRepository
from sentry.integrations.services.repository.service import repository_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.locks import locks
from sentry.models.apitoken import generate_token
from sentry.models.options.organization_option import OrganizationOption
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.plugins.providers.integration_repository import RepositoryConfig
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils.email import parse_email, parse_user_name
from sentry.utils.http import absolute_uri

if TYPE_CHECKING:
    from sentry.integrations.bitbucket.integration import BitbucketIntegration  # NOQA


class BitbucketRepositoryProvider(IntegrationRepositoryProvider["BitbucketIntegration"]):
    name = "Bitbucket"
    repo_provider = IntegrationProviderSlug.BITBUCKET.value

    def get_repository_data(self, organization, config):
        installation = self.get_installation(config.get("installation"), organization.id)
        client = installation.get_client()
        try:
            repo = client.get_repo(config["identifier"])
        except Exception as e:
            installation.raise_error(e)
        else:
            config["external_id"] = installation.get_repo_external_id(repo)
            config["name"] = repo["full_name"]
        return config

    def get_webhook_secret(self, organization):
        # TODO(LB): Revisit whether Integrations V3 should be using OrganizationOption for storage
        lock = locks.get(
            f"bitbucket:webhook-secret:{organization.id}",
            duration=60,
            name="bitbucket_webhook_secret",
        )
        with lock.acquire():
            secret = OrganizationOption.objects.get_value(
                organization=organization, key="bitbucket:webhook_secret"
            )
            if secret is None:
                secret = generate_token()
                OrganizationOption.objects.set_value(
                    organization=organization, key="bitbucket:webhook_secret", value=secret
                )
        return secret

    def build_repository_config(
        self, organization: RpcOrganization, data: Mapping[str, Any]
    ) -> RepositoryConfig:
        return {
            "name": data["identifier"],
            "external_id": data["external_id"],
            "url": "https://bitbucket.org/{}".format(data["name"]),
            "config": {"name": data["name"]},
            "integration_id": data["installation"],
        }

    def on_create_repository(self, repo: RpcRepository, organization: RpcOrganization) -> None:
        if repo.config.get("webhook_id"):
            return
        installation = self.get_installation(repo.integration_id, repo.organization_id)
        client = installation.get_client()
        secret = installation.model.metadata.get("webhook_secret", "")
        try:
            resp = client.create_hook(
                repo.config["name"],
                {
                    "description": "sentry-bitbucket-repo-hook",
                    "url": absolute_uri(
                        f"/extensions/bitbucket/organizations/{organization.id}/webhook/"
                    ),
                    "active": True,
                    "secret": secret,
                    "events": ["repo:push", "pullrequest:fulfilled"],
                },
            )
        except Exception as e:
            installation.raise_error(e)
        repo.config["webhook_id"] = resp["uuid"]
        repository_service.update_repository(organization_id=organization.id, update=repo)

    def on_delete_repository(self, repo):
        installation = self.get_installation(repo.integration_id, repo.organization_id)
        client = installation.get_client()

        try:
            client.delete_hook(repo.config["name"], repo.config["webhook_id"])
        except ApiError as exc:
            if exc.code == 404:
                return
            raise

    def _format_commits(self, repo, commit_list):
        return [
            {
                "id": c["hash"],
                "repository": repo.name,
                "author_email": parse_email(c["author"]["raw"]),
                "author_name": parse_user_name(c["author"]["raw"]),
                "message": c["message"],
                "timestamp": self.format_date(c["date"]),
                "patch_set": c.get("patch_set"),
            }
            for c in commit_list
        ]

    def compare_commits(self, repo, start_sha, end_sha):
        installation = self.get_installation(repo.integration_id, repo.organization_id)
        client = installation.get_client()
        # use config name because that is kept in sync via webhooks
        name = repo.config["name"]
        if start_sha is None:
            try:
                res = client.get_last_commits(name, end_sha)
            except Exception as e:
                installation.raise_error(e)
            else:
                return self._format_commits(repo, res[:10])
        else:
            try:
                res = client.compare_commits(name, start_sha, end_sha)
            except Exception as e:
                installation.raise_error(e)
            else:
                return self._format_commits(repo, res)

    def repository_external_slug(self, repo):
        return repo.name

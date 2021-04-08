import logging

from sentry.app import locks
from sentry.models import Integration, OrganizationOption
from sentry.models.apitoken import generate_token
from sentry.plugins import providers
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.utils.http import absolute_uri

from .webhook import parse_raw_user_email, parse_raw_user_name


class BitbucketRepositoryProvider(providers.IntegrationRepositoryProvider):
    name = "Bitbucket"
    logger = logging.getLogger("sentry.integrations.bitbucket")

    def get_installation(self, integration_id, organization_id):
        if integration_id is None:
            raise IntegrationError("Bitbucket requires an integration id.")
        integration_model = Integration.objects.get(
            id=integration_id, organizations=organization_id, provider="bitbucket"
        )

        return integration_model.get_installation(organization_id)

    def get_repository_data(self, organization, config):
        installation = self.get_installation(config.get("installation"), organization.id)
        client = installation.get_client()
        try:
            repo = client.get_repo(config["identifier"])
        except Exception as e:
            installation.raise_error(e)
        else:
            config["external_id"] = str(repo["uuid"])
            config["name"] = repo["full_name"]
        return config

    def get_webhook_secret(self, organization):
        # TODO(LB): Revisit whether Integrations V3 should be using OrganizationOption for storage
        lock = locks.get(f"bitbucket:webhook-secret:{organization.id}", duration=60)
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

    def build_repository_config(self, organization, data):
        installation = self.get_installation(data.get("installation"), organization.id)
        client = installation.get_client()
        try:
            resp = client.create_hook(
                data["identifier"],
                {
                    "description": "sentry-bitbucket-repo-hook",
                    "url": absolute_uri(
                        f"/extensions/bitbucket/organizations/{organization.id}/webhook/"
                    ),
                    "active": True,
                    "events": ["repo:push", "pullrequest:fulfilled"],
                },
            )
        except Exception as e:
            installation.raise_error(e)
        else:
            return {
                "name": data["identifier"],
                "external_id": data["external_id"],
                "url": "https://bitbucket.org/{}".format(data["name"]),
                "config": {"name": data["name"], "webhook_id": resp["uuid"]},
                "integration_id": data["installation"],
            }

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
                "author_email": parse_raw_user_email(c["author"]["raw"]),
                "author_name": parse_raw_user_name(c["author"]["raw"]),
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

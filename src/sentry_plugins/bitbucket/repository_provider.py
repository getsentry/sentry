from __future__ import absolute_import

import six

from uuid import uuid4

from sentry.app import locks
from sentry.models import OrganizationOption
from sentry.plugins import providers
from sentry.utils.http import absolute_uri

from sentry.shared_integrations.exceptions import ApiError

from .endpoints.webhook import parse_raw_user_email, parse_raw_user_name
from .mixins import BitbucketMixin


class BitbucketRepositoryProvider(BitbucketMixin, providers.RepositoryProvider):
    name = "Bitbucket"
    auth_provider = "bitbucket"

    def get_config(self):
        return [
            {
                "name": "name",
                "label": "Repository Name",
                "type": "text",
                "placeholder": "e.g. getsentry/sentry",
                "help": "Enter your repository name, including the owner.",
                "required": True,
            }
        ]

    def validate_config(self, organization, config, actor=None):
        """
        ```
        if config['foo'] and not config['bar']:
            raise PluginError('You cannot configure foo with bar')
        return config
        ```
        """
        if config.get("name"):
            client = self.get_client(actor)
            try:
                repo = client.get_repo(config["name"])
            except Exception as e:
                self.raise_error(e, identity=client.auth)
            else:
                config["external_id"] = six.text_type(repo["uuid"])
        return config

    def get_webhook_secret(self, organization):
        lock = locks.get("bitbucket:webhook-secret:{}".format(organization.id), duration=60)
        with lock.acquire():
            secret = OrganizationOption.objects.get_value(
                organization=organization, key="bitbucket:webhook_secret"
            )
            if secret is None:
                secret = uuid4().hex + uuid4().hex
                OrganizationOption.objects.set_value(
                    organization=organization, key="bitbucket:webhook_secret", value=secret
                )
        return secret

    def create_repository(self, organization, data, actor=None):
        if actor is None:
            raise NotImplementedError("Cannot create a repository anonymously")

        client = self.get_client(actor)
        try:
            resp = client.create_hook(
                data["name"],
                {
                    "description": "sentry-bitbucket-repo-hook",
                    "url": absolute_uri(
                        "/plugins/bitbucket/organizations/{}/webhook/".format(organization.id)
                    ),
                    "active": True,
                    "events": ["repo:push"],
                },
            )
        except Exception as e:
            self.raise_error(e, identity=client.auth)
        else:
            return {
                "name": data["name"],
                "external_id": data["external_id"],
                "url": "https://bitbucket.org/{}".format(data["name"]),
                "config": {"name": data["name"], "webhook_id": resp["uuid"]},
            }

    def delete_repository(self, repo, actor=None):
        if actor is None:
            raise NotImplementedError("Cannot delete a repository anonymously")

        client = self.get_client(actor)
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
                "patch_set": c.get("patch_set"),
            }
            for c in commit_list
        ]

    def compare_commits(self, repo, start_sha, end_sha, actor=None):
        if actor is None:
            raise NotImplementedError("Cannot fetch commits anonymously")

        client = self.get_client(actor)
        # use config name because that is kept in sync via webhooks
        name = repo.config["name"]
        if start_sha is None:
            try:
                res = client.get_last_commits(name, end_sha)
            except Exception as e:
                self.raise_error(e, identity=client.auth)
            else:
                return self._format_commits(repo, res[:10])
        else:
            try:
                res = client.compare_commits(name, start_sha, end_sha)
            except Exception as e:
                self.raise_error(e, identity=client.auth)
            else:
                return self._format_commits(repo, res)

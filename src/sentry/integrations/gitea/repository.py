from __future__ import annotations

import logging
from collections.abc import Mapping, MutableMapping, Sequence
from typing import TYPE_CHECKING, Any

from django.urls import reverse

from sentry.integrations.gitea.utils import is_repo_path
from sentry.integrations.services.repository.model import RpcRepository
from sentry.integrations.services.repository.service import repository_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.plugins.providers.integration_repository import RepositoryConfig
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.utils.http import absolute_uri

if TYPE_CHECKING:
    from sentry.integrations.gitea.integration import GiteaIntegration  # NOQA

logger = logging.getLogger("sentry.integrations.gitea")

# Gitea's `CommitAffectedFiles.status` mapped onto Sentry's patch-set types.
# A rename only reports the new path, so it reads as an addition rather than
# the delete/add pair a full diff would give us.
FILE_STATUS_TO_TYPE = {
    "added": "A",
    "copied": "A",
    "renamed": "A",
    "removed": "D",
    "deleted": "D",
}


class GiteaRepositoryProvider(IntegrationRepositoryProvider["GiteaIntegration"]):
    name = "Gitea"
    repo_provider = IntegrationProviderSlug.GITEA.value

    def get_repository_data(
        self, organization: Any, config: MutableMapping[str, Any]
    ) -> MutableMapping[str, Any]:
        installation = self.get_installation(config.get("installation"), organization.id)
        client = installation.get_client()

        # `identifier` is the `owner/name` pair `get_repositories` handed the
        # UI, which is also what every Gitea repository route is keyed on. It
        # arrives straight off the request body, and Gitea takes it as real path
        # segments, so an unchecked `../../user` would walk off
        # `/repos/{repo}` onto an unrelated route with the install user's token.
        repo_path = config["identifier"]
        if not isinstance(repo_path, str) or not is_repo_path(repo_path):
            raise IntegrationError("Gitea repositories are identified as 'owner/name'.")

        instance = installation.model.metadata["instance"]

        try:
            repo = client.get_repo(repo_path)
        except Exception as e:
            raise installation.raise_error(e)

        config.update(
            {
                "instance": instance,
                "path": repo["full_name"],
                "name": repo["full_name"],
                "external_id": installation.get_repo_external_id(repo),
                "url": repo["html_url"],
            }
        )
        return config

    def build_repository_config(
        self, organization: RpcOrganization, data: Mapping[str, Any]
    ) -> RepositoryConfig:
        return {
            "name": data["name"],
            "external_id": data["external_id"],
            "url": data["url"],
            "config": {
                "instance": data["instance"],
                "path": data["path"],
            },
            "integration_id": data["installation"],
        }

    # Webhooks

    @staticmethod
    def webhook_url(organization_id: int, integration_id: int) -> str:
        # Built with `reverse()` so a change to the route cannot silently
        # desync from the URL we have already written onto customers' repos -
        # which is exactly the drift the sweep below exists to clean up.
        return absolute_uri(
            reverse(
                "sentry-extensions-gitea-webhook",
                kwargs={"organization_id": organization_id, "integration_id": integration_id},
            )
        )

    def on_create_repository(self, repo: RpcRepository, organization: RpcOrganization) -> None:
        """
        Register the per-repository hook that feeds commits, releases and PRs.

        This reconciles rather than skips-if-configured. Replacing the OAuth app
        produces a *new* ``Integration`` row (the ``external_id`` embeds the
        client id so tenants of a shared instance never collide), and the hooks
        created by the old row stay on the Gitea repo with nothing on our side
        tracking them. Sweeping the hooks at our own endpoint means re-linking a
        repository converges on exactly one, whatever the customer did in
        between - no duplicate deliveries.

        Two details carry the safety. The endpoint is scoped to one
        (organization, integration) pair, so the sweep cannot reach a hook a
        different Sentry organization registered on this same repository - two
        organizations that installed with the same OAuth app share an
        ``Integration`` row, so keying the URL on the integration alone would
        have them deleting each other's hooks. And the new hook is created
        *before* the old ones are removed: the repository row is already
        persisted by the time we are called, so failing between a delete and a
        create would leave a repo that looks linked with no hook at all. A
        moment of duplicate deliveries is the cheaper failure.
        """
        installation = self.get_installation(repo.integration_id, repo.organization_id)
        client = installation.get_client()
        repo_path = repo.config["path"]
        # `installation.model.id` rather than `repo.integration_id`: same value,
        # but the installation resolved it, so it is known to exist.
        webhook_url = self.webhook_url(organization.id, installation.model.id)

        log_extra = {
            "gitea.repository.organization_id": repo.organization_id,
            "gitea.repository.integration_id": repo.integration_id,
            "gitea.repository.repository_id": repo.id,
        }

        try:
            existing = client.get_repo_webhooks(repo_path)
            hook_id = client.create_repo_webhook(repo_path, webhook_url)
        except Exception as e:
            raise installation.raise_error(e)

        repo.config["webhook_id"] = hook_id
        repository_service.update_repository(organization_id=organization.id, update=repo)
        logger.info(
            "gitea.repository.webhook_created",
            extra={**log_extra, "gitea.repository.webhook_id": hook_id},
        )

        for hook in existing:
            if hook.get("config", {}).get("url") != webhook_url:
                continue
            try:
                client.delete_repo_webhook(repo_path, hook["id"])
            except ApiError as e:
                # A 404 means somebody removed it between the list and now,
                # which is the state we wanted anyway - but nothing was deleted,
                # so don't claim otherwise.
                if e.code != 404:
                    raise installation.raise_error(e)
                continue
            except Exception as e:
                raise installation.raise_error(e)

            logger.info(
                "gitea.repository.stale_webhook_deleted",
                extra={**log_extra, "gitea.repository.webhook_id": hook["id"]},
            )

    def on_delete_repository(self, repo: Any) -> None:
        """
        Clean up the attached webhook.

        Fires on the ``Repository`` ``pending_delete`` signal, i.e. per
        repository - uninstalling the integration only clears ``integration_id``
        and never gets here, so that teardown lives in
        ``GiteaIntegration.uninstall``.
        """
        webhook_id = repo.config.get("webhook_id")
        if not webhook_id:
            return

        installation = self.get_installation(repo.integration_id, repo.organization_id)
        client = installation.get_client()
        try:
            client.delete_repo_webhook(repo.config["path"], webhook_id)
        except ApiError as e:
            if e.code == 404:
                return
            raise installation.raise_error(e)

    # Commits

    def compare_commits(
        self, repo: Any, start_sha: str | None, end_sha: str
    ) -> Sequence[Mapping[str, Any]]:
        installation = self.get_installation(repo.integration_id, repo.organization_id)
        client = installation.get_client()
        repo_path = repo.config["path"]

        try:
            if start_sha is None:
                commits = client.get_commits(repo_path, sha=end_sha)
            else:
                # `compare/{basehead}` has been available since 1.22.
                commits = client.compare_commits(repo_path, start_sha, end_sha)["commits"] or []
        except Exception as e:
            raise installation.raise_error(e)

        # Deliberately unwrapped: a `KeyError` here is our bug in reading the
        # response, not the instance failing to answer, and burying it in
        # "Error Communicating with Gitea" would hide it from the metrics that
        # would otherwise surface it.
        return [self._format_commit(client, repo, commit) for commit in commits]

    def _format_commit(
        self, client: Any, repo: Any, commit: Mapping[str, Any]
    ) -> Mapping[str, Any]:
        # Gitea nests the git metadata under `commit`, separately from the
        # Gitea *user* accounts it managed to match the addresses to (which may
        # be absent entirely for a contributor without an account).
        detail = commit.get("commit") or {}
        author = detail.get("author") or {}
        return {
            "id": commit["sha"],
            "repository": repo.name,
            "author_email": author.get("email"),
            "author_name": author.get("name"),
            "message": detail.get("message", ""),
            "timestamp": self.format_date(author.get("date")),
            "patch_set": self._patch_set(client, repo.config["path"], commit),
        }

    def _patch_set(
        self, client: Any, repo_path: str, commit: Mapping[str, Any]
    ) -> list[dict[str, str]]:
        """
        The files a commit touched.

        Gitea's list and compare responses carry ``files`` per commit when the
        instance computed the stats, but that is not guaranteed - and an empty
        patch set is not a harmless degradation here, it is suspect commits
        silently resolving nothing. Fall back to the single-commit route, which
        is cached, when the list did not include them.
        """
        files = commit.get("files")
        if files is None:
            files = client.get_commit(repo_path, commit["sha"]).get("files") or []

        return [
            {
                "path": changed["filename"],
                # `status` arrived in Gitea 1.22; older instances omit it and
                # anything unrecognised reads as a modification, which is the
                # harmless guess.
                "type": FILE_STATUS_TO_TYPE.get(changed.get("status", ""), "M"),
            }
            for changed in files
            if changed.get("filename")
        ]

    def pull_request_url(self, repo: Any, pull_request: Any) -> str | None:
        return f"{repo.url}/pulls/{pull_request.key}"

    def repository_external_slug(self, repo: Any) -> str | None:
        return repo.config["path"]

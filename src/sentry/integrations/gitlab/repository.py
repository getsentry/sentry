from __future__ import annotations

import hashlib
import logging
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any

from sentry.integrations.services.repository.model import RpcRepository
from sentry.integrations.services.repository.service import repository_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.plugins.providers.integration_repository import RepositoryConfig
from sentry.shared_integrations.exceptions import ApiError

if TYPE_CHECKING:
    from sentry.integrations.gitlab.integration import GitlabIntegration  # NOQA

logger = logging.getLogger("sentry.integrations.gitlab")


class GitlabRepositoryProvider(IntegrationRepositoryProvider["GitlabIntegration"]):
    name = "Gitlab"
    repo_provider = IntegrationProviderSlug.GITLAB.value

    def get_repository_data(self, organization, config):
        installation = self.get_installation(config.get("installation"), organization.id)
        client = installation.get_client()

        repo_id = config["identifier"]
        instance = installation.model.metadata["instance"]

        try:
            project = client.get_project(repo_id)
        except Exception as e:
            raise installation.raise_error(e)
        config.update(
            {
                "instance": instance,
                "path": project["path_with_namespace"],
                "name": project["name_with_namespace"],
                "external_id": installation.get_repo_external_id(project),
                "project_id": project["id"],
                "url": project["web_url"],
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
                "project_id": data["project_id"],
            },
            "integration_id": data["installation"],
        }

    @staticmethod
    def _webhook_fingerprint(model: Any) -> str:
        """One-way digest of the token we push to GitLab (``external_id:webhook_secret``).

        Stored on ``repo.config`` so we can tell, without any GitLab call, whether the
        token we would push differs from what we last wrote to the hook. The secret is
        derived from the OAuth ``client_id``, so it rotates when an org reinstalls
        against a new OAuth app — precisely the case where we must re-push.
        """
        token = "{}:{}".format(model.external_id, model.metadata.get("webhook_secret", ""))
        return hashlib.sha256(token.encode()).hexdigest()

    def on_create_repository(self, repo: RpcRepository, organization: RpcOrganization) -> None:
        existing_webhook_id = repo.config.get("webhook_id")
        # Namespaced under "gitlab.repository." so these attributes group together in the
        # Sentry Logs UI.
        log_extra = {
            "gitlab.repository.organization_id": repo.organization_id,
            "gitlab.repository.integration_id": repo.integration_id,
            "gitlab.repository.repository_id": repo.id,
            "gitlab.repository.project_id": repo.config.get("project_id"),
        }
        # Emitted on every invocation so we can gauge how often this path runs
        # (and therefore how many webhook create calls we make to GitLab).
        logger.info(
            "gitlab.repository.on_create_repository",
            extra={
                **log_extra,
                "gitlab.repository.has_existing_webhook": bool(existing_webhook_id),
            },
        )
        installation = self.get_installation(repo.integration_id, repo.organization_id)
        project_id = repo.config["project_id"]
        current_fingerprint = self._webhook_fingerprint(installation.model)

        # Steady-state skip: if we already have a hook and the token we'd push is
        # unchanged since we last wrote it, there is nothing to reconcile — return
        # before touching GitLab (or even resolving the OAuth client). This is the
        # common bulk-reactivation path (scm repo sync, auto-link-by-name), which
        # would otherwise issue a PUT per repo for no reason.
        #
        # Trade-off: the fingerprint tracks OUR token, not the hook's existence on
        # GitLab. A hook deleted out-of-band on GitLab *without* a secret rotation is
        # not recreated until the secret rotates or the fingerprint is cleared. This
        # is accepted: external deletion of a Sentry-managed hook is rare, and any
        # secret change still flows through the heal path below.
        if existing_webhook_id and repo.config.get("webhook_fingerprint") == current_fingerprint:
            logger.info(
                "gitlab.repository.webhook_unchanged",
                extra={**log_extra, "gitlab.repository.webhook_id": existing_webhook_id},
            )
            return

        client = installation.get_client()

        # A stored webhook_id can survive an uninstall/reinstall of the integration
        # (disassociate_organization_integration clears integration_id but leaves the
        # config intact and never deletes the GitLab hook). We only ever persist a
        # webhook_id for a hook we created, and GitLab never reuses hook ids, so the
        # stored id resolves to exactly one of two states — let GitLab be the source
        # of truth by addressing the hook directly:
        #   - hook still exists  -> update it in place, refreshing its token + events
        #                           (heals a rotated secret from reinstalling with a
        #                           new OAuth app)
        #   - hook is gone (404) -> fall through and create a fresh one
        if existing_webhook_id:
            try:
                client.update_project_webhook(project_id, existing_webhook_id)
            except ApiError as e:
                if e.code != 404:
                    raise installation.raise_error(e)
                # The stored hook no longer exists on GitLab; recreate it below.
            except Exception as e:
                raise installation.raise_error(e)
            else:
                repo.config["webhook_fingerprint"] = current_fingerprint
                repository_service.update_repository(organization_id=organization.id, update=repo)
                logger.info(
                    "gitlab.repository.webhook_refreshed",
                    extra={**log_extra, "gitlab.repository.webhook_id": existing_webhook_id},
                )
                return

        try:
            hook_id = client.create_project_webhook(project_id)
        except Exception as e:
            raise installation.raise_error(e)
        repo.config["webhook_id"] = hook_id
        repo.config["webhook_fingerprint"] = current_fingerprint
        repository_service.update_repository(organization_id=organization.id, update=repo)
        logger.info(
            # A prior webhook_id that 404'd means we replaced a stale hook rather than
            # creating one for the first time; distinguish the two for telemetry.
            (
                "gitlab.repository.webhook_stale_recreated"
                if existing_webhook_id
                else "gitlab.repository.webhook_created"
            ),
            extra={**log_extra, "gitlab.repository.webhook_id": hook_id},
        )

    def on_delete_repository(self, repo):
        """Clean up the attached webhook"""
        installation = self.get_installation(repo.integration_id, repo.organization_id)
        client = installation.get_client()
        try:
            client.delete_project_webhook(repo.config["project_id"], repo.config["webhook_id"])
        except ApiError as e:
            if e.code == 404:
                return
            raise installation.raise_error(e)

    def compare_commits(self, repo, start_sha, end_sha):
        """Fetch the commit list and diffed files between two SHAs"""
        installation = self.get_installation(repo.integration_id, repo.organization_id)
        client = installation.get_client()
        try:
            if start_sha is None:
                res = client.get_last_commits(repo.config["project_id"], end_sha)
                return self._format_commits(client, repo, res)
            else:
                res = client.compare_commits(repo.config["project_id"], start_sha, end_sha)
                return self._format_commits(client, repo, res["commits"])
        except Exception as e:
            raise installation.raise_error(e)

    def _format_commits(self, client, repo, commit_list):
        """Convert GitLab commits into our internal format"""
        return [
            {
                "id": c["id"],
                "repository": repo.name,
                "author_email": c["author_email"],
                "author_name": c["author_name"],
                "message": c["title"],
                "timestamp": self.format_date(c["created_at"]),
                "patch_set": self._get_patchset(client, repo, c["id"]),
            }
            for c in commit_list
        ]

    def _get_patchset(self, client, repo, sha):
        """GitLab commit lists don't come with diffs so we have
        to make additional round trips.
        """
        diffs = client.get_diff(repo.config["project_id"], sha)
        return self._transform_patchset(diffs)

    def _transform_patchset(self, patch_set):
        file_changes = []
        for changed_file in patch_set:
            if changed_file["new_file"]:
                file_changes.append({"path": changed_file["new_path"], "type": "A"})
            elif changed_file["deleted_file"]:
                file_changes.append({"path": changed_file["old_path"], "type": "D"})
            elif changed_file["renamed_file"]:
                file_changes.append({"path": changed_file["old_path"], "type": "D"})
                file_changes.append({"path": changed_file["new_path"], "type": "A"})
            else:
                file_changes.append({"path": changed_file["new_path"], "type": "M"})

        return file_changes

    def pull_request_url(self, repo, pull_request) -> str:
        return f"{repo.url}/merge_requests/{pull_request.key}"

    def repository_external_slug(self, repo):
        return repo.config["project_id"]

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

from django.db import router, transaction
from django.utils import timezone

from sentry import options
from sentry.constants import ObjectStatus
from sentry.integrations.cursor_origin.client import CursorOriginApiClient
from sentry.integrations.cursor_origin.handlers import WebhookEventHandler
from sentry.integrations.cursor_origin.repository import (
    MAX_COMPARE_COMMITS_OPTION_KEY,
    file_changes_from,
)
from sentry.integrations.cursor_origin.webhook_types import PushedCommit, PushEvent, RefUpdate
from sentry.integrations.services.integration.model import (
    RpcIntegration,
    RpcOrganizationIntegration,
)
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.utils.metrics import IntegrationWebhookEventType
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.commitfilechange import CommitFileChange, post_bulk_create
from sentry.models.repository import Repository
from sentry.plugins.providers.integration_repository import IntegrationRepositoryProvider
from sentry.utils import metrics

logger = logging.getLogger("sentry.integrations.cursor_origin")

EMPTY_SHA = "0" * 40


class RepositoryPushedHandler(WebhookEventHandler):
    """Record the commits a push added.

    Origin's payload names the refs and their old and new tips but carries no commit
    list, so the commits are read back through the API.
    """

    EVENT_TYPE = IntegrationWebhookEventType.PUSH

    def __call__(
        self,
        payload: Mapping[str, Any],
        delivery_id: str,
        integration: RpcIntegration,
        org_integrations: Sequence[RpcOrganizationIntegration],
    ) -> None:
        push = PushEvent.from_payload(payload)
        if not push.ref_updates:
            return

        if integration.status != ObjectStatus.ACTIVE:
            logger.info(
                "cursor_origin.push.inactive_integration",
                extra={"delivery_id": delivery_id, "integration_id": integration.id},
            )
            return

        repositories = Repository.objects.filter(
            organization_id__in=[oi.organization_id for oi in org_integrations],
            provider=f"integrations:{IntegrationProviderSlug.CURSOR_ORIGIN.value}",
            external_id=push.repository_id,
            status=ObjectStatus.ACTIVE,
        )
        if not repositories:
            logger.info(
                "cursor_origin.push.unknown_repository",
                extra={"delivery_id": delivery_id, "external_id": push.repository_id},
            )
            metrics.incr("cursor_origin.push.unknown_repository", sample_rate=1.0)
            return

        for repo in repositories:
            self._handle_repository(repo, integration, push.ref_updates, delivery_id)

    def _handle_repository(
        self,
        repo: Repository,
        integration: RpcIntegration,
        ref_updates: Sequence[RefUpdate],
        delivery_id: str,
    ) -> None:
        installation = integration.get_installation(organization_id=repo.organization_id)
        client = installation.get_client()

        for ref_update in ref_updates:
            if ref_update.deleted or not ref_update.is_branch:
                continue

            commits = self._commits_for(client, repo, ref_update, delivery_id)
            for commit in commits:
                self._record(client, repo, commit)

    def _commits_for(
        self,
        client: CursorOriginApiClient,
        repo: Repository,
        ref_update: RefUpdate,
        delivery_id: str,
    ) -> Sequence[PushedCommit]:
        """The commits this ref update added, oldest first."""
        after = ref_update.after
        head_commit = ref_update.head_commit
        if not after or after == EMPTY_SHA:
            return []

        if ref_update.created:
            return [head_commit] if head_commit else []

        name = repo.config["name"]
        comparison = client.compare_commits(name, ref_update.before, after)
        ahead_by = comparison["aheadBy"]
        if ahead_by <= 0:
            return []

        if ahead_by == 1 and head_commit:
            return [head_commit]

        max_commits = options.get(MAX_COMPARE_COMMITS_OPTION_KEY)
        if max_commits and ahead_by > max_commits:
            logger.info(
                "cursor_origin.push.truncated",
                extra={
                    "delivery_id": delivery_id,
                    "repository_id": repo.id,
                    "ahead_by": ahead_by,
                    "truncated_count": max_commits,
                },
            )
            ahead_by = max_commits

        return [
            PushedCommit.from_api_commit(commit)
            for commit in reversed(client.get_commits(name, sha=after, limit=ahead_by))
        ]

    def _record(
        self, client: CursorOriginApiClient, repo: Repository, commit: PushedCommit
    ) -> None:
        if IntegrationRepositoryProvider.should_ignore_commit(commit.message):
            return

        if Commit.objects.filter(repository_id=repo.id, key=commit.sha).exists():
            return

        author = self._author(repo, commit)
        changes = file_changes_from(client.get_commit_files(repo.config["name"], commit.sha))

        with transaction.atomic(router.db_for_write(Commit)):
            commit_row, created = Commit.objects.get_or_create(
                organization_id=repo.organization_id,
                repository_id=repo.id,
                key=commit.sha,
                defaults={
                    "message": commit.message,
                    "author": author,
                    "date_added": commit.authored_at or timezone.now(),
                },
            )
            if not created:
                return

            rows = [
                CommitFileChange(
                    organization_id=repo.organization_id,
                    commit_id=commit_row.id,
                    filename=change["path"],
                    type=change["type"],
                )
                for change in changes
            ]
            if rows:
                CommitFileChange.objects.bulk_create(rows, ignore_conflicts=True)
                post_bulk_create(rows)

    def _author(self, repo: Repository, commit: PushedCommit) -> CommitAuthor | None:
        if not commit.author_email or len(commit.author_email) > 75:
            return None

        commit_author, _ = CommitAuthor.objects.get_or_create(
            organization_id=repo.organization_id,
            email=commit.author_email,
            defaults={"name": commit.author_name[:128]},
        )
        return commit_author

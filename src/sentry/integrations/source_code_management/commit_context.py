from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import sentry_sdk
from django.utils import timezone as django_timezone

from sentry import analytics
from sentry.auth.exceptions import IdentityNotValid
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.integrations.source_code_management.metrics import (
    CommitContextHaltReason,
    CommitContextIntegrationInteractionEvent,
    SCMIntegrationInteractionType,
)
from sentry.locks import locks
from sentry.models.commit import Commit
from sentry.models.group import Group
from sentry.models.groupowner import GroupOwner
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.project import Project
from sentry.models.pullrequest import (
    CommentType,
    PullRequest,
    PullRequestComment,
    PullRequestCommit,
)
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiRateLimitedError
from sentry.users.models.identity import Identity
from sentry.utils import metrics
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)


def _debounce_pr_comment_cache_key(pullrequest_id: int) -> str:
    return f"pr-comment-{pullrequest_id}"


def _debounce_pr_comment_lock_key(pullrequest_id: int) -> str:
    return f"queue_comment_task:{pullrequest_id}"


def _pr_comment_log(integration_name: str, suffix: str) -> str:
    return f"{integration_name}.pr_comment.{suffix}"


PR_COMMENT_TASK_TTL = timedelta(minutes=5).total_seconds()
PR_COMMENT_WINDOW = 14  # days


@dataclass
class SourceLineInfo:
    lineno: int
    path: str
    ref: str
    repo: Repository
    code_mapping: RepositoryProjectPathConfig


@dataclass
class CommitInfo:
    commitId: str | None
    committedDate: datetime
    commitMessage: str | None
    commitAuthorName: str | None
    commitAuthorEmail: str | None


@dataclass
class FileBlameInfo(SourceLineInfo):
    commit: CommitInfo


class CommitContextIntegration(ABC):
    """
    Base class for integrations that include commit context features: suspect commits, suspect PR comments
    """

    @property
    @abstractmethod
    def integration_name(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def get_client(self) -> CommitContextClient:
        raise NotImplementedError

    def get_blame_for_files(
        self, files: Sequence[SourceLineInfo], extra: Mapping[str, Any]
    ) -> list[FileBlameInfo]:
        """
        Calls the client's `get_blame_for_files` method to fetch blame for a list of files.

        files: list of FileBlameInfo objects
        """
        with CommitContextIntegrationInteractionEvent(
            interaction_type=SCMIntegrationInteractionType.GET_BLAME_FOR_FILES,
            provider_key=self.integration_name,
        ).capture() as lifecycle:
            try:
                client = self.get_client()
            except Identity.DoesNotExist as e:
                lifecycle.record_failure(e)
                sentry_sdk.capture_exception(e)
                return []
            try:
                response = client.get_blame_for_files(files, extra)
            except IdentityNotValid as e:
                lifecycle.record_failure(e)
                sentry_sdk.capture_exception(e)
                return []
            # Swallow rate limited errors so we don't log them as exceptions
            except ApiRateLimitedError as e:
                sentry_sdk.capture_exception(e)
                lifecycle.record_halt(e)
                return []
            return response

    def get_commit_context_all_frames(
        self, files: Sequence[SourceLineInfo], extra: Mapping[str, Any]
    ) -> list[FileBlameInfo]:
        """
        Given a list of source files and line numbers,returns the commit info for the most recent commit.
        """
        return self.get_blame_for_files(files, extra)

    def queue_comment_task_if_needed(
        self,
        project: Project,
        commit: Commit,
        group_owner: GroupOwner,
        group_id: int,
    ) -> None:
        with CommitContextIntegrationInteractionEvent(
            interaction_type=SCMIntegrationInteractionType.QUEUE_COMMENT_TASK,
            provider_key=self.integration_name,
            organization=project.organization,
            project=project,
            commit=commit,
        ).capture() as lifecycle:
            if not OrganizationOption.objects.get_value(
                organization=project.organization,
                key="sentry:github_pr_bot",
                default=True,
            ):
                # TODO: remove logger in favor of the log recorded in  lifecycle.record_halt
                logger.info(
                    _pr_comment_log(integration_name=self.integration_name, suffix="disabled"),
                    extra={"organization_id": project.organization_id},
                )
                lifecycle.record_halt(CommitContextHaltReason.PR_BOT_DISABLED)
                return

            repo_query = Repository.objects.filter(id=commit.repository_id).order_by("-date_added")
            group = Group.objects.get_from_cache(id=group_id)
            if not (
                group.level is not logging.INFO and repo_query.exists()
            ):  # Don't comment on info level issues
                logger.info(
                    _pr_comment_log(
                        integration_name=self.integration_name, suffix="incorrect_repo_config"
                    ),
                    extra={"organization_id": project.organization_id},
                )
                lifecycle.record_halt(CommitContextHaltReason.INCORRECT_REPO_CONFIG)
                return

            repo: Repository = repo_query.get()
            lifecycle.add_extra("repository_id", repo.id)

            logger.info(
                _pr_comment_log(
                    integration_name=self.integration_name, suffix="queue_comment_check"
                ),
                extra={"organization_id": commit.organization_id, "merge_commit_sha": commit.key},
            )
            scope = sentry_sdk.Scope.get_isolation_scope()
            scope.set_tag("queue_comment_check.merge_commit_sha", commit.key)
            scope.set_tag("queue_comment_check.organization_id", commit.organization_id)
            from sentry.integrations.github.tasks.pr_comment import github_comment_workflow

            # client will raise an Exception if the request is not successful
            try:
                client = self.get_client()
                merge_commit_sha = client.get_merge_commit_sha_from_commit(
                    repo=repo.name, sha=commit.key
                )
            except Exception as e:
                sentry_sdk.capture_exception(e)
                lifecycle.record_halt(e)
                return

            if merge_commit_sha is None:
                logger.info(
                    _pr_comment_log(
                        integration_name=self.integration_name,
                        suffix="queue_comment_workflow.commit_not_in_default_branch",
                    ),
                    extra={
                        "organization_id": commit.organization_id,
                        "repository_id": repo.id,
                        "commit_sha": commit.key,
                    },
                )
                lifecycle.record_halt(CommitContextHaltReason.COMMIT_NOT_IN_DEFAULT_BRANCH)
                return

            pr_query = PullRequest.objects.filter(
                organization_id=commit.organization_id,
                repository_id=commit.repository_id,
                merge_commit_sha=merge_commit_sha,
            )
            if not pr_query.exists():
                logger.info(
                    _pr_comment_log(
                        integration_name=self.integration_name,
                        suffix="queue_comment_workflow.missing_pr",
                    ),
                    extra={
                        "organization_id": commit.organization_id,
                        "repository_id": repo.id,
                        "commit_sha": commit.key,
                    },
                )
                lifecycle.record_halt(CommitContextHaltReason.MISSING_PR)
                return

            pr = pr_query.first()
            lifecycle.add_extra("pull_request_id", pr.id if pr else None)
            assert pr is not None
            # need to query explicitly for merged PR comments since we can have multiple comments per PR
            merged_pr_comment_query = PullRequestComment.objects.filter(
                pull_request_id=pr.id, comment_type=CommentType.MERGED_PR
            )
            if pr.date_added >= datetime.now(tz=timezone.utc) - timedelta(
                days=PR_COMMENT_WINDOW
            ) and (
                not merged_pr_comment_query.exists()
                or group_owner.group_id not in merged_pr_comment_query[0].group_ids
            ):
                lock = locks.get(
                    _debounce_pr_comment_lock_key(pr.id), duration=10, name="queue_comment_task"
                )
                with lock.acquire():
                    cache_key = _debounce_pr_comment_cache_key(pullrequest_id=pr.id)
                    if cache.get(cache_key) is not None:
                        lifecycle.record_halt(CommitContextHaltReason.ALREADY_QUEUED)
                        return

                    # create PR commit row for suspect commit and PR
                    PullRequestCommit.objects.get_or_create(commit=commit, pull_request=pr)

                    logger.info(
                        _pr_comment_log(
                            integration_name=self.integration_name, suffix="queue_comment_workflow"
                        ),
                        extra={"pullrequest_id": pr.id, "project_id": group_owner.project_id},
                    )

                    cache.set(cache_key, True, PR_COMMENT_TASK_TTL)

                    github_comment_workflow.delay(
                        pullrequest_id=pr.id, project_id=group_owner.project_id
                    )

    def create_or_update_comment(
        self,
        repo: Repository,
        pr_key: str,
        comment_body: str,
        pullrequest_id: int,
        issue_list: list[int],
        metrics_base: str,
        comment_type: int = CommentType.MERGED_PR,
        language: str | None = None,
        github_copilot_actions: list[dict[str, Any]] | None = None,
    ):
        client = self.get_client()

        pr_comment_query = PullRequestComment.objects.filter(
            pull_request__id=pullrequest_id, comment_type=comment_type
        )
        pr_comment = pr_comment_query[0] if pr_comment_query.exists() else None

        interaction_type = (
            SCMIntegrationInteractionType.CREATE_COMMENT
            if not pr_comment
            else SCMIntegrationInteractionType.UPDATE_COMMENT
        )

        with CommitContextIntegrationInteractionEvent(
            interaction_type=interaction_type,
            provider_key=self.integration_name,
            repository=repo,
            pull_request_id=pullrequest_id,
        ).capture():
            if pr_comment is None:
                resp = client.create_comment(
                    repo=repo.name,
                    issue_id=str(pr_key),
                    data=(
                        {
                            "body": comment_body,
                            "actions": github_copilot_actions,
                        }
                        if github_copilot_actions
                        else {"body": comment_body}
                    ),
                )

                current_time = django_timezone.now()
                comment = PullRequestComment.objects.create(
                    external_id=resp.body["id"],
                    pull_request_id=pullrequest_id,
                    created_at=current_time,
                    updated_at=current_time,
                    group_ids=issue_list,
                    comment_type=comment_type,
                )
                metrics.incr(
                    metrics_base.format(integration=self.integration_name, key="comment_created")
                )

                if comment_type == CommentType.OPEN_PR:
                    analytics.record(
                        "open_pr_comment.created",
                        comment_id=comment.id,
                        org_id=repo.organization_id,
                        pr_id=pullrequest_id,
                        language=(language or "not found"),
                    )
            else:
                resp = client.update_comment(
                    repo=repo.name,
                    issue_id=str(pr_key),
                    comment_id=pr_comment.external_id,
                    data=(
                        {
                            "body": comment_body,
                            "actions": github_copilot_actions,
                        }
                        if github_copilot_actions
                        else {"body": comment_body}
                    ),
                )
                metrics.incr(
                    metrics_base.format(integration=self.integration_name, key="comment_updated")
                )
                pr_comment.updated_at = django_timezone.now()
                pr_comment.group_ids = issue_list
                pr_comment.save()

            logger_event = metrics_base.format(
                integration=self.integration_name, key="create_or_update_comment"
            )
            logger.info(
                logger_event,
                extra={"new_comment": pr_comment is None, "pr_key": pr_key, "repo": repo.name},
            )


class CommitContextClient(ABC):
    @abstractmethod
    def get_blame_for_files(
        self, files: Sequence[SourceLineInfo], extra: Mapping[str, Any]
    ) -> list[FileBlameInfo]:
        """Get the blame for a list of files. This method should include custom metrics for the specific integration implementation."""
        raise NotImplementedError

    @abstractmethod
    def create_comment(self, repo: str, issue_id: str, data: Mapping[str, Any]) -> Any:
        raise NotImplementedError

    @abstractmethod
    def update_comment(
        self, repo: str, issue_id: str, comment_id: str, data: Mapping[str, Any]
    ) -> Any:
        raise NotImplementedError

    @abstractmethod
    def get_merge_commit_sha_from_commit(self, repo: str, sha: str) -> str | None:
        raise NotImplementedError

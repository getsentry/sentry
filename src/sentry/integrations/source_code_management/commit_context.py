from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from django.utils import timezone

from sentry import analytics
from sentry.auth.exceptions import IdentityNotValid
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.pullrequest import CommentType, PullRequestComment
from sentry.models.repository import Repository
from sentry.users.models.identity import Identity
from sentry.utils import metrics

logger = logging.getLogger(__name__)


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
        try:
            client = self.get_client()
        except Identity.DoesNotExist:
            return []
        try:
            response = client.get_blame_for_files(files, extra)
        except IdentityNotValid:
            return []

        return response

    def get_commit_context_all_frames(
        self, files: Sequence[SourceLineInfo], extra: Mapping[str, Any]
    ) -> list[FileBlameInfo]:
        """
        Given a list of source files and line numbers,returns the commit info for the most recent commit.
        """
        return self.get_blame_for_files(files, extra)

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
    ):
        client = self.get_client()

        pr_comment_query = PullRequestComment.objects.filter(
            pull_request__id=pullrequest_id, comment_type=comment_type
        )
        pr_comment = pr_comment_query[0] if pr_comment_query.exists() else None

        # client will raise ApiError if the request is not successful
        if pr_comment is None:
            resp = client.create_comment(
                repo=repo.name, issue_id=str(pr_key), data={"body": comment_body}
            )

            current_time = timezone.now()
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
                data={"body": comment_body},
            )
            metrics.incr(
                metrics_base.format(integration=self.integration_name, key="comment_updated")
            )
            pr_comment.updated_at = timezone.now()
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

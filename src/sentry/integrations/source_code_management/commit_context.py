from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import sentry_sdk
from django.db import connection
from django.utils import timezone as django_timezone
from snuba_sdk import Column, Condition, Direction, Entity, Function, Op, OrderBy, Query
from snuba_sdk import Request as SnubaRequest

from sentry.auth.exceptions import IdentityNotValid
from sentry.integrations.gitlab.constants import GITLAB_CLOUD_BASE_URL
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.integrations.source_code_management.metrics import (
    CommitContextHaltReason,
    CommitContextIntegrationInteractionEvent,
    SCMIntegrationInteractionType,
)
from sentry.integrations.types import ExternalProviderEnum
from sentry.locks import locks
from sentry.models.commit import Commit
from sentry.models.group import Group
from sentry.models.groupowner import GroupOwner
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.pullrequest import (
    CommentType,
    PullRequest,
    PullRequestComment,
    PullRequestCommit,
)
from sentry.models.repository import Repository
from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiHostError,
    ApiInvalidRequestError,
    ApiRateLimitedError,
    ApiRetryError,
    UnknownHostError,
)
from sentry.snuba.dataset import Dataset
from sentry.snuba.occurrences_rpc import Occurrences
from sentry.snuba.referrer import Referrer
from sentry.users.models.identity import Identity
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)


def _debounce_pr_comment_cache_key(pullrequest_id: int) -> str:
    return f"pr-comment-{pullrequest_id}"


def _debounce_pr_comment_lock_key(pullrequest_id: int) -> str:
    return f"queue_comment_task:{pullrequest_id}"


def _pr_comment_log(integration_name: str, suffix: str) -> str:
    return f"{integration_name}.pr_comment.{suffix}"


PR_COMMENT_TASK_TTL = timedelta(minutes=5).total_seconds()
PR_COMMENT_WINDOW = 14  # days

MERGED_PR_METRICS_BASE = "{integration}.pr_comment.{key}"
MAX_SUSPECT_COMMITS = 1000


@dataclass
class SourceLineInfo:
    lineno: int | None
    path: str
    ref: str
    repo: Repository
    code_mapping: RepositoryProjectPathConfig


@dataclass
class CommitInfo:
    commitId: str
    committedDate: datetime
    commitMessage: str | None
    commitAuthorName: str | None
    commitAuthorEmail: str | None


@dataclass
class FileBlameInfo(SourceLineInfo):
    commit: CommitInfo


@dataclass
class PullRequestIssue:
    title: str
    subtitle: str | None
    url: str
    affected_users: int | None = None
    event_count: int | None = None
    function_name: str | None = None


@dataclass
class PullRequestFile:
    filename: str
    patch: str


ISSUE_TITLE_MAX_LENGTH = 50
MERGED_PR_SINGLE_ISSUE_TEMPLATE = "* ‼️ [**{title}**]({url}){environment}\n"


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
        self, files: Sequence[SourceLineInfo], extra: dict[str, Any]
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
            except ApiInvalidRequestError as e:
                # TODO(ecosystem): Remove this once we have a better way to handle this
                lifecycle.record_halt(e)
                return []
            except UnknownHostError as e:
                lifecycle.record_halt(e)
                return []
            except (ApiRetryError, ApiHostError) as e:
                # Ignore retry errors for GitLab
                # Ignore host error errors for GitLab
                # TODO(ecosystem): Remove this once we have a better way to handle this
                if (
                    self.integration_name == ExternalProviderEnum.GITLAB.value
                    and client.base_url != GITLAB_CLOUD_BASE_URL
                ):
                    lifecycle.record_halt(e)
                    return []
                else:
                    raise

            return response

    def get_commit_context_all_frames(
        self, files: Sequence[SourceLineInfo], extra: dict[str, Any]
    ) -> list[FileBlameInfo]:
        """
        Given a list of source files and line numbers,returns the commit info for the most recent commit.
        """
        return self.get_blame_for_files(files, extra)

    def queue_pr_comment_task_if_needed(
        self,
        project: Project,
        commit: Commit,
        group_owner: GroupOwner,
        group_id: int,
    ) -> None:
        try:
            # TODO(jianyuan): Remove this try/except once we have implemented the abstract method for all integrations
            pr_comment_workflow = self.get_pr_comment_workflow()
        except NotImplementedError:
            return

        if not OrganizationOption.objects.get_value(
            organization=project.organization,
            key=pr_comment_workflow.organization_option_key,
            default=False,
        ):
            return

        repo_query = Repository.objects.filter(id=commit.repository_id).order_by("-date_added")
        group = Group.objects.get_from_cache(id=group_id)
        if not (
            group.level is not logging.INFO and repo_query.exists()
        ):  # Don't comment on info level issues
            return

        with CommitContextIntegrationInteractionEvent(
            interaction_type=SCMIntegrationInteractionType.QUEUE_COMMENT_TASK,
            provider_key=self.integration_name,
            organization_id=project.organization_id,
            project=project,
            commit=commit,
        ).capture() as lifecycle:
            repo: Repository = repo_query.get()
            lifecycle.add_extras(
                {
                    "repository_id": repo.id,
                    "group_id": group_id,
                }
            )

            logger.info(
                _pr_comment_log(
                    integration_name=self.integration_name, suffix="queue_comment_check"
                ),
                extra={"organization_id": commit.organization_id, "merge_commit_sha": commit.key},
            )
            scope = sentry_sdk.get_isolation_scope()
            scope.set_tag("queue_comment_check.merge_commit_sha", commit.key)
            scope.set_tag("queue_comment_check.organization_id", commit.organization_id)

            # client will raise an Exception if the request is not successful
            try:
                client = self.get_client()
                merge_commit_sha = client.get_merge_commit_sha_from_commit(
                    repo=repo, sha=commit.key
                )
            except Exception as e:
                sentry_sdk.capture_exception(e)
                lifecycle.record_halt(e)
                return

            if merge_commit_sha is None:
                lifecycle.add_extra("commit_sha", commit.key)
                lifecycle.record_halt(CommitContextHaltReason.COMMIT_NOT_IN_DEFAULT_BRANCH)
                return

            lifecycle.add_extra("merge_commit_sha", merge_commit_sha)

            pr_query = PullRequest.objects.filter(
                organization_id=commit.organization_id,
                repository_id=commit.repository_id,
                merge_commit_sha=merge_commit_sha,
            )
            if not pr_query.exists():
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

                    pr_comment_workflow.queue_task(pr=pr, project_id=group_owner.project_id)

    def create_or_update_comment(
        self,
        repo: Repository,
        pr: PullRequest,
        comment_data: dict[str, Any],
        issue_list: list[int],
        metrics_base: str,
        comment_type: int = CommentType.MERGED_PR,
        language: str | None = None,
    ) -> None:
        client = self.get_client()

        pr_comment = PullRequestComment.objects.filter(
            pull_request__id=pr.id, comment_type=comment_type
        ).first()

        interaction_type = (
            SCMIntegrationInteractionType.CREATE_COMMENT
            if not pr_comment
            else SCMIntegrationInteractionType.UPDATE_COMMENT
        )

        with CommitContextIntegrationInteractionEvent(
            interaction_type=interaction_type,
            provider_key=self.integration_name,
            repository=repo,
            pull_request_id=pr.id,
        ).capture():
            if pr_comment is None:
                resp = client.create_pr_comment(repo=repo, pr=pr, data=comment_data)

                current_time = django_timezone.now()
                PullRequestComment.objects.create(
                    external_id=resp.body["id"],
                    pull_request_id=pr.id,
                    created_at=current_time,
                    updated_at=current_time,
                    group_ids=issue_list,
                    comment_type=comment_type,
                )
                metrics.incr(
                    metrics_base.format(integration=self.integration_name, key="comment_created")
                )
            else:
                resp = client.update_pr_comment(
                    repo=repo,
                    pr=pr,
                    pr_comment=pr_comment,
                    data=comment_data,
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
                extra={"new_comment": pr_comment is None, "pr_key": pr.key, "repo": repo.name},
            )

    @abstractmethod
    def on_create_or_update_comment_error(self, api_error: ApiError, metrics_base: str) -> bool:
        """
        Handle errors from the create_or_update_comment method.

        Returns True if the error was handled, False otherwise.
        """
        raise NotImplementedError

    # TODO(jianyuan): Make this an abstract method
    def get_pr_comment_workflow(self) -> PRCommentWorkflow:
        raise NotImplementedError


class CommitContextClient(ABC):
    base_url: str

    @abstractmethod
    def get_blame_for_files(
        self, files: Sequence[SourceLineInfo], extra: dict[str, Any]
    ) -> list[FileBlameInfo]:
        """Get the blame for a list of files. This method should include custom metrics for the specific integration implementation."""
        raise NotImplementedError

    @abstractmethod
    def create_comment(self, repo: str, issue_id: str, data: dict[str, Any]) -> Any:
        raise NotImplementedError

    @abstractmethod
    def update_comment(
        self, repo: str, issue_id: str, comment_id: str, data: dict[str, Any]
    ) -> Any:
        raise NotImplementedError

    @abstractmethod
    def create_pr_comment(self, repo: Repository, pr: PullRequest, data: dict[str, Any]) -> Any:
        raise NotImplementedError

    @abstractmethod
    def update_pr_comment(
        self,
        repo: Repository,
        pr: PullRequest,
        pr_comment: PullRequestComment,
        data: dict[str, Any],
    ) -> Any:
        raise NotImplementedError

    @abstractmethod
    def get_merge_commit_sha_from_commit(self, repo: Repository, sha: str) -> str | None:
        raise NotImplementedError


class PRCommentWorkflow(ABC):
    def __init__(self, integration: CommitContextIntegration):
        self.integration = integration

    @property
    @abstractmethod
    def organization_option_key(self) -> str:
        raise NotImplementedError

    @property
    @abstractmethod
    def referrer(self) -> Referrer:
        raise NotImplementedError

    @property
    @abstractmethod
    def referrer_id(self) -> str:
        raise NotImplementedError

    def queue_task(self, pr: PullRequest, project_id: int) -> None:
        from sentry.integrations.source_code_management.tasks import pr_comment_workflow

        pr_comment_workflow.delay(pr_id=pr.id, project_id=project_id)

    @abstractmethod
    def get_comment_body(self, issue_ids: list[int]) -> str:
        raise NotImplementedError

    @abstractmethod
    def get_comment_data(
        self,
        organization: Organization,
        repo: Repository,
        pr: PullRequest,
        comment_body: str,
        issue_ids: list[int],
    ) -> dict[str, Any]:
        raise NotImplementedError

    def get_issue_ids_from_pr(self, pr: PullRequest, limit: int = MAX_SUSPECT_COMMITS) -> list[int]:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT go.group_id issue_id
                FROM sentry_groupowner go
                JOIN sentry_pullrequest_commit c ON c.commit_id = (go.context::jsonb->>'commitId')::bigint
                JOIN sentry_pull_request pr ON c.pull_request_id = pr.id
                WHERE go.type=0
                AND pr.id=%s
                ORDER BY go.date_added
                LIMIT %s
                """,
                params=[pr.id, limit],
            )
            return [issue_id for (issue_id,) in cursor.fetchall()]

    def _get_top_5_issues_by_count_snuba(
        self, issue_ids: list[int], project: Project
    ) -> list[dict[str, Any]]:
        """Snuba implementation: Given a list of issue group ids, return a sublist of the top 5 ordered by event count"""
        request = SnubaRequest(
            dataset=Dataset.Events.value,
            app_id="default",
            tenant_ids={"organization_id": project.organization_id},
            query=(
                Query(Entity("events"))
                .set_select([Column("group_id"), Function("count", [], "event_count")])
                .set_groupby([Column("group_id")])
                .set_where(
                    [
                        Condition(Column("project_id"), Op.EQ, project.id),
                        Condition(Column("group_id"), Op.IN, issue_ids),
                        Condition(Column("timestamp"), Op.GTE, datetime.now() - timedelta(days=30)),
                        Condition(Column("timestamp"), Op.LT, datetime.now()),
                        Condition(Column("level"), Op.NEQ, "info"),
                    ]
                )
                .set_orderby([OrderBy(Column("event_count"), Direction.DESC)])
                .set_limit(5)
            ),
        )
        return raw_snql_query(request, referrer=self.referrer.value)["data"]

    def _get_top_5_issues_by_count_eap(
        self, issue_ids: list[int], project: Project
    ) -> list[dict[str, Any]]:
        """EAP implementation: Given a list of issue group ids, return a sublist of the top 5 ordered by event count"""
        organization = Organization.objects.get(id=project.organization_id)
        now = datetime.now()
        start = now - timedelta(days=30)

        snuba_params = SnubaParams(
            start=start,
            end=now,
            organization=organization,
            projects=[project],
        )

        group_id_filter = " OR ".join([f"group_id:{gid}" for gid in issue_ids])
        group_id_query = (
            f"({group_id_filter})" if len(issue_ids) > 1 else f"group_id:{issue_ids[0]}"
        )
        query_string = f"{group_id_query} !level:info"

        try:
            result = Occurrences.run_table_query(
                params=snuba_params,
                query_string=query_string,
                selected_columns=["group_id", "count()"],
                orderby=["-count()"],
                offset=0,
                limit=5,
                referrer=self.referrer.value,
                config=SearchResolverConfig(),
            )
            return [
                {"group_id": row["group_id"], "event_count": row["count()"]}
                for row in result["data"]
            ]
        except Exception:
            logger.exception(
                "Fetching top 5 issues by count from EAP failed",
                extra={
                    "issue_ids": issue_ids,
                    "project_id": project.id,
                    "organization_id": project.organization_id,
                },
            )
            return []

    def get_top_5_issues_by_count(
        self, issue_ids: list[int], project: Project
    ) -> list[dict[str, Any]]:
        """Given a list of issue group ids, return a sublist of the top 5 ordered by event count"""
        if not issue_ids:
            return []

        snuba_results = self._get_top_5_issues_by_count_snuba(issue_ids, project)
        results = snuba_results

        if EAPOccurrencesComparator.should_check_experiment(
            "integrations.pr_comment.get_top_5_issues_by_count"
        ):
            eap_results = self._get_top_5_issues_by_count_eap(issue_ids, project)
            results = EAPOccurrencesComparator.check_and_choose(
                snuba_results,
                eap_results,
                "integrations.pr_comment.get_top_5_issues_by_count",
                is_experimental_data_a_null_result=len(eap_results) == 0,
            )

        return results

    @staticmethod
    def _truncate_title(title: str, max_length: int = ISSUE_TITLE_MAX_LENGTH) -> str:
        """Truncate title if it's too long and add ellipsis."""
        if len(title) <= max_length:
            return title
        return title[:max_length].rstrip() + "..."

    def get_environment_info(self, issue: Group) -> str:
        try:
            recommended_event = issue.get_recommended_event()
            if recommended_event:
                environment = recommended_event.get_environment()
                if environment and environment.name:
                    return f" in `{environment.name}`"
        except Exception as e:
            # If anything goes wrong, just continue without environment info
            logger.info(
                "get_environment_info.no-environment",
                extra={"issue_id": issue.id, "error": e},
            )
        return ""

    @staticmethod
    def get_merged_pr_single_issue_template(title: str, url: str, environment: str) -> str:
        truncated_title = PRCommentWorkflow._truncate_title(title)
        return MERGED_PR_SINGLE_ISSUE_TEMPLATE.format(
            title=truncated_title,
            url=url,
            environment=environment,
        )

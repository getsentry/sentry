from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta, timezone
from typing import Any

import sentry_sdk
from django.db import connection
from django.db.models import Value
from django.db.models.functions import StrIndex
from django.utils import timezone as django_timezone
from snuba_sdk import (
    BooleanCondition,
    BooleanOp,
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Op,
    OrderBy,
    Query,
)
from snuba_sdk import Request as SnubaRequest

from sentry import analytics
from sentry.auth.exceptions import IdentityNotValid
from sentry.constants import ObjectStatus
from sentry.integrations.gitlab.constants import GITLAB_CLOUD_BASE_URL
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.integrations.services.integration import integration_service
from sentry.integrations.source_code_management.constants import STACKFRAME_COUNT
from sentry.integrations.source_code_management.language_parsers import PATCH_PARSERS
from sentry.integrations.source_code_management.metrics import (
    CommitContextHaltReason,
    CommitContextIntegrationInteractionEvent,
    SCMIntegrationInteractionType,
)
from sentry.integrations.types import ExternalProviderEnum
from sentry.locks import locks
from sentry.models.commit import Commit
from sentry.models.group import Group, GroupStatus
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
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiInvalidRequestError,
    ApiRateLimitedError,
    ApiRetryError,
)
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.users.models.identity import Identity
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)


@dataclass(frozen=True, kw_only=True)
class CommitContextReferrers:
    pr_comment_bot: Referrer


@dataclass(frozen=True, kw_only=True)
class CommitContextReferrerIds:
    pr_bot: str
    open_pr_bot: str


@dataclass(frozen=True, kw_only=True)
class CommitContextOrganizationOptionKeys:
    pr_bot: str


def debounce_pr_comment_cache_key(pullrequest_id: int) -> str:
    return f"pr-comment-{pullrequest_id}"


def _debounce_pr_comment_lock_key(pullrequest_id: int) -> str:
    return f"queue_comment_task:{pullrequest_id}"


def _pr_comment_log(integration_name: str, suffix: str) -> str:
    return f"{integration_name}.pr_comment.{suffix}"


def _open_pr_comment_log(integration_name: str, suffix: str) -> str:
    return f"{integration_name}.open_pr_comment.{suffix}"


PR_COMMENT_TASK_TTL = timedelta(minutes=5).total_seconds()
PR_COMMENT_WINDOW = 14  # days

PR_MAX_SUSPECT_COMMITS = 1000

OPEN_PR_MAX_RECENT_ISSUES = 5000
# Caps the number of files that can be modified in a PR to leave a comment
OPEN_PR_MAX_FILES_CHANGED = 7
# Caps the number of lines that can be modified in a PR to leave a comment
OPEN_PR_MAX_LINES_CHANGED = 500

# Metrics
MERGED_PR_METRICS_BASE = "{integration}.pr_comment.{key}"
OPEN_PR_METRICS_BASE = "{integration}.open_pr_comment.{key}"


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

    @property
    @abstractmethod
    def commit_context_referrers(self) -> CommitContextReferrers:
        raise NotImplementedError

    @property
    @abstractmethod
    def commit_context_referrer_ids(self) -> CommitContextReferrerIds:
        raise NotImplementedError

    @property
    @abstractmethod
    def commit_context_organization_option_keys(self) -> CommitContextOrganizationOptionKeys:
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
                # Ignore invalid request errors for GitLab
                # TODO(ecosystem): Remove this once we have a better way to handle this
                if self.integration_name == ExternalProviderEnum.GITLAB.value:
                    lifecycle.record_halt(e)
                    return []
                else:
                    raise
            except ApiRetryError as e:
                # Ignore retry errors for GitLab
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

    def get_projects_and_filenames_from_source_file(
        self,
        organization: Organization,
        repo: Repository,
        pr_filename: str,
    ) -> tuple[set[Project], set[str]]:
        # fetch the code mappings in which the source_root is a substring at the start of pr_filename
        code_mappings = (
            RepositoryProjectPathConfig.objects.filter(
                organization_id=organization.id,
                repository_id=repo.id,
            )
            .annotate(substring_match=StrIndex(Value(pr_filename), "source_root"))
            .filter(substring_match=1)
        )

        project_list: set[Project] = set()
        sentry_filenames = set()

        if len(code_mappings):
            for code_mapping in code_mappings:
                project_list.add(code_mapping.project)
                sentry_filenames.add(
                    pr_filename.replace(code_mapping.source_root, code_mapping.stack_root, 1)
                )
        return project_list, sentry_filenames

    def create_or_update_comment(
        self,
        repo: Repository,
        pr_key: str,
        comment_data: dict[str, Any],
        pullrequest_id: int,
        issue_ids: list[int],
        metrics_base: str,
        comment_type: int = CommentType.MERGED_PR,
        language: str | None = None,
    ):
        client = self.get_client()

        pr_comment = PullRequestComment.objects.filter(
            pull_request__id=pullrequest_id, comment_type=comment_type
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
            pull_request_id=pullrequest_id,
        ).capture():
            if pr_comment is None:
                resp = client.create_comment(
                    repo=repo.name,
                    issue_id=str(pr_key),
                    data=comment_data,
                )

                current_time = django_timezone.now()
                comment = PullRequestComment.objects.create(
                    external_id=resp.body["id"],
                    pull_request_id=pullrequest_id,
                    created_at=current_time,
                    updated_at=current_time,
                    group_ids=issue_ids,
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
                    data=comment_data,
                )
                metrics.incr(
                    metrics_base.format(integration=self.integration_name, key="comment_updated")
                )
                pr_comment.updated_at = django_timezone.now()
                pr_comment.group_ids = issue_ids
                pr_comment.save()

            logger_event = metrics_base.format(
                integration=self.integration_name, key="create_or_update_comment"
            )
            logger.info(
                logger_event,
                extra={"new_comment": pr_comment is None, "pr_key": pr_key, "repo": repo.name},
            )

    @abstractmethod
    def on_create_or_update_comment_error(self, api_error: ApiError, metrics_base: str) -> bool:
        raise NotImplementedError

    # PR Comment Workflow

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
                key=self.commit_context_organization_option_keys.pr_bot,
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
                    cache_key = debounce_pr_comment_cache_key(pullrequest_id=pr.id)
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

                    self.queue_comment_task(pullrequest_id=pr.id, project_id=group_owner.project_id)

    @abstractmethod
    def queue_comment_task(self, pullrequest_id: int, project_id: int) -> None:
        raise NotImplementedError

    @abstractmethod
    def format_pr_comment(self, issue_ids: list[int]) -> str:
        raise NotImplementedError

    @abstractmethod
    def build_pr_comment_data(
        self,
        organization: Organization,
        repo: Repository,
        pr_key: str,
        comment_body: str,
        issue_ids: list[int],
    ) -> dict[str, Any]:
        raise NotImplementedError

    def get_issue_ids_from_pr(
        self, pr: PullRequest, limit: int = PR_MAX_SUSPECT_COMMITS
    ) -> list[int]:
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

    def get_top_5_issues_by_count(
        self, issue_ids: list[int], project: Project
    ) -> list[dict[str, Any]]:
        """Given a list of issue group ids, return a sublist of the top 5 ordered by event count"""
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
        referrer = self.commit_context_referrers.pr_comment_bot.value
        return raw_snql_query(request, referrer=referrer)["data"]

    def run_pr_comment_workflow(
        self, organization: Organization, repo: Repository, pr: PullRequest, project_id: int
    ) -> None:
        cache_key = debounce_pr_comment_cache_key(pullrequest_id=pr.id)

        # cap to 1000 issues in which the merge commit is the suspect commit
        issue_ids = self.get_issue_ids_from_pr(pr, limit=PR_MAX_SUSPECT_COMMITS)

        if not OrganizationOption.objects.get_value(
            organization=organization,
            key=self.commit_context_organization_option_keys.pr_bot,
            default=True,
        ):
            logger.info(
                _pr_comment_log(integration_name=self.integration_name, suffix="option_missing"),
                extra={"organization_id": organization.id},
            )
            return

        try:
            project = Project.objects.get_from_cache(id=project_id)
        except Project.DoesNotExist:
            cache.delete(cache_key)
            logger.info(
                _pr_comment_log(integration_name=self.integration_name, suffix="project_missing"),
                extra={"organization_id": organization.id},
            )
            metrics.incr(
                MERGED_PR_METRICS_BASE.format(integration=self.integration_name, key="error"),
                tags={"type": "missing_project"},
            )
            return

        top_5_issues = self.get_top_5_issues_by_count(issue_ids, project)
        if not top_5_issues:
            logger.info(
                _pr_comment_log(integration_name=self.integration_name, suffix="no_issues"),
                extra={"organization_id": organization.id, "pr_id": pr.id},
            )
            cache.delete(cache_key)
            return

        top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]

        comment_body = self.format_pr_comment(issue_ids=top_5_issue_ids)
        logger.info(
            _pr_comment_log(integration_name=self.integration_name, suffix="comment_body"),
            extra={"body": comment_body},
        )

        top_24_issue_ids = issue_ids[:24]  # 24 is the P99 for issues-per-PR

        comment_data = self.build_pr_comment_data(
            organization=organization,
            repo=repo,
            pr_key=pr.key,
            comment_body=comment_body,
            issue_ids=top_24_issue_ids,
        )

        try:
            self.create_or_update_comment(
                repo=repo,
                pr_key=pr.key,
                comment_data=comment_data,
                pullrequest_id=pr.id,
                issue_ids=top_24_issue_ids,
                metrics_base=MERGED_PR_METRICS_BASE,
            )
        except ApiError as e:
            cache.delete(cache_key)

            if self.on_create_or_update_comment_error(
                api_error=e, metrics_base=MERGED_PR_METRICS_BASE
            ):
                return

            metrics.incr(
                MERGED_PR_METRICS_BASE.format(integration=self.integration_name, key="error"),
                tags={"type": "api_error"},
            )
            raise

    # Open PR Comment Workflow

    @abstractmethod
    def get_pr_files_safe_for_comment(
        self, repo: Repository, pr: PullRequest
    ) -> list[dict[str, str]]:
        raise NotImplementedError

    @abstractmethod
    def get_pr_files(self, pr_files: list[dict[str, str]]) -> list[PullRequestFile]:
        raise NotImplementedError

    @abstractmethod
    def format_open_pr_comment(self, issue_tables: list[str]) -> str:
        raise NotImplementedError

    @abstractmethod
    def format_issue_table(
        self,
        diff_filename: str,
        issues: list[PullRequestIssue],
        patch_parsers: dict[str, Any],
        toggle: bool,
    ) -> str:
        raise NotImplementedError

    def get_top_5_issues_by_count_for_file(
        self, projects: list[Project], sentry_filenames: list[str], function_names: list[str]
    ) -> list[dict[str, Any]]:
        """
        Given a list of projects, filenames reverse-codemapped into filenames in Sentry,
        and function names representing the list of functions changed in a PR file, return a
        sublist of the top 5 recent unhandled issues ordered by event count.
        """
        if not len(projects):
            return []

        patch_parsers = PATCH_PARSERS
        # NOTE: if we are testing beta patch parsers, add check here

        # fetches the appropriate parser for formatting the snuba query given the file extension
        # the extension is never replaced in reverse codemapping
        language_parser = patch_parsers.get(sentry_filenames[0].split(".")[-1], None)

        if not language_parser:
            return []

        group_ids = list(
            Group.objects.filter(
                first_seen__gte=datetime.now(UTC) - timedelta(days=90),
                last_seen__gte=datetime.now(UTC) - timedelta(days=14),
                status=GroupStatus.UNRESOLVED,
                project__in=projects,
            )
            .order_by("-times_seen")
            .values_list("id", flat=True)
        )[:OPEN_PR_MAX_RECENT_ISSUES]
        project_ids = [p.id for p in projects]

        multi_if = language_parser.generate_multi_if(function_names)

        # fetch the count of events for each group_id
        subquery = (
            Query(Entity("events"))
            .set_select(
                [
                    Column("title"),
                    Column("culprit"),
                    Column("group_id"),
                    Function("count", [], "event_count"),
                    Function(
                        "multiIf",
                        multi_if,
                        "function_name",
                    ),
                ]
            )
            .set_groupby(
                [
                    Column("title"),
                    Column("culprit"),
                    Column("group_id"),
                    Column("exception_frames.function"),
                ]
            )
            .set_where(
                [
                    Condition(Column("project_id"), Op.IN, project_ids),
                    Condition(Column("group_id"), Op.IN, group_ids),
                    Condition(Column("timestamp"), Op.GTE, datetime.now() - timedelta(days=14)),
                    Condition(Column("timestamp"), Op.LT, datetime.now()),
                    # NOTE: ideally this would follow suspect commit logic
                    BooleanCondition(
                        BooleanOp.OR,
                        [
                            BooleanCondition(
                                BooleanOp.AND,
                                [
                                    Condition(
                                        Function(
                                            "arrayElement",
                                            (Column("exception_frames.filename"), i),
                                        ),
                                        Op.IN,
                                        sentry_filenames,
                                    ),
                                    language_parser.generate_function_name_conditions(
                                        function_names, i
                                    ),
                                ],
                            )
                            for i in range(-STACKFRAME_COUNT, 0)  # first n frames
                        ],
                    ),
                    Condition(Function("notHandled", []), Op.EQ, 1),
                ]
            )
            .set_orderby([OrderBy(Column("event_count"), Direction.DESC)])
        )

        # filter on the subquery to squash group_ids with the same title and culprit
        # return the group_id with the greatest count of events
        query = (
            Query(subquery)
            .set_select(
                [
                    Column("function_name"),
                    Function(
                        "arrayElement",
                        (Function("groupArray", [Column("group_id")]), 1),
                        "group_id",
                    ),
                    Function(
                        "arrayElement",
                        (Function("groupArray", [Column("event_count")]), 1),
                        "event_count",
                    ),
                ]
            )
            .set_groupby(
                [
                    Column("title"),
                    Column("culprit"),
                    Column("function_name"),
                ]
            )
            .set_orderby([OrderBy(Column("event_count"), Direction.DESC)])
            .set_limit(5)
        )

        request = SnubaRequest(
            dataset=Dataset.Events.value,
            app_id="default",
            tenant_ids={"organization_id": projects[0].organization_id},
            query=query,
        )

        try:
            referrer = self.commit_context_referrers.pr_comment_bot.value
            return raw_snql_query(request, referrer=referrer)["data"]
        except Exception:
            logger.exception(
                _open_pr_comment_log(
                    integration_name=self.integration_name, suffix="snuba_query_error"
                ),
                extra={"query": request.to_dict()["query"]},
            )
            return []

    def get_issue_table_contents(self, issue_list: list[dict[str, Any]]) -> list[PullRequestIssue]:
        group_id_to_info = {}
        for issue in issue_list:
            group_id = issue["group_id"]
            group_id_to_info[group_id] = dict(filter(lambda k: k[0] != "group_id", issue.items()))

        issues = Group.objects.filter(id__in=list(group_id_to_info.keys())).all()

        pull_request_issues = [
            PullRequestIssue(
                title=issue.title,
                subtitle=issue.culprit,
                url=issue.get_absolute_url(),
                affected_users=issue.count_users_seen(
                    referrer=Referrer.TAGSTORE_GET_GROUPS_USER_COUNTS_OPEN_PR_COMMENT.value
                ),
                event_count=group_id_to_info[issue.id]["event_count"],
                function_name=group_id_to_info[issue.id]["function_name"],
            )
            for issue in issues
        ]
        pull_request_issues.sort(key=lambda k: k.event_count or 0, reverse=True)

        return pull_request_issues


def run_pr_comment_workflow(integration_name: str, pullrequest_id: int, project_id: int) -> None:
    cache_key = debounce_pr_comment_cache_key(pullrequest_id=pullrequest_id)

    try:
        pr = PullRequest.objects.get(id=pullrequest_id)
        assert isinstance(pr, PullRequest)
    except PullRequest.DoesNotExist:
        cache.delete(cache_key)
        logger.info(_pr_comment_log(integration_name=integration_name, suffix="pr_missing"))
        return

    try:
        organization = Organization.objects.get_from_cache(id=pr.organization_id)
        assert isinstance(organization, Organization)
    except Organization.DoesNotExist:
        cache.delete(cache_key)
        logger.info(_pr_comment_log(integration_name=integration_name, suffix="org_missing"))
        metrics.incr(
            MERGED_PR_METRICS_BASE.format(integration=integration_name, key="error"),
            tags={"type": "missing_org"},
        )
        return

    try:
        repo = Repository.objects.get(id=pr.repository_id)
        assert isinstance(repo, Repository)
    except Repository.DoesNotExist:
        cache.delete(cache_key)
        logger.info(
            _pr_comment_log(integration_name=integration_name, suffix="repo_missing"),
            extra={"organization_id": organization.id},
        )
        metrics.incr(
            MERGED_PR_METRICS_BASE.format(integration=integration_name, key="error"),
            tags={"type": "missing_repo"},
        )
        return

    integration = integration_service.get_integration(
        integration_id=repo.integration_id, status=ObjectStatus.ACTIVE
    )
    if not integration:
        cache.delete(cache_key)
        logger.info(
            _pr_comment_log(integration_name=integration_name, suffix="integration_missing"),
            extra={"organization_id": organization.id},
        )
        metrics.incr(
            MERGED_PR_METRICS_BASE.format(integration=integration_name, key="error"),
            tags={"type": "missing_integration"},
        )
        return

    installation = integration.get_installation(organization_id=organization.id)
    assert isinstance(installation, CommitContextIntegration)

    installation.run_pr_comment_workflow(
        organization=organization,
        repo=repo,
        pr=pr,
        project_id=project_id,
    )


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
    def get_merge_commit_sha_from_commit(self, repo: Repository, sha: str) -> str | None:
        raise NotImplementedError

    @abstractmethod
    def get_pullrequest_files(self, repo: Repository, pr: PullRequest) -> Any:
        raise NotImplementedError

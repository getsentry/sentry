from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from datetime import datetime, timedelta, timezone
from typing import Any

import sentry_sdk
from celery import Task
from celery.exceptions import MaxRetriesExceededError
from django.utils import timezone as django_timezone
from sentry_sdk import set_tag

from sentry import analytics
from sentry.api.serializers.models.release import get_users_for_authors
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.utils.code_mapping import get_sorted_code_mapping_configs
from sentry.integrations.utils.commit_context import (
    find_commit_context_for_event_all_frames,
    get_or_create_commit_from_blame,
)
from sentry.locks import locks
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.group import Group
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.project import Project
from sentry.models.projectownership import ProjectOwnership
from sentry.models.pullrequest import (
    CommentType,
    PullRequest,
    PullRequestComment,
    PullRequestCommit,
)
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.tasks.groupowner import process_suspect_commits
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.sdk import set_current_event_project

DEBOUNCE_PR_COMMENT_CACHE_KEY = lambda pullrequest_id: f"pr-comment-{pullrequest_id}"
DEBOUNCE_PR_COMMENT_LOCK_KEY = lambda pullrequest_id: f"queue_comment_task:{pullrequest_id}"
PR_COMMENT_TASK_TTL = timedelta(minutes=5).total_seconds()
PR_COMMENT_WINDOW = 14  # days

# TODO: replace this with isinstance(installation, CommitContextIntegration)
PR_COMMENT_SUPPORTED_PROVIDERS = {"integrations:github"}

logger = logging.getLogger(__name__)


def queue_comment_task_if_needed(
    commit: Commit, group_owner: GroupOwner, repo: Repository, installation: IntegrationInstallation
) -> None:
    from sentry.integrations.github.tasks.pr_comment import github_comment_workflow

    logger.info(
        "github.pr_comment.queue_comment_check",
        extra={"organization_id": commit.organization_id, "merge_commit_sha": commit.key},
    )

    # client will raise an Exception if the request is not successful
    try:
        client = installation.get_client()
        merge_commit_sha = client.get_merge_commit_sha_from_commit(repo=repo.name, sha=commit.key)
    except Exception as e:
        sentry_sdk.capture_exception(e)
        return

    if merge_commit_sha is None:
        logger.info(
            "github.pr_comment.queue_comment_check.commit_not_in_default_branch",
            extra={
                "organization_id": commit.organization_id,
                "repository_id": repo.id,
                "commit_sha": commit.key,
            },
        )
        return

    pr_query = PullRequest.objects.filter(
        organization_id=commit.organization_id,
        repository_id=commit.repository_id,
        merge_commit_sha=merge_commit_sha,
    )
    if not pr_query.exists():
        logger.info(
            "github.pr_comment.queue_comment_check.missing_pr",
            extra={
                "organization_id": commit.organization_id,
                "repository_id": repo.id,
                "commit_sha": commit.key,
            },
        )
        return

    pr = pr_query.first()
    assert pr is not None
    # need to query explicitly for merged PR comments since we can have multiple comments per PR
    merged_pr_comment_query = PullRequestComment.objects.filter(
        pull_request_id=pr.id, comment_type=CommentType.MERGED_PR
    )
    if pr.date_added >= datetime.now(tz=timezone.utc) - timedelta(days=PR_COMMENT_WINDOW) and (
        not merged_pr_comment_query.exists()
        or group_owner.group_id not in merged_pr_comment_query[0].group_ids
    ):
        lock = locks.get(
            DEBOUNCE_PR_COMMENT_LOCK_KEY(pr.id), duration=10, name="queue_comment_task"
        )
        with lock.acquire():
            cache_key = DEBOUNCE_PR_COMMENT_CACHE_KEY(pullrequest_id=pr.id)
            if cache.get(cache_key) is not None:
                return

            # create PR commit row for suspect commit and PR
            PullRequestCommit.objects.get_or_create(commit=commit, pull_request=pr)

            logger.info(
                "github.pr_comment.queue_comment_workflow",
                extra={"pullrequest_id": pr.id, "project_id": group_owner.project_id},
            )

            cache.set(cache_key, True, PR_COMMENT_TASK_TTL)

            github_comment_workflow.delay(pullrequest_id=pr.id, project_id=group_owner.project_id)


@instrumented_task(
    name="sentry.tasks.process_commit_context",
    queue="group_owners.process_commit_context",
    autoretry_for=(ApiError,),
    max_retries=5,
    retry_backoff=True,
    retry_backoff_max=60 * 60 * 3,  # 3 hours
    retry_jitter=False,
    silo_mode=SiloMode.REGION,
    bind=True,
)
def process_commit_context(
    self: Task,
    event_id: str,
    event_platform: str,
    event_frames: Sequence[Mapping[str, Any]],
    group_id: int,
    project_id: int,
    sdk_name: str | None = None,
) -> None:
    """
    For a given event, look at the first in_app frame, and if we can find who modified the line, we can then update who is assigned to the issue.
    """
    lock = locks.get(
        f"process-commit-context:{group_id}", duration=10, name="process_commit_context"
    )
    try:
        with lock.acquire():
            metrics.incr("sentry.tasks.process_commit_context.start")

            set_current_event_project(project_id)

            project = Project.objects.get_from_cache(id=project_id)
            set_tag("organization.slug", project.organization.slug)

            basic_logging_details = {
                "event": event_id,
                "group": group_id,
                "organization": project.organization_id,
            }

            code_mappings = get_sorted_code_mapping_configs(project)

            frames = event_frames or []
            in_app_frames = [f for f in frames if f and f.get("in_app", False)][::-1]
            # First frame in the stacktrace that is "in_app"
            frame = next(iter(in_app_frames), None)

            if not frame:
                metrics.incr(
                    "sentry.tasks.process_commit_context.aborted",
                    tags={
                        "detail": "could_not_find_in_app_stacktrace_frame",
                    },
                )
                logger.info(
                    "process_commit_context.find_frame",
                    extra={
                        **basic_logging_details,
                        "reason": "could_not_find_in_app_stacktrace_frame",
                        "fallback": True,
                    },
                )
                process_suspect_commits.delay(
                    event_id=event_id,
                    event_platform=event_platform,
                    event_frames=event_frames,
                    group_id=group_id,
                    project_id=project_id,
                    sdk_name=sdk_name,
                )
                analytics.record(
                    "integrations.failed_to_fetch_commit_context_all_frames",
                    organization_id=project.organization_id,
                    project_id=project_id,
                    group_id=basic_logging_details["group"],
                    event_id=basic_logging_details["event"],
                    num_frames=0,
                    num_successfully_mapped_frames=0,
                    reason="could_not_find_in_app_stacktrace_frame",
                )

                return

            metrics.incr("tasks.process_commit_context_all_frames.start")
            blame = None
            installation = None
            try:
                blame, installation = find_commit_context_for_event_all_frames(
                    code_mappings=code_mappings,
                    frames=in_app_frames,
                    organization_id=project.organization_id,
                    project_id=project_id,
                    platform=event_platform,
                    sdk_name=sdk_name,
                    extra=basic_logging_details,
                )
            except ApiError:
                logger.info(
                    "process_commit_context_all_frames.retry",
                    extra={**basic_logging_details, "retry_count": self.request.retries},
                )
                metrics.incr("tasks.process_commit_context_all_frames.retry")
                self.retry()

            if not blame or not installation:
                # Fall back to the release logic if we can't find a commit for any of the frames
                process_suspect_commits.delay(
                    event_id=event_id,
                    event_platform=event_platform,
                    event_frames=event_frames,
                    group_id=group_id,
                    project_id=project_id,
                    sdk_name=sdk_name,
                )
                return

            selected_code_mapping = blame.code_mapping

            commit = get_or_create_commit_from_blame(
                blame, organization_id=project.organization_id, extra=basic_logging_details
            )

            assert isinstance(commit, Commit)
            authors = list(CommitAuthor.objects.get_many_from_cache([commit.author_id]))
            author_to_user = get_users_for_authors(commit.organization_id, authors)
            user_dct: Mapping[str, Any] = author_to_user.get(str(commit.author_id), {})

            group_owner, created = GroupOwner.objects.update_or_create(
                group_id=group_id,
                type=GroupOwnerType.SUSPECT_COMMIT.value,
                user_id=user_dct.get("id"),
                project=project,
                organization_id=project.organization_id,
                context={"commitId": commit.id},
                defaults={
                    "date_added": django_timezone.now()
                },  # Updates date of an existing owner, since we just matched them with this new event
            )

            if OrganizationOption.objects.get_value(
                organization=project.organization,
                key="sentry:github_pr_bot",
                default=True,
            ):
                logger.info(
                    "github.pr_comment",
                    extra={"organization_id": project.organization_id},
                )
                repo = Repository.objects.filter(id=commit.repository_id).order_by("-date_added")
                group = Group.objects.get_from_cache(id=group_id)
                if (
                    group.level is not logging.INFO  # Don't comment on info level issues
                    and installation is not None
                    and repo.exists()
                    and repo.get().provider in PR_COMMENT_SUPPORTED_PROVIDERS
                ):
                    queue_comment_task_if_needed(commit, group_owner, repo.get(), installation)
                else:
                    logger.info(
                        "github.pr_comment.incorrect_repo_config",
                        extra={"organization_id": project.organization_id},
                    )

            ProjectOwnership.handle_auto_assignment(
                project_id=project.id,
                organization_id=project.organization_id,
                group=group_owner.group,
                logging_extra={
                    "event_id": event_id,
                    "group_id": group_id,
                    "project_id": str(project.id),
                    "organization_id": project.organization_id,
                    "source": "process_commit_context",
                },
            )
            logger.info(
                "process_commit_context.success",
                extra={
                    **basic_logging_details,
                    "group_owner_id": group_owner.id,
                    **(
                        {
                            "repository_id": selected_code_mapping.repository_id,
                            "selected_code_mapping": selected_code_mapping.id,
                        }
                        if selected_code_mapping is not None
                        else {}
                    ),
                    "reason": "created" if created else "updated",
                },
            )
            metrics.incr(
                "sentry.tasks.process_commit_context.success",
                tags={
                    "detail": f'successfully {"created" if created else "updated"}',
                },
            )
            analytics.record(
                "groupowner.assignment",
                organization_id=project.organization_id,
                project_id=project.id,
                group_id=group_id,
                new_assignment=created,
            )
    except UnableToAcquireLock:
        pass
    except MaxRetriesExceededError:
        metrics.incr("tasks.process_commit_context.max_retries_exceeded")
        logger.info(
            "process_commit_context.max_retries_exceeded",
            extra={
                **basic_logging_details,
                "reason": "max_retries_exceeded",
            },
        )

        process_suspect_commits.delay(
            event_id=event_id,
            event_platform=event_platform,
            event_frames=event_frames,
            group_id=group_id,
            project_id=project_id,
            sdk_name=sdk_name,
        )

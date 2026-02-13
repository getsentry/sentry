from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from datetime import timedelta
from typing import Any

import sentry_sdk
from django.utils import timezone as django_timezone
from sentry_sdk import set_tag

from sentry import analytics
from sentry.analytics.events.groupowner_assignment import GroupOwnerAssignment
from sentry.analytics.events.integration_commit_context_all_frames import (
    IntegrationsFailedToFetchCommitContextAllFrames,
)
from sentry.api.serializers.models.release import get_users_for_authors
from sentry.integrations.source_code_management.commit_context import CommitContextIntegration
from sentry.integrations.utils.commit_context import (
    find_commit_context_for_event_all_frames,
    get_or_create_commit_from_blame,
)
from sentry.issues.auto_source_code_config.code_mapping import get_sorted_code_mapping_configs
from sentry.locks import locks
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.group import Group
from sentry.models.groupowner import GroupOwner, GroupOwnerType, SuspectCommitStrategy
from sentry.models.project import Project
from sentry.models.projectownership import ProjectOwnership
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.taskworker.retry import NoRetriesRemainingError, Retry
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.sdk import set_current_event_project

DEBOUNCE_PR_COMMENT_CACHE_KEY = lambda pullrequest_id: f"pr-comment-{pullrequest_id}"
DEBOUNCE_PR_COMMENT_LOCK_KEY = lambda pullrequest_id: f"queue_comment_task:{pullrequest_id}"
PR_COMMENT_TASK_TTL = timedelta(minutes=5).total_seconds()
PR_COMMENT_WINDOW = 14  # days
TASK_DURATION_S = 90

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.process_commit_context",
    namespace=issues_tasks,
    processing_deadline_duration=TASK_DURATION_S,
    retry=Retry(times=5, delay=5),
    silo_mode=SiloMode.REGION,
)
def process_commit_context(
    event_id: str,
    event_platform: str,
    event_frames: Sequence[Mapping[str, Any]],
    group_id: int,
    project_id: int,
    sdk_name: str | None = None,
) -> None:
    """
    This is the task behind SuspectCommitStrategy.SCM_BASED

    For a given event, get the in_app frames and try to get the most relevant blame.
    If we can find blame, we can use the blame's commit as the suspect commit for the Issue
    by creating a GroupOwner for the event's Group.

    Will queue the task to create a pr comment if needed.
    Will check if the suspect commit author can be auto-assigned.
    """
    lock = locks.get(
        f"process-commit-context:{group_id}",
        duration=TASK_DURATION_S,
        name="process_commit_context",
    )
    try:
        with lock.acquire():
            metrics.incr("sentry.tasks.process_commit_context.start")
            set_current_event_project(project_id)

            project = Project.objects.get_from_cache(id=project_id)
            group = Group.objects.get_from_cache(id=group_id)
            set_tag("organization.slug", project.organization.slug)
            basic_logging_details = {
                "event": event_id,
                "group": group_id,
                "organization": project.organization_id,
            }

            frames = event_frames or []
            in_app_frames = [f for f in frames if f and f.get("in_app", False)][::-1]

            if not in_app_frames:
                metrics.incr(
                    "sentry.tasks.process_commit_context.aborted",
                    tags={
                        "detail": "could_not_find_in_app_stacktrace_frame",
                    },
                )
                analytics.record(
                    IntegrationsFailedToFetchCommitContextAllFrames(
                        organization_id=project.organization_id,
                        project_id=project_id,
                        group_id=basic_logging_details["group"],
                        event_id=basic_logging_details["event"],
                        num_frames=0,
                        num_successfully_mapped_frames=0,
                        reason="could_not_find_in_app_stacktrace_frame",
                    )
                )
                return

            metrics.incr("tasks.process_commit_context_all_frames.start")
            blame = None
            installation = None
            code_mappings = get_sorted_code_mapping_configs(project)

            try:
                blame, installation = find_commit_context_for_event_all_frames(
                    code_mappings=code_mappings,
                    frames=in_app_frames,
                    organization_id=project.organization_id,
                    project_id=project_id,
                    platform=event_platform,
                    sdk_name=sdk_name,
                    group_first_seen=group.first_seen,
                    extra=basic_logging_details,
                )
            except ApiError:
                metrics.incr("tasks.process_commit_context_all_frames.retry")
                raise

            if not blame or not installation:
                metrics.incr("tasks.process_commit_context_all_frames.no_blame_found")
                return

            commit = get_or_create_commit_from_blame(
                blame, organization_id=project.organization_id, extra=basic_logging_details
            )

            assert isinstance(commit, Commit)
            authors = list(CommitAuthor.objects.get_many_from_cache([commit.author_id]))
            author_to_user = get_users_for_authors(commit.organization_id, authors)
            user_dct: Mapping[str, Any] = author_to_user.get(str(commit.author_id), {})

            group_owner, created = GroupOwner.objects.update_or_create_and_preserve_context(
                lookup_kwargs={
                    "group_id": group_id,
                    "type": GroupOwnerType.SUSPECT_COMMIT.value,
                    "user_id": user_dct.get("id"),
                    "project_id": project.id,
                    "organization_id": project.organization_id,
                    "context__asjsonb__commitId": commit.id,
                },
                defaults={
                    "date_added": django_timezone.now(),
                },
                context_defaults={
                    "commitId": commit.id,
                    "suspectCommitStrategy": SuspectCommitStrategy.SCM_BASED,
                },
            )

            if installation and isinstance(installation, CommitContextIntegration):
                installation.queue_pr_comment_task_if_needed(project, commit, group_owner, group_id)

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
            metrics.incr(
                "sentry.tasks.process_commit_context.success",
                tags={
                    "detail": f"successfully {'created' if created else 'updated'}",
                },
            )
            try:
                analytics.record(
                    GroupOwnerAssignment(
                        organization_id=project.organization_id,
                        project_id=project.id,
                        group_id=group_id,
                        new_assignment=created,
                        user_id=group_owner.user_id,
                        group_owner_type=group_owner.type,
                        method="scm_integration",
                    )
                )
            except Exception as e:
                sentry_sdk.capture_exception(e)
    except UnableToAcquireLock:
        pass
    except NoRetriesRemainingError:
        metrics.incr("tasks.process_commit_context.max_retries_exceeded")

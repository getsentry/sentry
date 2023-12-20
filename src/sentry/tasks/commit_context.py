from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Mapping

import sentry_sdk
from celery.exceptions import MaxRetriesExceededError
from django.utils import timezone
from sentry_sdk import set_tag

from sentry import analytics, features
from sentry.api.serializers.models.release import get_users_for_authors
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.utils.code_mapping import get_sorted_code_mapping_configs
from sentry.integrations.utils.commit_context import (
    find_commit_context_for_event,
    find_commit_context_for_event_all_frames,
    get_or_create_commit_from_blame,
)
from sentry.locks import locks
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.project import Project
from sentry.models.pullrequest import PullRequest, PullRequestCommit
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.tasks.groupowner import process_suspect_commits
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.event_frames import munged_filename_and_frames
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.sdk import set_current_event_project

PREFERRED_GROUP_OWNERS = 1
PREFERRED_GROUP_OWNER_AGE = timedelta(days=7)
DEBOUNCE_CACHE_KEY = lambda group_id: f"process-commit-context-{group_id}"
DEBOUNCE_PR_COMMENT_CACHE_KEY = lambda pullrequest_id: f"pr-comment-{pullrequest_id}"
DEBOUNCE_PR_COMMENT_LOCK_KEY = lambda pullrequest_id: f"queue_comment_task:{pullrequest_id}"
PR_COMMENT_TASK_TTL = timedelta(minutes=5).total_seconds()
PR_COMMENT_WINDOW = 14  # days

logger = logging.getLogger(__name__)


def queue_comment_task_if_needed(
    commit: Commit, group_owner: GroupOwner, repo: Repository, installation: IntegrationInstallation
):
    from sentry.tasks.integrations.github.pr_comment import github_comment_workflow

    logger.info(
        "github.pr_comment.queue_comment_check",
        extra={"organization_id": commit.organization_id, "merge_commit_sha": commit.key},
    )

    # client will raise an Exception if the request is not successful
    try:
        response = installation.get_client().get_pullrequest_from_commit(
            repo=repo.name, sha=commit.key
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)
        return

    if not isinstance(response, list) or len(response) != 1:
        # the response should return a single PR, return if multiple
        if len(response) > 1:
            logger.info(
                "github.pr_comment.queue_comment_check.commit_not_in_default_branch",
                extra={
                    "organization_id": commit.organization_id,
                    "repository_id": repo.id,
                    "commit_sha": commit.key,
                },
            )
        return

    merge_commit_sha = response[0]["merge_commit_sha"]

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
    if pr.date_added >= datetime.now(tz=timezone.utc) - timedelta(days=PR_COMMENT_WINDOW) and (
        not pr.pullrequestcomment_set.exists()
        or group_owner.group_id not in pr.pullrequestcomment_set.get().group_ids
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
    self,
    event_id,
    event_platform,
    event_frames,
    group_id,
    project_id,
    sdk_name=None,
    **kwargs,
):
    """
    For a given event, look at the first in_app frame, and if we can find who modified the line, we can then update who is assigned to the issue.
    """
    lock = locks.get(
        f"process-commit-context:{group_id}", duration=10, name="process_commit_context"
    )
    try:
        with lock.acquire():
            metrics.incr("sentry.tasks.process_commit_context.start")

            cache_key = DEBOUNCE_CACHE_KEY(group_id)

            set_current_event_project(project_id)

            project = Project.objects.get_from_cache(id=project_id)
            set_tag("organization.slug", project.organization.slug)

            owners = GroupOwner.objects.filter(
                group_id=group_id,
                project=project,
                organization_id=project.organization_id,
                type=GroupOwnerType.SUSPECT_COMMIT.value,
            )
            basic_logging_details = {
                "event": event_id,
                "group": group_id,
                "organization": project.organization_id,
            }
            # Delete old owners
            to_be_deleted = owners.filter(
                date_added__lte=timezone.now() - PREFERRED_GROUP_OWNER_AGE
            )

            if len(to_be_deleted):
                for record in to_be_deleted:
                    record.delete()

            current_owners = owners.filter(
                date_added__gte=timezone.now() - PREFERRED_GROUP_OWNER_AGE
            ).order_by("-date_added")

            if len(current_owners) >= PREFERRED_GROUP_OWNERS:
                # When there exists a Suspect Committer, we want to debounce this task until that Suspect Committer hits the TTL of PREFERRED_GROUP_OWNER_AGE
                cache_duration = timezone.now() - current_owners[0].date_added
                cache_duration = (
                    cache_duration
                    if cache_duration < PREFERRED_GROUP_OWNER_AGE
                    else PREFERRED_GROUP_OWNER_AGE
                )
                cache.set(cache_key, True, cache_duration.total_seconds())
                metrics.incr(
                    "sentry.tasks.process_commit_context.aborted",
                    tags={
                        "detail": "maxed_owners_none_old",
                    },
                )
                logger.info(
                    "process_commit_context.maxed_owners",
                    extra={
                        **basic_logging_details,
                        "reason": "maxed_owners_none_old",
                    },
                )
                return

            code_mappings = get_sorted_code_mapping_configs(project)

            frames = event_frames or []
            munged = munged_filename_and_frames(event_platform, frames, "munged_filename", sdk_name)
            if munged:
                frames = munged[1]

            in_app_frames = [f for f in frames if f and f.get("in_app", False)][::-1]
            # First frame in the stacktrace that is "in_app"
            frame = next(iter(in_app_frames), None)

            if not frame:
                # When we could not find the in_app frame for the event, we will debounce the task for 1 day.
                # New events can be unrelated to the original event and may have an "in_app" frame.
                cache.set(cache_key, True, timedelta(days=1).total_seconds())
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
                if features.has("organizations:suspect-commits-all-frames", project.organization):
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

            if features.has("organizations:suspect-commits-all-frames", project.organization):
                metrics.incr("tasks.process_commit_context_all_frames.start")
                blame = None
                installation = None
                try:
                    blame, installation = find_commit_context_for_event_all_frames(
                        code_mappings=code_mappings,
                        frames=in_app_frames,
                        organization_id=project.organization_id,
                        project_id=project_id,
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
            else:
                found_contexts, installation = find_commit_context_for_event(
                    code_mappings=code_mappings,
                    frame=frame,
                    extra={
                        **basic_logging_details,
                    },
                )

                if not len(found_contexts):
                    # Couldn't find the blame with any of the code mappings, so we will debounce the task for PREFERRED_GROUP_OWNER_AGE.
                    # We will clear the debounce cache when the org adds new code mappings for the project of this group.
                    cache.set(cache_key, True, PREFERRED_GROUP_OWNER_AGE.total_seconds())

                    metrics.incr(
                        "sentry.tasks.process_commit_context.aborted",
                        tags={
                            "detail": "could_not_fetch_commit_context",
                        },
                    )
                    logger.info(
                        "process_commit_context.find_commit_context",
                        extra={
                            **basic_logging_details,
                            "reason": "could_not_fetch_commit_context",
                            "code_mappings_count": len(code_mappings),
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
                    return

                commit = None
                new_commit = None
                selected_code_mapping = None
                for commit_context, code_mapping in found_contexts:
                    try:
                        # Find commit and break
                        commit = Commit.objects.get(
                            repository_id=code_mapping.repository_id,
                            key=commit_context.get("commitId"),
                        )
                        assert commit is not None
                        if commit.message == "":
                            commit.message = commit_context.get("commitMessage")
                            commit.save()
                        selected_code_mapping = code_mapping
                        break
                    except Commit.DoesNotExist:
                        # If the commit has no date, we will not add it to avoid breaking other commit ordered-based logic.
                        if not new_commit and commit_context.get("committedDate"):
                            new_commit = {
                                "context": commit_context,
                                "repository_id": code_mapping.repository_id,
                                "code_mapping_id": code_mapping.id,
                            }

                        logger.info(
                            "process_commit_context.no_commit_in_sentry",
                            extra={
                                **basic_logging_details,
                                "sha": commit_context.get("commitId"),
                                "repository_id": code_mapping.repository_id,
                                "code_mapping_id": code_mapping.id,
                                "reason": "commit_sha_does_not_exist_in_sentry",
                            },
                        )

                if not commit:
                    if new_commit:
                        context = new_commit["context"]
                        # If none of the commits exist in sentry_commit, we add the first commit we found
                        commit_author, _ = CommitAuthor.objects.get_or_create(
                            organization_id=project.organization_id,
                            email=context.get("commitAuthorEmail"),
                            defaults={"name": context.get("commitAuthorName")},
                        )
                        commit = Commit.objects.create(
                            organization_id=project.organization_id,
                            repository_id=new_commit["repository_id"],
                            key=context.get("commitId"),
                            date_added=context.get("committedDate"),
                            author=commit_author,
                            message=context.get("commitMessage"),
                        )

                        logger.info(
                            "process_commit_context.added_commit_to_sentry_commit",
                            extra={
                                **basic_logging_details,
                                "sha": new_commit.get("commitId"),
                                "repository_id": new_commit["repository_id"],
                                "code_mapping_id": new_commit["code_mapping_id"],
                                "reason": "commit_sha_does_not_exist_in_sentry_for_all_code_mappings",
                            },
                        )
                    else:
                        metrics.incr(
                            "sentry.tasks.process_commit_context.aborted",
                            tags={
                                "detail": "commit_sha_does_not_exist_in_sentry",
                            },
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
                    "date_added": timezone.now()
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
                repo = Repository.objects.filter(id=commit.repository_id)
                if (
                    installation is not None
                    and repo.exists()
                    and repo.get().provider == "integrations:github"
                ):
                    queue_comment_task_if_needed(commit, group_owner, repo.get(), installation)
                else:
                    logger.info(
                        "github.pr_comment.incorrect_repo_config",
                        extra={"organization_id": project.organization_id},
                    )

            if created:
                # If owners exceeds the limit, delete the oldest one.
                if len(current_owners) + 1 > PREFERRED_GROUP_OWNERS:
                    try:
                        owner = current_owners[0]
                    except IndexError:
                        pass
                    else:
                        owner.delete()

            # Success. We will debounce this task until this Suspect Committer hits the TTL of PREFERRED_GROUP_OWNER_AGE
            cache.set(cache_key, True, PREFERRED_GROUP_OWNER_AGE.total_seconds())
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

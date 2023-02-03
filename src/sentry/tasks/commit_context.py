import logging
from datetime import timedelta

from django.utils import timezone
from sentry_sdk import set_tag

from sentry import analytics
from sentry.api.serializers.models.release import get_users_for_authors
from sentry.integrations.utils.commit_context import find_commit_context_for_event
from sentry.locks import locks
from sentry.models import Commit, CommitAuthor, Project, RepositoryProjectPathConfig
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.shared_integrations.exceptions import ApiError
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.event_frames import munged_filename_and_frames
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.sdk import set_current_event_project

PREFERRED_GROUP_OWNERS = 1
PREFERRED_GROUP_OWNER_AGE = timedelta(days=7)
DEBOUNCE_CACHE_KEY = lambda group_id: f"process-commit-context-{group_id}"
logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.process_commit_context",
    queue="group_owners.process_commit_context",
    autoretry_for=(ApiError,),
    max_retries=5,
    retry_backoff=True,
    retry_backoff_max=60 * 60 * 3,  # 3 hours
    retry_jitter=False,
)
def process_commit_context(
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

            code_mappings = RepositoryProjectPathConfig.objects.filter(project=project)

            frames = event_frames or []
            munged = munged_filename_and_frames(event_platform, frames, "munged_filename", sdk_name)
            if munged:
                frames = munged[1]

            # First frame in the stacktrace that is "in_app"
            frame = next(filter(lambda frame: frame.get("in_app", False), frames[::-1]), None)

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
                    },
                )
                return

            found_contexts = find_commit_context_for_event(
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
                    },
                )
                return

            commit = None
            for commit_context, selected_code_mapping in found_contexts:
                try:
                    # Find commit and break
                    commit = Commit.objects.get(
                        repository_id=selected_code_mapping.repository_id,
                        key=commit_context.get("commitId"),
                    )
                    break
                except Commit.DoesNotExist:

                    logger.info(
                        "process_commit_context.no_commit_in_sentry",
                        extra={
                            **basic_logging_details,
                            "sha": commit_context.get("commitId"),
                            "repository_id": selected_code_mapping.repository_id,
                            "code_mapping_id": selected_code_mapping.id,
                            "reason": "commit_sha_does_not_exist_in_sentry",
                        },
                    )

            if not commit:
                # None of the commits found from the integrations' contexts exist in sentry_commit.

                # We couldn't find the commit in Sentry, so we will debounce the task for 1 day.
                # TODO(nisanthan): We will not get the commit history for new customers, only the commits going forward from when they installed the source-code integration. We need a long-term fix.
                cache.set(cache_key, True, timedelta(days=1).total_seconds())

                metrics.incr(
                    "sentry.tasks.process_commit_context.aborted",
                    tags={
                        "detail": "commit_sha_does_not_exist_in_sentry",
                    },
                )
                logger.info(
                    "process_commit_context.aborted.no_commit_in_sentry",
                    extra={
                        **basic_logging_details,
                        "reason": "commit_sha_does_not_exist_in_sentry_for_all_code_mappings",
                    },
                )
                return

            authors = list(CommitAuthor.objects.get_many_from_cache([commit.author_id]))
            author_to_user = get_users_for_authors(commit.organization_id, authors)

            group_owner, created = GroupOwner.objects.update_or_create(
                group_id=group_id,
                type=GroupOwnerType.SUSPECT_COMMIT.value,
                user_id=author_to_user.get(str(commit.author_id)).get("id"),
                project=project,
                organization_id=project.organization_id,
                context={"commitId": commit.id},
                defaults={
                    "date_added": timezone.now()
                },  # Updates date of an existing owner, since we just matched them with this new event
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

from __future__ import annotations

import logging
import random
import uuid
from collections.abc import MutableMapping, Sequence
from datetime import datetime
from time import time
from typing import TYPE_CHECKING, Any, TypedDict

import sentry_sdk
from django.conf import settings
from django.db.models.signals import post_save
from django.utils import timezone
from google.api_core.exceptions import ServiceUnavailable

from sentry import features, options, projectoptions
from sentry.exceptions import PluginError
from sentry.integrations.types import IntegrationProviderSlug
from sentry.issues.grouptype import GroupCategory
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.killswitches import killswitch_matches_context
from sentry.replays.lib.event_linking import transform_event_for_linking_payload
from sentry.replays.lib.kafka import initialize_replays_publisher
from sentry.seer.autofix.constants import FixabilityScoreThresholds
from sentry.sentry_metrics.client import generic_metrics_backend
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.signals import event_processed, issue_unignored
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import ingest_errors_postprocess_tasks
from sentry.types.group import GroupSubStatus
from sentry.utils import json, metrics
from sentry.utils.cache import cache
from sentry.utils.event import track_event_since_received
from sentry.utils.event_frames import get_sdk_name
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.locking.backends import LockBackend
from sentry.utils.locking.manager import LockManager
from sentry.utils.retries import ConditionalRetryPolicy, exponential_delay
from sentry.utils.safe import get_path, safe_execute
from sentry.utils.sdk import bind_organization_context, set_current_event_project
from sentry.utils.sdk_crashes.sdk_crash_detection_config import build_sdk_crash_detection_configs
from sentry.utils.services import build_instance_from_options_of_type

if TYPE_CHECKING:
    from sentry.eventstream.base import GroupState
    from sentry.issues.ownership.grammar import Rule
    from sentry.models.group import Group
    from sentry.models.groupinbox import InboxReasonDetails
    from sentry.models.project import Project
    from sentry.models.team import Team
    from sentry.services.eventstore.models import Event, GroupEvent
    from sentry.users.services.user import RpcUser

logger = logging.getLogger(__name__)


locks = LockManager(
    build_instance_from_options_of_type(
        LockBackend, settings.SENTRY_POST_PROCESS_LOCKS_BACKEND_OPTIONS
    )
)

ISSUE_OWNERS_PER_PROJECT_PER_MIN_RATELIMIT = 50
HIGHER_ISSUE_OWNERS_PER_PROJECT_PER_MIN_RATELIMIT = 200


class PostProcessJob(TypedDict, total=False):
    event: GroupEvent
    group_state: GroupState
    is_reprocessed: bool
    has_reappeared: bool
    has_alert: bool
    has_escalated: bool


def _should_send_error_created_hooks(project):
    from sentry.models.organization import Organization
    from sentry.sentry_apps.models.servicehook import ServiceHook

    cache_key = f"servicehooks-error-created:1:{project.id}"
    result = cache.get(cache_key)

    if result is None:
        org = Organization.objects.get_from_cache(id=project.organization_id)
        if not features.has("organizations:integrations-event-hooks", organization=org):
            cache.set(cache_key, 0, 60)
            return False

        result = (
            ServiceHook.objects.filter(organization_id=org.id)
            .extra(where=["events @> '{error.created}'"])
            .exists()
        )

        cache_value = 1 if result else 0
        cache.set(cache_key, cache_value, 60)

    return result


def should_write_event_stats(event: Event | GroupEvent):
    # For now, we only want to write these stats for error events. If we start writing them for
    # other event types we'll throw off existing stats and potentially cause various alerts to fire.
    # We might decide to write these stats for other event types later, either under different keys
    # or with differentiating tags.
    return (
        event.group
        and event.group.issue_category == GroupCategory.ERROR
        and event.group.platform is not None
    )


def format_event_platform(event: Event | GroupEvent):
    if not event.group:
        logger.error(
            "Group not found on event during formatting", extra={"event_id": event.event_id}
        )
        return
    if not event.group.platform:
        logger.error(
            "Platform not found on group during formatting",
            extra={"event_id": event.event_id, "group_id": event.group.id},
        )
        return
    platform = event.group.platform
    return platform.split("-", 1)[0].split("_", 1)[0]


def _capture_event_stats(event: Event) -> None:
    if not should_write_event_stats(event):
        return

    platform = format_event_platform(event)
    tags = {"platform": platform}
    metrics.incr("events.processed", tags={"platform": platform}, skip_internal=False)
    metrics.incr(f"events.processed.{platform}", skip_internal=False)
    metrics.distribution("events.size.data", event.size, tags=tags, unit="byte")


def _update_escalating_metrics(event: Event) -> None:
    """
    Update metrics for escalating issues when an event is processed.
    """
    generic_metrics_backend.counter(
        UseCaseID.ESCALATING_ISSUES,
        org_id=event.project.organization_id,
        project_id=event.project.id,
        metric_name="event_ingested",
        value=1,
        tags={"group": str(event.group_id)},
        unit=None,
    )


def _capture_group_stats(job: PostProcessJob) -> None:
    event = job["event"]
    if not job["group_state"]["is_new"] or not should_write_event_stats(event):
        return

    if not event.group:
        logger.error(
            "Group not found on event while capturing group stats",
            extra={"event_id": event.event_id},
        )
        return

    platform = format_event_platform(event)
    metrics.incr("events.unique", tags={"platform": platform}, skip_internal=False)


@sentry_sdk.trace
def should_issue_owners_ratelimit(project_id: int, group_id: int, organization_id: int | None):
    """
    Make sure that we do not accept more groups than the enforced_limit at the project level.
    """
    from sentry.models.organization import Organization

    enforced_limit = ISSUE_OWNERS_PER_PROJECT_PER_MIN_RATELIMIT
    organization = Organization.objects.get_from_cache(id=organization_id)
    if features.has("organizations:increased-issue-owners-rate-limit", organization=organization):
        enforced_limit = HIGHER_ISSUE_OWNERS_PER_PROJECT_PER_MIN_RATELIMIT

    cache_key = f"issue_owner_assignment_ratelimiter:{project_id}"
    data = cache.get(cache_key)

    if data is None:
        groups = {group_id}
        window_start = datetime.now()
        cache.set(cache_key, (groups, window_start), 60)
    else:
        groups = set(data[0])
        groups.add(group_id)
        window_start = data[1]
        timeout = max(60 - (datetime.now() - window_start).total_seconds(), 0)
        cache.set(cache_key, (groups, window_start), timeout)

    return len(groups) > enforced_limit


@metrics.wraps("post_process.handle_owner_assignment")
@sentry_sdk.trace
def handle_owner_assignment(job):
    """
    The handle_owner_assignment task attempts to find issue owners for a group.
    We call `ProjectOwnership.get_issue_owners` to find issue owners, and then
    `handle_group_owners` to store them.

    Before doing any work, we first do a few checks:

    - If the issue has an assignee, we skip the task, as
    if the issue is assigned, we do not need to do this logic.
    - We check if we've attempted to find an issue owner in the last day.
      - We cache the result of this check so we're not checking every issue event.
    - We then check that the project has not gone over its rate limit for ownership evaluation.
    - We also have a killswitch to disable this logic for a project, in case for whatever reason a
      project is causing problems with the queue.

    These checks are to protect the queue from being overwhelmed by one project, and also to prevent
    one project to spam our Source code manager's (github, etc.) APIs.
    """
    if job["is_reprocessed"]:
        return

    from sentry.models.groupowner import (
        ASSIGNEE_DOES_NOT_EXIST_DURATION,
        ASSIGNEE_EXISTS_DURATION,
        ASSIGNEE_EXISTS_KEY,
        ISSUE_OWNERS_DEBOUNCE_DURATION,
        ISSUE_OWNERS_DEBOUNCE_KEY,
    )
    from sentry.models.projectownership import ProjectOwnership

    event = job["event"]
    project, group = event.project, event.group

    assignee_key = ASSIGNEE_EXISTS_KEY(group.id)
    assignees_exists = cache.get(assignee_key)
    if assignees_exists is None:
        assignees_exists = group.assignee_set.exists()
        cache.set(
            assignee_key,
            assignees_exists,
            (ASSIGNEE_EXISTS_DURATION if assignees_exists else ASSIGNEE_DOES_NOT_EXIST_DURATION),
        )

    if assignees_exists:
        metrics.incr("sentry.task.post_process.handle_owner_assignment.assignee_exists")
        return

    issue_owners_key = ISSUE_OWNERS_DEBOUNCE_KEY(group.id)
    debounce_issue_owners = cache.get(issue_owners_key)

    if debounce_issue_owners:
        metrics.incr("sentry.tasks.post_process.handle_owner_assignment.debounce")
        return

    if should_issue_owners_ratelimit(
        project_id=project.id,
        group_id=group.id,
        organization_id=event.project.organization_id,
    ):
        if random.random() < 0.01:
            logger.warning(
                "handle_owner_assignment.ratelimited",
                extra={
                    "organization_id": event.project.organization_id,
                    "project_id": project.id,
                    "group_id": group.id,
                },
            )
        metrics.incr("sentry.task.post_process.handle_owner_assignment.ratelimited")
        return

    if killswitch_matches_context(
        "post_process.get-autoassign-owners",
        {
            "project_id": project.id,
        },
    ):
        # see ProjectOwnership.get_issue_owners
        issue_owners: Sequence[tuple[Rule, Sequence[Team | RpcUser], str]] = []
        handle_invalid_group_owners(group)
    else:
        issue_owners = ProjectOwnership.get_issue_owners(project.id, event.data)
        cache.set(
            issue_owners_key,
            True,
            ISSUE_OWNERS_DEBOUNCE_DURATION,
        )

    if issue_owners:
        try:
            handle_group_owners(project, group, issue_owners)
        except Exception:
            logger.exception("Failed to store group owners")
    else:
        handle_invalid_group_owners(group)


@sentry_sdk.trace
def handle_invalid_group_owners(group):
    from sentry.models.groupowner import GroupOwner, GroupOwnerType

    invalid_group_owners = GroupOwner.objects.filter(
        group=group,
        type__in=[GroupOwnerType.OWNERSHIP_RULE.value, GroupOwnerType.CODEOWNERS.value],
    )
    for owner in invalid_group_owners:
        owner.delete()
        logger.info(
            "handle_invalid_group_owners.delete_group_owner",
            extra={"group": group.id, "group_owner_id": owner.id, "project": group.project_id},
        )


@sentry_sdk.trace
def handle_group_owners(
    project: Project,
    group: Group,
    issue_owners: Sequence[tuple[Rule, Sequence[Team | RpcUser], str]],
):
    """
    Stores group owners generated by `ProjectOwnership.get_issue_owners` in the
    `GroupOwner` model, and handles any diffing/changes of which owners we're keeping.
    :return:
    """
    from sentry.models.groupowner import GroupOwner, GroupOwnerType, OwnerRuleType
    from sentry.models.team import Team
    from sentry.users.models.user import User
    from sentry.users.services.user import RpcUser

    lock = locks.get(f"groupowner-bulk:{group.id}", duration=10, name="groupowner_bulk")
    logging_params = {
        "group": group.id,
        "project": project.id,
        "organization": project.organization_id,
        "issue_owners_length": len(issue_owners) if issue_owners else 0,
    }
    try:
        logger.info("handle_group_owners.start", extra=logging_params)
        with (
            sentry_sdk.start_span(op="post_process.handle_group_owners"),
            lock.acquire(),
        ):
            current_group_owners = GroupOwner.objects.filter(
                group=group,
                type__in=[GroupOwnerType.OWNERSHIP_RULE.value, GroupOwnerType.CODEOWNERS.value],
            )
            new_owners: dict = {}
            for rule, owners, source in issue_owners:
                for owner in owners:
                    # Can potentially have multiple rules pointing to the same owner
                    if new_owners.get((type(owner), owner.id, source)):
                        new_owners[(type(owner), owner.id, source)].append(rule)
                    else:
                        new_owners[(type(owner), owner.id, source)] = [rule]

            # Owners already in the database that we'll keep
            keeping_owners = set()
            for group_owner in current_group_owners:
                local_logging_params = logging_params.copy()
                local_logging_params["group_owner_id"] = group_owner.id
                owner_rule_type = (
                    OwnerRuleType.CODEOWNERS.value
                    if group_owner.type == GroupOwnerType.CODEOWNERS.value
                    else OwnerRuleType.OWNERSHIP_RULE.value
                )
                lookup_key = (
                    (Team, group_owner.team_id, owner_rule_type)
                    if group_owner.team_id is not None
                    else (User, group_owner.user_id, owner_rule_type)
                )
                # Old groupowner assignments get deleted
                lookup_key_value = None
                if lookup_key not in new_owners:
                    group_owner.delete()
                    logger.info(
                        "handle_group_owners.delete_group_owner",
                        extra={**local_logging_params, "reason": "assignment_deleted"},
                    )
                else:
                    lookup_key_value = new_owners.get(lookup_key)
                # Old groupowner assignment from outdated rules get deleted
                if (
                    lookup_key_value
                    and (group_owner.context or {}).get("rule") not in lookup_key_value
                ):
                    group_owner.delete()
                    logger.info(
                        "handle_group_owners.delete_group_owner",
                        extra={**local_logging_params, "reason": "outdated_rule"},
                    )
                else:
                    keeping_owners.add(lookup_key)

            new_group_owners = []

            for key in new_owners.keys():
                if key not in keeping_owners:
                    owner_type, owner_id, owner_source = key
                    rules = new_owners[key]
                    group_owner_type = (
                        GroupOwnerType.OWNERSHIP_RULE.value
                        if owner_source == OwnerRuleType.OWNERSHIP_RULE.value
                        else GroupOwnerType.CODEOWNERS.value
                    )
                    user_id = None
                    team_id = None
                    if owner_type is RpcUser:
                        user_id = owner_id
                    if owner_type is Team:
                        team_id = owner_id
                    for rule in rules:
                        new_group_owners.append(
                            GroupOwner(
                                group=group,
                                type=group_owner_type,
                                user_id=user_id,
                                team_id=team_id,
                                project=project,
                                organization=project.organization,
                                context={"rule": str(rule)},
                            )
                        )
            if new_group_owners:
                GroupOwner.objects.bulk_create(new_group_owners)
                for go in new_group_owners:
                    post_save.send_robust(
                        sender=GroupOwner,
                        instance=go,
                        created=True,
                    )
                logging_params["count"] = len(new_group_owners)
                logger.info("group_owners.bulk_create", extra=logging_params)

    except UnableToAcquireLock:
        logger.info("handle_group_owners.lock_failed", extra=logging_params)
        pass


def update_existing_attachments(job):
    """
    Attaches the group_id to all event attachments that were either:

    1) ingested prior to the event via the standalone attachment endpoint.
    2) part of a different group before reprocessing started.
    """
    from sentry.models.eventattachment import EventAttachment

    event = job["event"]

    EventAttachment.objects.filter(project_id=event.project_id, event_id=event.event_id).update(
        group_id=event.group_id
    )


def fetch_buffered_group_stats(group):
    """
    Populates `times_seen_pending` with the number of buffered increments to `times_seen`
    for this group. `times_seen_with_pending` can subsequently be used as the total times seen,
    including the pending buffer updates.
    """
    from sentry import buffer
    from sentry.models.group import Group

    result = buffer.backend.get(Group, ["times_seen"], {"id": group.id})
    group.times_seen_pending = result["times_seen"]


MAX_FETCH_ATTEMPTS = 3


def should_retry_fetch(attempt: int, e: Exception) -> bool:
    from sentry.issues.occurrence_consumer import EventLookupError

    return not attempt > MAX_FETCH_ATTEMPTS and (
        isinstance(e, ServiceUnavailable) or isinstance(e, EventLookupError)
    )


fetch_retry_policy = ConditionalRetryPolicy(should_retry_fetch, exponential_delay(1.00))


def should_update_escalating_metrics(event: Event) -> bool:
    return (
        features.has("organizations:escalating-metrics-backend", event.project.organization)
        and event.group is not None
        and event.group.issue_type.should_detect_escalation()
    )


@instrumented_task(
    name="sentry.issues.tasks.post_process.post_process_group",
    namespace=ingest_errors_postprocess_tasks,
    processing_deadline_duration=120,
    silo_mode=SiloMode.REGION,
)
def post_process_group(
    is_new,
    is_regression,
    is_new_group_environment,
    cache_key,
    group_id=None,
    occurrence_id: str | None = None,
    *,
    project_id: int,
    eventstream_type: str | None = None,
    **kwargs,
):
    """
    Fires post processing hooks for a group.
    """
    from sentry.utils import snuba

    with snuba.options_override({"consistent": True}):
        from sentry.issues.occurrence_consumer import EventLookupError
        from sentry.models.organization import Organization
        from sentry.models.project import Project
        from sentry.reprocessing2 import is_reprocessed_event
        from sentry.services import eventstore
        from sentry.services.eventstore.processing import event_processing_store

        if occurrence_id is None:
            # We use the data being present/missing in the processing store
            # to ensure that we don't duplicate work should the forwarding consumers
            # need to rewind history.
            data = event_processing_store.get(cache_key)
            if not data:

                logger.info(
                    "post_process.skipped",
                    extra={"cache_key": cache_key, "reason": "missing_cache"},
                )
                return
            with metrics.timer("tasks.post_process.delete_event_cache"):
                event_processing_store.delete_by_key(cache_key)
            occurrence = None
            event = process_event(data, group_id)
        else:
            # Note: We attempt to acquire the lock here, but we don't release it and instead just
            # rely on the ttl. The goal here is to make sure we only ever run post process group
            # at most once per occurrence. Even though we don't use retries on the task, this is
            # still necessary since the consumer that sends these might reprocess a batch.
            # TODO: It might be better to instead set a value that we delete here, similar to what
            # we do with `event_processing_store`. If we could do this *before* the occurrence ends
            # up in Kafka (IE via the api that will sit in front of it), then we could guarantee at
            # most once running of post process group.
            lock = locks.get(
                f"ppg:{occurrence_id}-once",
                duration=600,
                name="post_process_w_o",
            )

            try:
                lock.acquire()
            except Exception:
                # If we fail to acquire the lock, we've already run post process group for this
                # occurrence
                return

            occurrence = (
                IssueOccurrence.fetch(occurrence_id, project_id=project_id) if project_id else None
            )
            if not occurrence:
                logger.error(
                    "Failed to fetch occurrence",
                    extra={"occurrence_id": occurrence_id, "project_id": project_id},
                )
                return
            # Issue platform events don't use `event_processing_store`. Fetch from eventstore
            # instead.

            def get_event_raise_exception() -> Event:
                assert occurrence is not None
                retrieved = eventstore.backend.get_event_by_id(
                    project_id,
                    occurrence.event_id,
                    group_id=group_id,
                    skip_transaction_groupevent=True,
                    occurrence_id=occurrence_id,
                )
                if retrieved is None:
                    raise EventLookupError(
                        f"failed to retrieve event(project_id={project_id}, event_id={occurrence.event_id}, group_id={group_id}) from eventstore"
                    )
                return retrieved

            event = fetch_retry_policy(get_event_raise_exception)

        track_event_since_received(
            step="start_post_process",
            event_data=event.data,
        )

        set_current_event_project(event.project_id)

        # Re-bind Project and Org since we're reading the Event object
        # from cache which may contain stale parent models.
        with sentry_sdk.start_span(op="tasks.post_process_group.project_get_from_cache"):
            try:
                event.project = Project.objects.get_from_cache(id=event.project_id)
            except Project.DoesNotExist:
                # project probably got deleted while this task was sitting in the queue
                return
            event.project.set_cached_field_value(
                "organization",
                Organization.objects.get_from_cache(id=event.project.organization_id),
            )

        is_reprocessed = is_reprocessed_event(event.data)
        sentry_sdk.set_tag("is_reprocessed", is_reprocessed)

        metric_tags = {}
        if group_id:
            group_state: GroupState = {
                "id": group_id,
                "is_new": is_new,
                "is_regression": is_regression,
                "is_new_group_environment": is_new_group_environment,
            }

            group_event = update_event_group(event, group_state)
            bind_organization_context(event.project.organization)
            _capture_event_stats(event)
            if should_update_escalating_metrics(event):
                _update_escalating_metrics(event)

            group_event.occurrence = occurrence

            run_post_process_job(
                {
                    "event": group_event,
                    "group_state": group_state,
                    "is_reprocessed": is_reprocessed,
                    "has_reappeared": bool(not group_state["is_new"]),
                    "has_alert": False,
                    "has_escalated": kwargs.get("has_escalated", False),
                }
            )
            metric_tags["occurrence_type"] = group_event.group.issue_type.slug

        track_event_since_received(
            step="end_post_process",
            event_data=event.data,
            tags=metric_tags,
        )


def run_post_process_job(job: PostProcessJob) -> None:
    group_event = job["event"]
    issue_category = group_event.group.issue_category if group_event.group else None
    issue_category_metric = issue_category.name.lower() if issue_category else None

    if group_event.group and not group_event.group.issue_type.allow_post_process_group(
        group_event.group.organization
    ):
        metrics.incr(
            "post_process.skipped_feature_disabled",
            tags={"issue_type": group_event.group.issue_type.slug},
        )
        return

    if issue_category in GROUP_CATEGORY_POST_PROCESS_PIPELINE:
        # specific pipelines for issue types
        pipeline = GROUP_CATEGORY_POST_PROCESS_PIPELINE[issue_category]
    else:
        # pipeline for generic issues
        pipeline = GENERIC_POST_PROCESS_PIPELINE

    for pipeline_step in pipeline:
        try:
            with (
                metrics.timer(
                    "tasks.post_process.run_post_process_job.pipeline.duration",
                    tags={
                        "pipeline": pipeline_step.__name__,
                        "issue_category": issue_category_metric,
                        "is_reprocessed": job["is_reprocessed"],
                    },
                ),
                sentry_sdk.start_span(op=f"tasks.post_process_group.{pipeline_step.__name__}"),
            ):
                pipeline_step(job)
        except Exception:
            metrics.incr(
                "sentry.tasks.post_process.post_process_group.exception",
                tags={
                    "issue_category": issue_category_metric,
                    "pipeline": pipeline_step.__name__,
                },
            )
            logger.exception(
                "Failed to process pipeline step %s",
                pipeline_step.__name__,
                extra={"event": group_event, "group": group_event.group},
            )
        else:
            metrics.incr(
                "sentry.tasks.post_process.post_process_group.completed",
                tags={
                    "issue_category": issue_category_metric,
                    "pipeline": pipeline_step.__name__,
                },
            )


def process_event(data: MutableMapping[str, Any], group_id: int | None) -> Event:
    from sentry.models.event import EventDict
    from sentry.services.eventstore.models import Event

    event = Event(
        project_id=data["project"], event_id=data["event_id"], group_id=group_id, data=data
    )

    # Re-bind node data to avoid renormalization. We only want to
    # renormalize when loading old data from the database.
    event.data = EventDict(event.data, skip_renormalization=True)
    return event


def update_event_group(event: Event, group_state: GroupState) -> GroupEvent:
    # NOTE: we must pass through the full Event object, and not an
    # event_id since the Event object may not actually have been stored
    # in the database due to sampling.
    from sentry.models.group import get_group_with_redirect

    # Re-bind Group since we're reading the Event object
    # from cache, which may contain a stale group and project
    rebound_group = get_group_with_redirect(group_state["id"])[0]
    # We buffer updates to last_seen, assume it's at least >= the event datetime
    rebound_group.last_seen = max(event.datetime, rebound_group.last_seen)

    # We fetch buffered updates to group aggregates here and populate them on the Group. This
    # helps us avoid problems with processing group ignores and alert rules that rely on these
    # stats.
    with sentry_sdk.start_span(op="tasks.post_process_group.fetch_buffered_group_stats"):
        fetch_buffered_group_stats(rebound_group)

    rebound_group.project = event.project
    rebound_group.project.set_cached_field_value("organization", event.project.organization)
    group_state["id"] = rebound_group.id
    if event.group_id is not None:
        # deprecated event.group and event.group_id usage, kept here for backwards compatibility
        event.group = rebound_group

    event.groups = [rebound_group]
    return event.for_group(rebound_group)


def process_inbox_adds(job: PostProcessJob) -> None:
    from sentry.models.group import GroupStatus
    from sentry.types.group import GroupSubStatus

    with sentry_sdk.start_span(op="tasks.post_process_group.add_group_to_inbox"):
        event = job["event"]
        is_reprocessed = job["is_reprocessed"]
        is_new = job["group_state"]["is_new"]
        is_regression = job["group_state"]["is_regression"]
        has_reappeared = job["has_reappeared"]

        from sentry.models.groupinbox import GroupInboxReason, add_group_to_inbox

        if not event.group:
            logger.error(
                "Group not found on event while processing inbox adds",
                extra={"event_id": event.event_id},
            )
            return

        if is_reprocessed and is_new:
            # keep Group.status=UNRESOLVED and Group.substatus=ONGOING if its reprocessed
            add_group_to_inbox(event.group, GroupInboxReason.REPROCESSED)
        elif (
            not is_reprocessed and not has_reappeared
        ):  # If true, we added the .ONGOING reason already
            if is_new:
                add_group_to_inbox(event.group, GroupInboxReason.NEW)
            elif is_regression:
                # we don't need to update the group since that should've already been
                # handled on event ingest
                event.group.status = GroupStatus.UNRESOLVED
                event.group.substatus = GroupSubStatus.REGRESSED
                add_group_to_inbox(event.group, GroupInboxReason.REGRESSION)


def process_snoozes(job: PostProcessJob) -> None:
    """
    Set has_reappeared to True if the group is transitioning from "resolved" to "unresolved" and
    set has_escalated to True if the group is transitioning from "archived until escalating" to "unresolved"
    otherwise set to False.
    """
    # we process snoozes before rules as it might create a regression
    # but not if it's new because you can't immediately snooze a new group
    if job["is_reprocessed"] or not job["has_reappeared"]:
        return

    from sentry.issues.escalating.escalating import is_escalating, manage_issue_states
    from sentry.models.group import GroupStatus
    from sentry.models.groupinbox import GroupInboxReason
    from sentry.models.groupsnooze import GroupSnooze
    from sentry.types.group import GroupSubStatus

    event = job["event"]
    group = event.group
    if not group:
        logger.error(
            "Group not found on event while processing snoozes", extra={"event_id": event.event_id}
        )
        return

    if not group.issue_type.should_detect_escalation():
        return

    # groups less than a day old should use the new -> escalating logic
    group_age_hours = (timezone.now() - group.first_seen).total_seconds() / 3600
    should_use_new_escalation_logic = group_age_hours < MAX_NEW_ESCALATION_AGE_HOURS
    # Check if group is escalating
    if (
        not should_use_new_escalation_logic
        and group.status == GroupStatus.IGNORED
        and group.substatus == GroupSubStatus.UNTIL_ESCALATING
    ):
        escalating, forecast = is_escalating(group)
        if escalating:
            manage_issue_states(
                group, GroupInboxReason.ESCALATING, event, activity_data={"forecast": forecast}
            )
            job["has_escalated"] = True
        return

    with metrics.timer("post_process.process_snoozes.duration"):
        key = GroupSnooze.get_cache_key(group.id)
        snooze = cache.get(key)
        if snooze is None:
            try:
                snooze = GroupSnooze.objects.get(group=group)
            except GroupSnooze.DoesNotExist:
                snooze = False
            # This cache is also set in post_save|delete.
            cache.set(key, snooze, 3600)
        if not snooze:
            job["has_reappeared"] = False
            return

        # GroupSnooze row exists but the Group.status isn't ignored
        # this shouldn't be possible, if this fires, there may be a race or bug
        if snooze is not None and group.status is not GroupStatus.IGNORED:
            # log a metric for now, we can potentially set the status and substatus but that might mask some other bug
            metrics.incr(
                "post_process.process_snoozes.mismatch_status",
                tags={
                    "group_status": group.status,
                    "group_substatus": group.substatus,
                },
            )

        snooze_condition_still_applies = snooze.is_valid(
            group, test_rates=True, use_pending_data=True
        )

        if not snooze_condition_still_applies:
            snooze_details: InboxReasonDetails = {
                "until": (
                    snooze.until.replace(microsecond=0).isoformat()
                    if snooze.until is not None
                    else None
                ),
                "count": snooze.count,
                "window": snooze.window,
                "user_count": snooze.user_count,
                "user_window": snooze.user_window,
            }

            # issues snoozed with a specific time duration should be marked ONGOING when the window expires
            reason = (
                GroupInboxReason.ONGOING
                if snooze.until is not None
                else GroupInboxReason.ESCALATING
            )
            manage_issue_states(group, reason, event, snooze_details)

            snooze.delete()

            issue_unignored.send_robust(
                project=group.project,
                user_id=None,
                group=group,
                transition_type="automatic",
                sender="process_snoozes",
            )

            job["has_reappeared"] = True
            return

        job["has_reappeared"] = False
        return


def process_replay_link(job: PostProcessJob) -> None:
    def _get_replay_id(event):
        # replay ids can either come as a context, or a tag.
        # right now they come as a context on non-js events,
        # and javascript transaction (through DSC context)
        # It comes as a tag on js errors.
        # TODO: normalize this upstream in relay and javascript SDK. and eventually remove the tag
        # logic.

        context_replay_id = get_path(event.data, "contexts", "replay", "replay_id")
        return context_replay_id or event.get_tag("replayId")

    if job["is_reprocessed"]:
        return

    metrics.incr("post_process.process_replay_link.id_sampled")

    group_event = job["event"]
    replay_id = _get_replay_id(group_event)
    if not replay_id:
        return

    # Validate the UUID.
    try:
        uuid.UUID(replay_id)
    except (ValueError, TypeError):
        return None

    metrics.incr("post_process.process_replay_link.id_exists")

    publisher = initialize_replays_publisher(is_async=True)
    try:
        kafka_payload = transform_event_for_linking_payload(replay_id, group_event)
    except ValueError:
        metrics.incr("post_process.process_replay_link.id_invalid")
    else:
        publisher.publish(
            "ingest-replay-events",
            json.dumps(kafka_payload),
        )


def process_workflow_engine(job: PostProcessJob) -> None:
    """
    Invoke the workflow_engine to process workflows given the job.

    Currently, we do not want to add this to an event in post processing,
    instead wrap this with a check for a feature flag before invoking.

    Eventually, we'll want to replace `process_rule` with this method.
    """
    metrics.incr("workflow_engine.issue_platform.payload.received.occurrence")

    from sentry.workflow_engine.tasks.workflows import process_workflows_event

    if "event" not in job:
        logger.error("Missing event to schedule workflow task", extra={"job": job})
        return

    if not job["event"].group.is_unresolved():
        return

    try:
        process_workflows_event.apply_async(
            kwargs=dict(
                event_id=job["event"].event_id,
                occurrence_id=job["event"].occurrence_id,
                group_id=job["event"].group_id,
                group_state=job["group_state"],
                has_reappeared=job["has_reappeared"],
                has_escalated=job["has_escalated"],
                start_timestamp_seconds=time(),
            ),
            headers={"sentry-propagate-traces": False},
        )
    except Exception:
        logger.exception("Could not process workflow task", extra={"job": job})
        return


def _should_single_process_event(job: PostProcessJob) -> bool:
    org = job["event"].project.organization

    return (
        features.has("organizations:workflow-engine-single-process-workflows", org)
        and job["event"].group.type
        in options.get("workflow_engine.issue_alert.group.type_id.rollout")
    ) or job["event"].group.type in options.get("workflow_engine.issue_alert.group.type_id.ga")


def process_workflow_engine_issue_alerts(job: PostProcessJob) -> None:
    """
    Call for process_workflow_engine with the issue alert feature flag
    """
    if job["is_reprocessed"]:
        return

    # process workflow engine if we are single processing or dual processing for a specific org
    if _should_single_process_event(job):
        process_workflow_engine(job)


def process_workflow_engine_metric_issues(job: PostProcessJob) -> None:
    """
    Call for process_workflow_engine for metric alerts
    """
    if job["is_reprocessed"]:
        return

    process_workflow_engine(job)


def process_rules(job: PostProcessJob) -> None:
    if job["is_reprocessed"]:
        return

    if _should_single_process_event(job):
        # we are only processing through workflow engine
        return

    metrics.incr(
        "post_process.rules_processor_events", tags={"group_type": job["event"].group.type}
    )

    from sentry.rules.processing.processor import RuleProcessor

    group_event = job["event"]
    is_new = job["group_state"]["is_new"]
    is_regression = job["group_state"]["is_regression"]
    is_new_group_environment = job["group_state"]["is_new_group_environment"]
    has_reappeared = job["has_reappeared"]
    has_escalated = job["has_escalated"]

    has_alert = False

    rp = RuleProcessor(
        group_event,
        is_new,
        is_regression,
        is_new_group_environment,
        has_reappeared,
        has_escalated,
    )
    with sentry_sdk.start_span(op="tasks.post_process_group.rule_processor_callbacks"):
        # TODO(dcramer): ideally this would fanout, but serializing giant
        # objects back and forth isn't super efficient
        callback_and_futures = rp.apply()

        for callback, futures in callback_and_futures:
            has_alert = True
            safe_execute(callback, group_event, futures)

    job["has_alert"] = has_alert
    return


def process_code_mappings(job: PostProcessJob) -> None:
    if job["is_reprocessed"]:
        return

    from sentry.issues.auto_source_code_config.stacktraces import get_frames_to_process
    from sentry.issues.auto_source_code_config.utils.platform import supported_platform
    from sentry.tasks.auto_source_code_config import auto_source_code_config

    try:
        event = job["event"]
        project = event.project
        group_id = event.group_id

        platform = event.data.get("platform", "not_available")
        if not supported_platform(platform):
            return

        frames_to_process = get_frames_to_process(event.data, platform)
        if not frames_to_process:
            return

        # To limit the overall number of tasks, only process one issue per project per hour. In
        # order to give the most issues a chance to to be processed, don't reprocess any given
        # issue for at least 24 hours.
        project_cache_key = f"code-mappings:project:{project.id}"
        issue_cache_key = f"code-mappings:group:{group_id}"
        if cache.get(project_cache_key) is None and cache.get(issue_cache_key) is None:
            cache.set(project_cache_key, True, 3600)  # 1 hour
            cache.set(issue_cache_key, True, 86400)  # 24 hours
        else:
            return

        auto_source_code_config.delay(project.id, event_id=event.event_id, group_id=group_id)

    except Exception:
        logger.exception("Failed to process automatic source code config")


def process_commits(job: PostProcessJob) -> None:
    if job["is_reprocessed"]:
        return

    from sentry.models.commit import Commit
    from sentry.tasks.commit_context import process_commit_context
    from sentry.tasks.groupowner import DEBOUNCE_CACHE_KEY as SUSPECT_COMMITS_DEBOUNCE_CACHE_KEY
    from sentry.tasks.groupowner import process_suspect_commits

    event = job["event"]

    try:
        lock = locks.get(
            f"w-o:{event.group_id}-d-l",
            duration=10,
            name="post_process_w_o",
        )
        with lock.acquire():
            has_commit_key = f"w-o:{event.project.organization_id}-h-c"
            org_has_commit = cache.get(has_commit_key)
            if org_has_commit is None:
                org_has_commit = Commit.objects.filter(
                    organization_id=event.project.organization_id
                ).exists()
                cache.set(has_commit_key, org_has_commit, 3600)

            if org_has_commit:
                from sentry.utils.committers import get_frame_paths

                event_frames = get_frame_paths(event)
                sdk_name = get_sdk_name(event.data)

                integration_cache_key = (
                    f"commit-context-scm-integration:{event.project.organization_id}"
                )
                has_integrations = cache.get(integration_cache_key)
                if has_integrations is None:
                    from sentry.integrations.services.integration import integration_service

                    org_integrations = integration_service.get_organization_integrations(
                        organization_id=event.project.organization_id,
                        providers=[
                            IntegrationProviderSlug.GITHUB.value,
                            IntegrationProviderSlug.GITLAB.value,
                            IntegrationProviderSlug.GITHUB_ENTERPRISE.value,
                            IntegrationProviderSlug.PERFORCE.value,
                        ],
                    )
                    has_integrations = len(org_integrations) > 0
                    # Cache the integrations check for 4 hours
                    cache.set(integration_cache_key, has_integrations, 14400)

                if has_integrations:
                    if not job["group_state"]["is_new"]:
                        return

                    process_commit_context.delay(
                        event_id=event.event_id,
                        event_platform=event.platform or "",
                        event_frames=event_frames,
                        group_id=event.group_id,
                        project_id=event.project_id,
                        sdk_name=sdk_name,
                    )
                else:
                    cache_key = SUSPECT_COMMITS_DEBOUNCE_CACHE_KEY(event.group_id)
                    if cache.get(cache_key):
                        metrics.incr("sentry.tasks.process_suspect_commits.debounce")
                        return
                    process_suspect_commits.delay(
                        event_id=event.event_id,
                        event_platform=event.platform,
                        event_frames=event_frames,
                        group_id=event.group_id,
                        project_id=event.project_id,
                        sdk_name=sdk_name,
                    )
    except UnableToAcquireLock:
        pass


def handle_auto_assignment(job: PostProcessJob) -> None:
    if job["is_reprocessed"]:
        return

    from sentry.models.projectownership import ProjectOwnership

    event = job["event"]
    ProjectOwnership.handle_auto_assignment(
        project_id=event.project_id,
        organization_id=event.project.organization_id,
        event=event,
        logging_extra={
            "event_id": event.event_id,
            "group_id": str(event.group_id),
            "project_id": str(event.project_id),
            "organization_id": event.project.organization_id,
            "source": "post_process",
        },
    )


def process_service_hooks(job: PostProcessJob) -> None:
    if job["is_reprocessed"]:
        return

    if _should_single_process_event(job):
        # we will kick off service hooks in the workflow engine task
        return

    from sentry.sentry_apps.tasks.service_hooks import kick_off_service_hooks

    kick_off_service_hooks(job["event"], job["has_alert"])


def process_resource_change_bounds(job: PostProcessJob) -> None:
    if not should_process_resource_change_bounds(job):
        return

    if job["is_reprocessed"]:
        return

    from sentry.sentry_apps.tasks.sentry_apps import process_resource_change_bound

    event, is_new = job["event"], job["group_state"]["is_new"]

    if event.get_event_type() == "error" and _should_send_error_created_hooks(event.project):
        process_resource_change_bound.delay(
            action="created",
            sender="Error",
            instance_id=event.event_id,
            project_id=event.project_id,
            group_id=event.group_id,
        )
    if is_new:
        process_resource_change_bound.delay(
            action="created", sender="Group", instance_id=event.group_id
        )


def should_process_resource_change_bounds(job: PostProcessJob) -> bool:
    # Feature flag check for expanded sentry apps webhooks
    has_expanded_sentry_apps_webhooks = features.has(
        "organizations:expanded-sentry-apps-webhooks", job["event"].project.organization
    )
    group_category = job["event"].group.issue_category

    if group_category != GroupCategory.ERROR and not has_expanded_sentry_apps_webhooks:
        return False

    supported_group_categories = [
        GroupCategory(category)
        for category in options.get("sentry-apps.expanded-webhook-categories")
    ]
    if group_category not in supported_group_categories:
        return False

    return True


def process_data_forwarding(job: PostProcessJob) -> None:
    if job["is_reprocessed"]:
        return

    event = job["event"]

    if not features.has("organizations:data-forwarding-revamp-access", event.project.organization):
        return

    if not features.has("organizations:data-forwarding", event.project.organization):
        return

    from sentry.integrations.data_forwarding import FORWARDER_REGISTRY
    from sentry.integrations.data_forwarding.base import BaseDataForwarder
    from sentry.integrations.models.data_forwarder_project import DataForwarderProject

    data_forwarder_projects = DataForwarderProject.objects.filter(
        project_id=event.project_id,
        is_enabled=True,
        data_forwarder__is_enabled=True,
    ).select_related("data_forwarder")

    for data_forwarder_project in data_forwarder_projects:
        provider = data_forwarder_project.data_forwarder.provider
        try:
            # GroupEvent is compatible with Event for all operations forwarders need
            forwarder: type[BaseDataForwarder] = FORWARDER_REGISTRY[provider]
            forwarder().post_process(event, data_forwarder_project)
            metrics.incr(
                "data_forwarding.post_process",
                tags={"provider": provider},
            )
        except Exception:
            metrics.incr(
                "data_forwarding.post_process.error",
                tags={"provider": provider},
            )
            logger.exception(
                "data_forwarding.post_process.error",
                extra={"provider": provider, "project_id": event.project_id},
            )


def process_plugins(job: PostProcessJob) -> None:
    if job["is_reprocessed"]:
        return

    from sentry.plugins.base import plugins

    event, is_new, is_regression = (
        job["event"],
        job["group_state"]["is_new"],
        job["group_state"]["is_regression"],
    )

    for plugin in plugins.for_project(event.project):
        plugin_post_process_group(
            plugin_slug=plugin.slug, event=event, is_new=is_new, is_regresion=is_regression
        )


def process_similarity(job: PostProcessJob) -> None:
    if not options.get("sentry.similarity.indexing.enabled"):
        return
    if job["is_reprocessed"] or job["event"].group.project.get_option(
        "sentry:similarity_backfill_completed"
    ):
        return

    from sentry import similarity

    event = job["event"]

    with sentry_sdk.start_span(op="tasks.post_process_group.similarity"):
        safe_execute(similarity.record, event.project, [event])


def fire_error_processed(job: PostProcessJob):
    if job["is_reprocessed"]:
        return
    event = job["event"]

    event_processed.send_robust(
        sender=post_process_group,
        project=event.project,
        event=event,
    )


def sdk_crash_monitoring(job: PostProcessJob):
    from sentry.utils.sdk_crashes.sdk_crash_detection import sdk_crash_detection

    if job["is_reprocessed"]:
        return

    event = job["event"]

    if not features.has("organizations:sdk-crash-detection", event.project.organization):
        return

    with sentry_sdk.start_span(op="post_process.build_sdk_crash_config"):
        configs = build_sdk_crash_detection_configs()
        if not configs or len(configs) == 0:
            return None

    with sentry_sdk.start_span(op="post_process.detect_sdk_crash"):
        sdk_crash_detection.detect_sdk_crash(event=event, configs=configs)


def plugin_post_process_group(plugin_slug, event, **kwargs):
    """
    Fires post processing hooks for a group.
    """
    set_current_event_project(event.project_id)

    from sentry.plugins.base import plugins

    plugin = plugins.get(plugin_slug)
    try:
        plugin.post_process(
            event=event,
            group=event.group,
            **kwargs,
        )
    except PluginError as e:
        logger.info("post_process.process_error_ignored", extra={"exception": e})
    # Since plugins are deprecated, instead of creating issues, lets just create a warning log
    except Exception as e:
        logger.warning("post_process.process_error", extra={"exception": e})


def feedback_filter_decorator(func):
    def wrapper(job):
        if not should_postprocess_feedback(job):
            return
        return func(job)

    return wrapper


def should_postprocess_feedback(job: PostProcessJob) -> bool:
    from sentry.feedback.lib.utils import FeedbackCreationSource

    event = job["event"]

    if not hasattr(event, "occurrence") or event.occurrence is None:
        return False

    if event.occurrence.evidence_data.get("is_spam") is True:
        metrics.incr("feedback.spam-detection-actions.dont-send-notification")
        return False

    feedback_source = event.occurrence.evidence_data.get("source")
    if feedback_source is None:
        logger.error("Feedback source is missing, skipped alert processing")
        return False

    if feedback_source in FeedbackCreationSource.new_feedback_category_values():
        return True

    should_notify_on_old_feedbacks = job["event"].project.get_option(
        "sentry:feedback_user_report_notifications"
    )
    if should_notify_on_old_feedbacks is None:
        should_notify_on_old_feedbacks = projectoptions.get_well_known_default(
            "sentry:feedback_user_report_notifications",
            epoch=job["event"].project.get_option(
                ("sentry:option-epoch"),
            ),
        )

    if (
        feedback_source in FeedbackCreationSource.old_feedback_category_values()
        and should_notify_on_old_feedbacks
    ):
        return True

    return False


def link_event_to_user_report(job: PostProcessJob) -> None:
    from sentry.feedback.lib.utils import FeedbackCreationSource
    from sentry.feedback.usecases.ingest.shim_to_feedback import shim_to_feedback
    from sentry.models.userreport import UserReport

    event = job["event"]
    project = event.project
    group = event.group

    if not job["is_reprocessed"]:
        metrics.incr("event_manager.save._update_user_reports_with_event_link")
        event = job["event"]
        project = event.project
        user_reports_without_group = UserReport.objects.filter(
            project_id=project.id, event_id=event.event_id, group_id__isnull=True
        )
        for report in user_reports_without_group:
            if report.environment_id is None:
                shim_to_feedback(
                    {
                        "name": report.name,
                        "email": report.email,
                        "comments": report.comments,
                        "event_id": report.event_id,
                        "level": "error",
                    },
                    event,
                    project,
                    FeedbackCreationSource.USER_REPORT_ENVELOPE,
                )
                metrics.incr(
                    "event_manager.save._update_user_reports_with_event_link.shim_to_feedback"
                )
        # If environment is set, this report was already shimmed from new feedback.

        user_reports_updated = user_reports_without_group.update(
            group_id=group.id, environment_id=event.get_environment().id
        )

        if user_reports_updated:
            metrics.incr("event_manager.save._update_user_reports_with_event_link_updated")

    else:
        UserReport.objects.filter(project_id=project.id, event_id=job["event"].event_id).update(
            group_id=group.id, environment_id=event.get_environment().id
        )


MAX_NEW_ESCALATION_AGE_HOURS = 24
MIN_EVENTS_FOR_NEW_ESCALATION = 10


def detect_new_escalation(job: PostProcessJob):
    """
    Detects whether a new issue is escalating. New issues are issues less than
    MAX_NEW_ESCALATION_AGE_HOURS hours old.

    If we detect that the group has escalated, set has_escalated to True in the
    job.
    """
    from sentry.issues.escalating.issue_velocity import get_latest_threshold
    from sentry.issues.priority import PriorityChangeReason, auto_update_priority
    from sentry.models.activity import Activity
    from sentry.models.group import GroupStatus
    from sentry.models.grouphistory import GroupHistoryStatus, record_group_history
    from sentry.models.groupinbox import GroupInboxReason, add_group_to_inbox
    from sentry.types.activity import ActivityType

    group = job["event"].group
    if not group:
        return
    extra = {
        "org_id": group.organization.id,
        "project_id": job["event"].project.id,
        "group_id": group.id,
    }
    group_age_seconds = (timezone.now() - group.first_seen).total_seconds()
    group_age_hours = group_age_seconds / 3600 if group_age_seconds >= 3600 else 1
    times_seen = group.times_seen_with_pending
    has_valid_status = group.substatus == GroupSubStatus.NEW
    if (
        group_age_hours >= MAX_NEW_ESCALATION_AGE_HOURS
        or not has_valid_status
        or times_seen < MIN_EVENTS_FOR_NEW_ESCALATION
    ):
        metrics.incr("tasks.post_process.detect_new_escalation.skipping_detection")
        return
    # Get escalation lock for this group. If we're unable to acquire this lock, another process is handling
    # this group at the same time. In that case, just exit early, no need to retry.
    lock = locks.get(f"detect_escalation:{group.id}", duration=10, name="detect_escalation")
    try:
        with lock.acquire():
            project_escalation_rate = get_latest_threshold(job["event"].project)
            group_hourly_event_rate = times_seen / group_age_hours
            # a rate of 0 means there was no threshold that could be calculated
            if project_escalation_rate > 0 and group_hourly_event_rate > project_escalation_rate:
                job["has_escalated"] = True
                group.update(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ESCALATING)
                # TODO(snigdha): reuse manage_issue_states when we allow escalating from other statuses
                add_group_to_inbox(group, GroupInboxReason.ESCALATING)
                record_group_history(group, GroupHistoryStatus.ESCALATING)
                Activity.objects.create_group_activity(
                    group=group,
                    type=ActivityType.SET_ESCALATING,
                    data={"event_id": job["event"].event_id},
                )
                auto_update_priority(group, PriorityChangeReason.ESCALATING)
            logger.info(
                "tasks.post_process.detect_new_escalation",
                extra={
                    **extra,
                    "group_hourly_event_rate": group_hourly_event_rate,
                    "project_escalation_rate": project_escalation_rate,
                    "has_escalated": job["has_escalated"],
                },
            )
    except UnableToAcquireLock as error:
        extra["error"] = error
        logger.warning(
            "tasks.post_process.detect_new_escalation.unable_to_acquire_lock", extra=extra
        )
        return


def detect_base_urls_for_uptime(job: PostProcessJob):
    from sentry.uptime.autodetect.detector import autodetect_base_url_for_project

    url = get_path(job["event"].data, "request", "url")
    autodetect_base_url_for_project(job["event"].project, url)


def check_if_flags_sent(job: PostProcessJob) -> None:
    from sentry.signals import first_flag_received
    from sentry.utils.projectflags import set_project_flag_and_signal

    event = job["event"]
    project = event.project
    flag_context = get_path(event.data, "contexts", "flags")

    if flag_context:
        metrics.incr("feature_flags.event_has_flags_context")
        metrics.distribution("feature_flags.num_flags_sent", len(flag_context))
        set_project_flag_and_signal(project, "has_flags", first_flag_received)


def kick_off_seer_automation(job: PostProcessJob) -> None:
    from sentry.seer.autofix.issue_summary import (
        get_issue_summary_cache_key,
        get_issue_summary_lock_key,
    )
    from sentry.seer.autofix.utils import (
        is_issue_eligible_for_seer_automation,
        is_seer_scanner_rate_limited,
        is_seer_seat_based_tier_enabled,
    )
    from sentry.tasks.autofix import (
        generate_issue_summary_only,
        generate_summary_and_run_automation,
        run_automation_only_task,
    )

    event = job["event"]
    group = event.group

    # Default behaviour
    if not is_seer_seat_based_tier_enabled(group.organization):
        # Only run on issues with no existing scan
        if group.seer_fixability_score is not None:
            return

        if not is_issue_eligible_for_seer_automation(group):
            return

        # Don't run if there's already a task in progress for this issue
        lock_key, lock_name = get_issue_summary_lock_key(group.id)
        lock = locks.get(lock_key, duration=1, name=lock_name)
        if lock.locked():
            return

        if is_seer_scanner_rate_limited(group.project, group.organization):
            return

        generate_summary_and_run_automation.delay(group.id)
    else:
        # Triage signals V0 behaviour
        # If event count < 10, only generate summary (no automation)
        if group.times_seen_with_pending < 10:
            # Check if summary exists in cache
            cache_key = get_issue_summary_cache_key(group.id)
            if cache.get(cache_key) is not None:
                return

            # Early returns for eligibility checks (cheap checks first)
            if not is_issue_eligible_for_seer_automation(group):
                return

            # Atomically set cache to prevent duplicate summary generation
            summary_dispatch_cache_key = f"seer-summary-dispatched:{group.id}"
            if not cache.add(summary_dispatch_cache_key, True, timeout=30):
                return  # Another process already dispatched summary generation

            # Rate limit check must be last, after cache.add succeeds, to avoid wasting quota
            if is_seer_scanner_rate_limited(group.project, group.organization):
                return

            generate_issue_summary_only.delay(group.id)
        else:
            # Event count >= 10: run automation
            # Long-term check to avoid re-running
            if group.seer_autofix_last_triggered is not None:
                return

            # Triage signals will not run issues if they are not fixable at MEDIUM threshold
            if group.seer_fixability_score is not None:
                if (
                    group.seer_fixability_score < FixabilityScoreThresholds.MEDIUM.value
                    and not group.issue_type.always_trigger_seer_automation
                ):
                    return

            # Early returns for eligibility checks (cheap checks first)
            if not is_issue_eligible_for_seer_automation(group):
                return

            # Atomically set cache to prevent duplicate dispatches (returns False if key exists)
            automation_dispatch_cache_key = f"seer-automation-dispatched:{group.id}"
            if not cache.add(automation_dispatch_cache_key, True, timeout=300):
                return  # Another process already dispatched automation

            # Check if project has connected repositories - requirement for new pricing
            # which triggers Django model loading before apps are ready
            from sentry.seer.autofix.utils import has_project_connected_repos

            if not has_project_connected_repos(group.organization.id, group.project.id):
                return

            # Check if summary exists in cache
            cache_key = get_issue_summary_cache_key(group.id)
            if cache.get(cache_key) is not None:
                # Summary exists, run automation directly
                run_automation_only_task.delay(group.id)
            else:
                # Rate limit check before generating summary
                if is_seer_scanner_rate_limited(group.project, group.organization):
                    return

                # No summary yet, generate summary + run automation in one go
                generate_summary_and_run_automation.delay(group.id)


GROUP_CATEGORY_POST_PROCESS_PIPELINE = {
    GroupCategory.ERROR: [
        _capture_group_stats,
        process_snoozes,
        process_inbox_adds,
        detect_new_escalation,
        process_commits,
        handle_owner_assignment,
        handle_auto_assignment,
        kick_off_seer_automation,
        process_rules,
        process_workflow_engine_issue_alerts,
        process_service_hooks,
        process_resource_change_bounds,
        process_data_forwarding,
        process_plugins,
        process_code_mappings,
        process_similarity,
        update_existing_attachments,
        fire_error_processed,
        sdk_crash_monitoring,
        process_replay_link,
        link_event_to_user_report,
        detect_base_urls_for_uptime,
        check_if_flags_sent,
    ],
    GroupCategory.FEEDBACK: [
        feedback_filter_decorator(process_snoozes),
        feedback_filter_decorator(process_inbox_adds),
        feedback_filter_decorator(process_rules),
        feedback_filter_decorator(process_workflow_engine_issue_alerts),
        feedback_filter_decorator(process_resource_change_bounds),
    ],
    GroupCategory.METRIC_ALERT: [
        process_workflow_engine_metric_issues,
    ],
}

GENERIC_POST_PROCESS_PIPELINE = [
    process_snoozes,
    process_inbox_adds,
    kick_off_seer_automation,
    process_rules,
    process_workflow_engine_issue_alerts,
    process_resource_change_bounds,
    process_data_forwarding,
]

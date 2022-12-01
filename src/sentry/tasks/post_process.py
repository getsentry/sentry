from __future__ import annotations

import logging
from datetime import timedelta
from typing import TYPE_CHECKING, List, Mapping, Optional, Sequence, Tuple, TypedDict, Union

import sentry_sdk
from django.conf import settings
from django.utils import timezone

from sentry import features
from sentry.exceptions import PluginError
from sentry.killswitches import killswitch_matches_context
from sentry.signals import event_processed, issue_unignored, transaction_processed
from sentry.tasks.base import instrumented_task
from sentry.types.activity import ActivityType
from sentry.types.issues import GroupCategory
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.event_frames import get_sdk_name
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.locking.manager import LockManager
from sentry.utils.safe import safe_execute
from sentry.utils.sdk import bind_organization_context, set_current_event_project
from sentry.utils.services import build_instance_from_options

if TYPE_CHECKING:
    from sentry.eventstore.models import Event, GroupEvent
    from sentry.eventstream.base import GroupState, GroupStates

logger = logging.getLogger(__name__)

locks = LockManager(build_instance_from_options(settings.SENTRY_POST_PROCESS_LOCKS_BACKEND_OPTIONS))


class PostProcessJob(TypedDict, total=False):
    event: Union[Event, GroupEvent]
    group_state: GroupState
    is_reprocessed: bool
    has_reappeared: bool
    has_alert: bool


def _get_service_hooks(project_id):
    from sentry.models import ServiceHook

    cache_key = f"servicehooks:1:{project_id}"
    result = cache.get(cache_key)

    if result is None:
        hooks = ServiceHook.objects.filter(servicehookproject__project_id=project_id)
        result = [(h.id, h.events) for h in hooks]
        cache.set(cache_key, result, 60)
    return result


def _should_send_error_created_hooks(project):
    from sentry.models import Organization, ServiceHook

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


def should_write_event_stats(event: Event):
    # For now, we only want to write these stats for error events. If we start writing them for
    # other event types we'll throw off existing stats and potentially cause various alerts to fire.
    # We might decide to write these stats for other event types later, either under different keys
    # or with differentiating tags.
    return (
        event.group
        and event.group.issue_category == GroupCategory.ERROR
        and event.group.platform is not None
    )


def format_event_platform(event: Event):
    platform = event.group.platform
    if not platform:
        return
    return platform.split("-", 1)[0].split("_", 1)[0]


def _capture_event_stats(event: Event) -> None:
    if not should_write_event_stats(event):
        return

    platform = format_event_platform(event)
    tags = {"platform": platform}
    metrics.incr("events.processed", tags={"platform": platform}, skip_internal=False)
    metrics.incr(f"events.processed.{platform}", skip_internal=False)
    metrics.timing("events.size.data", event.size, tags=tags)


def _capture_group_stats(job: PostProcessJob) -> None:
    event = job["event"]
    if not job["group_state"]["is_new"] or not should_write_event_stats(event):
        return

    platform = format_event_platform(event)
    tags = {"platform": platform}
    metrics.incr("events.unique", tags=tags, skip_internal=False)


def handle_owner_assignment(job):
    if job["is_reprocessed"]:
        return

    with sentry_sdk.start_span(op="tasks.post_process_group.handle_owner_assignment"):
        try:
            from sentry.models import ProjectOwnership

            event = job["event"]
            project, group = event.project, event.group

            with metrics.timer("post_process.handle_owner_assignment"):
                with sentry_sdk.start_span(
                    op="post_process.handle_owner_assignment.cache_set_owner"
                ):
                    owner_key = "owner_exists:1:%s" % group.id
                    owners_exists = cache.get(owner_key)
                    if owners_exists is None:
                        owners_exists = group.groupowner_set.exists()
                        # Cache for an hour if it's assigned. We don't need to move that fast.
                        cache.set(owner_key, owners_exists, 3600 if owners_exists else 60)

                with sentry_sdk.start_span(
                    op="post_process.handle_owner_assignment.cache_set_assignee"
                ):
                    # Is the issue already assigned to a team or user?
                    assignee_key = "assignee_exists:1:%s" % group.id
                    assignees_exists = cache.get(assignee_key)
                    if assignees_exists is None:
                        assignees_exists = group.assignee_set.exists()
                        # Cache for an hour if it's assigned. We don't need to move that fast.
                        cache.set(assignee_key, assignees_exists, 3600 if assignees_exists else 60)

                if owners_exists and assignees_exists:
                    return

                with sentry_sdk.start_span(
                    op="post_process.handle_owner_assignment.get_issue_owners"
                ):
                    if killswitch_matches_context(
                        "post_process.get-autoassign-owners",
                        {
                            "project_id": project.id,
                        },
                    ):
                        # see ProjectOwnership.get_issue_owners
                        issue_owners = []
                    else:
                        issue_owners = ProjectOwnership.get_issue_owners(
                            group.project_id, event.data
                        )

                with sentry_sdk.start_span(
                    op="post_process.handle_owner_assignment.handle_group_owners"
                ):
                    if issue_owners and not owners_exists:
                        try:
                            handle_group_owners(project, group, issue_owners)
                        except Exception:
                            logger.exception("Failed to store group owners")
        except Exception:
            logger.exception("Failed to handle owner assignments")


def handle_group_owners(project, group, issue_owners):
    """
    Stores group owners generated by `ProjectOwnership.get_issue_owners` in the
    `GroupOwner` model, and handles any diffing/changes of which owners we're keeping.
    :return:
    """
    from sentry.models.groupowner import GroupOwner, GroupOwnerType, OwnerRuleType
    from sentry.models.team import Team
    from sentry.models.user import User
    from sentry.services.hybrid_cloud.user import APIUser

    lock = locks.get(f"groupowner-bulk:{group.id}", duration=10, name="groupowner_bulk")
    try:
        with metrics.timer("post_process.handle_group_owners"), sentry_sdk.start_span(
            op="post_process.handle_group_owners"
        ), lock.acquire():
            current_group_owners = GroupOwner.objects.filter(
                group=group,
                type__in=[GroupOwnerType.OWNERSHIP_RULE.value, GroupOwnerType.CODEOWNERS.value],
            )
            new_owners = {}
            owners: Union[List[APIUser], List[Team]]
            for rule, owners, source in issue_owners:
                for owner in owners:
                    # Can potentially have multiple rules pointing to the same owner
                    if new_owners.get((type(owner), owner.id, source)):
                        new_owners[(type(owner), owner.id, source)].append(rule)
                    else:
                        new_owners[(type(owner), owner.id, source)] = [rule]

            # Owners already in the database that we'll keep
            keeping_owners = set()
            for owner in current_group_owners:
                owner_type = (
                    OwnerRuleType.CODEOWNERS.value
                    if owner.type == GroupOwnerType.CODEOWNERS.value
                    else OwnerRuleType.OWNERSHIP_RULE.value
                )
                lookup_key = (
                    (Team, owner.team_id, owner_type)
                    if owner.team_id is not None
                    else (User, owner.user_id, owner_type)
                )
                # Old groupowner assignments get deleted
                if lookup_key not in new_owners:
                    owner.delete()
                # Old groupowner assignment from outdated rules get deleted
                if new_owners.get(lookup_key) and (owner.context or {}).get(
                    "rule"
                ) not in new_owners.get(lookup_key):
                    owner.delete()
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
                    if owner_type is APIUser:
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
    except UnableToAcquireLock:
        pass


def update_existing_attachments(job):
    """
    Attaches the group_id to all event attachments that were either:

    1) ingested prior to the event via the standalone attachment endpoint.
    2) part of a different group before reprocessing started.
    """
    # Patch attachments that were ingested on the standalone path.
    with sentry_sdk.start_span(op="tasks.post_process_group.update_existing_attachments"):
        from sentry.models import EventAttachment

        event = job["event"]

        EventAttachment.objects.filter(project_id=event.project_id, event_id=event.event_id).update(
            group_id=event.group_id
        )


def fetch_buffered_group_stats(group):
    """
    Fetches buffered increments to `times_seen` for this group and adds them to the current
    `times_seen`.
    """
    from sentry import buffer
    from sentry.models import Group

    result = buffer.get(Group, ["times_seen"], {"pk": group.id})
    group.times_seen_pending = result["times_seen"]


@instrumented_task(
    name="sentry.tasks.post_process.post_process_group",
    time_limit=120,
    soft_time_limit=110,
)
def post_process_group(
    is_new,
    is_regression,
    is_new_group_environment,
    cache_key,
    group_id=None,
    group_states: Optional[GroupStates] = None,
    **kwargs,
):
    """
    Fires post processing hooks for a group.
    """
    from sentry.utils import snuba

    with snuba.options_override({"consistent": True}):
        from sentry.eventstore.processing import event_processing_store
        from sentry.models import Organization, Project
        from sentry.reprocessing2 import is_reprocessed_event

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

        event = process_event(data, group_id)

        # Re-bind Project and Org since we're reading the Event object
        # from cache which may contain stale parent models.
        with sentry_sdk.start_span(op="tasks.post_process_group.project_get_from_cache"):
            event.project = Project.objects.get_from_cache(id=event.project_id)
            event.project.set_cached_field_value(
                "organization",
                Organization.objects.get_from_cache(id=event.project.organization_id),
            )

        is_reprocessed = is_reprocessed_event(event.data)
        sentry_sdk.set_tag("is_reprocessed", is_reprocessed)

        is_transaction_event = event.get_event_type() == "transaction"

        # Simplified post processing for transaction events.
        # This should eventually be completely removed and transactions
        # will not go through any post processing.
        if is_transaction_event:
            with sentry_sdk.start_span(op="tasks.post_process_group.transaction_processed_signal"):
                transaction_processed.send_robust(
                    sender=post_process_group,
                    project=event.project,
                    event=event,
                )
            if not features.has(
                "organizations:performance-issues-post-process-group", event.project.organization
            ):
                return

        # TODO: Remove this check once we're sending all group ids as `group_states` and treat all
        # events the same way
        if not is_transaction_event and group_states is None:
            # error issue
            group_states = [
                {
                    "id": group_id,
                    "is_new": is_new,
                    "is_regression": is_regression,
                    "is_new_group_environment": is_new_group_environment,
                }
            ]

        update_event_groups(event, group_states)
        bind_organization_context(event.project.organization)
        _capture_event_stats(event)

        group_events: Mapping[int, GroupEvent] = {
            ge.group_id: ge for ge in list(event.build_group_events())
        }

        multi_groups: Sequence[Tuple[GroupEvent, GroupState]] = [
            (group_events.get(gs.get("id")), gs)
            for gs in (group_states or ())
            if gs.get("id") is not None
        ]

        group_jobs: Sequence[PostProcessJob] = [
            {
                "event": ge,
                "group_state": gs,
                "is_reprocessed": is_reprocessed,
                "has_reappeared": bool(not gs["is_new"]),
                "has_alert": False,
            }
            for ge, gs in multi_groups
        ]

        for job in group_jobs:
            run_post_process_job(job)


def run_post_process_job(job: PostProcessJob):
    group_event = job["event"]
    if group_event.group.issue_category not in GROUP_CATEGORY_POST_PROCESS_PIPELINE:
        logger.error(
            "No post process pipeline configured for issue category",
            extra={"category": group_event.group.issue_category},
        )
        return
    pipeline = GROUP_CATEGORY_POST_PROCESS_PIPELINE[group_event.group.issue_category]
    for pipeline_step in pipeline:
        try:
            pipeline_step(job)
        except Exception:
            logger.exception(
                f"Failed to process pipeline step {pipeline_step.__name__}",
                extra={"event": group_event, "group": group_event.group},
            )


def process_event(data: dict, group_id: Optional[int]) -> Event:
    from sentry.eventstore.models import Event
    from sentry.models import EventDict

    event = Event(
        project_id=data["project"], event_id=data["event_id"], group_id=group_id, data=data
    )

    set_current_event_project(event.project_id)

    # Re-bind node data to avoid renormalization. We only want to
    # renormalize when loading old data from the database.
    event.data = EventDict(event.data, skip_renormalization=True)

    return event


def update_event_groups(event: Event, group_states: Optional[GroupStates] = None) -> None:
    # NOTE: we must pass through the full Event object, and not an
    # event_id since the Event object may not actually have been stored
    # in the database due to sampling.
    from sentry.models.group import get_group_with_redirect

    # event.group_id can be None in the case of transaction events
    if event.group_id is not None:
        # deprecated event.group and event.group_id usage, kept here for backwards compatibility
        event.group, _ = get_group_with_redirect(event.group_id)
        event.group_id = event.group.id

    # Re-bind Group since we're reading the Event object
    # from cache, which may contain a stale group and project
    group_states = group_states or ([{"id": event.group_id}] if event.group_id else [])
    rebound_groups = []
    for group_state in group_states:
        rebound_group = get_group_with_redirect(group_state["id"])[0]

        # We fetch buffered updates to group aggregates here and populate them on the Group. This
        # helps us avoid problems with processing group ignores and alert rules that rely on these
        # stats.
        with sentry_sdk.start_span(op="tasks.post_process_group.fetch_buffered_group_stats"):
            fetch_buffered_group_stats(rebound_group)

        rebound_group.project = event.project
        rebound_group.project.set_cached_field_value("organization", event.project.organization)

        group_state["id"] = rebound_group.id
        rebound_groups.append(rebound_group)

    event.groups = rebound_groups


def process_inbox_adds(job: PostProcessJob) -> None:
    with sentry_sdk.start_span(op="tasks.post_process_group.add_group_to_inbox"):
        event = job["event"]
        is_reprocessed = job["is_reprocessed"]
        is_new = job["group_state"]["is_new"]
        is_regression = job["group_state"]["is_regression"]
        has_reappeared = job["has_reappeared"]

        from sentry.models import GroupInboxReason
        from sentry.models.groupinbox import add_group_to_inbox

        if is_reprocessed and is_new:
            add_group_to_inbox(event.group, GroupInboxReason.REPROCESSED)
        elif (
            not is_reprocessed and not has_reappeared
        ):  # If true, we added the .UNIGNORED reason already
            if is_new:
                add_group_to_inbox(event.group, GroupInboxReason.NEW)
            elif is_regression:
                add_group_to_inbox(event.group, GroupInboxReason.REGRESSION)


def process_snoozes(job: PostProcessJob) -> None:
    """
    Set has_reappeared to True if the group is transitioning from "resolved" to "unresolved",
    otherwise set to False.
    """
    # we process snoozes before rules as it might create a regression
    # but not if it's new because you can't immediately snooze a new group
    if job["is_reprocessed"] or not job["has_reappeared"]:
        return

    from sentry.models import (
        Activity,
        GroupInboxReason,
        GroupSnooze,
        GroupStatus,
        add_group_to_inbox,
    )
    from sentry.models.grouphistory import GroupHistoryStatus, record_group_history

    group = job["event"].group

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

    if not snooze.is_valid(group, test_rates=True, use_pending_data=True):
        snooze_details = {
            "until": snooze.until,
            "count": snooze.count,
            "window": snooze.window,
            "user_count": snooze.user_count,
            "user_window": snooze.user_window,
        }
        add_group_to_inbox(group, GroupInboxReason.UNIGNORED, snooze_details)
        record_group_history(group, GroupHistoryStatus.UNIGNORED)
        Activity.objects.create(
            project=group.project,
            group=group,
            type=ActivityType.SET_UNRESOLVED.value,
            user=None,
            data={"event_id": job["event"].event_id},
        )

        snooze.delete()
        group.update(status=GroupStatus.UNRESOLVED)
        issue_unignored.send_robust(
            project=group.project,
            user=None,
            group=group,
            transition_type="automatic",
            sender="process_snoozes",
        )

        job["has_reappeared"] = True
        return

    job["has_reappeared"] = False
    return


def process_rules(job: PostProcessJob) -> None:
    if job["is_reprocessed"]:
        return

    from sentry.rules.processor import RuleProcessor

    group_event = job["event"]
    is_new = job["group_state"]["is_new"]
    is_regression = job["group_state"]["is_regression"]
    is_new_group_environment = job["group_state"]["is_new_group_environment"]
    has_reappeared = job["has_reappeared"]

    has_alert = False

    rp = RuleProcessor(group_event, is_new, is_regression, is_new_group_environment, has_reappeared)
    with sentry_sdk.start_span(op="tasks.post_process_group.rule_processor_callbacks"):
        # TODO(dcramer): ideally this would fanout, but serializing giant
        # objects back and forth isn't super efficient
        for callback, futures in rp.apply():
            has_alert = True
            safe_execute(callback, group_event, futures, _with_transaction=False)

    job["has_alert"] = has_alert
    return


def process_code_mappings(job: PostProcessJob) -> None:
    if job["is_reprocessed"]:
        return

    from sentry.tasks.derive_code_mappings import derive_code_mappings

    try:
        event = job["event"]
        project = event.project

        # We're currently only processing code mappings for python events
        if event.data["platform"] != "python":
            return

        cache_key = f"code-mappings:{project.id}"
        project_queued = cache.get(cache_key)
        if project_queued is None:
            cache.set(cache_key, True, 3600)

        if project_queued:
            return

        org_slug = project.organization.slug
        next_time = timezone.now() + timedelta(hours=1)
        if features.has("organizations:derive-code-mappings", event.project.organization):
            logger.info(
                f"derive_code_mappings: Queuing code mapping derivation for {project.slug=} {event.group_id=}."
                + f" Future events in {org_slug=} will not have not have code mapping derivation until {next_time}"
            )
            derive_code_mappings.delay(project.id, event.data, dry_run=False)

        # Derive code mappings with dry_run=True to validate the generated mappings.
        elif features.has("organizations:derive-code-mappings-dry-run", event.project.organization):
            logger.info(
                f"derive_code_mappings: Queuing dry run code mapping derivation for {project.slug=} {event.group_id=}."
                + f" Future events in {org_slug=} will not have not have code mapping derivation until {next_time}"
            )
            derive_code_mappings.delay(project.id, event.data, dry_run=True)

    except Exception:
        logger.exception("derive_code_mappings: Failed to process code mappings")


def process_commits(job: PostProcessJob) -> None:
    if job["is_reprocessed"]:
        return

    from sentry.models import Commit
    from sentry.tasks.commit_context import process_commit_context
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
                group_cache_key = f"w-o-i:g-{event.group_id}"
                if cache.get(group_cache_key):
                    metrics.incr(
                        "sentry.tasks.process_suspect_commits.debounce",
                        tags={"detail": "w-o-i:g debounce"},
                    )
                else:
                    from sentry.utils.committers import get_frame_paths

                    cache.set(group_cache_key, True, 604800)  # 1 week in seconds
                    event_frames = get_frame_paths(event)
                    sdk_name = get_sdk_name(event.data)
                    if features.has("organizations:commit-context", event.project.organization):
                        process_commit_context.delay(
                            event_id=event.event_id,
                            event_platform=event.platform,
                            event_frames=event_frames,
                            group_id=event.group_id,
                            project_id=event.project_id,
                            sdk_name=sdk_name,
                        )
                    else:
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

    from sentry.models import ProjectOwnership

    event = job["event"]
    try:
        ProjectOwnership.handle_auto_assignment(event.project.id, event)
    except Exception:
        logger.exception("Failed to set auto-assignment")


def process_service_hooks(job: PostProcessJob) -> None:
    if job["is_reprocessed"]:
        return

    from sentry.tasks.servicehooks import process_service_hook

    event, has_alert = job["event"], job["has_alert"]

    if features.has("projects:servicehooks", project=event.project):
        allowed_events = {"event.created"}
        if has_alert:
            allowed_events.add("event.alert")

        if allowed_events:
            for servicehook_id, events in _get_service_hooks(project_id=event.project_id):
                if any(e in allowed_events for e in events):
                    process_service_hook.delay(servicehook_id=servicehook_id, event=event)


def process_resource_change_bounds(job: PostProcessJob) -> None:
    if job["is_reprocessed"]:
        return

    from sentry.tasks.sentry_apps import process_resource_change_bound

    event, is_new = job["event"], job["group_state"]["is_new"]

    if event.get_event_type() == "error" and _should_send_error_created_hooks(event.project):
        process_resource_change_bound.delay(
            action="created", sender="Error", instance_id=event.event_id, instance=event
        )
    if is_new:
        process_resource_change_bound.delay(
            action="created", sender="Group", instance_id=event.group_id
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
    if job["is_reprocessed"]:
        return

    from sentry import similarity

    event = job["event"]

    with sentry_sdk.start_span(op="tasks.post_process_group.similarity"):
        safe_execute(similarity.record, event.project, [event], _with_transaction=False)


def fire_error_processed(job: PostProcessJob):
    if job["is_reprocessed"]:
        return
    event = job["event"]
    event_processed.send_robust(
        sender=post_process_group,
        project=event.project,
        event=event,
    )


def plugin_post_process_group(plugin_slug, event, **kwargs):
    """
    Fires post processing hooks for a group.
    """
    set_current_event_project(event.project_id)

    from sentry.plugins.base import plugins

    plugin = plugins.get(plugin_slug)
    safe_execute(
        plugin.post_process,
        event=event,
        group=event.group,
        expected_errors=(PluginError,),
        _with_transaction=False,
        **kwargs,
    )


GROUP_CATEGORY_POST_PROCESS_PIPELINE = {
    GroupCategory.ERROR: [
        _capture_group_stats,
        process_snoozes,
        process_inbox_adds,
        process_commits,
        handle_owner_assignment,
        handle_auto_assignment,
        process_rules,
        process_service_hooks,
        process_resource_change_bounds,
        process_plugins,
        process_code_mappings,
        process_similarity,
        update_existing_attachments,
        fire_error_processed,
    ],
    GroupCategory.PERFORMANCE: [
        process_snoozes,
        process_inbox_adds,
        process_rules,
        # TODO: Uncomment this when we want to send perf issues out via plugins as well
        # process_plugins,
    ],
}

import logging

import sentry_sdk

from sentry import analytics, features
from sentry.app import locks
from sentry.exceptions import PluginError
from sentry.killswitches import killswitch_matches_context
from sentry.signals import event_processed, issue_unignored, transaction_processed
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.safe import safe_execute
from sentry.utils.sdk import bind_organization_context, set_current_event_project

logger = logging.getLogger("sentry")


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


def _capture_stats(event, is_new):
    # TODO(dcramer): limit platforms to... something?
    platform = event.group.platform
    if not platform:
        return
    platform = platform.split("-", 1)[0].split("_", 1)[0]
    tags = {"platform": platform}

    if is_new:
        metrics.incr("events.unique", tags=tags, skip_internal=False)

    metrics.incr("events.processed", tags=tags, skip_internal=False)
    metrics.incr(f"events.processed.{platform}", skip_internal=False)
    metrics.timing("events.size.data", event.size, tags=tags)

    # This is an experiment to understand whether we have, in production,
    # mismatches between event and group before we permanently rely on events
    # for the platform. before adding some more verbose logging on this
    # case, using a stats will give us a sense of the magnitude of the problem.
    if event.group:
        if event.group.platform != event.platform:
            metrics.incr("events.platform_mismatch", tags=tags)


def handle_owner_assignment(project, group, event):
    from sentry.models import GroupAssignee, ProjectOwnership

    with metrics.timer("post_process.handle_owner_assignment"):
        with sentry_sdk.start_span(op="post_process.handle_owner_assignment.cache_set_owner"):
            owner_key = "owner_exists:1:%s" % group.id
            owners_exists = cache.get(owner_key)
            if owners_exists is None:
                owners_exists = group.groupowner_set.exists()
                # Cache for an hour if it's assigned. We don't need to move that fast.
                cache.set(owner_key, owners_exists, 3600 if owners_exists else 60)

        with sentry_sdk.start_span(op="post_process.handle_owner_assignment.cache_set_assignee"):
            # Is the issue already assigned to a team or user?
            assignee_key = "assignee_exists:1:%s" % group.id
            assignees_exists = cache.get(assignee_key)
            if assignees_exists is None:
                assignees_exists = group.assignee_set.exists()
                # Cache for an hour if it's assigned. We don't need to move that fast.
                cache.set(assignee_key, assignees_exists, 3600 if assignees_exists else 60)

        if owners_exists and assignees_exists:
            return

        with sentry_sdk.start_span(op="post_process.handle_owner_assignment.get_autoassign_owners"):
            if killswitch_matches_context(
                "post_process.get-autoassign-owners",
                {
                    "project_id": project.id,
                },
            ):
                # see ProjectOwnership.get_autoassign_owners
                auto_assignment = False
                owners = []
                assigned_by_codeowners = False
            else:
                (
                    auto_assignment,
                    owners,
                    assigned_by_codeowners,
                ) = ProjectOwnership.get_autoassign_owners(group.project_id, event.data)

        with sentry_sdk.start_span(op="post_process.handle_owner_assignment.analytics_record"):
            if auto_assignment and owners and not assignees_exists:
                assignment = GroupAssignee.objects.assign(group, owners[0], create_only=True)
                if assignment["new_assignment"] or assignment["updated_assignment"]:
                    analytics.record(
                        "codeowners.assignment"
                        if assigned_by_codeowners
                        else "issueowners.assignment",
                        organization_id=project.organization_id,
                        project_id=project.id,
                        group_id=group.id,
                    )

        with sentry_sdk.start_span(op="post_process.handle_owner_assignment.handle_group_owners"):
            if owners and not owners_exists:
                try:
                    handle_group_owners(project, group, owners)
                except Exception:
                    logger.exception("Failed to store group owners")


def handle_group_owners(project, group, owners):
    """
    Stores group owners generated by `ProjectOwnership.get_autoassign_owners` in the
    `GroupOwner` model, and handles any diffing/changes of which owners we're keeping.
    :return:
    """
    from sentry.models.groupowner import GroupOwner, GroupOwnerType
    from sentry.models.team import Team
    from sentry.models.user import User

    lock = locks.get(f"groupowner-bulk:{group.id}", duration=10)
    try:
        with metrics.timer("post_process.handle_group_owners"), sentry_sdk.start_span(
            op="post_process.handle_group_owners"
        ), lock.acquire():
            current_group_owners = GroupOwner.objects.filter(
                group=group, type=GroupOwnerType.OWNERSHIP_RULE.value
            )
            new_owners = {(type(owner), owner.id) for owner in owners}
            # Owners already in the database that we'll keep
            keeping_owners = set()
            for owner in current_group_owners:
                lookup_key = (
                    (Team, owner.team_id) if owner.team_id is not None else (User, owner.user_id)
                )
                if lookup_key not in new_owners:
                    owner.delete()
                else:
                    keeping_owners.add(lookup_key)

            new_group_owners = []

            for key in new_owners:
                if key not in keeping_owners:
                    owner_type, owner_id = key
                    user_id = None
                    team_id = None
                    if owner_type is User:
                        user_id = owner_id
                    if owner_type is Team:
                        team_id = owner_id
                    new_group_owners.append(
                        GroupOwner(
                            group=group,
                            type=GroupOwnerType.OWNERSHIP_RULE.value,
                            user_id=user_id,
                            team_id=team_id,
                            project=project,
                            organization=project.organization,
                        )
                    )
            if new_group_owners:
                GroupOwner.objects.bulk_create(new_group_owners)
    except UnableToAcquireLock:
        pass


def update_existing_attachments(event):
    """
    Attaches the group_id to all event attachments that were either:

    1) ingested prior to the event via the standalone attachment endpoint.
    2) part of a different group before reprocessing started.
    """
    from sentry.models import EventAttachment

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
    is_new, is_regression, is_new_group_environment, cache_key, group_id=None, **kwargs
):
    """
    Fires post processing hooks for a group.
    """
    from sentry.eventstore.models import Event
    from sentry.eventstore.processing import event_processing_store
    from sentry.reprocessing2 import is_reprocessed_event
    from sentry.utils import snuba

    with snuba.options_override({"consistent": True}):
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
        event = Event(
            project_id=data["project"], event_id=data["event_id"], group_id=group_id, data=data
        )

        set_current_event_project(event.project_id)

        is_transaction_event = not bool(event.group_id)

        from sentry.models import EventDict, Organization, Project

        # Re-bind node data to avoid renormalization. We only want to
        # renormalize when loading old data from the database.
        event.data = EventDict(event.data, skip_renormalization=True)

        with metrics.timer("tasks.post_process.delete_event_cache"):
            event_processing_store.delete_by_key(cache_key)

        # Re-bind Project and Org since we're reading the Event object
        # from cache which may contain stale parent models.
        event.project = Project.objects.get_from_cache(id=event.project_id)
        event.project.set_cached_field_value(
            "organization", Organization.objects.get_from_cache(id=event.project.organization_id)
        )

        # Simplified post processing for transaction events.
        # This should eventually be completely removed and transactions
        # will not go through any post processing.
        if is_transaction_event:
            transaction_processed.send_robust(
                sender=post_process_group,
                project=event.project,
                event=event,
            )

            return

        is_reprocessed = is_reprocessed_event(event.data)
        sentry_sdk.set_tag("is_reprocessed", is_reprocessed)

        # NOTE: we must pass through the full Event object, and not an
        # event_id since the Event object may not actually have been stored
        # in the database due to sampling.
        from sentry.models import Commit, GroupInboxReason
        from sentry.models.group import get_group_with_redirect
        from sentry.models.groupinbox import add_group_to_inbox
        from sentry.rules.processor import RuleProcessor
        from sentry.tasks.groupowner import process_suspect_commits
        from sentry.tasks.servicehooks import process_service_hook

        # Re-bind Group since we're reading the Event object
        # from cache, which may contain a stale group and project
        event.group, _ = get_group_with_redirect(event.group_id)
        event.group_id = event.group.id
        # We fetch buffered updates to group aggregates here and populate them on the Group. This
        # helps us avoid problems with processing group ignores and alert rules that rely on these
        # stats.
        fetch_buffered_group_stats(event.group)

        event.group.project = event.project
        event.group.project.set_cached_field_value("organization", event.project.organization)

        bind_organization_context(event.project.organization)

        _capture_stats(event, is_new)

        with sentry_sdk.start_span(op="tasks.post_process_group.add_group_to_inbox"):
            try:
                if is_reprocessed and is_new:
                    add_group_to_inbox(event.group, GroupInboxReason.REPROCESSED)
            except Exception:
                logger.exception("Failed to add group to inbox for reprocessed groups")

        if not is_reprocessed:
            # we process snoozes before rules as it might create a regression
            # but not if it's new because you can't immediately snooze a new group
            has_reappeared = not is_new
            try:
                if has_reappeared:
                    has_reappeared = process_snoozes(event.group)
            except Exception:
                logger.exception("Failed to process snoozes for group")

            try:
                if not has_reappeared:  # If true, we added the .UNIGNORED reason already
                    if is_new:
                        add_group_to_inbox(event.group, GroupInboxReason.NEW)
                    elif is_regression:
                        add_group_to_inbox(event.group, GroupInboxReason.REGRESSION)
            except Exception:
                logger.exception("Failed to add group to inbox for non-reprocessed groups")

            with sentry_sdk.start_span(op="tasks.post_process_group.handle_owner_assignment"):
                try:
                    handle_owner_assignment(event.project, event.group, event)
                except Exception:
                    logger.exception("Failed to handle owner assignments")

            rp = RuleProcessor(
                event, is_new, is_regression, is_new_group_environment, has_reappeared
            )
            has_alert = False
            with sentry_sdk.start_span(op="tasks.post_process_group.rule_processor_callbacks"):
                # TODO(dcramer): ideally this would fanout, but serializing giant
                # objects back and forth isn't super efficient
                for callback, futures in rp.apply():
                    has_alert = True
                    safe_execute(callback, event, futures, _with_transaction=False)

            try:
                lock = locks.get(
                    f"w-o:{event.group_id}-d-l",
                    duration=10,
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
                            event_frames = get_frame_paths(event.data)
                            process_suspect_commits.delay(
                                event_id=event.event_id,
                                event_platform=event.platform,
                                event_frames=event_frames,
                                group_id=event.group_id,
                                project_id=event.project_id,
                            )
            except UnableToAcquireLock:
                pass
            except Exception:
                logger.exception("Failed to process suspect commits")

            if features.has("projects:servicehooks", project=event.project):
                allowed_events = {"event.created"}
                if has_alert:
                    allowed_events.add("event.alert")

                if allowed_events:
                    for servicehook_id, events in _get_service_hooks(project_id=event.project_id):
                        if any(e in allowed_events for e in events):
                            process_service_hook.delay(servicehook_id=servicehook_id, event=event)

            from sentry.tasks.sentry_apps import process_resource_change_bound

            if event.get_event_type() == "error" and _should_send_error_created_hooks(
                event.project
            ):
                process_resource_change_bound.delay(
                    action="created", sender="Error", instance_id=event.event_id, instance=event
                )
            if is_new:
                process_resource_change_bound.delay(
                    action="created", sender="Group", instance_id=event.group_id
                )

            from sentry.plugins.base import plugins

            for plugin in plugins.for_project(event.project):
                plugin_post_process_group(
                    plugin_slug=plugin.slug, event=event, is_new=is_new, is_regresion=is_regression
                )

            from sentry import similarity

            with sentry_sdk.start_span(op="tasks.post_process_group.similarity"):
                safe_execute(similarity.record, event.project, [event], _with_transaction=False)

        # Patch attachments that were ingested on the standalone path.
        with sentry_sdk.start_span(op="tasks.post_process_group.update_existing_attachments"):
            try:
                update_existing_attachments(event)
            except Exception:
                logger.exception("Failed to update existing attachments")

        if not is_reprocessed:
            event_processed.send_robust(
                sender=post_process_group,
                project=event.project,
                event=event,
                primary_hash=kwargs.get("primary_hash"),
            )


def process_snoozes(group):
    """
    Return True if the group is transitioning from "resolved" to "unresolved",
    otherwise return False.
    """
    from sentry.models import (
        Activity,
        GroupInboxReason,
        GroupSnooze,
        GroupStatus,
        add_group_to_inbox,
    )
    from sentry.models.grouphistory import GroupHistoryStatus, record_group_history

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
        return False

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
            type=Activity.SET_UNRESOLVED,
            user=None,
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
        return True

    return False


@instrumented_task(
    name="sentry.tasks.post_process.plugin_post_process_group",
    stat_suffix=lambda plugin_slug, *a, **k: plugin_slug,
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

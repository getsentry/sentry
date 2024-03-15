from __future__ import annotations

import copy
import logging
import time
from collections.abc import MutableMapping, Sequence
from typing import TYPE_CHECKING, Any

import sentry_sdk
from django.conf import settings
from django.core.cache import cache

from sentry.exceptions import HashDiscarded
from sentry.features.rollout import in_random_rollout
from sentry.grouping.api import (
    NULL_GROUPING_CONFIG,
    NULL_HASHES,
    BackgroundGroupingConfigLoader,
    GroupingConfig,
    GroupingConfigNotFound,
    SecondaryGroupingConfigLoader,
    apply_server_fingerprinting,
    detect_synthetic_exception,
    get_fingerprinting_config_for_project,
    get_grouping_config_dict_for_event_data,
    get_grouping_config_dict_for_project,
    load_grouping_config,
)
from sentry.grouping.result import CalculatedHashes
from sentry.issues.grouptype import GroupCategory
from sentry.killswitches import killswitch_matches_context
from sentry.locks import locks
from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
from sentry.models.project import Project
from sentry.projectoptions.defaults import BETA_GROUPING_CONFIG, DEFAULT_GROUPING_CONFIG
from sentry.reprocessing2 import is_reprocessed_event
from sentry.utils import metrics
from sentry.utils.metrics import MutableTags
from sentry.utils.tag_normalization import normalized_sdk_tag_from_event

if TYPE_CHECKING:
    from sentry.eventstore.models import Event

logger = logging.getLogger("sentry.events.grouping")

Job = MutableMapping[str, Any]


def update_grouping_config_if_needed(project: Project) -> None:
    if _project_should_update_grouping(project):
        _auto_update_grouping(project)


def _project_should_update_grouping(project: Project) -> bool:
    should_update_org = (
        project.organization_id % 1000 < float(settings.SENTRY_GROUPING_AUTO_UPDATE_ENABLED) * 1000
    )
    return bool(project.get_option("sentry:grouping_auto_update")) and should_update_org


def _auto_update_grouping(project: Project) -> None:
    current_config = project.get_option("sentry:grouping_config")
    new_config = DEFAULT_GROUPING_CONFIG

    if current_config == new_config or current_config == BETA_GROUPING_CONFIG:
        return

    # Because the way the auto grouping upgrading happening is racy, we want to
    # try to write the audit log entry and project option change just once.
    # For this a cache key is used.  That's not perfect, but should reduce the
    # risk significantly.
    cache_key = f"grouping-config-update:{project.id}:{current_config}"
    lock_key = f"grouping-update-lock:{project.id}"
    if cache.get(cache_key) is not None:
        return

    with locks.get(lock_key, duration=60, name="grouping-update-lock").acquire():
        if cache.get(cache_key) is None:
            cache.set(cache_key, "1", 60 * 5)
        else:
            return

        from sentry import audit_log
        from sentry.utils.audit import create_system_audit_entry

        # This is when we will stop calculating both old hashes (which we do in an effort to
        # preserve group continuity).
        expiry = int(time.time()) + settings.SENTRY_GROUPING_UPDATE_MIGRATION_PHASE

        changes = {
            "sentry:secondary_grouping_config": current_config,
            "sentry:secondary_grouping_expiry": expiry,
            "sentry:grouping_config": new_config,
        }
        for key, value in changes.items():
            project.update_option(key, value)

        create_system_audit_entry(
            organization=project.organization,
            target_object=project.id,
            event=audit_log.get_event_id("PROJECT_EDIT"),
            data={**changes, **project.get_audit_log_data()},
        )


def _calculate_event_grouping(
    project: Project, event: Event, grouping_config: GroupingConfig
) -> CalculatedHashes:
    """
    Main entrypoint for modifying/enhancing and grouping an event, writes
    hashes back into event payload.
    """
    metric_tags: MutableTags = {
        "grouping_config": grouping_config["id"],
        "platform": event.platform or "unknown",
        "sdk": normalized_sdk_tag_from_event(event),
    }

    with metrics.timer("save_event._calculate_event_grouping", tags=metric_tags):
        loaded_grouping_config = load_grouping_config(grouping_config)

        with metrics.timer("event_manager.normalize_stacktraces_for_grouping", tags=metric_tags):
            with sentry_sdk.start_span(op="event_manager.normalize_stacktraces_for_grouping"):
                event.normalize_stacktraces_for_grouping(loaded_grouping_config)

        # Detect & set synthetic marker if necessary
        detect_synthetic_exception(event.data, loaded_grouping_config)

        with metrics.timer("event_manager.apply_server_fingerprinting", tags=metric_tags):
            # The active grouping config was put into the event in the
            # normalize step before.  We now also make sure that the
            # fingerprint was set to `'{{ default }}' just in case someone
            # removed it from the payload.  The call to get_hashes will then
            # look at `grouping_config` to pick the right parameters.
            event.data["fingerprint"] = event.data.data.get("fingerprint") or ["{{ default }}"]
            apply_server_fingerprinting(
                event.data.data,
                get_fingerprinting_config_for_project(project),
                allow_custom_title=True,
            )

        with metrics.timer("event_manager.event.get_hashes", tags=metric_tags):
            # TODO: It's not clear we can even hit `GroupingConfigNotFound` here - this is leftover
            # from a time before we started separately retrieving the grouping config and passing it
            # directly to `get_hashes`. Now that we do that, a bogus config will get replaced by the
            # default long before we get here. Should we consolidate bogus config handling into the
            # code actually getting the config?
            try:
                hashes = event.get_hashes(loaded_grouping_config)
            except GroupingConfigNotFound:
                event.data["grouping_config"] = get_grouping_config_dict_for_project(project)
                hashes = event.get_hashes()

        hashes.write_to_event(event.data)
        return hashes


def maybe_run_background_grouping(project: Project, job: Job) -> None:
    """
    Optionally run a fraction of events with an experimental grouping config.

    This does not affect actual grouping, but can be helpful to measure the new config's performance
    impact.
    """
    try:
        if in_random_rollout("store.background-grouping-sample-rate"):
            config = BackgroundGroupingConfigLoader().get_config_dict(project)
            if config["id"]:
                copied_event = copy.deepcopy(job["event"])
                _calculate_background_grouping(project, copied_event, config)
    except Exception as err:
        sentry_sdk.capture_exception(err)


def _calculate_background_grouping(
    project: Project, event: Event, config: GroupingConfig
) -> CalculatedHashes:
    metric_tags: MutableTags = {
        "grouping_config": config["id"],
        "platform": event.platform or "unknown",
        "sdk": normalized_sdk_tag_from_event(event),
    }
    with metrics.timer("event_manager.background_grouping", tags=metric_tags):
        return _calculate_event_grouping(project, event, config)


def _is_in_transition(project: Project) -> bool:
    secondary_grouping_config = project.get_option("sentry:secondary_grouping_config")
    secondary_grouping_expiry = project.get_option("sentry:secondary_grouping_expiry")

    return bool(secondary_grouping_config) and (secondary_grouping_expiry or 0) >= time.time()


def maybe_run_secondary_grouping(
    project: Project, job: Job, metric_tags: MutableTags
) -> tuple[GroupingConfig, CalculatedHashes]:
    """
    If the projct is in a grouping config transition phase, calculate a set of secondary hashes for
    the job's event.
    """

    secondary_grouping_config = NULL_GROUPING_CONFIG
    secondary_hashes = NULL_HASHES

    if _is_in_transition(project):
        with metrics.timer("event_manager.secondary_grouping", tags=metric_tags):
            secondary_grouping_config = SecondaryGroupingConfigLoader().get_config_dict(project)
            secondary_hashes = _calculate_secondary_hash(project, job, secondary_grouping_config)

    return (secondary_grouping_config, secondary_hashes)


def _calculate_secondary_hash(
    project: Project, job: Job, secondary_grouping_config: GroupingConfig
) -> CalculatedHashes:
    """Calculate secondary hash for event using a fallback grouping config for a period of time.
    This happens when we upgrade all projects that have not opted-out to automatic upgrades plus
    when the customer changes the grouping config.
    This causes extra load in save_event processing.
    """
    secondary_hashes = NULL_HASHES
    try:
        with sentry_sdk.start_span(
            op="event_manager",
            description="event_manager.save.secondary_calculate_event_grouping",
        ):
            # create a copy since `_calculate_event_grouping` modifies the event to add all sorts
            # of grouping info and we don't want the backup grouping data in there
            event_copy = copy.deepcopy(job["event"])
            secondary_hashes = _calculate_event_grouping(
                project, event_copy, secondary_grouping_config
            )
    except Exception as err:
        sentry_sdk.capture_exception(err)

    return secondary_hashes


def run_primary_grouping(
    project: Project, job: Job, metric_tags: MutableTags
) -> tuple[GroupingConfig, CalculatedHashes]:
    """
    Get the primary grouping config and primary hashes for the event.
    """
    with metrics.timer("event_manager.load_grouping_config"):
        if is_reprocessed_event(job["data"]):
            # The customer might have changed grouping enhancements since
            # the event was ingested -> make sure we get the fresh one for reprocessing.
            grouping_config = get_grouping_config_dict_for_project(project)
            # Write back grouping config because it might have changed since the
            # event was ingested.
            # NOTE: We could do this unconditionally (regardless of `is_processed`).
            job["data"]["grouping_config"] = grouping_config
        else:
            grouping_config = get_grouping_config_dict_for_event_data(
                job["event"].data.data, project
            )

            # TODO: For new (non-reprocessed) events, we read the grouping config off the event
            # rather than from the project. But that grouping config is put there by Relay after
            # looking it up on the project. Are these ever not the same? If we don't ever see this
            # log, after some period of time we could probably just decide to always follow the
            # behavior from the reprocessing branch above. If we do that, we should decide if we
            # also want to stop adding the config in Relay.
            # See https://github.com/getsentry/sentry/pull/65116.
            config_from_relay = grouping_config["id"]
            config_from_project = project.get_option("sentry:grouping_config")
            if config_from_relay != config_from_project:
                logger.info(
                    "Event grouping config different from project grouping config",
                    extra={
                        "project": project.id,
                        "relay_config": config_from_relay,
                        "project_config": config_from_project,
                    },
                )

    with (
        sentry_sdk.start_span(
            op="event_manager",
            description="event_manager.save.calculate_event_grouping",
        ),
        metrics.timer("event_manager.calculate_event_grouping", tags=metric_tags),
    ):
        hashes = _calculate_primary_hash(project, job, grouping_config)

    return (grouping_config, hashes)


def _calculate_primary_hash(
    project: Project, job: Job, grouping_config: GroupingConfig
) -> CalculatedHashes:
    """
    Get the primary hash for the event.

    This is pulled out into a separate function mostly in order to make testing easier.
    """
    return _calculate_event_grouping(project, job["event"], grouping_config)


def find_existing_grouphash(
    project: Project,
    flat_grouphashes: Sequence[GroupHash],
    hierarchical_hashes: Sequence[str] | None,
) -> tuple[GroupHash | None, str | None]:
    all_grouphashes = []
    root_hierarchical_hash = None

    found_split = False

    if hierarchical_hashes:
        hierarchical_grouphashes = {
            h.hash: h
            for h in GroupHash.objects.filter(project=project, hash__in=hierarchical_hashes)
        }

        # Look for splits:
        # 1. If we find a hash with SPLIT state at `n`, we want to use
        #    `n + 1` as the root hash.
        # 2. If we find a hash associated to a group that is more specific
        #    than the primary hash, we want to use that hash as root hash.
        for hash in reversed(hierarchical_hashes):
            group_hash = hierarchical_grouphashes.get(hash)

            if group_hash is not None and group_hash.state == GroupHash.State.SPLIT:
                found_split = True
                break

            root_hierarchical_hash = hash

            if group_hash is not None:
                all_grouphashes.append(group_hash)

                if group_hash.group_id is not None:
                    # Even if we did not find a hash with SPLIT state, we want to use
                    # the most specific hierarchical hash as root hash if it was already
                    # associated to a group.
                    # See `move_all_events` test case
                    break

        if root_hierarchical_hash is None:
            # All hashes were split, so we group by most specific hash. This is
            # a legitimate usecase when there are events whose stacktraces are
            # suffixes of other event's stacktraces.
            root_hierarchical_hash = hierarchical_hashes[-1]
            group_hash = hierarchical_grouphashes.get(root_hierarchical_hash)

            if group_hash is not None:
                all_grouphashes.append(group_hash)

    if not found_split:
        # In case of a split we want to avoid accidentally finding the split-up
        # group again via flat hashes, which are very likely associated with
        # whichever group is attached to the split hash. This distinction will
        # become irrelevant once we start moving existing events into child
        # groups and delete the parent group.
        all_grouphashes.extend(flat_grouphashes)

    for group_hash in all_grouphashes:
        if group_hash.group_id is not None:
            return group_hash, root_hierarchical_hash

        # When refactoring for hierarchical grouping, we noticed that a
        # tombstone may get ignored entirely if there is another hash *before*
        # that happens to have a group_id. This bug may not have been noticed
        # for a long time because most events only ever have 1-2 hashes. It
        # will definitely get more noticeable with hierarchical grouping and
        # it's not clear what good behavior would look like. Do people want to
        # be able to tombstone `hierarchical_hashes[4]` while still having a
        # group attached to `hierarchical_hashes[0]`? Maybe.
        if group_hash.group_tombstone_id is not None:
            raise HashDiscarded(
                "Matches group tombstone %s" % group_hash.group_tombstone_id,
                reason="discard",
                tombstone_id=group_hash.group_tombstone_id,
            )

    return None, root_hierarchical_hash


def find_existing_grouphash_new(
    grouphashes: Sequence[GroupHash],
) -> GroupHash | None:
    for group_hash in grouphashes:
        if group_hash.group_id is not None:
            return group_hash

        # TODO: When refactoring for hierarchical grouping, we noticed that a
        # tombstone may get ignored entirely if there is another hash *before*
        # that happens to have a group_id. This bug may not have been noticed
        # for a long time because most events only ever have 1-2 hashes.
        if group_hash.group_tombstone_id is not None:
            raise HashDiscarded(
                "Matches group tombstone %s" % group_hash.group_tombstone_id,
                reason="discard",
                tombstone_id=group_hash.group_tombstone_id,
            )

    return None


def get_hash_values(
    project: Project,
    job: Job,
    metric_tags: MutableTags,
) -> tuple[CalculatedHashes, CalculatedHashes | None, CalculatedHashes]:
    # Background grouping is a way for us to get performance metrics for a new
    # config without having it actually affect on how events are grouped. It runs
    # either before or after the main grouping logic, depending on the option value.
    maybe_run_background_grouping(project, job)

    secondary_grouping_config, secondary_hashes = maybe_run_secondary_grouping(
        project, job, metric_tags
    )

    primary_grouping_config, primary_hashes = run_primary_grouping(project, job, metric_tags)

    record_hash_calculation_metrics(
        project,
        primary_grouping_config,
        primary_hashes,
        secondary_grouping_config,
        secondary_hashes,
    )

    all_hashes = CalculatedHashes(
        hashes=extract_hashes(primary_hashes) + extract_hashes(secondary_hashes),
        hierarchical_hashes=(
            list(primary_hashes.hierarchical_hashes)
            + list(secondary_hashes and secondary_hashes.hierarchical_hashes or [])
        ),
        tree_labels=(
            primary_hashes.tree_labels or (secondary_hashes and secondary_hashes.tree_labels) or []
        ),
    )

    if all_hashes.tree_labels:
        job["finest_tree_label"] = all_hashes.finest_tree_label

    return (primary_hashes, secondary_hashes, all_hashes)


def record_hash_calculation_metrics(
    project: Project,
    primary_config: GroupingConfig,
    primary_hashes: CalculatedHashes,
    secondary_config: GroupingConfig,
    secondary_hashes: CalculatedHashes,
):
    has_secondary_hashes = len(extract_hashes(secondary_hashes)) > 0

    if has_secondary_hashes:
        tags = {
            "primary_config": primary_config["id"],
            "secondary_config": secondary_config["id"],
        }
        current_values = primary_hashes.hashes
        secondary_values = secondary_hashes.hashes
        hashes_match = current_values == secondary_values

        if hashes_match:
            tags["result"] = "no change"
        else:
            shared_hashes = set(current_values) & set(secondary_values)
            if len(shared_hashes) > 0:
                tags["result"] = "partial change"
            else:
                tags["result"] = "full change"

        metrics.incr("grouping.hash_comparison", tags=tags)

        # TODO: This is temporary, just until we can figure out how we're recording a hash
        # comparison metric showing projects calculating both primary and secondary hashes using the
        # same config
        if primary_config["id"] == secondary_config["id"]:
            logger.info(
                "Equal primary and secondary configs",
                extra={
                    "project": project.id,
                    "primary_config": primary_config["id"],
                },
            )

    # Track the total number of grouping calculations done overall, so we can divide by the
    # count to get an average number of calculations per event
    metrics.incr("grouping.event_hashes_calculated")
    metrics.incr("grouping.total_calculations", amount=2 if has_secondary_hashes else 1)


def record_new_group_metrics(event: Event):
    metrics.incr(
        "group.created",
        skip_internal=True,
        tags={
            "platform": event.platform or "unknown",
            "sdk": normalized_sdk_tag_from_event(event),
        },
    )

    # This only applies to events with stacktraces
    frame_mix = event.get_event_metadata().get("in_app_frame_mix")
    if frame_mix:
        metrics.incr(
            "grouping.in_app_frame_mix",
            sample_rate=1.0,
            tags={
                "platform": event.platform or "unknown",
                "sdk": normalized_sdk_tag_from_event(event),
                "frame_mix": frame_mix,
            },
        )


def check_for_group_creation_load_shed(project: Project, event: Event):
    """
    Raise a `HashDiscarded` error if the load-shed killswitch is enabled
    """
    if killswitch_matches_context(
        "store.load-shed-group-creation-projects",
        {
            "project_id": project.id,
            "platform": event.platform,
        },
    ):
        raise HashDiscarded("Load shedding group creation", reason="load_shed")


def add_group_id_to_grouphashes(
    group: Group,
    grouphashes: list[GroupHash],
) -> None:
    """
    Link the given group to any grouphash which doesn't yet have a group assigned.
    """

    new_grouphash_ids = [gh.id for gh in grouphashes if gh.group_id is None]

    GroupHash.objects.filter(id__in=new_grouphash_ids).exclude(
        state=GroupHash.State.LOCKED_IN_MIGRATION
    ).update(group=group)


def check_for_category_mismatch(group: Group) -> bool:
    """
    Make sure an error event hasn't hashed to a value assigned to a non-error-type group
    """
    if group.issue_category != GroupCategory.ERROR:
        logger.info(
            "event_manager.category_mismatch",
            extra={
                "issue_category": group.issue_category,
                "event_type": "error",
            },
        )
        return True

    return False


def extract_hashes(calculated_hashes: CalculatedHashes | None) -> list[str]:
    return [] if not calculated_hashes else list(calculated_hashes.hashes)

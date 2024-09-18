from __future__ import annotations

import copy
import logging
from collections.abc import Sequence
from typing import TYPE_CHECKING

import sentry_sdk

from sentry import features, options
from sentry.exceptions import HashDiscarded
from sentry.features.rollout import in_random_rollout
from sentry.grouping.api import (
    NULL_GROUPING_CONFIG,
    BackgroundGroupingConfigLoader,
    GroupingConfig,
    GroupingConfigNotFound,
    SecondaryGroupingConfigLoader,
    apply_server_fingerprinting,
    get_fingerprinting_config_for_project,
    get_grouping_config_dict_for_project,
    load_grouping_config,
)
from sentry.grouping.ingest.config import is_in_transition
from sentry.grouping.ingest.metrics import record_hash_calculation_metrics
from sentry.models.grouphash import GroupHash
from sentry.models.grouphashmetadata import GroupHashMetadata
from sentry.models.project import Project
from sentry.utils import metrics
from sentry.utils.metrics import MutableTags
from sentry.utils.tag_normalization import normalized_sdk_tag_from_event

if TYPE_CHECKING:
    from sentry.event_manager import Job
    from sentry.eventstore.models import Event

logger = logging.getLogger("sentry.events.grouping")


def _calculate_event_grouping(
    project: Project, event: Event, grouping_config: GroupingConfig
) -> list[str]:
    """
    Main entrypoint for modifying/enhancing and grouping an event, writes
    hashes back into event payload.
    """
    metric_tags: MutableTags = {
        "grouping_config": grouping_config["id"],
        "platform": event.platform or "unknown",
        "sdk": normalized_sdk_tag_from_event(event.data),
    }

    with metrics.timer("save_event._calculate_event_grouping", tags=metric_tags):
        loaded_grouping_config = load_grouping_config(grouping_config)

        with metrics.timer("event_manager.normalize_stacktraces_for_grouping", tags=metric_tags):
            with sentry_sdk.start_span(op="event_manager.normalize_stacktraces_for_grouping"):
                event.normalize_stacktraces_for_grouping(loaded_grouping_config)

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
) -> list[str]:
    metric_tags: MutableTags = {
        "grouping_config": config["id"],
        "platform": event.platform or "unknown",
        "sdk": normalized_sdk_tag_from_event(event.data),
    }
    with metrics.timer("event_manager.background_grouping", tags=metric_tags):
        return _calculate_event_grouping(project, event, config)


def maybe_run_secondary_grouping(
    project: Project, job: Job, metric_tags: MutableTags
) -> tuple[GroupingConfig, list[str]]:
    """
    If the projct is in a grouping config transition phase, calculate a set of secondary hashes for
    the job's event.
    """

    secondary_grouping_config = NULL_GROUPING_CONFIG
    secondary_hashes = []

    if is_in_transition(project):
        with metrics.timer("event_manager.secondary_grouping", tags=metric_tags):
            secondary_grouping_config = SecondaryGroupingConfigLoader().get_config_dict(project)
            secondary_hashes = _calculate_secondary_hashes(project, job, secondary_grouping_config)

    return (secondary_grouping_config, secondary_hashes)


def _calculate_secondary_hashes(
    project: Project, job: Job, secondary_grouping_config: GroupingConfig
) -> list[str]:
    """Calculate secondary hash for event using a fallback grouping config for a period of time.
    This happens when we upgrade all projects that have not opted-out to automatic upgrades plus
    when the customer changes the grouping config.
    This causes extra load in save_event processing.
    """
    secondary_hashes = []
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
) -> tuple[GroupingConfig, list[str]]:
    """
    Get the primary grouping config and primary hashes for the event.
    """
    with metrics.timer("event_manager.load_grouping_config"):
        grouping_config = get_grouping_config_dict_for_project(project)
        job["data"]["grouping_config"] = grouping_config

    with (
        sentry_sdk.start_span(
            op="event_manager",
            description="event_manager.save.calculate_event_grouping",
        ),
        metrics.timer("event_manager.calculate_event_grouping", tags=metric_tags),
    ):
        hashes = _calculate_primary_hashes(project, job, grouping_config)

    return (grouping_config, hashes)


def _calculate_primary_hashes(
    project: Project, job: Job, grouping_config: GroupingConfig
) -> list[str]:
    """
    Get the primary hash for the event.

    This is pulled out into a separate function mostly in order to make testing easier.
    """
    return _calculate_event_grouping(project, job["event"], grouping_config)


def find_existing_grouphash(
    grouphashes: Sequence[GroupHash],
) -> GroupHash | None:
    for group_hash in grouphashes:
        if group_hash.group_id is not None:
            return group_hash

        # TODO: Tombstones may get ignored entirely if there is another hash *before*
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
) -> tuple[list[str], list[str]]:
    # Background grouping is a way for us to get performance metrics for a new
    # config without having it actually affect on how events are grouped. It runs
    # either before or after the main grouping logic, depending on the option value.
    maybe_run_background_grouping(project, job)

    secondary_grouping_config, secondary_hashes = maybe_run_secondary_grouping(
        project, job, metric_tags
    )

    primary_grouping_config, primary_hashes = run_primary_grouping(project, job, metric_tags)

    record_hash_calculation_metrics(
        primary_grouping_config,
        primary_hashes,
        secondary_grouping_config,
        secondary_hashes,
    )

    return (primary_hashes, secondary_hashes)


def get_or_create_grouphashes(project: Project, hashes: Sequence[str]) -> list[GroupHash]:
    grouphashes = []

    for hash_value in hashes:
        grouphash, created = GroupHash.objects.get_or_create(project=project, hash=hash_value)

        # TODO: Do we want to expand this to backfill metadata for existing grouphashes? If we do,
        # we'll have to override the metadata creation date for them.
        if (
            created
            and options.get("grouping.grouphash_metadata.ingestion_writes_enabled")
            and features.has("organizations:grouphash-metadata-creation", project.organization)
        ):
            # For now, this just creates a record with a creation timestamp
            GroupHashMetadata.objects.create(grouphash=grouphash)

        grouphashes.append(grouphash)

    return grouphashes

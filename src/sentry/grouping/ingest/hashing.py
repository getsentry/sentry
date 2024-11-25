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
    SecondaryGroupingConfigLoader,
    apply_server_fingerprinting,
    get_fingerprinting_config_for_project,
    get_grouping_config_dict_for_project,
    load_grouping_config,
)
from sentry.grouping.ingest.config import is_in_transition
from sentry.grouping.ingest.grouphash_metadata import (
    create_or_update_grouphash_metadata_if_needed,
    record_grouphash_metadata_metrics,
)
from sentry.grouping.variants import BaseVariant
from sentry.models.grouphash import GroupHash
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
) -> tuple[list[str], dict[str, BaseVariant]]:
    """
    Calculate hashes for the event using the given grouping config, add them to the event data, and
    return them, along with the variants data upon which they're based.
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
            # removed it from the payload.  The call to `get_hashes_and_variants` will then
            # look at `grouping_config` to pick the right parameters.
            event.data["fingerprint"] = event.data.data.get("fingerprint") or ["{{ default }}"]
            apply_server_fingerprinting(
                event.data.data,
                get_fingerprinting_config_for_project(project),
                allow_custom_title=True,
            )

        with metrics.timer("event_manager.event.get_hashes", tags=metric_tags):
            hashes, variants = event.get_hashes_and_variants(loaded_grouping_config)

        return (hashes, variants)


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
        return _calculate_event_grouping(project, event, config)[0]


def maybe_run_secondary_grouping(
    project: Project, job: Job, metric_tags: MutableTags
) -> tuple[GroupingConfig, list[str], dict[str, BaseVariant]]:
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

    # Return an empty variants dictionary because we need the signature of this function to match
    # that of `run_primary_grouping` (so we have to return something), but we don't ever actually
    # need the variant information
    return (secondary_grouping_config, secondary_hashes, {})


def _calculate_secondary_hashes(
    project: Project, job: Job, secondary_grouping_config: GroupingConfig
) -> list[str]:
    """
    Calculate hashes based on an older grouping config, so that unknown hashes calculated by the
    current config can be matched to an existing group if there is one.
    """
    secondary_hashes: list[str] = []
    try:
        with sentry_sdk.start_span(
            op="event_manager",
            name="event_manager.save.secondary_calculate_event_grouping",
        ):
            # create a copy since `_calculate_event_grouping` modifies the event to add all sorts
            # of grouping info and we don't want the secondary grouping data in there
            event_copy = copy.deepcopy(job["event"])
            secondary_hashes, _ = _calculate_event_grouping(
                project, event_copy, secondary_grouping_config
            )
    except Exception as err:
        sentry_sdk.capture_exception(err)

    return secondary_hashes


def run_primary_grouping(
    project: Project, job: Job, metric_tags: MutableTags
) -> tuple[GroupingConfig, list[str], dict[str, BaseVariant]]:
    """
    Get the primary grouping config, primary hashes, and variants for the event.
    """
    with metrics.timer("event_manager.load_grouping_config"):
        grouping_config = get_grouping_config_dict_for_project(project)
        job["data"]["grouping_config"] = grouping_config

    with (
        sentry_sdk.start_span(
            op="event_manager",
            name="event_manager.save.calculate_event_grouping",
        ),
        metrics.timer("event_manager.calculate_event_grouping", tags=metric_tags),
    ):
        hashes, variants = _calculate_primary_hashes_and_variants(project, job, grouping_config)

    return (grouping_config, hashes, variants)


def _calculate_primary_hashes_and_variants(
    project: Project, job: Job, grouping_config: GroupingConfig
) -> tuple[list[str], dict[str, BaseVariant]]:
    """
    Get the primary hash and variants for the event.

    This is pulled out into a separate function mostly in order to make testing easier.
    """
    return _calculate_event_grouping(project, job["event"], grouping_config)


def find_grouphash_with_group(
    grouphashes: Sequence[GroupHash],
) -> GroupHash | None:
    """
    Search in the list of given `GroupHash` records for one which has a group assigned to it, and
    return the first one found. (Assumes grouphashes have already been sorted in priority order.)
    """
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


def get_or_create_grouphashes(
    event: Event,
    project: Project,
    variants: dict[str, BaseVariant],
    hashes: Sequence[str],
    grouping_config: str,
) -> list[GroupHash]:
    is_secondary = grouping_config != project.get_option("sentry:grouping_config")
    grouphashes: list[GroupHash] = []

    # The only utility of secondary hashes is to link new primary hashes to an existing group.
    # Secondary hashes which are also new are therefore of no value, so there's no need to store or
    # annotate them and we can bail now.
    if is_secondary and not GroupHash.objects.filter(project=project, hash__in=hashes).exists():
        return grouphashes

    for hash_value in hashes:
        grouphash, created = GroupHash.objects.get_or_create(project=project, hash=hash_value)

        if options.get("grouping.grouphash_metadata.ingestion_writes_enabled") and features.has(
            "organizations:grouphash-metadata-creation", project.organization
        ):
            create_or_update_grouphash_metadata_if_needed(
                event, project, grouphash, created, grouping_config, variants
            )

        if grouphash.metadata:
            record_grouphash_metadata_metrics(grouphash.metadata)
        else:
            # Collect a temporary metric to get a sense of how often we would be adding metadata to an
            # existing hash. (Yes, this is an overestimate, because this will fire every time we see a given
            # non-backfilled grouphash, not the once per non-backfilled grouphash we'd actually be doing a
            # backfill, but it will give us a ceiling from which we can work down.)
            metrics.incr("grouping.grouphashmetadata.backfill_needed")

        grouphashes.append(grouphash)

    return grouphashes

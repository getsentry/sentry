from __future__ import annotations

import copy
import logging
from collections.abc import Iterable, Sequence
from typing import TYPE_CHECKING, Literal

import sentry_sdk
from django.core.cache import cache

from sentry import options
from sentry.exceptions import HashDiscarded
from sentry.grouping.api import (
    NULL_GROUPING_CONFIG,
    BackgroundGroupingConfigLoader,
    GroupingConfig,
    SecondaryGroupingConfigLoader,
    apply_server_side_fingerprinting,
    get_fingerprinting_config_for_project,
    get_grouping_config_dict_for_project,
    load_grouping_config,
)
from sentry.grouping.ingest.caching import (
    get_grouphash_existence_cache_key,
    get_grouphash_object_cache_key,
)
from sentry.grouping.ingest.config import is_in_transition
from sentry.grouping.ingest.grouphash_metadata import (
    create_or_update_grouphash_metadata_if_needed,
    record_grouphash_metadata_metrics,
)
from sentry.grouping.variants import BaseVariant
from sentry.models.grouphash import GroupHash
from sentry.models.project import Project
from sentry.options.rollout import in_random_rollout
from sentry.utils import metrics
from sentry.utils.metrics import MutableTags
from sentry.utils.tag_normalization import normalized_sdk_tag_from_event

if TYPE_CHECKING:
    from sentry.event_manager import Job
    from sentry.services.eventstore.models import Event

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

        with metrics.timer("event_manager.apply_server_fingerprinting", tags=metric_tags):
            event.data["fingerprint"] = event.data.data.get("fingerprint") or ["{{ default }}"]
            apply_server_side_fingerprinting(
                event.data.data, get_fingerprinting_config_for_project(project)
            )

        with metrics.timer("event_manager.normalize_stacktraces_for_grouping", tags=metric_tags):
            with sentry_sdk.start_span(op="event_manager.normalize_stacktraces_for_grouping"):
                event.normalize_stacktraces_for_grouping(loaded_grouping_config)

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


# TODO: This can go once we've settled on an expiry time for each cache
def _get_cache_expiry(
    cache_key: str, cache_type: Literal["existence", "object"]
) -> tuple[int, int]:
    option_name = f"grouping.ingest_grouphash_{cache_type}_cache_expiry.trial_values"
    possible_cache_expiries = options.get(option_name)
    expiry_for_cache_key = possible_cache_expiries[hash(cache_key) % len(possible_cache_expiries)]

    # Calculate a option version value so that when the option value changes, we invalidate the
    # cache entries stored under the old value of the option
    option_version = abs(hash(tuple(possible_cache_expiries)))

    return (expiry_for_cache_key, option_version)


def _grouphash_exists_for_hash_value(hash_value: str, project: Project, use_caching: bool) -> bool:
    """
    Check whether a given hash value has a corresponding `GroupHash` record in the database.

    If `use_caching` is True, cache the boolean result. Cache retention is controlled by the
    `grouping.ingest_grouphash_existence_cache_expiry` option.

    TODO: That last sentence is temporarily untrue. While we're experimenting with retention
    periods, cache retention is actually controlled by the helper `_get_cache_expiry`.
    """
    with metrics.timer(
        "grouping.get_or_create_grouphashes.check_secondary_hash_existence"
    ) as metrics_tags:
        if use_caching:
            cache_key = get_grouphash_existence_cache_key(hash_value, project.id)
            # TODO: This can go back to being just
            #     cache_expiry = options.get("grouping.ingest_grouphash_existence_cache_expiry")
            # once we've settled on a good retention period
            cache_expiry, option_version = _get_cache_expiry(cache_key, cache_type="existence")

            # TODO: We can remove the version once we've settled on a good retention period
            grouphash_exists = cache.get(cache_key, version=option_version)
            got_cache_hit = grouphash_exists is not None
            metrics_tags["cache_result"] = "hit" if got_cache_hit else "miss"
            # TODO: Temporary tag to let us compare hit rates across different retention periods
            metrics_tags["expiry_seconds"] = cache_expiry

            if got_cache_hit:
                metrics_tags["grouphash_exists"] = grouphash_exists
                return grouphash_exists

        grouphash_exists = GroupHash.objects.filter(project=project, hash=hash_value).exists()

        if use_caching:
            metrics_tags["grouphash_exists"] = grouphash_exists
            metrics_tags["cache_set"] = True

            # TODO: We can remove the version once we've settled on a good retention period
            cache.set(cache_key, grouphash_exists, cache_expiry, version=option_version)

        return grouphash_exists


def _get_or_create_single_grouphash(
    hash_value: str, project: Project, use_caching: bool
) -> tuple[GroupHash, bool]:
    """
    Create or retrieve a `GroupHash` record for the given hash.

    If `use_caching` is true, and the resulting grouphash has an assigned group, cache the
    `GroupHash` object. (Grouphashes without a group aren't cached because their data is about to
    change when a group is assigned.) Cache retention is controlled by the
    `grouping.ingest_grouphash_object_cache_expiry` option.

    TODO: That last sentence is temporarily untrue. While we're experimenting with retention
    periods, cache retention is actually controlled by the helper `_get_cache_expiry`.
    """
    with metrics.timer(
        "grouping.get_or_create_grouphashes.get_or_create_grouphash"
    ) as metrics_tags:
        if use_caching:
            cache_key = get_grouphash_object_cache_key(hash_value, project.id)
            # TODO: This can go back to being just
            #     cache_expiry = options.get("grouping.ingest_grouphash_object_cache_expiry")
            # once we've settled on a good retention period
            cache_expiry, option_version = _get_cache_expiry(cache_key, cache_type="object")

            # TODO: We can remove the version once we've settled on a good retention period
            grouphash = cache.get(cache_key, version=option_version)
            got_cache_hit = grouphash is not None
            metrics_tags["cache_result"] = "hit" if got_cache_hit else "miss"
            # TODO: Temporary tag to let us compare hit rates across different retention periods
            metrics_tags["expiry_seconds"] = cache_expiry

            if got_cache_hit:
                return (grouphash, False)

        grouphash, created = GroupHash.objects.get_or_create(project=project, hash=hash_value)

        # We only want to cache grouphashes which already have a group assigned, because we know any
        # without a group will only stay current in the cache for a few milliseconds (until they get
        # their own group), so there's no point in bothering to cache them.
        if use_caching and grouphash.group_id is not None:
            metrics_tags["cache_set"] = True

            # TODO: We can remove the version once we've settled on a good retention period
            cache.set(cache_key, grouphash, cache_expiry, version=option_version)

        return (grouphash, created)


def get_or_create_grouphashes(
    event: Event,
    project: Project,
    variants: dict[str, BaseVariant],
    hashes: Iterable[str],
    grouping_config_id: str,
) -> list[GroupHash]:
    is_secondary = grouping_config_id == project.get_option("sentry:secondary_grouping_config")
    use_caching = options.get("grouping.use_ingest_grouphash_caching")
    grouphashes: list[GroupHash] = []

    if is_secondary:
        # The only utility of secondary hashes is to link new primary hashes to an existing group
        # via an existing grouphash. Secondary hashes which are new are therefore of no value, so
        # filter them out before creating grouphash records.
        hashes = [
            hash_value
            for hash_value in hashes
            if _grouphash_exists_for_hash_value(hash_value, project, use_caching)
        ]

    for hash_value in hashes:
        grouphash, created = _get_or_create_single_grouphash(hash_value, project, use_caching)

        if options.get("grouping.grouphash_metadata.ingestion_writes_enabled"):
            try:
                # We don't expect this to throw any errors, but collecting this metadata
                # shouldn't ever derail ingestion, so better to be safe
                create_or_update_grouphash_metadata_if_needed(
                    event, project, grouphash, created, grouping_config_id, variants
                )
            except Exception as exc:
                event_id = sentry_sdk.capture_exception(exc)
                # Temporary log to try to debug why two metrics which should be equivalent are
                # consistently unequal - maybe the code is erroring out between incrementing the
                # first one and the second one?
                logger.warning(
                    "grouphash_metadata.exception", extra={"event_id": event_id, "error": repr(exc)}
                )
        if grouphash.metadata:
            record_grouphash_metadata_metrics(grouphash.metadata, event.platform)

        grouphashes.append(grouphash)

    return grouphashes

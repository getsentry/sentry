from __future__ import annotations

import logging
from collections.abc import MutableMapping
from typing import TYPE_CHECKING, Any

from sentry import features
from sentry.grouping.api import GroupingConfig
from sentry.grouping.ingest.config import _config_update_happened_recently, is_in_transition
from sentry.grouping.ingest.utils import extract_hashes
from sentry.grouping.result import CalculatedHashes
from sentry.models.project import Project
from sentry.utils import metrics
from sentry.utils.tag_normalization import normalized_sdk_tag_from_event

if TYPE_CHECKING:
    from sentry.eventstore.models import Event

logger = logging.getLogger("sentry.events.grouping")

Job = MutableMapping[str, Any]


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

        # If the configs are the same, *of course* the values are going to match, so no point in
        # recording a metric
        #
        # TODO: If we fix the issue outlined in https://github.com/getsentry/sentry/pull/65116, we
        # can ditch both this check and the logging below
        if tags["primary_config"] != tags["secondary_config"]:
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

        else:
            if not _config_update_happened_recently(project, 30):
                logger.info(
                    "Equal primary and secondary configs",
                    extra={
                        "project": project.id,
                        "primary_config": primary_config["id"],
                    },
                )


# TODO: Once the legacy `_save_aggregate` goes away, this logic can be pulled into
# `record_hash_calculation_metrics`. Right now it's split up because we don't know the value for
# `result` at the time the legacy `_save_aggregate` (indirectly) calls `record_hash_calculation_metrics`
def record_calculation_metric_with_result(
    project: Project,
    has_secondary_hashes: bool,
    result: str,
) -> None:

    # Track the total number of grouping calculations done overall, so we can divide by the
    # count to get an average number of calculations per event
    tags = {
        "in_transition": str(is_in_transition(project)),
        "using_transition_optimization": str(
            features.has(
                "organizations:grouping-suppress-unnecessary-secondary-hash",
                project.organization,
            )
        ),
        "result": result,
    }
    metrics.incr("grouping.event_hashes_calculated", tags=tags)
    metrics.incr("grouping.total_calculations", amount=2 if has_secondary_hashes else 1, tags=tags)


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

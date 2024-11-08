from __future__ import annotations

import logging
from collections.abc import MutableMapping
from typing import TYPE_CHECKING, Any

from sentry import options
from sentry.grouping.api import GroupingConfig
from sentry.grouping.ingest.config import is_in_transition
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
    primary_hashes: list[str],
    secondary_config: GroupingConfig,
    secondary_hashes: list[str],
    existing_hash_search_result: str,
) -> None:
    has_secondary_hashes = len(secondary_hashes) > 0

    # In cases where we've computed both primary and secondary hashes, track how often the config
    # change has changed the resulting hashes
    if has_secondary_hashes:
        hash_comparison_tags = {
            "primary_config": primary_config["id"],
            "secondary_config": secondary_config["id"],
        }
        current_values = primary_hashes
        secondary_values = secondary_hashes
        hashes_match = current_values == secondary_values

        if hashes_match:
            hash_comparison_tags["result"] = "no change"
        else:
            shared_hashes = set(current_values) & set(secondary_values)
            if len(shared_hashes) > 0:
                hash_comparison_tags["result"] = "partial change"
            else:
                hash_comparison_tags["result"] = "full change"

        metrics.incr(
            "grouping.hash_comparison",
            sample_rate=options.get("grouping.config_transition.metrics_sample_rate"),
            tags=hash_comparison_tags,
        )

    # Track the total number of grouping calculations done overall, so we can divide by the
    # count to get an average number of calculations per event
    num_calculations_tags = {
        "in_transition": str(is_in_transition(project)),
        "result": existing_hash_search_result,
    }
    metrics.incr(
        "grouping.event_hashes_calculated",
        sample_rate=options.get("grouping.config_transition.metrics_sample_rate"),
        tags=num_calculations_tags,
    )
    metrics.incr(
        "grouping.total_calculations",
        amount=2 if has_secondary_hashes else 1,
        sample_rate=options.get("grouping.config_transition.metrics_sample_rate"),
        tags=num_calculations_tags,
    )


def record_new_group_metrics(event: Event) -> None:
    metrics.incr(
        "group.created",
        skip_internal=True,
        tags={
            "platform": event.platform or "unknown",
            "sdk": normalized_sdk_tag_from_event(event.data),
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
                "sdk": normalized_sdk_tag_from_event(event.data),
                "frame_mix": frame_mix,
            },
        )

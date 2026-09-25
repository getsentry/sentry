"""
Configuration for similarity grouping model versions.

This module defines which model versions are used for similarity grouping
and provides helper functions for determining the appropriate version to use.
"""

from sentry.seer.similarity.types import GroupingVersion

SEER_GROUPING_STABLE_VERSION = GroupingVersion.V2_1

# Set only when a new model is ready to serve grouping requests and populate existing hashes.
SEER_GROUPING_NEXT_VERSION: GroupingVersion | None = None


def get_grouping_model_version() -> GroupingVersion:
    return SEER_GROUPING_NEXT_VERSION or SEER_GROUPING_STABLE_VERSION


def should_send_to_seer_for_training(
    grouphash_seer_latest_training_model: str | None,
) -> bool:
    """
    Populate an existing grouphash's embedding once for a new model, until it is promoted.
    """
    return (
        SEER_GROUPING_NEXT_VERSION is not None
        and SEER_GROUPING_NEXT_VERSION != SEER_GROUPING_STABLE_VERSION
        and grouphash_seer_latest_training_model != SEER_GROUPING_NEXT_VERSION.value
    )

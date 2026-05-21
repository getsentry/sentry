"""
Configuration for similarity grouping model versions.

This module defines which model versions are used for similarity grouping
and provides helper functions for determining the appropriate version to use.
"""

from sentry import features
from sentry.models.project import Project
from sentry.seer.similarity.types import GroupingVersion

# Stable model version - used for ALL requests for non-rolled-out projects
SEER_GROUPING_STABLE_VERSION = GroupingVersion.V1

# New model version being rolled out
# - Rolled-out projects: Use this for ALL requests (both grouping and embeddings)
# - Non-rolled-out projects: Never use this (use stable version for everything)
# Set to None to disable rollout entirely
SEER_GROUPING_NEXT_VERSION: GroupingVersion | None = GroupingVersion.V2_1
SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE = "projects:similarity-grouping-model-next"


def get_grouping_model_version(project: Project) -> GroupingVersion:
    """
    Get the model version to use for grouping decisions for this project.

    Returns:
        - Next version if rollout is enabled for this project
        - Stable version otherwise
    """
    if SEER_GROUPING_NEXT_VERSION is not None and features.has(
        SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE, project
    ):
        return SEER_GROUPING_NEXT_VERSION

    return SEER_GROUPING_STABLE_VERSION


def should_send_to_seer_for_training(
    project: Project,
    grouphash_seer_latest_training_model: str | None,
) -> bool:
    """
    Check if we should send a training_mode=true request to Seer for the
    project's current model version.

    This is true when:
    1. The project is on a non-stable model version (via feature flags)
    2. The grouphash hasn't already been sent to that version
    """
    model_version = get_grouping_model_version(project)
    is_stable = model_version == SEER_GROUPING_STABLE_VERSION
    was_grouphash_already_sent = grouphash_seer_latest_training_model == model_version.value
    return not (is_stable or was_grouphash_already_sent)

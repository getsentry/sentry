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
SEER_GROUPING_NEW_VERSION: GroupingVersion | None = GroupingVersion.V2

# Feature flag name (version-agnostic)
SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE = "projects:similarity-grouping-model-upgrade"


def get_grouping_model_version(project: Project) -> GroupingVersion:
    """
    Get the model version to use for grouping decisions for this project.

    Returns:
        - New version if rollout is enabled for this project
        - Stable version otherwise
    """
    # Early return if no new version configured
    if SEER_GROUPING_NEW_VERSION is None:
        return SEER_GROUPING_STABLE_VERSION

    # Type is narrowed to GroupingVersion here
    if features.has(SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE, project):
        return SEER_GROUPING_NEW_VERSION
    return SEER_GROUPING_STABLE_VERSION


def is_new_model_rolled_out(project: Project) -> bool:
    """
    Check if the new model version is rolled out for this project.

    Returns False if:
    - No new version is configured (rollout disabled globally)
    - Feature flag is not enabled for this project
    """
    if SEER_GROUPING_NEW_VERSION is None:
        return False

    return features.has(SEER_GROUPING_NEW_MODEL_ROLLOUT_FEATURE, project)


def get_new_model_version() -> GroupingVersion | None:
    """
    Get the new model version being rolled out, if any.
    Returns None if no rollout is in progress.
    """
    return SEER_GROUPING_NEW_VERSION


def should_send_new_model_embeddings(
    project: Project,
    grouphash_seer_model: str | None,
) -> bool:
    """
    Check if we should send training_mode=true request to build embeddings
    for the new model version for an existing group.

    This is true when:
    1. A new version is being rolled out
    2. The project has the rollout feature enabled
    3. The grouphash hasn't been sent to the new version yet

    Args:
        project: The project
        grouphash_seer_model: The seer_model value from grouphash metadata

    Returns:
        True if we should send a training_mode=true request
    """
    new_version = get_new_model_version()
    if new_version is None:
        # No rollout in progress
        return False

    if not is_new_model_rolled_out(project):
        # Rollout not enabled for this project
        return False

    if grouphash_seer_model is None:
        # Never sent to Seer at all
        return True

    # Check if it was sent to the new version
    return grouphash_seer_model != new_version.value

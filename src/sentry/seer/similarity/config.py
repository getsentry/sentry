"""
Configuration for similarity grouping model versions.

This module defines which model versions are used for similarity grouping
and provides helper functions for determining the appropriate version to use.
"""

from sentry import features
from sentry.models.project import Project
from sentry.seer.similarity.types import GroupingVersion

SEER_GROUPING_STABLE_VERSION = GroupingVersion.V2_1

# Reset dormant rollout flags before configuring a new candidate.
SEER_GROUPING_NEXT_VERSION: GroupingVersion | None = None
SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE = "projects:similarity-grouping-model-next"
SEER_GROUPING_SKIP_FALLBACK_FEATURE = "projects:similarity-grouping-skip-fallback"


def get_grouping_model_version(project: Project) -> GroupingVersion:
    """Select the grouping model for a project."""
    if SEER_GROUPING_NEXT_VERSION is not None and features.has(
        SEER_GROUPING_NEXT_MODEL_ROLLOUT_FEATURE, project
    ):
        return SEER_GROUPING_NEXT_VERSION
    return SEER_GROUPING_STABLE_VERSION


def should_skip_seer_fallback(project: Project) -> bool:
    """
    Whether to tell Seer to skip falling back from the next model to the
    stable model when the next model returns no matches.
    """
    if SEER_GROUPING_NEXT_VERSION is None:
        return True
    return features.has(SEER_GROUPING_SKIP_FALLBACK_FEATURE, project)


def should_send_to_seer_for_training(
    project: Project,
    grouphash_seer_latest_training_model: str | None,
) -> bool:
    """
    Populate an existing grouphash's embedding once for a new model, until it is promoted.
    """
    if SEER_GROUPING_NEXT_VERSION is None:
        return False

    model_version = get_grouping_model_version(project)
    return (
        model_version == SEER_GROUPING_NEXT_VERSION
        and grouphash_seer_latest_training_model != model_version.value
    )

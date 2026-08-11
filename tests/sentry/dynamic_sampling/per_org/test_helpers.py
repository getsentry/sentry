from __future__ import annotations

from collections.abc import Iterator
from contextlib import ExitStack, contextmanager
from typing import Any
from unittest.mock import MagicMock, Mock, patch

from sentry.dynamic_sampling.per_org.configuration import ProjectSampleRates
from sentry.dynamic_sampling.per_org.queries import ProjectVolume
from sentry.models.organization import Organization
from sentry.models.project import Project

CONFIGURATION = "sentry.dynamic_sampling.per_org.configuration"
CALCULATIONS = "sentry.dynamic_sampling.per_org.calculations"
BLENDED_SAMPLE_RATE = f"{CONFIGURATION}.quotas.backend.get_blended_sample_rate"
OUTCOMES_VOLUME = f"{CONFIGURATION}.get_outcomes_organization_volume"
SLIDING_WINDOW_RATE = f"{CONFIGURATION}.compute_sliding_window_sample_rate"
CALCULATE_FACTOR = f"{CONFIGURATION}.calculate_recalibration_factor"
GET_FACTOR = f"{CONFIGURATION}.per_org_recalibration_cache.get_adjusted_factor"
SET_FACTOR = f"{CONFIGURATION}.per_org_recalibration_cache.set_guarded_adjusted_factor"
DELETE_FACTOR = f"{CONFIGURATION}.per_org_recalibration_cache.delete_adjusted_factor"
LEGACY_GET_FACTOR = f"{CALCULATIONS}.legacy_recalibration_cache.get_adjusted_factor"


@contextmanager
def patch_configuration(targets: dict[str, Any]) -> Iterator[dict[str, MagicMock]]:
    """Patch the given targets, each with the given return value.

    Pass ``DEFAULT`` as the return value to patch a target without one. The yielded
    mocks are keyed by target so that callers can assert on the calls.
    """
    with ExitStack() as stack:
        yield {
            target: stack.enter_context(patch(target, return_value=return_value))
            for target, return_value in targets.items()
        }


def make_project_volume(project_id: int, total: int = 100, keep: int = 25) -> ProjectVolume:
    return ProjectVolume(project_id=project_id, total=total, keep=keep, drop=max(total - keep, 0))


def mock_configuration(
    organization: Organization,
    projects: list[Project] | None = None,
    sample_rate: float | None = None,
    project_sample_rates: ProjectSampleRates | None = None,
) -> Mock:
    """A stand-in configuration whose getters return the given sample rates."""
    return Mock(
        organization=organization,
        projects=projects or [],
        **{
            "get_sample_rate.return_value": sample_rate,
            "get_project_sample_rates.return_value": project_sample_rates or {},
        },
    )

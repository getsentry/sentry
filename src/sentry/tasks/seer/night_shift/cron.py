from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import timedelta

import sentry_sdk

from sentry import features, options
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.project import Project
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.tasks.base import instrumented_task
from sentry.tasks.seer.night_shift.agentic_triage import agentic_triage_strategy
from sentry.taskworker.namespaces import seer_tasks
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger("sentry.tasks.seer.night_shift")

NIGHT_SHIFT_DISPATCH_STEP_SECONDS = 37
NIGHT_SHIFT_SPREAD_DURATION = timedelta(hours=4)

FEATURE_NAMES = [
    "organizations:seer-night-shift",
    "organizations:gen-ai-features",
]


@instrumented_task(
    name="sentry.tasks.seer.night_shift.schedule_night_shift",
    namespace=seer_tasks,
    processing_deadline_duration=15 * 60,
)
def schedule_night_shift() -> None:
    """
    Nightly scheduler: iterates active orgs in batches, checks feature flags
    in bulk, and dispatches per-org worker tasks with jitter.
    """
    if not options.get("seer.night_shift.enable"):
        return

    spread_seconds = int(NIGHT_SHIFT_SPREAD_DURATION.total_seconds())
    batch_index = 0

    for org_batch in chunked(
        RangeQuerySetWrapper[Organization](
            Organization.objects.filter(status=OrganizationStatus.ACTIVE),
            step=1000,
        ),
        100,
    ):
        for org in _get_eligible_orgs_from_batch(org_batch):
            delay = (batch_index * NIGHT_SHIFT_DISPATCH_STEP_SECONDS) % spread_seconds

            run_night_shift_for_org.apply_async(
                args=[org.id],
                countdown=delay,
            )
            batch_index += 1

    logger.info(
        "night_shift.schedule_complete",
        extra={"orgs_dispatched": batch_index},
    )


@instrumented_task(
    name="sentry.tasks.seer.night_shift.run_night_shift_for_org",
    namespace=seer_tasks,
    processing_deadline_duration=5 * 60,
)
def run_night_shift_for_org(organization_id: int) -> None:
    try:
        organization = Organization.objects.get(
            id=organization_id, status=OrganizationStatus.ACTIVE
        )
    except Organization.DoesNotExist:
        return

    sentry_sdk.set_tags(
        {
            "organization_id": organization.id,
            "organization_slug": organization.slug,
        }
    )

    eligible_projects = _get_eligible_projects(organization)
    if not eligible_projects:
        logger.info(
            "night_shift.no_eligible_projects",
            extra={
                "organization_id": organization_id,
                "organization_slug": organization.slug,
            },
        )
        return

    candidates = agentic_triage_strategy(eligible_projects, organization)

    logger.info(
        "night_shift.candidates_selected",
        extra={
            "organization_id": organization_id,
            "organization_slug": organization.slug,
            "num_eligible_projects": len(eligible_projects),
            "num_candidates": len(candidates),
            "candidates": [
                {
                    "group_id": c.group.id,
                    "action": c.action,
                }
                for c in candidates
            ],
        },
    )


def _get_eligible_orgs_from_batch(
    orgs: Sequence[Organization],
) -> list[Organization]:
    """
    Check feature flags for a batch of orgs using batch_has_for_organizations.
    Returns orgs that have all required feature flags enabled.
    """
    eligible = [org for org in orgs if not org.get_option("sentry:hide_ai_features")]

    for feature_name in FEATURE_NAMES:
        batch_result = features.batch_has_for_organizations(feature_name, eligible)
        if batch_result is None:
            raise RuntimeError(f"batch_has_for_organizations returned None for {feature_name}")

        eligible = [org for org in eligible if batch_result.get(f"organization:{org.id}", False)]

        if not eligible:
            return []

    return eligible


def _get_eligible_projects(organization: Organization) -> list[Project]:
    """Return active projects that have automation enabled and connected repos."""
    projects_with_repos = set(
        SeerProjectRepository.objects.filter(
            project__organization=organization,
            project__status=ObjectStatus.ACTIVE,
        ).values_list("project_id", flat=True)
    )
    if not projects_with_repos:
        return []

    projects = Project.objects.filter(id__in=projects_with_repos)
    return [
        p
        for p in projects
        if p.get_option("sentry:autofix_automation_tuning") != AutofixAutomationTuningSettings.OFF
    ]

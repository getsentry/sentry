from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import timedelta

import sentry_sdk
from django.db.models import F

from sentry import features, options
from sentry.constants import ObjectStatus
from sentry.models.group import Group, GroupStatus
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.project import Project
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.autofix.utils import is_issue_category_eligible
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.types.group import PriorityLevel
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger("sentry.tasks.seer.night_shift")

NIGHT_SHIFT_DISPATCH_STEP_SECONDS = 37
NIGHT_SHIFT_SPREAD_DURATION = timedelta(hours=4)
NIGHT_SHIFT_MAX_CANDIDATES = 10
NIGHT_SHIFT_ISSUE_FETCH_LIMIT = 100

# Weights for candidate scoring. Set to 0 to disable a signal.
WEIGHT_FIXABILITY = 1.0
WEIGHT_SEVERITY = 0.0
WEIGHT_TIMES_SEEN = 0.0

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
            if bool(org.get_option("sentry:hide_ai_features")):
                continue

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


@dataclass
class _ScoredCandidate:
    """A candidate issue with raw signals for ranking."""

    group_id: int
    project_id: int
    fixability: float
    times_seen: int
    severity: float

    @property
    def score(self) -> float:
        return (
            WEIGHT_FIXABILITY * self.fixability
            + WEIGHT_SEVERITY * self.severity
            + WEIGHT_TIMES_SEEN * min(self.times_seen / 1000.0, 1.0)
        )

    def __lt__(self, other: _ScoredCandidate) -> bool:
        return self.score < other.score


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

    top_candidates = _fixability_score_strategy(eligible_projects)

    logger.info(
        "night_shift.candidates_selected",
        extra={
            "organization_id": organization_id,
            "organization_slug": organization.slug,
            "num_eligible_projects": len(eligible_projects),
            "num_candidates": len(top_candidates),
            "candidates": [
                {
                    "group_id": c.group_id,
                    "project_id": c.project_id,
                    "score": c.score,
                    "fixability": c.fixability,
                    "severity": c.severity,
                    "times_seen": c.times_seen,
                }
                for c in top_candidates
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
    eligible = list(orgs)

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


def _fixability_score_strategy(
    projects: Sequence[Project],
) -> list[_ScoredCandidate]:
    """
    Rank issues by existing fixability score with times_seen as tiebreaker.
    Simple baseline — doesn't require any additional LLM calls.
    """
    all_candidates: list[_ScoredCandidate] = []

    for project_id_batch in chunked(projects, 100):
        groups = Group.objects.filter(
            project_id__in=[p.id for p in project_id_batch],
            status=GroupStatus.UNRESOLVED,
            seer_autofix_last_triggered__isnull=True,
            seer_explorer_autofix_last_triggered__isnull=True,
        ).order_by(
            F("seer_fixability_score").desc(nulls_last=True),
            F("times_seen").desc(),
        )[:NIGHT_SHIFT_ISSUE_FETCH_LIMIT]

        for group in groups:
            if not is_issue_category_eligible(group):
                continue

            all_candidates.append(
                _ScoredCandidate(
                    group_id=group.id,
                    project_id=group.project_id,
                    fixability=group.seer_fixability_score or 0.0,
                    times_seen=group.times_seen,
                    severity=(group.priority or 0) / PriorityLevel.HIGH,
                )
            )

    all_candidates.sort(reverse=True)
    return all_candidates[:NIGHT_SHIFT_MAX_CANDIDATES]

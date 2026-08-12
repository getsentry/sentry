"""Two-flag gating for the Autofix PR-iteration stages.

Every stage is gated on *both* the project-scoped umbrella flag, which opts a
project into PR iteration at all, and that stage's own organization-scoped flag,
which says how far the org has rolled the surface out. The project flag alone
never enables a stage, and an org flag alone never reaches a project that has
not opted in.

Stages are not fully independent: some subsume others, so one stage's flag can
enable another -- see ``STAGE_IMPLIED_BY``.

Call ``has_pr_iteration_flag`` rather than reading either flag directly, so
neither the project check nor a stage implication is skipped by accident.
"""

from __future__ import annotations

from enum import StrEnum

from django.contrib.auth.models import AnonymousUser

from sentry import features
from sentry.models.project import Project
from sentry.seer.autofix.pr_iteration.constants import (
    AUTOMATED_FLAG,
    CAP_ASSIGN_FLAG,
    MANUAL_FLAG,
    PR_ITERATION_PROJECT_FLAG,
    REVIEW_REQUEST_FLAG,
)
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class PrIterationStage(StrEnum):
    """The separately-gated stages of the PR-iteration surface."""

    # A failing check suite sends Autofix back to fix its own PR.
    AUTOMATED = "automated"
    # Human-triggered: the drawer feedback form, `@sentry` PR comments, PR reviews.
    MANUAL = "manual"
    # Open the PR as draft, then undraft and request review once CI is green.
    REVIEW = "review"
    # Hand the PR to a human once the automated iteration cap is exhausted.
    HARD_CAP = "hard_cap"


STAGE_ORG_FLAGS: dict[PrIterationStage, str] = {
    PrIterationStage.AUTOMATED: AUTOMATED_FLAG,
    PrIterationStage.MANUAL: MANUAL_FLAG,
    PrIterationStage.REVIEW: REVIEW_REQUEST_FLAG,
    PrIterationStage.HARD_CAP: CAP_ASSIGN_FLAG,
}

# Stages that another stage's flag also enables, keyed by the implied stage.
# Manual iteration subsumes automated iteration, so an org that has rolled out
# manual gets automated without also enabling the automated flag.
STAGE_IMPLIED_BY: dict[PrIterationStage, tuple[PrIterationStage, ...]] = {
    PrIterationStage.AUTOMATED: (PrIterationStage.MANUAL,),
}


def has_pr_iteration_flag(
    stage: PrIterationStage,
    project: Project,
    *,
    actor: User | RpcUser | AnonymousUser | None = None,
) -> bool:
    """True when the project umbrella flag is on and ``stage`` is enabled.

    ``stage`` is enabled by its own org flag or by the flag of any stage that
    implies it, so callers never have to ``or`` two stages together themselves.
    """
    if not features.has(PR_ITERATION_PROJECT_FLAG, project, actor=actor):
        return False

    organization = project.organization
    return any(
        features.has(STAGE_ORG_FLAGS[implying_stage], organization, actor=actor)
        for implying_stage in (stage, *STAGE_IMPLIED_BY.get(stage, ()))
    )

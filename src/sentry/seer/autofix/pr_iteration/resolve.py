"""Resolve a raw ``check_suite`` webhook into the green or red handler.

Kept apart from ``check_suites`` (the shared helpers) so the handler modules can
import those helpers without a cycle: helpers <- handlers <- this module.
"""

from __future__ import annotations

import logging
from typing import Any

from sentry.models.organization import Organization
from sentry.scm.types import CheckSuiteEvent
from sentry.seer.autofix.pr_iteration.check_suites import (
    CHECK_SUITE_CONCLUSION_TYPES,
    CheckSuiteConclusionType,
    parse_github_check_suite_event,
    record_check_suite_outcome,
    resolve_check_suite_autofix_run,
    resolve_check_suite_repositories,
)
from sentry.seer.autofix.pr_iteration.green_check_suite import GreenCheckSuite
from sentry.seer.autofix.pr_iteration.red_check_suite import RedCheckSuite
from sentry.seer.models.run import SeerRun
from sentry.utils import metrics


def resolve_check_suite(
    check_suite_event: CheckSuiteEvent,
) -> GreenCheckSuite | RedCheckSuite | None:
    """Parse a completed green/red webhook and resolve the Autofix run (no SCM).

    Returns the green or red subclass based on the suite conclusion; each owns its
    own relevance gate and side effects. Shared by both check-suite stages — the
    raw event is what crosses the task boundary, so each stage resolves once.
    """
    if check_suite_event.action != "completed":
        return None

    conclusion = check_suite_event.check_suite["conclusion"]
    conclusion_type = (
        CHECK_SUITE_CONCLUSION_TYPES.get(conclusion) if conclusion is not None else None
    )
    if conclusion_type is None:
        return None

    resolved_cls: type[GreenCheckSuite] | type[RedCheckSuite] = (
        GreenCheckSuite if conclusion_type is CheckSuiteConclusionType.GREEN else RedCheckSuite
    )

    event = parse_github_check_suite_event(check_suite_event)
    if event is None:
        record_check_suite_outcome("skipped", "resolve", "unparseable_event", conclusion_type)
        return None

    organizations: dict[int, Organization] = {}
    candidate_repos = []
    for repo in resolve_check_suite_repositories(event):
        organization = organizations.get(repo.organization_id)
        if organization is None:
            try:
                organization = Organization.objects.get_from_cache(id=repo.organization_id)
            except Organization.DoesNotExist:
                continue
            organizations[repo.organization_id] = organization
        candidate_repos.append(repo)

    if not candidate_repos:
        record_check_suite_outcome(
            "skipped",
            "resolve",
            "no_candidate_repos",
            conclusion_type,
            {"repo_name": event.repository.full_name},
        )
        return None

    autofix_run = resolve_check_suite_autofix_run(event, candidate_repos)
    metrics.incr(
        "autofix.pr_iteration.check_suite.run_resolved",
        tags={"found": str(autofix_run is not None).lower()},
    )
    if autofix_run is None:
        record_check_suite_outcome(
            "skipped",
            "resolve",
            "no_autofix_run",
            conclusion_type,
            {
                "repo_name": event.repository.full_name,
                "organization_ids": [repo.organization_id for repo in candidate_repos],
            },
        )
        return None
    organization = organizations[autofix_run.repository.organization_id]

    log_extra: dict[str, Any] = {
        "organization_id": autofix_run.repository.organization_id,
        "repo_id": autofix_run.repository.id,
        "run_id": autofix_run.run_state.run_id,
        "pr_id": autofix_run.pr_id,
    }

    # Past this point Seer has handed us a run for an open Autofix PR, so the PR
    # number and the local ``SeerRun`` mirror should both exist. Bailing here is an
    # invariant violation, not routine filtering: log loudly, and log the keys we
    # looked up so the mismatch is diagnosable without a repro.
    repo_name = event.repository.full_name
    if not repo_name:
        record_check_suite_outcome(
            "skipped",
            "resolve",
            "missing_repo_name",
            conclusion_type,
            log_extra,
            level=logging.WARNING,
        )
        return None

    pr_state = autofix_run.run_state.repo_pr_states.get(repo_name)
    pr_number = pr_state.pr_number if pr_state else None
    if pr_number is None:
        record_check_suite_outcome(
            "skipped",
            "resolve",
            "missing_pr_number",
            conclusion_type,
            {
                **log_extra,
                "repo_name": repo_name,
                # The realistic failure is a key mismatch rather than a genuinely
                # absent PR number, so record what Seer does have keys for.
                "has_pr_state": pr_state is not None,
                "repo_pr_state_keys": sorted(autofix_run.run_state.repo_pr_states),
            },
            level=logging.WARNING,
        )
        return None

    seer_run = SeerRun.objects.filter(
        seer_run_state_id=autofix_run.run_state.run_id, organization=organization
    ).first()
    if seer_run is None:
        record_check_suite_outcome(
            "skipped",
            "resolve",
            "missing_seer_run",
            conclusion_type,
            {
                **log_extra,
                "repo_name": repo_name,
                # Seer knows about the run but Sentry has no mirror row: record the
                # exact lookup keys so the missing row can be chased down directly.
                "seer_run_state_id": autofix_run.run_state.run_id,
                "seer_run_organization_id": organization.id,
            },
            level=logging.WARNING,
        )
        return None

    return resolved_cls(
        event=event,
        organization=organization,
        autofix_run=autofix_run,
        seer_run=seer_run,
        repo_name=repo_name,
        pr_number=pr_number,
        log_extra=log_extra,
    )

from __future__ import annotations

from collections.abc import Iterable, Mapping

from sentry.investigations.converters.notebook import BlockSpec, ConvertedNotebook, IssueRef
from sentry.investigations.models import InvestigationBlockKind, InvestigationSourceType
from sentry.seer.models.agentic_triage import SeerAgenticTriageRunResult


def convert_agentic_triage_run(
    *,
    run_id: int,
    results: Iterable[SeerAgenticTriageRunResult],
    issues: Mapping[int, IssueRef],
) -> ConvertedNotebook:
    """One notebook per triage run, with every verdict so far in one table."""
    rows = []
    for result in results:
        issue = issues.get(result.group_id) if result.group_id is not None else None
        rows.append(
            {
                "group_id": result.group_id,
                "short_id": issue.short_id if issue else None,
                "title": issue.title if issue else None,
                "verdict": result.extras,
                "autofix_seer_run_id": (
                    result.result_seer_run.seer_run_state_id if result.result_seer_run else None
                ),
            }
        )

    return ConvertedNotebook(
        source_type=InvestigationSourceType.AGENTIC_TRIAGE,
        source_key=f"agentic_triage:{run_id}",
        title=f"Agentic triage of {len(rows)} issues",
        source={"type": InvestigationSourceType.AGENTIC_TRIAGE, "workflowRunId": run_id},
        blocks=[
            BlockSpec(
                "verdicts", InvestigationBlockKind.TRIAGE_VERDICTS, "Verdicts", {"rows": rows}
            )
        ],
    )

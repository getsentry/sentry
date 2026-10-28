from __future__ import annotations

from sentry.investigations.converters.agentic_triage import convert_agentic_triage_run
from sentry.investigations.converters.notebook import IssueRef
from sentry.investigations.models import InvestigationBlockKind, InvestigationSourceType
from sentry.seer.models.agentic_triage import SeerAgenticTriageRunResult
from sentry.seer.models.run import SeerRun


def test_one_table_with_a_row_per_verdict() -> None:
    fix = SeerAgenticTriageRunResult(
        group_id=1,
        extras={"action": "autofix", "reason": "One-file change."},
        result_seer_run=SeerRun(seer_run_state_id=99),
    )
    skip = SeerAgenticTriageRunResult(
        group_id=2,
        extras={
            "action": "skip",
            "reason": "Upstream outage.",
            "skip_reason": "environmental",
        },
    )
    issues = {1: IssueRef(group_id=1, short_id="APP-1", title="TypeError in cart")}

    notebook = convert_agentic_triage_run(run_id=5, results=[fix, skip], issues=issues)

    assert notebook.source_type == InvestigationSourceType.AGENTIC_TRIAGE
    assert notebook.source_key == "agentic_triage:5"
    assert notebook.title == "Agentic triage of 2 issues"
    [block] = notebook.blocks
    assert block.key == "verdicts"
    assert block.kind == InvestigationBlockKind.TRIAGE_VERDICTS
    assert block.config == {
        "rows": [
            {
                "group_id": 1,
                "short_id": "APP-1",
                "title": "TypeError in cart",
                "verdict": {"action": "autofix", "reason": "One-file change."},
                "autofix_seer_run_id": 99,
            },
            {
                "group_id": 2,
                "short_id": None,
                "title": None,
                "verdict": {
                    "action": "skip",
                    "reason": "Upstream outage.",
                    "skip_reason": "environmental",
                },
                "autofix_seer_run_id": None,
            },
        ]
    }

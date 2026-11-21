"""Read the public investigation artifacts from a notebook's latest workflow."""

from typing import Any

from sentry.investigations.models import WorkflowRun
from sentry.notebooks.models import Notebook, NotebookWorkflowRun


def work_status(status: str) -> str:
    return {
        "pending": "not_started",
        "ready": "queued",
        "succeeded": "completed",
        "awaiting_input": "blocked",
    }.get(status, status)


def notebook_report(notebook: Notebook) -> dict[str, Any] | None:
    binding = (
        NotebookWorkflowRun.objects.filter(notebook=notebook).order_by("-id").values("run_id")[:1]
    )
    run = WorkflowRun.objects.filter(organization_id=notebook.organization_id, uuid=binding).first()
    if run is None:
        return None
    report: dict[str, Any] = {
        "runId": str(run.uuid),
        "active": run.checkpoint["status"] in ("pending", "running", "awaiting_input"),
        "summary": None,
        "activity": [],
        "hypotheses": [],
        "hypothesisBlockKeys": [],
    }
    # Only these registered output schemas have investigation-specific presentation.
    # An unrelated workflow can publish its notebook with none of them.
    rows = list(
        run.nodes.filter(
            checkpoint__state__output_schema__in=[
                "BroadScanArtifact",
                "VerificationStepArtifact",
                "HypothesisJudgmentArtifact",
            ]
        ).order_by("id")
    )
    cards: list[dict[str, Any]] = report["hypotheses"]
    for row in rows:
        state = row.checkpoint["state"]
        if state["output_schema"] != "BroadScanArtifact":
            continue
        output = state.get("output") or {}
        report["summary"] = output.get("summary")
        for attempt in sorted(row.activity.values(), key=lambda entry: entry["explorer_run_id"]):
            for block in attempt["session"]["blocks"]:
                msg = block["message"]
                if msg.get("role") == "assistant" and msg.get("content"):
                    report["activity"].append(msg["content"])
                report["activity"].extend(
                    event["message"]
                    for event in block.get("progress") or []
                    if event.get("message")
                )
                for result in block.get("tool_results") or []:
                    report["activity"].extend(
                        call["title"]
                        for call in result["structuredContent"]["calls"]
                        if call.get("title") and not call.get("parent")
                    )
        for index, plan in enumerate(output.get("hypotheses", [])):
            card = {
                "id": f"{row.uuid}-{index}",
                "order": len(cards),
                "statement": plan["statement"],
                "rationale": plan["rationale"],
                "confidence": None,
                "effectiveStatus": "pending",
                "decisionSource": "none",
                "status": "queued",
                "error": None,
                "evidence": [],
                "verificationSteps": [],
            }
            cards.append(card)
            for check in plan.get("verificationSteps", []):
                update_check(card, check, "queued", None)
    for row in rows:
        state = row.checkpoint["state"]
        inputs = state.get("input")
        if not isinstance(inputs, dict) or not isinstance(inputs.get("hypothesis"), dict):
            continue
        plan = inputs["hypothesis"]
        card = next(
            (
                c
                for c in cards
                if c["statement"] == plan["statement"] and c["rationale"] == plan["rationale"]
            ),
            None,
        )
        if card is None:
            continue
        output = state.get("output") or {}
        status = work_status(row.checkpoint["status"])
        if state["output_schema"] == "VerificationStepArtifact":
            check = inputs.get("verificationStep") or inputs.get("verification_step")
            if check:
                update_check(
                    card,
                    check,
                    status,
                    output.get("finding") or (state.get("error") or {}).get("message"),
                )
                if card["decisionSource"] == "none":
                    card.update(status="running", effectiveStatus="investigating")
        elif state["output_schema"] == "HypothesisJudgmentArtifact":
            for checked in inputs.get("checks", []):
                update_check(
                    card,
                    checked["check"],
                    work_status(checked["status"]),
                    (checked.get("output") or {}).get("finding")
                    or (checked.get("error") or {}).get("message"),
                )
            for skipped in inputs.get("skippedChecks", inputs.get("skipped_checks", [])):
                update_check(card, skipped["check"], "skipped", skipped["reason"])
            if output:
                report["hypothesisBlockKeys"].append(f"hypothesis-{row.uuid}")
                card.update(
                    status=status,
                    effectiveStatus=output["verdict"],
                    confidence=output["confidence"],
                    decisionSource="agent",
                    agentVerdict={
                        "verdict": output["verdict"],
                        "rationale": output["rationale"],
                        "confidence": output["confidence"],
                        "remainingGaps": output.get("remainingGaps", []),
                        "supportingEvidenceIds": [],
                        "refutingEvidenceIds": [],
                    },
                )
    if run.checkpoint["status"] in ("failed", "cancelled"):
        for card in cards:
            if card["decisionSource"] == "none":
                card.update(
                    status=run.checkpoint["status"], effectiveStatus=run.checkpoint["status"]
                )
    report["activity"] = list(dict.fromkeys(report["activity"]))[-40:]
    return report


def update_check(
    card: dict[str, Any], check: dict[str, Any], status: str, result: str | None
) -> None:
    steps = card["verificationSteps"]
    key = check.get("id")
    step = next(
        (s for s in steps if (key and s["id"] == key) or s["title"] == check["title"]), None
    )
    if step is None:
        step = {
            "id": f"{card['id']}-{len(steps)}",
            "order": len(steps),
            "error": None,
            "evidence": [],
        }
        steps.append(step)
    step.update(
        title=check["title"],
        objective=check["objective"],
        method=check["method"],
        status=status,
        result=result,
    )
    if key:
        step["id"] = key

"""Read the public investigation artifacts from a notebook's latest workflow."""

from typing import Any

from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from sentry.investigations.models import WorkflowNodeRun, WorkflowRun
from sentry.notebooks.models import Notebook, NotebookWorkflowRun


def work_status(status: str) -> str:
    return {
        "pending": "not_started",
        "ready": "queued",
        "succeeded": "completed",
        "awaiting_input": "blocked",
    }.get(status, status)


def public_activity(row: WorkflowNodeRun) -> list[tuple[str, dict[str, str]]]:
    """Only display the public messages and tool labels from the current Explorer attempt."""
    attempt = row.activity.get(str(row.checkpoint.get("explorer_run_id")))
    entries: list[tuple[str, dict[str, str]]] = []
    if not attempt:
        return entries
    for index, block in enumerate(attempt["session"]["blocks"]):
        prefix = f"{row.uuid}:{attempt['explorer_run_id']}:{block.get('id') or index}"
        when = block.get("timestamp") or attempt["updatedAt"]
        msg = block["message"]
        if msg.get("role") == "assistant" and msg.get("content"):
            entries.append((when, {"id": prefix, "kind": "thought", "text": msg["content"]}))
        for i, progress in enumerate(block.get("progress") or []):
            if text := progress.get("message"):
                entries.append(
                    (when, {"id": f"{prefix}:progress:{i}", "kind": "thought", "text": text})
                )
        results = {r.get("tool_call_id"): r for r in block.get("tool_results") or []}
        for call in msg.get("tool_calls") or []:
            call_id = call["id"]
            result = results.get(call_id)
            labels = [
                item
                for item in ((result or {}).get("structuredContent") or {}).get("calls", [])
                if (item.get("llm_description") or item.get("title")) and item.get("parent") is None
            ]
            for i, item in enumerate(labels or [{"title": call["function"]}]):
                status = str(item.get("status", ""))
                failed = (
                    item.get("error")
                    or status in {"failed", "error"}
                    or (status.isdigit() and int(status) >= 400)
                )
                call_status = "running"
                if result is not None:
                    call_status = "failed" if failed else "completed"
                entries.append(
                    (
                        when,
                        {
                            "id": f"{prefix}:{call_id}:{i}",
                            "kind": item.get("kind") or "tool",
                            "title": item.get("llm_description") or item["title"],
                            "status": call_status,
                        },
                    )
                )
    return entries


def workflow_progress(run: WorkflowRun) -> dict[str, Any]:
    # Pending nodes carry the schema inside their definition until a worker claims them.
    nodes = list(
        run.nodes.annotate(
            schema=Coalesce(
                "checkpoint__state__output_schema", "checkpoint__state__definition__output_schema"
            )
        ).values_list("checkpoint__node_id", "checkpoint__status", "schema")
    )
    statuses = {name: status for name, status, _ in nodes}
    scan = [status for _, status, schema in nodes if schema == "BroadScanArtifact"]
    live = {"ready", "running", "awaiting_input"}
    scan_pending = any(status in live or status == "pending" for status in scan)
    if run.checkpoint["status"] in {"failed", "cancelled", "succeeded"}:
        phase = "completed" if run.checkpoint["status"] == "succeeded" else run.checkpoint["status"]
    elif "notebook/metadata" in statuses or "notebook/next_steps" in statuses:
        phase = "metadata"
    elif statuses.get("notebook/write") in live:
        phase = "reporting"
    elif scan_pending:
        phase = "broad_scan"
    elif any(
        schema == "HypothesisJudgmentArtifact" and status in live for _, status, schema in nodes
    ):
        phase = "judging"
    elif scan:
        phase = "investigating"
    else:
        phase = "workflow"

    activity = []
    if run.checkpoint["status"] == "running":
        for row in (
            run.nodes.filter(checkpoint__status="running").exclude(activity={}).order_by("id")
        ):
            activity.extend(public_activity(row))
    next_step = statuses.get("notebook/next_steps")
    if next_step in {"ready", "pending", "running"} and run.checkpoint["status"] in {
        "failed",
        "cancelled",
    }:
        next_step = run.checkpoint["status"]
    return {
        "phase": phase,
        "awaitingHypotheses": scan_pending and run.checkpoint["status"] in {"pending", "running"},
        "nextStepStatus": next_step,
        "currentActivity": [entry for _, entry in sorted(activity, key=lambda pair: pair[0])[-40:]],
    }


def notebook_report(notebook: Notebook, *, viewer_id: int | None = None) -> dict[str, Any] | None:
    binding = (
        NotebookWorkflowRun.objects.filter(notebook=notebook).order_by("-id").values("run_id")[:1]
    )
    run = WorkflowRun.objects.get_or_none(organization_id=notebook.organization_id, uuid=binding)
    if run is None:
        return None
    status = run.checkpoint["status"]
    active = status in ("pending", "running", "awaiting_input")
    started = (
        parse_datetime(run.checkpoint.get("created_at") or run.checkpoint.get("started_at") or "")
        or run.date_added
    )
    ended = timezone.now() if active else parse_datetime(run.checkpoint.get("finished_at") or "")
    queued = active and not run.checkpoint.get("started_at") and status in ("running", "pending")
    clock = run.checkpoint.get("active_clock")
    since = parse_datetime((clock or {}).get("since") or "")
    active_seconds = (
        clock["seconds"] + (max(0, (timezone.now() - since).total_seconds()) if since else 0)
        if clock
        else None
    )
    prompts = []
    for node in run.nodes.filter(checkpoint__status="awaiting_input").exclude(activity={}):
        attempt = node.activity.get(str(node.checkpoint.get("explorer_run_id")), {})
        pending = attempt.get("session", {}).get("pendingInput")
        if pending:
            prompts.append({"nodeId": str(node.uuid), **pending})
    report: dict[str, Any] = {
        "pendingInputs": prompts,
        "canCommand": notebook.status == "active"
        and viewer_id is not None
        and viewer_id == run.user_id,
        "canSteer": active
        and len(run.checkpoint.get("steering", {})) < 10
        and run.nodes.filter(checkpoint__status="pending").exists(),
        "activeSeconds": active_seconds,
        "clockRunning": bool(since),
        "reportReady": bool(run.checkpoint.get("report_ready")),
        "queued": queued,
        **workflow_progress(run),
        "runId": str(run.uuid),
        "error": (run.checkpoint.get("error") or {}).get("message"),
        "status": status,
        "active": active,
        "elapsedSeconds": max(0, (ended - started).total_seconds()) if started and ended else None,
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
                        call.get("llm_description") or call["title"]
                        for call in (result.get("structuredContent") or {}).get("calls", [])
                        if (call.get("llm_description") or call.get("title"))
                        and call.get("parent") is None
                    )
        for index, plan in enumerate(output.get("hypotheses", [])):
            planned_card = {
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
            cards.append(planned_card)
            for check in plan.get("verificationSteps", []):
                update_check(planned_card, check, "queued", None)
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
                    output.get("finding"),
                    error=state.get("error"),
                    evidence=output.get("evidence"),
                )
                if card["decisionSource"] == "none":
                    card.update(status="running", effectiveStatus="investigating")
        elif state["output_schema"] == "HypothesisJudgmentArtifact":
            for checked in inputs.get("checks", []):
                update_check(
                    card,
                    checked["check"],
                    work_status(checked["status"]),
                    (checked.get("output") or {}).get("finding"),
                    error=checked.get("error"),
                    evidence=(checked.get("output") or {}).get("evidence"),
                )
            for skipped in inputs.get("skippedChecks") or inputs.get("skipped_checks") or []:
                update_check(card, skipped["check"], "skipped", skipped["reason"])
            evidence = public_evidence(card["id"], inputs.get("evidence") or [])
            card["evidence"] = evidence
            if output:
                card["notebookBlockKey"] = f"hypothesis-{row.uuid}"
                report["hypothesisBlockKeys"].append(card["notebookBlockKey"])
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
                        "supportingEvidenceIds": [
                            evidence[i]["id"]
                            for i in output.get("supportingEvidenceIndexes", [])
                            if 0 <= i < len(evidence)
                        ],
                        "refutingEvidenceIds": [
                            evidence[i]["id"]
                            for i in output.get("refutingEvidenceIndexes", [])
                            if 0 <= i < len(evidence)
                        ],
                    },
                )
    if run.checkpoint["status"] in ("failed", "cancelled"):
        for card in cards:
            if card["decisionSource"] == "none":
                card.update(
                    status=run.checkpoint["status"], effectiveStatus=run.checkpoint["status"]
                )
    metadata, preview = run.nodes.filter(checkpoint__node_id="notebook/metadata").values_list(
        "checkpoint__state__output", "checkpoint__state__title_preview"
    ).get_or_none() or ({}, None)
    metadata = metadata or {}
    report["titlePreview"] = (
        preview
        if preview
        and active
        and not report["reportReady"]
        and not NotebookWorkflowRun.objects.filter(
            notebook=notebook, run_id=run.uuid, preserve_title=True
        ).exists()
        else None
    )
    primary = metadata.get("primaryHypothesisKey")
    report["primaryHypothesisId"] = next(
        (
            card["id"]
            for card in cards
            if primary
            and card.get("effectiveStatus") == "supported"
            and card.get("notebookBlockKey") == primary
        ),
        None,
    )
    report["activity"] = list(dict.fromkeys(report["activity"]))[-40:]
    return report


def public_evidence(parent_id: str, evidence: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "id": f"{parent_id}-evidence-{index}",
            "kind": item["kind"],
            "title": item["title"],
            "url": item.get("url"),
            "summary": item.get("summary"),
            "reference": item.get("reference"),
            "data": {},
        }
        for index, item in enumerate(evidence)
    ]


def update_check(
    card: dict[str, Any],
    check: dict[str, Any],
    status: str,
    result: str | None,
    *,
    error: dict[str, Any] | None = None,
    evidence: list[dict[str, Any]] | None = None,
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
        result=result or (error or {}).get("message"),
        error=error,
    )
    if key:
        step["id"] = key
    if evidence is not None:
        step["evidence"] = public_evidence(f"{card['id']}-{step['id']}", evidence)

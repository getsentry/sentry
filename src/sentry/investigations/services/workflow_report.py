"""Read the public investigation artifacts from a notebook's latest workflow."""

from typing import Any

from django.db.models import F, Q
from django.db.models.functions import Coalesce, JSONObject
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


def public_activity(node_id: str, attempt: dict[str, Any]) -> list[tuple[str, dict[str, str]]]:
    """Only display the public messages and tool labels from the current Explorer attempt."""
    entries: list[tuple[str, dict[str, str]]] = []
    if not attempt:
        return entries
    for index, block in enumerate(attempt["session"]["blocks"]):
        prefix = f"{node_id}:{attempt['explorer_run_id']}:{block.get('id') or index}"
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


def workflow_progress(run_status: str, nodes: list[tuple[str, str, str | None]]) -> dict[str, Any]:
    statuses = {name: status for name, status, _ in nodes}
    scan = [status for _, status, schema in nodes if schema == "BroadScanArtifact"]
    live = {"ready", "running", "awaiting_input"}
    scan_pending = any(status in live or status == "pending" for status in scan)
    if run_status in {"failed", "cancelled", "succeeded"}:
        phase = "completed" if run_status == "succeeded" else run_status
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

    next_step = statuses.get("notebook/next_steps")
    if next_step in {"ready", "pending", "running"} and run_status in {
        "failed",
        "cancelled",
    }:
        next_step = run_status
    return {
        "phase": phase,
        "awaitingHypotheses": scan_pending and run_status in {"pending", "running"},
        "nextStepStatus": next_step,
    }


def notebook_report(notebook: Notebook, *, viewer_id: int | None = None) -> dict[str, Any] | None:
    binding = NotebookWorkflowRun.objects.filter(notebook=notebook).order_by("-id")
    run = WorkflowRun.objects.values(
        "id",
        "uuid",
        "user_id",
        "date_added",
        preserve_title=binding.values("preserve_title")[:1],
        status=F("checkpoint__status"),
        created=F("checkpoint__created_at"),
        started=F("checkpoint__started_at"),
        finished=F("checkpoint__finished_at"),
        active_clock=F("checkpoint__active_clock"),
        steering=F("checkpoint__steering"),
        report_ready=F("checkpoint__report_ready"),
        error_message=F("checkpoint__error__message"),
    ).get_or_none(organization_id=notebook.organization_id, uuid=binding.values("run_id")[:1])
    if run is None:
        return None
    node_runs = WorkflowNodeRun.objects.filter(run_id=run["id"])
    status = run["status"]
    active = status in ("pending", "running", "awaiting_input")
    started = parse_datetime(run["created"] or run["started"] or "") or run["date_added"]
    ended = timezone.now() if active else parse_datetime(run["finished"] or "")
    queued = active and not run["started"] and status in ("running", "pending")
    clock = run["active_clock"]
    since = parse_datetime((clock or {}).get("since") or "")
    active_seconds = (
        clock["seconds"] + (max(0, (timezone.now() - since).total_seconds()) if since else 0)
        if clock
        else None
    )
    nodes = list(
        node_runs.annotate(
            schema=Coalesce(
                "checkpoint__state__output_schema", "checkpoint__state__definition__output_schema"
            )
        ).values_list("checkpoint__node_id", "checkpoint__status", "schema")
    )
    # Read transcripts only for live progress, pending questions, and the public scan history.
    transcript_filter = Q(checkpoint__state__output_schema="BroadScanArtifact")
    if active:
        transcript_filter |= Q(checkpoint__status__in=("running", "awaiting_input"))
    transcripts = (
        node_runs.filter(transcript_filter)
        .exclude(activity={})
        .values_list("uuid", "checkpoint__status", "checkpoint__explorer_run_id", "activity")
    )
    prompts = []
    activity = []
    history = {}
    for node_id, node_status, explorer_id, attempts in transcripts:
        history[node_id] = attempts
        attempt = attempts.get(str(explorer_id), {})
        if status == "running" and node_status == "running":
            activity.extend(public_activity(str(node_id), attempt))
        if node_status == "awaiting_input" and (
            pending := attempt.get("session", {}).get("pendingInput")
        ):
            prompts.append({"nodeId": str(node_id), **pending})
    report: dict[str, Any] = {
        "pendingInputs": prompts,
        "canCommand": notebook.status == "active"
        and viewer_id is not None
        and viewer_id == run["user_id"],
        "canSteer": active
        and len(run["steering"] or {}) < 10
        and any(status == "pending" for _, status, _ in nodes),
        "activeSeconds": active_seconds,
        "clockRunning": bool(since),
        "reportReady": bool(run["report_ready"]),
        "queued": queued,
        **workflow_progress(status, nodes),
        "currentActivity": [entry for _, entry in sorted(activity, key=lambda pair: pair[0])[-40:]],
        "runId": str(run["uuid"]),
        "error": run["error_message"],
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
        node_runs.filter(
            Q(
                checkpoint__state__output_schema__in=[
                    "BroadScanArtifact",
                    "VerificationStepArtifact",
                    "HypothesisJudgmentArtifact",
                ]
            )
            | Q(checkpoint__node_id="notebook/metadata")
        )
        .order_by("id")
        .values(
            "uuid",
            name=F("checkpoint__node_id"),
            title_preview=F("checkpoint__state__title_preview"),
            schema=F("checkpoint__state__output_schema"),
            status=F("checkpoint__status"),
            output=F("checkpoint__state__output"),
            error=F("checkpoint__state__error"),
            inputs=JSONObject(
                hypothesis="checkpoint__state__input__hypothesis",
                checks="checkpoint__state__input__checks",
                skippedChecks=Coalesce(
                    "checkpoint__state__input__skippedChecks",
                    "checkpoint__state__input__skipped_checks",
                ),
                evidence="checkpoint__state__input__evidence",
                verificationStep=Coalesce(
                    "checkpoint__state__input__verificationStep",
                    "checkpoint__state__input__verification_step",
                ),
            ),
        )
    )
    cards: list[dict[str, Any]] = report["hypotheses"]
    for row in rows:
        if row["schema"] != "BroadScanArtifact":
            continue
        output = row["output"] or {}
        report["summary"] = output.get("summary")
        for attempt in sorted(
            history.get(row["uuid"], {}).values(), key=lambda entry: entry["explorer_run_id"]
        ):
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
                "id": f"{row['uuid']}-{index}",
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
        inputs = row["inputs"]
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
        output = row["output"] or {}
        status = work_status(row["status"])
        if row["schema"] == "VerificationStepArtifact":
            check = inputs.get("verificationStep") or inputs.get("verification_step")
            if check:
                update_check(
                    card,
                    check,
                    status,
                    output.get("finding"),
                    error=row["error"],
                    evidence=output.get("evidence"),
                )
                if card["decisionSource"] == "none":
                    card.update(status="running", effectiveStatus="investigating")
        elif row["schema"] == "HypothesisJudgmentArtifact":
            for checked in inputs.get("checks") or []:
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
                card["notebookBlockKey"] = f"hypothesis-{row['uuid']}"
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
    if run["status"] in ("failed", "cancelled"):
        for card in cards:
            if card["decisionSource"] == "none":
                card.update(status=run["status"], effectiveStatus=run["status"])
    metadata_node = next((row for row in rows if row["name"] == "notebook/metadata"), None)
    metadata = (metadata_node["output"] or {}) if metadata_node else {}
    report["titlePreview"] = (
        metadata_node["title_preview"]
        if metadata_node and active and not report["reportReady"] and not run["preserve_title"]
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

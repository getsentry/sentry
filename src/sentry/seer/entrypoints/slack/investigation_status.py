from __future__ import annotations

import hashlib
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

import orjson

from sentry.api.event_search import (
    ParenExpression,
    SearchConfig,
    SearchFilter,
    parse_search_query,
)
from sentry.exceptions import InvalidSearchQuery
from sentry.investigations.models import Investigation, InvestigationOrchestrationRun
from sentry.investigations.models.orchestration import (
    InvestigationOrchestrationPhase,
    InvestigationOrchestrationStatus,
)
from sentry.issues.issue_search import issue_search_config
from sentry.notifications.platform.templates.seer import (
    SeerInvestigationConclusion,
    SeerInvestigationHypothesis,
    SeerInvestigationProgress,
    SeerInvestigationStatus,
)

MAX_STATUS_HYPOTHESES = 10
MAX_STATUS_TEXT_LENGTH = 300
# Slack caps a section's text at 3,000 characters.
MAX_SUMMARY_DESCRIPTION_LENGTH = 2_500

VERIFYING_LABEL = "● Verifying"
SUPPORTED_LABEL = "● Supported"
REFUTED_LABEL = "● Refuted"
NOT_COMPLETED_LABEL = "● Not completed"

NOT_COMPLETED_DETAIL = "Verification stopped before this explanation could be assessed."
STEP_DETAIL_PREFIXES = {
    "running": "",
    "reauth_required": "Needs re-authentication: ",
    "blocked": "Blocked: ",
    "stalled": "Stalled: ",
    "queued": "",
}
# Alert queries can use AND and OR, which the issue search config rejects.
ENDPOINT_SEARCH_CONFIG = SearchConfig.create_from(issue_search_config, allow_boolean=True)

HYPOTHESIS_LABELS = {
    "pending": VERIFYING_LABEL,
    "investigating": VERIFYING_LABEL,
    "supported": SUPPORTED_LABEL,
    "accepted": SUPPORTED_LABEL,
    "refuted": REFUTED_LABEL,
    "rejected": REFUTED_LABEL,
    "inconclusive": "● Inconclusive",
    "failed": NOT_COMPLETED_LABEL,
    "cancelled": NOT_COMPLETED_LABEL,
}
# A person's decision overrides Seer's verdict, so its reasoning no longer applies.
USER_DECISION_LABELS = {
    "accepted": "● Accepted by a teammate",
    "rejected": "● Rejected by a teammate",
}
USER_DECISION_DETAIL = "A teammate made this call in Sentry."


def _truncate(text: str, limit: int = MAX_STATUS_TEXT_LENGTH) -> str:
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def _as_dict(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _format_window(start: datetime, end: datetime) -> str:
    start_text = f"{start:%b} {start.day}, {start:%H:%M}"
    if start.date() == end.date():
        return f"{start_text}–{end:%H:%M} UTC"
    return f"{start_text} – {end:%b} {end.day}, {end:%H:%M} UTC"


def get_status_title(source: Mapping[str, Any]) -> str:
    return source["snapshot"]["monitor"]["name"]


def _get_endpoint(query: str) -> str | None:
    try:
        tokens = parse_search_query(query, config=ENDPOINT_SEARCH_CONFIG)
    except InvalidSearchQuery:
        return None
    if any(token == "OR" or isinstance(token, ParenExpression) for token in tokens):
        return None
    endpoints = [
        token.value.raw_value
        for token in tokens
        if isinstance(token, SearchFilter)
        and token.key.name == "transaction"
        and token.operator == "="
        and isinstance(token.value.raw_value, str)
    ]
    return endpoints[0] if len(endpoints) == 1 else None


def get_status_subtitle(source: Mapping[str, Any], updated_at: datetime | None = None) -> str:
    snapshot = source["snapshot"]
    parts = []
    query = snapshot["monitor"]["query"]
    endpoint = _get_endpoint(query) if query else None
    if endpoint:
        # A backtick in the endpoint ends the code span too early.
        parts.append(f"`{_truncate(endpoint.replace('`', "'"))}`")
    window = snapshot["analysisWindow"]
    start = datetime.fromisoformat(window["breachStart"]).astimezone(UTC)
    end = (updated_at or datetime.fromisoformat(window["end"])).astimezone(UTC)
    parts.append(_format_window(start, end))
    return " · ".join(parts)


def _get_detail(hypothesis: Mapping[str, Any]) -> str:
    verdict = _as_dict(hypothesis.get("agentVerdict"))
    if verdict.get("rationale"):
        return _truncate(str(verdict["rationale"]))

    steps = [
        step for step in hypothesis.get("verificationSteps") or [] if isinstance(step, Mapping)
    ]
    steps.sort(key=lambda step: step.get("order", 0))
    # A step that is stuck explains more than one that is still queued behind it.
    for status, prefix in STEP_DETAIL_PREFIXES.items():
        for step in steps:
            if step.get("status") == status and step.get("title"):
                return _truncate(f"{prefix}{step['title']}")

    return _truncate(str(hypothesis.get("rationale") or ""))


def _get_progress(
    phase: str | None,
    status: str | None,
    hypotheses: list[Mapping[str, Any]],
    interrupted: bool,
) -> SeerInvestigationProgress | None:
    if interrupted:
        return SeerInvestigationProgress(
            title="Investigation interrupted",
            status="error",
            detail="Seer couldn't finish the investigation. "
            "The available work is preserved; no conclusion was produced.",
        )
    if status == InvestigationOrchestrationStatus.AWAITING_INPUT:
        return SeerInvestigationProgress(
            title="Waiting for input",
            status="error",
            detail="Seer is paused until someone responds. Open the investigation to continue.",
        )
    match phase:
        case (
            None
            | InvestigationOrchestrationPhase.INTAKE
            | InvestigationOrchestrationPhase.BROAD_SCAN
        ):
            return SeerInvestigationProgress(
                title="Gathering context",
                status="in_progress",
                detail="Comparing the alert with related telemetry.",
            )
        case (
            InvestigationOrchestrationPhase.PLANNING | InvestigationOrchestrationPhase.INVESTIGATING
        ):
            # Each hypothesis plans its checks before any of them run.
            if not any(hypothesis.get("verificationSteps") for hypothesis in hypotheses):
                return SeerInvestigationProgress(
                    title="Forming hypotheses",
                    status="in_progress",
                    detail="Checking the available telemetry for plausible explanations of the alert.",
                )
            return SeerInvestigationProgress(
                title="Verifying hypotheses",
                status="in_progress",
                detail="Checking the remaining explanations against related telemetry.",
            )
        case InvestigationOrchestrationPhase.JUDGING:
            return SeerInvestigationProgress(
                title="Reviewing findings",
                status="in_progress",
                detail="Reviewing the evidence behind each verdict and identifying what remains uncertain.",
            )
        case InvestigationOrchestrationPhase.REPORTING | InvestigationOrchestrationPhase.METADATA:
            return SeerInvestigationProgress(
                title="Preparing conclusion",
                status="in_progress",
                detail="Bringing the evidence, remaining uncertainty, and suggested next steps "
                "into a conclusion.",
            )
        case InvestigationOrchestrationPhase.COMPLETED:
            return SeerInvestigationProgress(
                title="Investigation complete",
                status="complete",
                detail="Seer finished checking every hypothesis.",
            )
    return None


def build_investigation_status(
    *,
    investigation: Investigation,
    projection: Mapping[str, Any] | None,
    phase: str | None = None,
    status: str | None = None,
    updated_at: datetime | None = None,
) -> tuple[SeerInvestigationStatus, str]:
    """Builds the status message data and a fingerprint of what it shows."""
    raw_hypotheses = [
        hypothesis
        for hypothesis in _as_dict(projection).get("hypotheses") or []
        if isinstance(hypothesis, Mapping)
    ]
    raw_hypotheses.sort(key=lambda hypothesis: hypothesis.get("order", 0))
    interrupted = status in (
        InvestigationOrchestrationStatus.FAILED,
        InvestigationOrchestrationStatus.CANCELLED,
    )
    progress = _get_progress(phase, status, raw_hypotheses, interrupted)
    raw_hypotheses = raw_hypotheses[:MAX_STATUS_HYPOTHESES]

    hypotheses = []
    fingerprint_hypotheses = []
    for hypothesis in raw_hypotheses:
        effective_status = hypothesis.get("effectiveStatus", "")
        statement = _truncate(str(hypothesis.get("statement") or ""))
        if hypothesis.get("decisionSource") == "user" and effective_status in USER_DECISION_LABELS:
            label = USER_DECISION_LABELS[effective_status]
            detail = USER_DECISION_DETAIL
        else:
            label = HYPOTHESIS_LABELS.get(effective_status, VERIFYING_LABEL)
            if interrupted and label == VERIFYING_LABEL:
                label = NOT_COMPLETED_LABEL
            detail = (
                NOT_COMPLETED_DETAIL if label == NOT_COMPLETED_LABEL else _get_detail(hypothesis)
            )
        hypotheses.append(
            SeerInvestigationHypothesis(statement=statement, label=label, detail=detail)
        )
        fingerprint_hypotheses.append(
            [hypothesis.get("id"), hypothesis.get("generation"), statement, label, detail]
        )

    data = SeerInvestigationStatus(
        organization_id=investigation.organization_id,
        title=get_status_title(investigation.source),
        subtitle=get_status_subtitle(investigation.source, updated_at),
        investigation_url=investigation.get_absolute_url(),
        hypotheses=hypotheses,
        progress=progress,
    )
    fingerprint = hashlib.sha256(
        orjson.dumps([data.title, data.subtitle, fingerprint_hypotheses, progress])
    ).hexdigest()
    return data, fingerprint


def build_investigation_conclusion(
    run: InvestigationOrchestrationRun,
) -> SeerInvestigationConclusion | None:
    """Builds the conclusion from the investigation's summary, or None if there is no summary."""
    investigation = run.investigation
    if not investigation.summary:
        return None
    description = investigation.summary_description
    return SeerInvestigationConclusion(
        organization_id=investigation.organization_id,
        summary=investigation.summary,
        summary_description=(
            _truncate(description, MAX_SUMMARY_DESCRIPTION_LENGTH) if description else None
        ),
        investigation_url=investigation.get_absolute_url(),
    )

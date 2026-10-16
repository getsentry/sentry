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
from sentry.investigations.models import Investigation
from sentry.issues.issue_search import issue_search_config
from sentry.notifications.platform.templates.seer import (
    SeerInvestigationHypothesis,
    SeerInvestigationStatus,
)

MAX_STATUS_HYPOTHESES = 10
MAX_STATUS_TEXT_LENGTH = 300
VERIFYING_LABEL = "● Verifying"
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
    "supported": "● Supported",
    "accepted": "● Supported",
    "refuted": "● Refuted",
    "rejected": "● Refuted",
    "inconclusive": "● Inconclusive",
    "failed": NOT_COMPLETED_LABEL,
    "cancelled": NOT_COMPLETED_LABEL,
}


def _truncate(text: str, limit: int = MAX_STATUS_TEXT_LENGTH) -> str:
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def _as_dict(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _parse_time(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _format_window(start: datetime, end: datetime) -> str:
    start_text = f"{start:%b} {start.day}, {start:%H:%M}"
    if start.date() == end.date():
        return f"{start_text}–{end:%H:%M} UTC"
    return f"{start_text} – {end:%b} {end.day}, {end:%H:%M} UTC"


def get_status_title(source: Mapping[str, Any]) -> str:
    snapshot = _as_dict(source.get("snapshot"))
    monitor = _as_dict(snapshot.get("monitor"))
    for title in (monitor.get("name"), snapshot.get("groupTitle")):
        if isinstance(title, str) and title:
            return title
    return "this alert"


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


def get_status_subtitle(
    source: Mapping[str, Any], updated_at: datetime | None = None
) -> str | None:
    snapshot = _as_dict(source.get("snapshot"))
    parts = []
    query = _as_dict(snapshot.get("monitor")).get("query")
    endpoint = _get_endpoint(query) if isinstance(query, str) and query else None
    if endpoint:
        # A backtick in the endpoint ends the code span too early.
        parts.append(f"`{_truncate(endpoint.replace('`', "'"))}`")
    window = _as_dict(snapshot.get("analysisWindow"))
    start = _parse_time(window.get("breachStart"))
    end = updated_at.astimezone(UTC) if updated_at else _parse_time(window.get("end"))
    if start and end:
        parts.append(_format_window(start, end))
    return " · ".join(parts) or None


def _get_detail(hypothesis: Mapping[str, Any]) -> str:
    verdict = _as_dict(hypothesis.get("agentVerdict"))
    if verdict:
        return _truncate(str(verdict.get("rationale") or ""))

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


def build_investigation_status(
    *,
    investigation: Investigation,
    projection: Mapping[str, Any] | None,
    updated_at: datetime | None = None,
) -> tuple[SeerInvestigationStatus, str]:
    """Builds the status message data and a fingerprint of what it shows."""
    source = _as_dict(investigation.source)
    raw_hypotheses = [
        hypothesis
        for hypothesis in _as_dict(projection).get("hypotheses") or []
        if isinstance(hypothesis, Mapping)
    ]
    raw_hypotheses.sort(key=lambda hypothesis: hypothesis.get("order", 0))
    raw_hypotheses = raw_hypotheses[:MAX_STATUS_HYPOTHESES]

    hypotheses = []
    fingerprint_hypotheses = []
    for hypothesis in raw_hypotheses:
        label = HYPOTHESIS_LABELS.get(hypothesis.get("effectiveStatus", ""), VERIFYING_LABEL)
        statement = _truncate(str(hypothesis.get("statement") or ""))
        detail = NOT_COMPLETED_DETAIL if label == NOT_COMPLETED_LABEL else _get_detail(hypothesis)
        hypotheses.append(
            SeerInvestigationHypothesis(statement=statement, label=label, detail=detail)
        )
        fingerprint_hypotheses.append(
            [hypothesis.get("id"), hypothesis.get("generation"), statement, label, detail]
        )

    data = SeerInvestigationStatus(
        organization_id=investigation.organization_id,
        title=get_status_title(source),
        subtitle=get_status_subtitle(source, updated_at),
        investigation_url=investigation.get_absolute_url(),
        hypotheses=hypotheses,
    )
    fingerprint = hashlib.sha256(
        orjson.dumps([data.title, data.subtitle, fingerprint_hypotheses])
    ).hexdigest()
    return data, fingerprint

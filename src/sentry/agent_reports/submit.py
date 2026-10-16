from __future__ import annotations

import hashlib
import logging
import re
import time
from dataclasses import dataclass
from typing import Any, TypedDict
from uuid import UUID, uuid4

import sentry_sdk
from django.conf import settings
from sentry_sdk.envelope import Envelope, Item, PayloadRef

from sentry.utils import metrics

logger = logging.getLogger(__name__)

# Stay under feedback.message.max-size (4096) after ingest checks the raw message.
_MAX_FEEDBACK_MESSAGE = 4000

_AREA_OWNERS = {
    "mcp": "agent-interfaces",
    "api": "api",
    "documentation": "docs",
}

# Order matters: specific token shapes run before the generic token assignment.
_SECRET_PATTERNS = (
    re.compile(r"sntrys_[A-Za-z0-9_\-]+", re.IGNORECASE),
    re.compile(r"sntryu_[A-Za-z0-9_\-]+", re.IGNORECASE),
    re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]+"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]+"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._\-+/=]+"),
    re.compile(r"(?i)\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*\S+"),
    re.compile(r"\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b", re.IGNORECASE),
)


@dataclass(frozen=True)
class SubmittedAgentProblemReport:
    id: str
    delivered: bool


class _ScrubbedReport(TypedDict):
    summary: str
    expected: str
    observed: str
    reproduction_steps: list[str]
    tool_name: str
    api_endpoint: str
    documentation_url: str
    request_id: str
    event_id: str
    additional_context: str


def scrub_report_text(value: str) -> str:
    scrubbed = value
    for pattern in _SECRET_PATTERNS:
        scrubbed = pattern.sub("[redacted]", scrubbed)
    return scrubbed


def compose_feedback_message(
    *,
    area: str,
    summary: str,
    expected: str,
    observed: str,
    reproduction_steps: list[str],
    tool_name: str,
    api_endpoint: str,
    documentation_url: str,
    request_id: str,
    event_id: str,
    additional_context: str,
) -> str:
    lines = [
        f"[{area}] {summary}",
        "",
        "Expected:",
        expected,
        "",
        "Observed:",
        observed,
    ]
    if reproduction_steps:
        lines.extend(["", "Steps:"])
        lines.extend(f"{index}. {step}" for index, step in enumerate(reproduction_steps, start=1))
    details = [
        ("Tool", tool_name),
        ("Endpoint", api_endpoint),
        ("Documentation", documentation_url),
        ("Request ID", request_id),
        ("Event ID", event_id),
    ]
    detail_lines = [f"{label}: {value}" for label, value in details if value]
    if detail_lines:
        lines.extend(["", *detail_lines])
    if additional_context:
        lines.extend(["", "Context:", additional_context])

    message = "\n".join(lines)
    if len(message) <= _MAX_FEEDBACK_MESSAGE:
        return message
    return message[: _MAX_FEEDBACK_MESSAGE - 12].rstrip() + "\n[truncated]"


def submit_agent_problem_report(
    *,
    reporter_id: int,
    reporter_email: str,
    reporter_name: str,
    reporter_username: str,
    user_agent: str,
    area: str,
    summary: str,
    expected: str,
    observed: str,
    reproduction_steps: list[str],
    tool_name: str,
    api_endpoint: str,
    documentation_url: str,
    request_id: str,
    event_id: str,
    additional_context: str,
) -> SubmittedAgentProblemReport:
    """Send one agent report as a User Feedback envelope on the backend SDK client."""
    scrubbed: _ScrubbedReport = {
        "summary": scrub_report_text(summary),
        "expected": scrub_report_text(expected),
        "observed": scrub_report_text(observed),
        "reproduction_steps": [scrub_report_text(step) for step in reproduction_steps],
        "tool_name": scrub_report_text(tool_name),
        "api_endpoint": scrub_report_text(api_endpoint),
        "documentation_url": scrub_report_text(documentation_url),
        "request_id": scrub_report_text(request_id),
        "event_id": scrub_report_text(event_id),
        "additional_context": scrub_report_text(additional_context),
    }
    message = compose_feedback_message(area=area, **scrubbed)
    report_id = uuid4().hex
    dedup_key = hashlib.sha256(f"{area}\n{scrubbed['summary'].casefold()}".encode()).hexdigest()[
        :16
    ]
    feedback: dict[str, Any] = {
        "message": message,
        "source": "agent_problem_report",
    }
    if reporter_email:
        feedback["contact_email"] = reporter_email
    if reporter_name:
        feedback["name"] = reporter_name
    if documentation_url:
        feedback["url"] = scrubbed["documentation_url"]
    associated_event_id = _associated_event_id(scrubbed["event_id"])
    if associated_event_id:
        feedback["associated_event_id"] = associated_event_id

    user: dict[str, Any] = {"id": str(reporter_id)}
    if reporter_email:
        user["email"] = reporter_email
    if reporter_username:
        user["username"] = reporter_username
    if reporter_name:
        user["name"] = reporter_name

    payload: dict[str, Any] = {
        "type": "feedback",
        "event_id": report_id,
        "timestamp": time.time(),
        "platform": "python",
        "level": "info",
        "environment": settings.ENVIRONMENT,
        "release": settings.SENTRY_SDK_CONFIG.get("release"),
        "contexts": {
            "feedback": feedback,
            "agent_report": {
                "area": area,
                "tool_name": scrubbed["tool_name"],
                "api_endpoint": scrubbed["api_endpoint"],
                "documentation_url": scrubbed["documentation_url"],
                "request_id": scrubbed["request_id"],
                "event_id": scrubbed["event_id"],
                "user_agent": user_agent[:300],
                # Feedback issues are fingerprinted per submission. This key lets
                # reviewers group repeats without collapsing them into one issue.
                "dedup_key": dedup_key,
            },
        },
        "tags": {
            "feedback.source": "agent-problem-report",
            "feedback.area": area,
            "feedback.owner": _AREA_OWNERS[area],
        },
        "user": user,
    }
    envelope = Envelope(headers={"event_id": report_id})
    envelope.add_item(Item(payload=PayloadRef(json=payload), type="feedback"))

    delivered = _capture_feedback_envelope(envelope)
    metrics.incr(
        "agent_problem_report.submitted",
        tags={"area": area, "delivered": "true" if delivered else "false"},
    )
    log_extra = {
        "report_id": report_id,
        "area": area,
        "user_id": reporter_id,
        "delivered": delivered,
    }
    if delivered:
        logger.info("agent_problem_report.submitted", extra=log_extra)
    else:
        logger.info("agent_problem_report.not_delivered", extra=log_extra)
    return SubmittedAgentProblemReport(id=report_id, delivered=delivered)


def _associated_event_id(event_id: str) -> str | None:
    if not event_id or "[redacted]" in event_id:
        return None
    try:
        return UUID(event_id).hex
    except ValueError:
        return None


def _capture_feedback_envelope(envelope: Envelope) -> bool:
    client = sentry_sdk.get_client()
    transport = client.transport
    if transport is None or not client.is_active():
        return False
    transport.capture_envelope(envelope)
    return True

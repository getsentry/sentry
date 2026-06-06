"""Prototype post-process detection for maliciously crafted error issues.

This runs after grouping and durable event storage, so accepted-event quota has already been
consumed. The goal is to archive clear prompt-injection issues before they are surfaced through
notifications, webhooks, or other post-process fanout.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal, TypedDict, cast

from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry import features, options
from sentry.models.group import Group, GroupStatus
from sentry.models.groupinbox import GroupInboxRemoveAction, remove_group_from_inbox
from sentry.options.rollout import in_rollout_group
from sentry.seer.seer_setup import has_seer_access
from sentry.seer.signed_seer_api import (
    MaliciousIssueDetectionRequest,
    SeerViewerContext,
    make_malicious_issue_detection_request,
)
from sentry.services.eventstore.models import GroupEvent
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.utils import json, metrics
from sentry.utils.safe import safe_execute

logger = logging.getLogger(__name__)

Classification = Literal["yes", "no"]

MALICIOUS_ISSUE_DETECTION_FEATURE = "organizations:malicious-issue-detection"
MAX_CONTEXT_LENGTH = 4000

PROMPT_INJECTION_TERMS = (
    "ignore previous",
    "ignore all previous",
    "system prompt",
    "developer message",
    "no code fix",
    "no-code fix",
    "coding agent",
    "automated agent",
    "agent instructions",
)

RISKY_COMMAND_TERMS = (
    "npm install",
    "npx ",
    "pnpm add",
    "yarn add",
    "curl ",
    "wget ",
    "nslookup ",
    "bash -c",
    "powershell",
)

COMMAND_INJECTION_MARKERS = (
    "$(",
    "`",
    "||",
    "${ifs}",
    ";(",
    "&(",
    "|(",
)

DANGEROUS_ACTION_TERMS = (
    "environment variable",
    "environment variables",
    "env contents",
    ".env",
    "api key",
    "credentials",
    "postinstall",
    "token",
    "secret",
    "telemetry",
    "exfiltrate",
)

GENERIC_CONTEXT_VALUES = {
    "error",
    "unknown error",
    "<unlabeled event>",
    "generic",
    "other",
}


class MaliciousIssueClassification(TypedDict):
    classification: Classification
    reason: str


@dataclass(frozen=True)
class MaliciousIssueDetectionResult:
    classification: Classification | None
    archived: bool = False
    skipped_reason: str | None = None


def detect_and_archive_malicious_issue(
    event: GroupEvent,
    *,
    is_new: bool,
    is_reprocessed: bool,
) -> MaliciousIssueDetectionResult:
    group = event.group
    if group is None:
        return _skip("missing_group")

    if not is_new:
        return _skip("not_new")

    if is_reprocessed:
        return _skip("reprocessed")

    if not group.is_unresolved():
        return _skip("not_unresolved")

    organization = event.project.organization
    if not features.has(MALICIOUS_ISSUE_DETECTION_FEATURE, organization):
        return _skip("feature_disabled")

    if not has_seer_access(organization):
        return _skip("seer_unavailable")

    if not _is_in_sample(group):
        return _skip("sample_rate")

    context = build_issue_context(event)
    if not context:
        return _skip("empty_context")

    if not contains_suspicious_indicators(context):
        return _skip("heuristic_filtered")

    classification = classify_issue_context(
        context, organization_id=organization.id, project_id=event.project_id
    )

    metrics.incr(
        "malicious_issue_detection.classified",
        tags={"classification": classification["classification"]},
    )

    if classification["classification"] != "yes":
        return MaliciousIssueDetectionResult(classification=classification["classification"])

    archive_group_forever(group)
    logger.info(
        "malicious_issue_detection.archived",
        extra={
            "group_id": group.id,
            "project_id": group.project_id,
            "organization_id": group.project.organization_id,
        },
    )
    metrics.incr("malicious_issue_detection.archived")
    return MaliciousIssueDetectionResult(classification="yes", archived=True)


def build_issue_context(event: GroupEvent) -> str:
    group = event.group
    parts: list[str] = []

    def append(label: str, value: object | None, *, skip_generic: bool = True) -> None:
        if value is None:
            return
        value_str = str(value).strip()
        if skip_generic and value_str.lower() in GENERIC_CONTEXT_VALUES:
            return
        if value_str:
            parts.append(f"{label}: {value_str}")

    if group is not None:
        append("Issue title", group.title)
        append("Issue message", group.message)
        append("Culprit", group.culprit)

    append("Event title", event.title)
    append("Event message", event.message)
    append("Search message", event.search_message)

    metadata = event.get_event_metadata()
    for key in ("type", "value", "title", "filename", "function"):
        append(f"Metadata {key}", metadata.get(key))

    occurrence = getattr(event, "occurrence", None)
    if occurrence is not None:
        append("Occurrence title", occurrence.issue_title)
        append("Occurrence subtitle", occurrence.subtitle)
        for key, value in occurrence.evidence_data.items():
            append(f"Occurrence evidence {key}", value)

    interface_parts = []
    for interface in event.interfaces.values():
        output = safe_execute(interface.to_string, event)
        if output:
            interface_parts.append(output)
    append("Event details", "\n\n".join(interface_parts))

    context = "\n".join(dict.fromkeys(parts))
    return context[:MAX_CONTEXT_LENGTH]


def contains_suspicious_indicators(context: str) -> bool:
    normalized = context.lower()
    if any(term in normalized for term in PROMPT_INJECTION_TERMS):
        return True

    if ("curl " in normalized or "wget " in normalized) and (
        "| bash" in normalized or "| sh" in normalized or "bash -c" in normalized
    ):
        return True

    if "nslookup " in normalized and ("curl " in normalized or "wget " in normalized):
        return any(marker in normalized for marker in COMMAND_INJECTION_MARKERS)

    has_risky_command = any(term in normalized for term in RISKY_COMMAND_TERMS)
    has_dangerous_action = any(term in normalized for term in DANGEROUS_ACTION_TERMS)
    return has_risky_command and has_dangerous_action


def classify_issue_context(
    context: str,
    *,
    organization_id: int,
    project_id: int,
) -> MaliciousIssueClassification:
    body = MaliciousIssueDetectionRequest(
        organization_id=organization_id,
        project_id=project_id,
        issue_context=context,
    )

    try:
        response = make_malicious_issue_detection_request(
            body,
            timeout=options.get("malicious-issue-detection.seer-timeout"),
            viewer_context=SeerViewerContext(organization_id=organization_id),
        )
    except (TimeoutError, MaxRetryError) as error:
        logger.warning(
            "malicious_issue_detection.seer_request_error",
            extra={"error": type(error).__name__, "organization_id": organization_id},
        )
        metrics.incr(
            "malicious_issue_detection.error",
            tags={"reason": "request_error", "error": type(error).__name__},
        )
        return {"classification": "no", "reason": "seer request failed"}
    except Exception:
        logger.exception("malicious_issue_detection.seer_request_failed")
        metrics.incr("malicious_issue_detection.error", tags={"reason": "request_failed"})
        return {"classification": "no", "reason": "seer request failed"}

    if response.status >= 400:
        logger.warning(
            "malicious_issue_detection.seer_error_response",
            extra={
                "status_code": response.status,
                "organization_id": organization_id,
            },
        )
        metrics.incr("malicious_issue_detection.error", tags={"reason": "bad_status"})
        return {"classification": "no", "reason": "seer request failed"}

    try:
        classification = _parse_seer_classification(response.json())
    except (AttributeError, TypeError, ValueError, json.JSONDecodeError):
        logger.warning(
            "malicious_issue_detection.invalid_response",
            extra={"organization_id": organization_id},
            exc_info=True,
        )
        metrics.incr("malicious_issue_detection.error", tags={"reason": "invalid_response"})
        return {"classification": "no", "reason": "invalid seer response"}

    return classification


def _parse_seer_classification(data: object) -> MaliciousIssueClassification:
    if not isinstance(data, dict):
        raise ValueError("response content was not an object")

    classification = data.get("classification")
    reason = data.get("reason")
    if classification not in ("yes", "no") or not isinstance(reason, str):
        raise ValueError("invalid classification shape")

    return {"classification": cast(Classification, classification), "reason": reason}


def archive_group_forever(group: Group) -> None:
    Group.objects.update_group_status(
        groups=[group],
        status=GroupStatus.IGNORED,
        substatus=GroupSubStatus.FOREVER,
        activity_type=ActivityType.SET_IGNORED,
        activity_data={"ignoreReason": "malicious_issue_detection"},
        send_activity_notification=False,
    )
    group.status = GroupStatus.IGNORED
    group.substatus = GroupSubStatus.FOREVER
    remove_group_from_inbox(group, action=GroupInboxRemoveAction.IGNORED)


def _is_in_sample(group: Group) -> bool:
    return in_rollout_group(
        "malicious-issue-detection.sample-rate",
        f"{group.project_id}:{group.id}",
    )


def _skip(reason: str) -> MaliciousIssueDetectionResult:
    metrics.incr("malicious_issue_detection.skipped", tags={"reason": reason})
    return MaliciousIssueDetectionResult(classification=None, skipped_reason=reason)

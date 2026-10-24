from __future__ import annotations

import logging
from typing import Any, TypedDict

from sentry import features
from sentry.models.group import Group
from sentry.seer.oneshot import run_oneshot
from sentry.seer.seer_setup import has_seer_access
from sentry.services.eventstore.models import GroupEvent
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils.safe import safe_execute

logger = logging.getLogger(__name__)

MAX_CONTEXT_LENGTH = 2000


def _build_event_context(group: Group, event: Any | None = None) -> str:
    if event is None:
        event = group.get_latest_event()
    title = group.title or ""
    culprit = group.culprit or ""

    body_parts: list[str] = []
    if event:
        for interface in event.interfaces.values():
            output = safe_execute(interface.to_string, event)
            if output:
                body_parts.append(output)

    event_body = "\n\n".join(body_parts)

    context = f"Error Title: {title}"
    if culprit:
        context += f"\nCulprit: {culprit}"
    if event_body:
        context += f"\nDetails:\n{event_body}"

    if len(context) > MAX_CONTEXT_LENGTH:
        context = context[:MAX_CONTEXT_LENGTH]

    return context


class GeneratedExternalIssueDetails(TypedDict):
    title: str | None
    description: str | None


def _make_generate_external_issue_details_request(
    group: Group, event: Any | None = None, user_id: int | None = None
) -> GeneratedExternalIssueDetails | None:
    context = _build_event_context(group, event=event)
    result = run_oneshot(
        "external_issue_details",
        {"context": context},
        group.organization,
        user_id=user_id,
        timeout=10,
    )
    title = result.get("title")
    description = result.get("description")
    if isinstance(title, str) and isinstance(description, str) and title and description:
        return {"title": title.strip(), "description": description.strip()}

    logger.warning(
        "external_issues.invalid_shape",
        extra={"group_id": group.id, "title": title, "description": description},
    )
    return None


def maybe_generate_external_issue_details(
    *, group: Group, user: User | RpcUser, event: GroupEvent | None = None
) -> GeneratedExternalIssueDetails:
    organization = group.organization
    empty_result = GeneratedExternalIssueDetails(title=None, description=None)
    if not has_seer_access(organization):
        return empty_result
    if not features.has("organizations:external-issues-ai-generate", organization, actor=user):
        return empty_result

    try:
        result = _make_generate_external_issue_details_request(group, event=event, user_id=user.id)
    except Exception:
        logger.error("external_issues.generate_issue_details_failed", exc_info=True)
        return empty_result

    if not result:
        return empty_result

    return result

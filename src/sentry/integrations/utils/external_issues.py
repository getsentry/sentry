from __future__ import annotations

import logging
from typing import Any, TypedDict

from sentry import features
from sentry.models.group import Group
from sentry.seer.signed_seer_api import (
    LlmGenerateRequest,
    SeerViewerContext,
    make_llm_generate_request,
)
from sentry.services.eventstore.models import GroupEvent
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils import json
from sentry.utils.safe import safe_execute

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a helpful assistant that generates concise titles and descriptions for issue tickets in external project management tools like Jira, GitHub Issues, and Linear.

Given information about a Sentry error (title and stack trace / error details), generate:
1. A short, actionable title (3-8 words) suitable for a ticket. Describe the problem clearly.
2. A brief description (1-3 sentences) summarizing the error, its likely cause, and potential impact.

Do not include Sentry-specific formatting, links, or markdown. Keep the description in plain text.
Return a JSON object with "title" and "description" keys. Return only the JSON, nothing else."""

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
    group: Group, event: Any | None = None, viewer_context: SeerViewerContext | None = None
) -> GeneratedExternalIssueDetails | None:
    logging_ctx: dict[str, Any] = {"group_id": group.id, "viewer_context": viewer_context}
    context = _build_event_context(group, event=event)

    body = LlmGenerateRequest(
        provider="gemini",
        model="flash",
        referrer="sentry.external-issue.details-generate",
        prompt=f"Generate a title and description for this Sentry error:\n\n{context}",
        system_prompt=SYSTEM_PROMPT,
        temperature=0.3,
        max_tokens=750,
        response_schema={
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "description": {"type": "string"},
            },
            "required": ["title", "description"],
        },
    )
    response = make_llm_generate_request(body, timeout=10, viewer_context=viewer_context)
    logging_ctx["status_code"] = response.status
    if response.status >= 400:
        logger.warning("external_issues.seer_request_failed", extra=logging_ctx)
        return None

    try:
        data = response.json()
    except (json.JSONDecodeError, ValueError):
        logger.warning(
            "external_issues.seer_response_json_failed", extra=logging_ctx, exc_info=True
        )
        return None
    content = data.get("content")
    try:
        content = json.loads(content)
    except (json.JSONDecodeError, TypeError, ValueError):
        logger.warning(
            "external_issues.seer_response_parse_failed", extra=logging_ctx, exc_info=True
        )
        return None

    title = content.get("title")
    description = content.get("description")
    if title and description:
        return {"title": title.strip(), "description": description.strip()}

    logging_ctx["title"] = title
    logging_ctx["description"] = description
    logger.warning("external_issues.invalid_shape", extra=logging_ctx)
    return None


def maybe_generate_external_issue_details(
    *, group: Group, user: User | RpcUser, event: GroupEvent | None = None
) -> GeneratedExternalIssueDetails:
    organization = group.organization
    empty_result = GeneratedExternalIssueDetails(title=None, description=None)
    if not features.has("organizations:gen-ai-features", organization, actor=user):
        return empty_result
    if organization.get_option("sentry:hide_ai_features", False):
        return empty_result
    if not features.has("organizations:external-issues-ai-generate", organization, actor=user):
        return empty_result

    try:
        viewer_context = SeerViewerContext(organization_id=organization.id, user_id=user.id)
        result = _make_generate_external_issue_details_request(
            group, event=event, viewer_context=viewer_context
        )
    except Exception:
        logger.error("external_issues.generate_issue_details_failed", exc_info=True)
        return empty_result

    if not result:
        return empty_result

    return result

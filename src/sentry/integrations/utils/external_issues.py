from __future__ import annotations

import logging
from typing import NamedTuple

from sentry import features
from sentry.models.group import Group
from sentry.seer.signed_seer_api import (
    LlmGenerateRequest,
    SeerViewerContext,
    make_llm_generate_request,
)
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils.safe import safe_execute

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a helpful assistant that generates concise titles and descriptions for issue tickets in external project management tools like Jira, GitHub Issues, and Linear.

Given information about a Sentry error (title and stack trace / error details), generate:
1. A short, actionable title (5-10 words) suitable for a ticket. Describe the problem clearly.
2. A brief description (2-4 sentences) summarizing the error, its likely cause, and potential impact.

Do not include Sentry-specific formatting, links, or markdown. Keep the description in plain text.
Return a JSON object with "title" and "description" keys. Return only the JSON, nothing else."""

MAX_CONTEXT_LENGTH = 2000


def _build_event_context(group: Group) -> str:
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


def _make_generate_external_issue_details_request(
    group: Group, viewer_context: SeerViewerContext | None = None
) -> dict[str, str] | None:
    context = _build_event_context(group)

    body = LlmGenerateRequest(
        provider="gemini",
        model="flash",
        referrer="sentry.external-issue.description-generate",
        prompt=f"Generate a title and description for this Sentry error:\n\n{context}",
        system_prompt=SYSTEM_PROMPT,
        temperature=0.3,
        max_tokens=300,
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
    if response.status >= 400:
        return None
    data = response.json()
    content = data.get("content")
    if not content or not isinstance(content, dict):
        return None

    title = content.get("title")
    description = content.get("description")
    if title and description:
        return {"title": title.strip(), "description": description.strip()}

    return None


class GeneratedIssueDetails(NamedTuple):
    title: str | None = None
    description: str | None = None


def generate_external_issue_details(group: Group, user: User | RpcUser) -> GeneratedIssueDetails:
    organization = group.organization
    if organization.get_option("sentry:hide_ai_features", False):
        return GeneratedIssueDetails()
    if not features.has("organizations:external-issues-ai-generate", organization, actor=user):
        return GeneratedIssueDetails()

    try:
        viewer_context = SeerViewerContext(organization_id=organization.id, user_id=user.id)
        result = _make_generate_external_issue_details_request(group, viewer_context=viewer_context)
    except Exception:
        logger.exception("Failed to generate AI text for external issue")
        return GeneratedIssueDetails()

    if not result:
        return GeneratedIssueDetails()

    title: str | None = result.get("title")
    description: str | None = result.get("description")
    return GeneratedIssueDetails(title=title, description=description)

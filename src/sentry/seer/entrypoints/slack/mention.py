from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from sentry.integrations.slack.unfurl.handlers import match_link
from sentry.integrations.slack.unfurl.types import LinkType


@dataclass(frozen=True)
class IssueLink:
    group_id: int
    event_id: str | None = None


# Slack formats URLs as <URL|label> or <URL>
_SLACK_URL_RE = re.compile(r"<(https?://[^|>]+)(?:\|[^>]*)?>")


def extract_prompt(text: str, bot_user_id: str) -> str:
    """Remove the bot mention from text to get the user's clean prompt.

    Slack app_mention events include ``<@BOT_ID>`` in the text.  We only
    strip the bot's own mention — other user mentions are preserved as
    they may provide useful context for Seer.
    """
    cleaned = re.sub(rf"<@{re.escape(bot_user_id)}>", "", text).strip()
    # Collapse multiple spaces left by mention removal
    return re.sub(r" {2,}", " ", cleaned)


def extract_issue_links(text: str) -> list[IssueLink]:
    """Extract Sentry issue links from Slack message text."""
    urls = _SLACK_URL_RE.findall(text)
    results: list[IssueLink] = []
    seen_group_ids: set[int] = set()

    for url in urls:
        link_type, args = match_link(url)
        if link_type == LinkType.ISSUES and args is not None:
            group_id: int = args["issue_id"]
            if group_id not in seen_group_ids:
                seen_group_ids.add(group_id)
                results.append(IssueLink(group_id=group_id, event_id=args.get("event_id")))

    return results


def _extract_rich_text_element_text(element: Mapping[str, Any]) -> str:
    """Extract text from a single rich_text sub-element (text, link, user, channel, etc.)."""
    elem_type = element.get("type")
    if elem_type == "text":
        return element.get("text", "")
    if elem_type == "link":
        url = element.get("url", "")
        label = element.get("text", "")
        return f"<{url}|{label}>" if label else f"<{url}>"
    if elem_type == "user":
        return f"<@{element.get('user_id', '')}>"
    if elem_type == "channel":
        return f"<#{element.get('channel_id', '')}>"
    if elem_type == "emoji":
        return f":{element.get('name', '')}:"
    if elem_type == "broadcast":
        return f"@{element.get('range', 'here')}"
    return ""


def _extract_block_text(block: Mapping[str, Any]) -> str:
    """Extract readable text from a single Slack Block Kit block."""
    block_type = block.get("type")

    if block_type == "rich_text":
        parts: list[str] = []
        for container in block.get("elements", []):
            if not isinstance(container, dict):
                continue
            container_parts = [
                _extract_rich_text_element_text(el) for el in container.get("elements", [])
            ]
            parts.append("".join(container_parts))
        return "\n".join(parts)

    if block_type == "section":
        section_parts: list[str] = []
        text_obj = block.get("text")
        if isinstance(text_obj, dict):
            section_parts.append(text_obj.get("text", ""))
        for field in block.get("fields", []):
            if isinstance(field, dict):
                section_parts.append(field.get("text", ""))
        return "\n".join(part for part in section_parts if part)

    if block_type == "context":
        return " ".join(
            el.get("text", "")
            for el in block.get("elements", [])
            if isinstance(el, dict) and el.get("type") in ("mrkdwn", "plain_text")
        )

    if block_type in ("header", "markdown"):
        text_obj = block.get("text")
        if isinstance(text_obj, dict):
            return text_obj.get("text", "")
        if isinstance(text_obj, str):
            return text_obj

    return ""


def _extract_text_from_blocks(blocks: Sequence[Mapping[str, Any]]) -> str:
    """Extract readable text from a list of Slack Block Kit blocks."""
    parts = [_extract_block_text(block) for block in blocks]
    return "\n".join(part for part in parts if part)


def _extract_attachment_text(attachment: Mapping[str, Any]) -> str:
    """Extract readable text from a single legacy/secondary message attachment.

    Slack attachments may either be modern (containing a nested ``blocks``
    array) or legacy (using fields like ``pretext``/``title``/``text``/
    ``fields``). See:
    https://docs.slack.dev/legacy/legacy-messaging/legacy-secondary-message-attachments/
    """
    # Attachments may have blocks inside them, if so, it's not using the legacy attachments
    blocks = attachment.get("blocks")
    if blocks:
        block_text = _extract_text_from_blocks(blocks)
        if block_text:
            return block_text

    parts: list[str] = []

    if pretext := attachment.get("pretext", ""):
        parts.append(pretext)

    if title := attachment.get("title", ""):
        title_link = attachment.get("title_link")
        parts.append(f"<{title_link}|{title}>" if title_link else title)

    if text := attachment.get("text", ""):
        parts.append(text)

    for field in attachment.get("fields", []):
        if not isinstance(field, dict):
            continue
        field_title = field.get("title", "")
        field_value = field.get("value", "")
        if field_title and field_value:
            parts.append(f"{field_title}: {field_value}")
        elif field_value:
            parts.append(field_value)

    if parts:
        return "\n".join(parts)

    return attachment.get("fallback", "")


def _extract_text_from_attachments(attachments: Sequence[Mapping[str, Any]]) -> str:
    """Extract readable text from a list of legacy/secondary attachments."""
    parts: list[str] = []
    for attachment in attachments:
        if not isinstance(attachment, dict):
            continue
        if attachment_text := _extract_attachment_text(attachment):
            parts.append(attachment_text)
    return "\n".join(parts)


def build_thread_context(messages: Sequence[Mapping[str, Any]]) -> str:
    """Build a context string from thread history for Seer Agent."""
    if not messages:
        return ""

    parts: list[str] = []
    for msg in messages:
        user = msg.get("user", "unknown")

        text_parts: list[str] = []
        if blocks := msg.get("blocks"):
            if block_text := _extract_text_from_blocks(blocks):
                text_parts.append(block_text)

        if not text_parts and (top_level_text := msg.get("text", "")):
            text_parts.append(top_level_text)

        if attachments := msg.get("attachments"):
            if attachment_text := _extract_text_from_attachments(attachments):
                text_parts.append(attachment_text)

        if not text_parts:
            continue
        text = "\n".join(text_parts)
        parts.append(f"<@{user}>: {text}")

    return "\n".join(parts)

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


def build_thread_context(messages: Sequence[Mapping[str, Any]]) -> str:
    """Build a context string from thread history for Seer Explorer."""
    if not messages:
        return ""

    parts: list[str] = []
    for msg in messages:
        user = msg.get("user", "unknown")

        text = ""
        blocks = msg.get("blocks")
        if blocks:
            text = _extract_text_from_blocks(blocks)

        if not text:
            text = msg.get("text", "")

        if not text:
            continue
        parts.append(f"<@{user}>: {text}")

    return "\n".join(parts)

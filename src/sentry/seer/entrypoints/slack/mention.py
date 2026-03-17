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


def build_thread_context(messages: Sequence[Mapping[str, Any]]) -> str:
    """Build a context string from thread history for Seer Explorer."""
    if not messages:
        return ""

    parts: list[str] = []
    for msg in messages:
        user = msg.get("user", "unknown")
        text = msg.get("text", "")
        if not text:
            continue
        parts.append(f"<@{user}>: {text}")

    return "\n".join(parts)

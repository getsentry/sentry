from __future__ import annotations

import html
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qs, urlsplit

import orjson

from sentry.integrations.slack.unfurl.handlers import match_link
from sentry.integrations.slack.unfurl.types import LinkType
from sentry.models.group import Group
from sentry.models.organization import Organization


@dataclass(frozen=True)
class IssueLink:
    group_id: int
    event_id: str | None = None


@dataclass(frozen=True)
class SlackMessageLink:
    channel_id: str
    ts: str
    thread_ts: str | None = None


# Slack formats URLs as <URL|label> or <URL>
_SLACK_URL_RE = re.compile(r"<(https?://[^|>]+)(?:\|[^>]*)?>")

# Slack message permalinks: https://workspace.slack.com/archives/<channel>/p<ts>[?thread_ts=...]
# The "p" is a literal Slack convention; the timestamp follows as
# <10 digits seconds><6 digits microseconds>, with the dot stripped.
_SLACK_PERMALINK_PATH_RE = re.compile(
    r"^/archives/(?P<channel>[CGD][A-Z0-9]+)/p(?P<ts_seconds>\d{10})(?P<ts_micros>\d{6})$"
)

# Cap how many linked messages we will fetch per prompt to bound API + token cost.
_MAX_LINKED_MESSAGES = 5

_ANY_MENTION_RE = re.compile(r"<@[^>]+>")

# Slack link syntax: <https://url|label>, <https://url>, <mailto:addr|label>
_SLACK_LINK_RE = re.compile(r"<((?:https?|mailto):[^|>]+)(?:\|([^>]*))?>")

# Bounds the extra DB lookups and keeps alert-heavy threads from flooding the context.
_MAX_REFERENCED_ISSUES = 3


def has_prompt_content(text: str) -> bool:
    """Whether the text holds anything beyond Slack mentions and whitespace.

    Takes no bot_user_id: Slack omits `authorizations` in some cases, and
    `extract_prompt` strips nothing when the id is missing.
    """
    return bool(_ANY_MENTION_RE.sub("", text).strip())


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


def _parse_slack_permalink(url: str, expected_host: str | None) -> SlackMessageLink | None:
    """Return a ``SlackMessageLink`` if ``url`` is a Slack message permalink we can act on."""
    parsed = urlsplit(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc.endswith(".slack.com"):
        return None
    if expected_host is not None and parsed.netloc != expected_host:
        return None

    match = _SLACK_PERMALINK_PATH_RE.match(parsed.path)
    if not match:
        return None

    ts = f"{match.group('ts_seconds')}.{match.group('ts_micros')}"

    thread_ts: str | None = None
    if parsed.query and (thread_ts_values := parse_qs(parsed.query).get("thread_ts")):
        thread_ts = thread_ts_values[0]

    return SlackMessageLink(
        channel_id=match.group("channel"),
        ts=ts,
        thread_ts=thread_ts,
    )


def find_message_in_attachments(
    link: SlackMessageLink,
    attachments: Sequence[Mapping[str, Any]] | None,
) -> Mapping[str, Any] | None:
    """Return a Slack-message-shaped dict if ``attachments`` contains the
    auto-unfurl that Slack generates when a permalink is shared.

    The shape mirrors what ``conversations.replies`` returns so callers can
    feed it to ``build_thread_context``.
    """
    if not attachments:
        return None

    for attachment in attachments:
        if not isinstance(attachment, dict):
            continue
        if attachment.get("channel_id") != link.channel_id:
            continue
        if attachment.get("ts") != link.ts:
            continue
        return {
            "user": attachment.get("author_id", ""),
            "ts": attachment.get("ts", ""),
            "text": _extract_attachment_text(attachment),
        }

    return None


def extract_slack_message_links(
    text: str,
    *,
    domain_name: str | None = None,
) -> list[SlackMessageLink]:
    """Extract Slack message permalinks from a Slack message's mrkdwn text.

    ``domain_name`` is the integration's stored workspace host (e.g.
    ``"acme.slack.com"``).  When provided, links pointing at any other
    workspace are skipped as the bot's token can't read them.

    if ``domain_name`` is not proivded, we return an empty list.

    Results are deduped by ``(channel_id, ts)`` and capped at
    ``_MAX_LINKED_MESSAGES`` to bound API and token cost.
    """
    if domain_name is None:
        return []

    results: list[SlackMessageLink] = []
    seen: set[tuple[str, str]] = set()

    for url in _SLACK_URL_RE.findall(text):
        link = _parse_slack_permalink(url, domain_name)
        if link is None:
            continue
        key = (link.channel_id, link.ts)
        if key in seen:
            continue
        seen.add(key)
        results.append(link)
        if len(results) >= _MAX_LINKED_MESSAGES:
            break

    return results


def _extract_rich_text_element_text(element: Mapping[str, Any]) -> str:
    """Extract text from a single rich_text sub-element (text, link, user, channel, etc.)."""
    elem_type = element.get("type")
    if elem_type == "text":
        text = element.get("text", "")
        return text
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
            text = text_obj.get("text", "")
            return text
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

    Slack message-unfurl attachments embed the source message's Block Kit content in
    ``message_blocks[0].message.blocks`` - we prefer that over the flat
    ``text`` fallback so links/mentions/formatting are preserved.
    """
    message_blocks = attachment.get("message_blocks") or []
    if message_blocks and isinstance(message_blocks[0], dict):
        inner = message_blocks[0].get("message", {})
        if isinstance(inner, dict) and (inner_blocks := inner.get("blocks")):
            if block_text := _extract_text_from_blocks(inner_blocks):
                return block_text

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

    fallback = attachment.get("fallback", "")
    return fallback


def _extract_text_from_attachments(attachments: Sequence[Mapping[str, Any]]) -> str:
    """Extract readable text from a list of legacy/secondary attachments."""
    parts: list[str] = []
    for attachment in attachments:
        if not isinstance(attachment, dict):
            continue
        if attachment_text := _extract_attachment_text(attachment):
            parts.append(attachment_text)
    return "\n".join(parts)


def _extract_message_text(msg: Mapping[str, Any]) -> str:
    text_parts: list[str] = []
    if blocks := msg.get("blocks"):
        if block_text := _extract_text_from_blocks(blocks):
            text_parts.append(block_text)

    if not text_parts and (top_level_text := msg.get("text", "")):
        text_parts.append(top_level_text)

    if attachments := msg.get("attachments"):
        if attachment_text := _extract_text_from_attachments(attachments):
            text_parts.append(attachment_text)

    return "\n".join(text_parts)


def _slack_link_to_markdown(match: re.Match[str]) -> str:
    url, label = match.group(1), match.group(2)
    if url.startswith("mailto:"):
        return label or url.removeprefix("mailto:")
    if not label or label == url:
        return url
    return f"[{label}]({url})"


def _slack_mrkdwn_to_text(text: str, bot_user_id: str | None) -> str:
    """Make Slack mrkdwn readable for the model: markdown links, no HTML entities.

    Slack escapes ``&``, ``<`` and ``>`` in message text, so links have to be
    converted before the entities are unescaped.
    """
    if bot_user_id:
        text = text.replace(f"<@{bot_user_id}>", "@Sentry")
    text = _SLACK_LINK_RE.sub(_slack_link_to_markdown, text)
    return html.unescape(text)


def _alert_issue_ids(msg: Mapping[str, Any]) -> list[int]:
    """Group ids that Sentry wrote into the ``block_id`` of an issue alert's blocks."""
    issue_ids: list[int] = []
    for block in msg.get("blocks") or []:
        block_id = block.get("block_id") if isinstance(block, dict) else None
        if not isinstance(block_id, str) or not block_id.startswith("{"):
            continue
        try:
            payload = orjson.loads(block_id)
        except orjson.JSONDecodeError:
            continue
        issue_id = payload.get("issue") if isinstance(payload, dict) else None
        if isinstance(issue_id, int):
            issue_ids.append(issue_id)
    return issue_ids


def _is_seer_reply(msg: Mapping[str, Any]) -> bool:
    # Seer's Slack replies are rendered with a leading MarkdownBlock; alerts and
    # other notifications use section blocks or attachments.
    blocks = msg.get("blocks") or []
    return bool(blocks) and isinstance(blocks[0], dict) and blocks[0].get("type") == "markdown"


def _is_own_message(msg: Mapping[str, Any], bot_user_id: str | None) -> bool:
    return bot_user_id is not None and msg.get("user") == bot_user_id


def extract_alert_issue_ids(
    messages: Sequence[Mapping[str, Any]], *, bot_user_id: str | None
) -> list[int]:
    """Deduped group ids from the alert metadata of messages our Slack app posted.

    Only the app's own messages are read: anyone can post a message with a
    crafted ``block_id``.
    """
    issue_ids = (
        issue_id
        for msg in messages
        if _is_own_message(msg, bot_user_id)
        for issue_id in _alert_issue_ids(msg)
    )
    return list(dict.fromkeys(issue_ids))


def build_referenced_issues_context(*, organization: Organization, issue_ids: Sequence[int]) -> str:
    """List the alerted issues that belong to ``organization`` by their identifiers only.

    Titles and other user-controlled text are left out on purpose; the agent
    can fetch the issue itself.
    """
    issue_ids = list(issue_ids)[:_MAX_REFERENCED_ISSUES]
    if not issue_ids:
        return ""

    groups_by_id = {
        group.id: group
        for group in Group.objects.filter(
            id__in=issue_ids, project__organization_id=organization.id
        ).select_related("project")
    }
    lines: list[str] = []
    for issue_id in issue_ids:
        group = groups_by_id.get(issue_id)
        if group is None:
            continue
        group.project.set_cached_field_value("organization", organization)
        lines.append(
            f"- org: {organization.slug}, issue_id: {group.id}, "
            f"short_id: {group.qualified_short_id}, project: {group.project.slug}, "
            f"category: {group.issue_category.name.lower()}, url: {group.get_absolute_url()}"
        )
    if not lines:
        return ""

    header = (
        "Sentry issues referenced by alerts in this Slack thread. Sentry resolved these "
        "from the alert metadata, not from the message text, and all of them are in the "
        f"connected organization ({organization.slug}):"
    )
    return "\n".join([header, *lines])


def build_thread_context(
    messages: Sequence[Mapping[str, Any]],
    *,
    bot_user_id: str | None = None,
    include_own_replies: bool = True,
) -> str:
    """Build a context string from thread history for Seer Agent.

    Messages posted by our Slack app (``bot_user_id``) are Sentry issue alerts,
    recognized by their alert metadata, Seer's own earlier replies, which start
    with a ``markdown`` block, or other Sentry notifications such as metric
    alerts. ``include_own_replies=False`` drops Seer's replies, for runs whose
    history already holds them.
    """
    if not messages:
        return ""

    parts: list[str] = []
    for msg in messages:
        if _is_own_message(msg, bot_user_id):
            if _alert_issue_ids(msg):
                author = "Sentry alert"
            elif not _is_seer_reply(msg):
                author = "Sentry notification"
            elif include_own_replies:
                author = "Sentry (you), earlier reply"
            else:
                continue
        else:
            author = f"User <@{msg.get('user', 'unknown')}>"

        if text := _extract_message_text(msg):
            parts.append(f"{author}: {_slack_mrkdwn_to_text(text, bot_user_id)}")

    return "\n".join(parts)


def extract_thread_text(messages: Sequence[Mapping[str, Any]]) -> str:
    """The raw Slack mrkdwn of every message, for scanning links in Slack's ``<url|label>`` syntax."""
    return "\n".join(text for msg in messages if (text := _extract_message_text(msg)))


def build_linked_messages_context(
    blocks: Sequence[tuple[SlackMessageLink, Sequence[Mapping[str, Any]]]],
    *,
    bot_user_id: str | None = None,
) -> str:
    """Render messages fetched from Slack permalinks into a Seer context block.

    Each ``(link, messages)`` pair becomes a labeled section:

        User linked a Slack message in <#C123>:
        User <@U456>: ...

    Empty message lists (fetch failed / scope missing) are skipped.
    """
    sections: list[str] = []
    for link, messages in blocks:
        body = build_thread_context(messages, bot_user_id=bot_user_id)
        if not body:
            continue
        sections.append(f"User linked a Slack message in <#{link.channel_id}>:\n{body}")
    return "\n\n".join(sections)

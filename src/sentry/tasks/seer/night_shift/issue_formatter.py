"""
Issue formatter for the Night Shift agentic triage tool.

Triage-tuned: renders the fields from Seer's `get_issue_details` that actually
move the verdict — header (title/culprit/priority/counts/first-last seen),
aggregated tag distribution, and recent human activity. The latest-event
stacktrace excerpt is intentionally omitted so the agent is steered toward
`get_event_details_agentic_triage` (which exposes the full stack, locals on
the first in-app frame, and linked repos).
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any


def format_issue_output(details: Mapping[str, Any]) -> str:
    """Render Seer's `get_issue_details` response as markdown for triage."""
    issue = details.get("issue") or {}
    tags_overview = details.get("tags_overview") or {}
    activity = details.get("user_activity") or []

    sections = [
        _format_header(issue),
        _format_tags(tags_overview),
        _format_activity(activity),
    ]
    return "\n\n".join(s for s in sections if s) + "\n"


def _format_header(issue: Mapping[str, Any]) -> str:
    short_id = issue.get("shortId") or "(no short id)"
    title = issue.get("title") or "Unknown"
    lines = [f"# {short_id}: {title}"]

    culprit = issue.get("culprit")
    if culprit:
        lines.append(f"**Culprit:** `{culprit}`")

    issue_type = issue.get("issueType")
    issue_category = issue.get("issueCategory")
    type_desc = issue.get("issueTypeDescription")
    type_parts = [p for p in (issue_type, issue_category) if p]
    if type_parts:
        suffix = f" — {type_desc}" if type_desc else ""
        lines.append(f"**Type:** {' / '.join(type_parts)}{suffix}")

    status_bits = [
        ("Level", issue.get("level")),
        ("Priority", issue.get("priority")),
        ("Status", issue.get("status")),
        ("Substatus", issue.get("substatus")),
    ]
    status_line = " | ".join(f"**{k}:** {v}" for k, v in status_bits if v)
    if status_line:
        lines.append(status_line)

    first_seen = issue.get("firstSeen")
    last_seen = issue.get("lastSeen")
    if first_seen or last_seen:
        seen_bits = []
        if first_seen:
            seen_bits.append(f"**First seen:** {first_seen}")
        if last_seen:
            seen_bits.append(f"**Last seen:** {last_seen}")
        lines.append(" | ".join(seen_bits))

    count = issue.get("count")
    user_count = issue.get("userCount")
    count_bits = []
    if count is not None:
        count_bits.append(f"**Events:** {count}")
    if user_count is not None:
        count_bits.append(f"**Users affected:** {user_count}")
    if count_bits:
        lines.append(" | ".join(count_bits))

    assigned_to = issue.get("assignedTo")
    assignee = _format_actor(assigned_to) if assigned_to else None
    if assignee:
        lines.append(f"**Assigned to:** {assignee}")

    platform = issue.get("platform")
    if platform:
        lines.append(f"**Platform:** {platform}")

    return "\n".join(lines)


def _format_tags(tags_overview: Mapping[str, Any]) -> str:
    # Seer returns {"tags_overview": [...tags...]} under the response's
    # "tags_overview" key — unwrap the inner list.
    inner = tags_overview.get("tags_overview") if isinstance(tags_overview, Mapping) else None
    if not isinstance(inner, Sequence) or not inner:
        return ""

    blocks = []
    for tag in inner:
        if not isinstance(tag, Mapping):
            continue
        key = tag.get("key")
        if not key:
            continue
        name = tag.get("name") or key
        total = tag.get("total_values")
        unique = tag.get("unique_values")

        meta_bits = []
        if total is not None:
            meta_bits.append(f"{total} total")
        if unique is not None:
            meta_bits.append(f"{unique} unique")
        meta = f" ({', '.join(meta_bits)})" if meta_bits else ""

        header = f"**{name}** (`{key}`){meta}" if name != key else f"**{key}**{meta}"

        top_values = tag.get("top_values") or []
        value_lines = []
        for tv in top_values:
            if not isinstance(tv, Mapping):
                continue
            value = tv.get("value")
            count = tv.get("count")
            pct = tv.get("percentage")
            pct_str = f" ({pct})" if pct is not None else ""
            count_str = f" — {count}" if count is not None else ""
            value_lines.append(f"- {value}{count_str}{pct_str}")

        if not value_lines:
            continue
        blocks.append(header + "\n" + "\n".join(value_lines))

    if not blocks:
        return ""
    return "## Tag Distribution\n\n" + "\n\n".join(blocks)


def _format_activity(activity: Sequence[Any]) -> str:
    if not activity:
        return ""

    lines = []
    for item in activity:
        if not isinstance(item, Mapping):
            continue
        when = item.get("dateCreated")
        actor = _format_actor(item.get("user")) or _format_actor(item.get("sentry_app")) or "system"
        type_ = item.get("type") or "activity"
        detail = _summarize_activity_data(item.get("data"))
        when_str = f"{when} — " if when else ""
        detail_str = f": {detail}" if detail else ""
        lines.append(f"- {when_str}{actor} ({type_}){detail_str}")

    if not lines:
        return ""
    return "## Recent Activity\n\n" + "\n".join(lines)


def _format_actor(actor: Any) -> str | None:
    if not isinstance(actor, Mapping):
        return None
    for key in ("email", "username", "name"):
        value = actor.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def _summarize_activity_data(data: Any) -> str:
    if not isinstance(data, Mapping) or not data:
        return ""
    preferred_keys = (
        "text",
        "assignee",
        "assigneeEmail",
        "version",
        "commit",
        "pullRequest",
    )
    for key in preferred_keys:
        value = data.get(key)
        if isinstance(value, str) and value:
            return f"{key}={value}"
        if isinstance(value, Mapping):
            nested = value.get("id") or value.get("shortId") or value.get("title")
            if nested:
                return f"{key}={nested}"
    return ""

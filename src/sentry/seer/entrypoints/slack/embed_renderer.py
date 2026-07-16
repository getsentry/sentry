"""Slack-specific rendering of Seer embed tags as Block Kit elements.

Consumes the provider-agnostic token stream from
``sentry.seer.agent.embed_parser`` and converts it to Slack Block Kit
blocks: ``MarkdownBlock`` for plain markdown, ``RichTextBlock`` for
paragraphs with inline embeds (native Slack ``Date``/``Link`` parts).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from slack_sdk.models.blocks import (
    Block,
    MarkdownBlock,
    RichTextBlock,
    RichTextElementParts,
    RichTextSectionElement,
)
from slack_sdk.models.blocks.block_elements import RichTextElement

from sentry.seer.agent.embed_parser import has_embed_tags, tokenize

# ---------------------------------------------------------------------------
# Inline tag → RichText element converters
# ---------------------------------------------------------------------------


def _timestamp_elements(attrs: dict[str, str], _data: Any) -> list[RichTextElement]:
    value = attrs.get("value", "")
    fmt = attrs.get("format", "absolute")
    try:
        dt = datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return [RichTextElementParts.Text(text=value or "(invalid date)")]

    unix_ts = int(dt.replace(tzinfo=dt.tzinfo or timezone.utc).timestamp())
    if fmt == "relative":
        return [RichTextElementParts.Date(timestamp=unix_ts, format="{ago}", fallback=value)]
    fallback = dt.strftime("%b %d, %Y at %I:%M %p")
    return [
        RichTextElementParts.Date(
            timestamp=unix_ts, format="{date_short} at {time}", fallback=fallback
        )
    ]


def _docs_elements(attrs: dict[str, str], _data: Any) -> list[RichTextElement]:
    href = attrs.get("href", "")
    title = attrs.get("title", href)
    if href:
        return [RichTextElementParts.Link(url=href, text=title)]
    return [RichTextElementParts.Text(text=title)]


def _fallback_elements(attrs: dict[str, str], _data: Any) -> list[RichTextElement]:
    for key in ("value", "title", "href"):
        if key in attrs:
            return [RichTextElementParts.Text(text=attrs[key])]
    return []


_INLINE_CONVERTERS: dict[str, Any] = {
    "timestamp": _timestamp_elements,
    "docs": _docs_elements,
}


def _tag_to_rich_text_elements(tag_attrs: dict[str, Any]) -> list[RichTextElement]:
    name = tag_attrs["name"]
    converter = _INLINE_CONVERTERS.get(name, _fallback_elements)
    return converter(tag_attrs["attrs"], tag_attrs.get("data"))


# ---------------------------------------------------------------------------
# Token stream → Block Kit blocks
# ---------------------------------------------------------------------------


def _build_rich_text_block(children: list[dict[str, Any]]) -> RichTextBlock:
    elements: list[RichTextElement] = []
    for child in children:
        if child["type"] == "seer_tag":
            elements.extend(_tag_to_rich_text_elements(child["attrs"]))
        else:
            raw = child.get("raw", "")
            if raw:
                elements.append(RichTextElementParts.Text(text=raw))
    return RichTextBlock(elements=[RichTextSectionElement(elements=elements)])


def render_agent_summary(summary: str) -> list[Block]:
    """Convert an agent response summary to Slack Block Kit blocks.

    Paragraphs without tags pass through as ``MarkdownBlock``. Paragraphs
    with inline embeds become ``RichTextBlock`` with native Slack elements
    (localized dates, clickable links). Block-level tags (thinking,
    tool-use) will map to ``PlanBlock`` in the future — for now they're
    stripped.

    Falls back to a single ``MarkdownBlock`` when no tags are present.
    """
    tokens = tokenize(summary)

    if not has_embed_tags(tokens):
        return [MarkdownBlock(text=summary)]

    blocks: list[Block] = []
    md_buffer: list[str] = []

    def flush_md() -> None:
        if md_buffer:
            blocks.append(MarkdownBlock(text="\n\n".join(md_buffer)))
            md_buffer.clear()

    for tok in tokens:
        match tok["type"]:
            case "paragraph_with_tags":
                flush_md()
                blocks.append(_build_rich_text_block(tok["children"]))

            case "seer_tag":
                pass

            case "paragraph":
                md_buffer.append(tok.get("text", "").strip())

            case "heading":
                level = tok.get("attrs", {}).get("level", 2)
                prefix = "#" * level
                md_buffer.append(f"{prefix} {tok.get('text', '')}")

            case "block_code":
                info = tok.get("attrs", {}).get("info", "")
                lang = info.split()[0] if info else ""
                code = tok.get("raw", tok.get("text", ""))
                md_buffer.append(f"```{lang}\n{code}```")

            case "list":
                md_buffer.append(tok.get("raw", tok.get("text", "")))

            case "block_quote":
                md_buffer.append(tok.get("raw", tok.get("text", "")))

            case "thematic_break":
                md_buffer.append("---")

            case "blank_line":
                pass

            case _:
                raw = tok.get("raw", tok.get("text", ""))
                if raw and raw.strip():
                    md_buffer.append(raw.strip())

    flush_md()
    return blocks

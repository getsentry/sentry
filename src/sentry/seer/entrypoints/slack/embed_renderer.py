"""Convert Seer agent response markdown (with embed tags) to Slack Block Kit blocks.

Uses mistune for markdown-aware tokenization — code fences, paragraph boundaries,
and heading detection come from the parser, not hand-rolled regex. A custom plugin
adds ``{% tag %}`` awareness at both block and inline levels, mirroring the
frontend tokenizer grammar in ``static/app/utils/marked/extensions/tag.ts``.

The output is a list of Slack Block Kit blocks ready for ``SlackRenderable``:
- Plain markdown paragraphs → ``MarkdownBlock``
- Paragraphs with inline embeds (timestamp, docs) → ``RichTextBlock``
- Block-level embeds (thinking, tool-use) → ``PlanBlock`` / ``TaskCardBlock``
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

import mistune
from mistune.core import BlockState
from slack_sdk.models.blocks import (
    Block,
    MarkdownBlock,
    RichTextBlock,
    RichTextElementParts,
    RichTextSectionElement,
)
from slack_sdk.models.blocks.block_elements import RichTextElement

from sentry.utils import json

# ---------------------------------------------------------------------------
# Mistune plugin: Seer embed tag grammar
# ---------------------------------------------------------------------------

_ATTRS_PAT = r'(?:\s+[\w-]+="[^"]*")*'
_BLOCK_TAG = (
    rf"\{{%\s+(?P<bt_name>[\w-]+)(?P<bt_attrs>{_ATTRS_PAT})"
    rf"\s+%\}}(?P<bt_body>[\s\S]*?)\{{%\s+/(?P=bt_name)\s+%\}}"
)
_SELF_CLOSING_TAG = rf"\{{%\s+(?P<sc_name>[\w-]+)(?P<sc_attrs>{_ATTRS_PAT})\s+/%\}}"
_ATTR_RE = re.compile(r'([\w-]+)="([^"]*)"')

_BLOCK_PATTERN = rf"^ {{0,3}}(?:{_BLOCK_TAG}|{_SELF_CLOSING_TAG}) *(?:\n|$)"
_INLINE_PATTERN = rf"(?:{_BLOCK_TAG}|{_SELF_CLOSING_TAG})"


def _parse_attrs(raw: str) -> dict[str, str]:
    return dict(_ATTR_RE.findall(raw or ""))


def _parse_body(body: str | None) -> Any:
    if not body:
        return None
    try:
        return json.loads(body)
    except (json.JSONDecodeError, TypeError):
        return body.strip() or None


def _extract_tag_fields(m: re.Match[str]) -> dict[str, Any]:
    name = m.group("bt_name") or m.group("sc_name")
    attr_str = m.group("bt_attrs") or m.group("sc_attrs") or ""
    body = m.group("bt_body") if m.group("bt_name") else None
    return {"name": name, "attrs": _parse_attrs(attr_str), "data": _parse_body(body)}


def _handle_block_tag(block: mistune.BlockParser, m: re.Match[str], state: BlockState) -> int:
    fields = _extract_tag_fields(m)
    state.append_token(
        {"type": "seer_tag", "raw": m.group(0), "attrs": {**fields, "level": "block"}}
    )
    return m.end()


def _handle_inline_tag(inline: mistune.InlineParser, m: re.Match[str], state: Any) -> int:
    fields = _extract_tag_fields(m)
    state.append_token(
        {"type": "seer_tag", "raw": m.group(0), "attrs": {**fields, "level": "inline"}}
    )
    return m.end()


def _build_parsers() -> tuple[mistune.BlockParser, mistune.InlineParser]:
    bp = mistune.BlockParser()
    ip = mistune.InlineParser()
    bp.register("seer_tag", _BLOCK_PATTERN, _handle_block_tag, before="paragraph")
    ip.register("seer_tag", _INLINE_PATTERN, _handle_inline_tag, before="linebreak")
    return bp, ip


# ---------------------------------------------------------------------------
# Tokenizer
# ---------------------------------------------------------------------------


def _tokenize(text: str) -> list[dict[str, Any]]:
    """Parse *text* into block-level tokens with inline tag splitting."""
    bp, ip = _build_parsers()

    state = BlockState()
    state.process(text)
    bp.parse(state)

    result: list[dict[str, Any]] = []
    for tok in state.tokens:
        if tok["type"] == "paragraph" and "{%" in tok.get("text", ""):
            children = ip(tok["text"].strip(), state.env)
            result.append({"type": "paragraph_with_tags", "raw": tok["text"], "children": children})
        else:
            result.append(tok)
    return result


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


_INLINE_CONVERTERS: dict[
    str,
    Any,
] = {
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


def _rebuild_paragraph_markdown(raw: str) -> str:
    """Reconstruct a paragraph's raw text, stripping only the tag syntax."""
    return raw


def render_agent_summary(summary: str) -> list[Block]:
    """Convert an agent response summary to Slack Block Kit blocks.

    Paragraphs without tags pass through as ``MarkdownBlock``. Paragraphs with
    inline embeds become ``RichTextBlock`` with native Slack elements (localized
    dates, clickable links). Block-level tags (thinking, tool-use) will map to
    ``PlanBlock`` in the future — for now they're stripped.

    Falls back to a single ``MarkdownBlock`` when no tags are present at all.
    """
    tokens = _tokenize(summary)

    has_any_tags = any(tok["type"] in ("seer_tag", "paragraph_with_tags") for tok in tokens)
    if not has_any_tags:
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
                # Block-level tags (thinking, tool-use, summary) — PlanBlock
                # support will go here. For now, strip them.
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

"""Parse Seer embed tags from agent response markdown.

Uses mistune for markdown-aware tokenization — code fences, paragraph
boundaries, and heading detection come from the parser, not hand-rolled
regex. A custom plugin adds ``{% tag %}`` awareness at both block and
inline levels, mirroring the frontend tokenizer grammar in
``static/app/utils/marked/extensions/tag.ts``.

This module is provider-agnostic. It produces a token stream that
platform-specific renderers (Slack, email, Discord, etc.) consume to
build native output.
"""

from __future__ import annotations

import re
from typing import Any

import mistune
from mistune.core import BlockState

from sentry.utils import json

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


def tokenize(text: str) -> list[dict[str, Any]]:
    """Parse *text* into block-level tokens with inline tag splitting.

    Returns a list of mistune tokens. Paragraphs that contain embed tags
    are emitted as ``paragraph_with_tags`` with a ``children`` list of
    inline tokens (text and ``seer_tag`` alternating). All other token
    types pass through unchanged from mistune's block parser.
    """
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


def has_embed_tags(tokens: list[dict[str, Any]]) -> bool:
    """Return whether any tokens contain Seer embed tags."""
    return any(tok["type"] in ("seer_tag", "paragraph_with_tags") for tok in tokens)

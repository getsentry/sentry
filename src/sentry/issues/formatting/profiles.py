"""Profiles + the public ``format_issue`` entry point.

A profile pairs an ordered section list with a limits preset. For now there is one base
profile that renders the full set of event sections under default limits. Consumer-specific
presets (e.g. tighter limits for Seer, issue aggregates for MCP) are added when those
consumers are migrated; they are internal only and never exposed on the public API.

``format_issue`` is the single entry point shared by every consumer (REST mixin, RPC,
import): serialized event -> adapter -> model -> formatter, so all paths produce identical
output.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any, Literal, NamedTuple

from sentry.issues.formatting.adapter import event_response_to_model
from sentry.issues.formatting.formatter import Formatter, MarkdownFormatter, SectionFn, XmlFormatter
from sentry.issues.formatting.limits import LIMITS_DEFAULT, Limits
from sentry.issues.formatting.sections import (
    breadcrumbs_section,
    exceptions_section,
    message_section,
    request_section,
    spans_section,
    tags_section,
    threads_section,
    title_section,
    user_section,
)

Format = Literal["markdown", "xml"]

_FORMATTERS: dict[Format, type[Formatter]] = {
    "markdown": MarkdownFormatter,
    "xml": XmlFormatter,
}

# base event sections in render order
EVENT_SECTIONS: list[SectionFn] = [
    title_section,
    message_section,
    exceptions_section,
    threads_section,
    spans_section,
    breadcrumbs_section,
    request_section,
    tags_section,
    user_section,
]


class Profile(NamedTuple):
    sections: Sequence[SectionFn]
    limits: Limits


# base profile: everything an event carries, default limits
DEFAULT_PROFILE = Profile(EVENT_SECTIONS, LIMITS_DEFAULT)


def format_issue(
    data: Mapping[str, Any],
    *,
    format: Format = "markdown",
    profile: Profile = DEFAULT_PROFILE,
) -> str:
    """Render a serialized event into text. The single path used by every consumer."""
    try:
        formatter_cls = _FORMATTERS[format]
    except KeyError:
        raise ValueError(f"unsupported format: {format!r}")

    model = event_response_to_model(data)
    return formatter_cls().render(model, profile.sections, profile.limits)

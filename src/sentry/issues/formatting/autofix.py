"""Builds the sections for a serialized autofix (Seer Issue Fix) state response, reusing the
shared formatter. Delivered over REST via ``FormattableResponseMixin`` on the autofix endpoint.
Like the event sections, these describe what to render and let the formatter decide how.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry.issues.formatting.formatter import (
    Consumer,
    Field,
    Format,
    Group,
    Section,
    Text,
    get_formatter,
)


def _artifacts(autofix: Mapping[str, Any]) -> dict[str, Any]:
    """Latest data per artifact key across the run's blocks (later wins), mirroring
    ``SeerRunState.get_artifacts()``. Keys we render: ``root_cause``, ``solution``.
    """
    result: dict[str, Any] = {}
    for block in autofix.get("blocks") or []:
        for artifact in block.get("artifacts") or []:
            result[artifact["key"]] = artifact.get("data")
    return result


def _root_cause(data: Any) -> Section | None:
    if not data:
        return None
    groups: list[Group] = []
    if data.get("one_line_description"):
        groups.append(Group(items=(Text(data["one_line_description"]),)))
    whys = data.get("five_whys") or []
    if whys:
        groups.append(
            Group(items=(Text("\n".join(f"{i}. {why}" for i, why in enumerate(whys, 1))),))
        )
    steps = data.get("reproduction_steps") or []
    if steps:
        groups.append(Group(items=(Text("\n".join(f"- {step}" for step in steps)),)))
    return Section(title="Root Cause", groups=tuple(groups)) if groups else None


def _solution(data: Any) -> Section | None:
    if not data:
        return None
    groups: list[Group] = []
    if data.get("one_line_summary"):
        groups.append(Group(items=(Text(data["one_line_summary"]),)))
    steps = tuple(
        Field(step.get("title") or "Step", step.get("description") or "")
        for step in data.get("steps") or []
    )
    if steps:
        groups.append(Group(items=steps))
    return Section(title="Solution", groups=tuple(groups)) if groups else None


def _pull_requests(autofix: Mapping[str, Any]) -> Section | None:
    lines = tuple(
        Text(f"- {repo}: {pr['pr_url']}")
        for repo, pr in (autofix.get("repo_pr_states") or {}).items()
        if pr.get("pr_url")
    )
    return Section(title="Pull Requests", groups=(Group(items=lines),)) if lines else None


def format_autofix(
    data: Mapping[str, Any], format: Format = "markdown", consumer: Consumer = "ui"
) -> str:
    """Render a serialized autofix state response (``{"autofix": {...}}``) into text or JSON.

    Takes ``consumer`` to satisfy the adapter signature; the autofix body is the same for the UI
    and for API clients, so nothing varies on it yet.
    """
    fmt = get_formatter(format)
    autofix = data.get("autofix")
    if not autofix:  # no autofix run on this issue yet
        # empty still has to parse: "" for the text formats, "{}" for json
        return fmt.join([])
    artifacts = _artifacts(autofix)
    sections = [
        _root_cause(artifacts.get("root_cause")),
        _solution(artifacts.get("solution")),
        _pull_requests(autofix),
    ]
    rendered = [fmt.render_section(s) for s in sections if s is not None]
    return fmt.join([part for part in rendered if part])

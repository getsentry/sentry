"""Renders a serialized autofix (Seer Issue Fix) state response into text, reusing the shared
formatter primitives. Delivered over REST via ``FormattableResponseMixin`` on the autofix endpoint.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry.issues.formatting.formatter import Format, Formatter, get_formatter


def _artifacts(autofix: Mapping[str, Any]) -> dict[str, Any]:
    """Latest data per artifact key across the run's blocks (later wins), mirroring
    ``SeerRunState.get_artifacts()``. Keys we render: ``root_cause``, ``solution``.
    """
    result: dict[str, Any] = {}
    for block in autofix.get("blocks") or []:
        for artifact in block.get("artifacts") or []:
            result[artifact["key"]] = artifact.get("data")
    return result


def _root_cause(data: Any, fmt: Formatter) -> str:
    if not data:
        return ""
    parts: list[str] = []
    if data.get("one_line_description"):
        parts.append(data["one_line_description"])
    whys = data.get("five_whys") or []
    if whys:
        parts.append("\n".join(f"{i}. {why}" for i, why in enumerate(whys, 1)))
    steps = data.get("reproduction_steps") or []
    if steps:
        parts.append("\n".join(f"- {step}" for step in steps))
    return fmt.block("Root Cause", "\n\n".join(parts)) if parts else ""


def _solution(data: Any, fmt: Formatter) -> str:
    if not data:
        return ""
    parts: list[str] = []
    if data.get("one_line_summary"):
        parts.append(data["one_line_summary"])
    steps = [
        fmt.field(step.get("title") or "Step", step.get("description") or "")
        for step in data.get("steps") or []
    ]
    if steps:
        parts.append("\n".join(steps))
    return fmt.block("Solution", "\n\n".join(parts)) if parts else ""


def _pull_requests(autofix: Mapping[str, Any], fmt: Formatter) -> str:
    lines = [
        f"- {repo}: {pr['pr_url']}"
        for repo, pr in (autofix.get("repo_pr_states") or {}).items()
        if pr.get("pr_url")
    ]
    return fmt.block("Pull Requests", "\n".join(lines)) if lines else ""


def format_autofix(data: Mapping[str, Any], format: Format = "markdown") -> str:
    """Render a serialized autofix state response (``{"autofix": {...}}``) into text."""
    autofix = data.get("autofix")
    if not autofix:  # no autofix run on this issue yet
        return ""
    fmt = get_formatter(format)
    artifacts = _artifacts(autofix)
    parts = [
        _root_cause(artifacts.get("root_cause"), fmt),
        _solution(artifacts.get("solution"), fmt),
        _pull_requests(autofix, fmt),
    ]
    return "\n\n".join(part for part in parts if part)

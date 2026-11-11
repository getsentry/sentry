"""Builds the sections for a serialized autofix (Seer Issue Fix) state response, reusing the
shared formatter. Delivered over REST via ``FormattableResponseMixin`` on the autofix endpoint.
Like the event sections, these describe what to render and let the formatter decide how.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry.issues.formatting.formatter import (
    Code,
    Consumer,
    Field,
    Format,
    Group,
    MarkdownFormatter,
    Section,
    Text,
    get_formatter,
)
from sentry.seer.autofix.single_run import SINGLE_RUN_ROOT_CAUSE_KEY

_MAX_CODE_CHANGES_CHARS = 20_000


def _artifacts(autofix: Mapping[str, Any]) -> dict[str, Any]:
    """Latest data per artifact key across the run's blocks (later wins), mirroring
    ``SeerRunState.get_artifacts()``.
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


def _single_run_root_cause(data: Any) -> Section | None:
    if not data:
        return None
    items = tuple(Text(data[key]) for key in ("headline", "cause") if data.get(key))
    return Section(title="Root Cause", groups=(Group(items=items),)) if items else None


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


def _file_patches(autofix: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Latest merged patch per file, mirroring ``SeerRunState.get_diffs_by_repo()``."""
    latest: dict[tuple[str, str], dict[str, Any]] = {}
    for block in autofix.get("blocks") or []:
        for file_patch in block.get("merged_file_patches") or []:
            latest[(file_patch["repo_name"], file_patch["patch"]["path"])] = file_patch
    return [
        {
            "repo_name": file_patch["repo_name"],
            "path": file_patch["patch"]["path"],
            "type": file_patch["patch"].get("type"),
            "added": file_patch["patch"].get("added", 0),
            "removed": file_patch["patch"].get("removed", 0),
            "diff": file_patch.get("diff") or "",
        }
        for file_patch in latest.values()
    ]


def _code_changes(patches: list[dict[str, Any]]) -> Section | None:
    groups = tuple(
        Group(
            items=(
                Text(f"{p['repo_name']}: {p['path']} (+{p['added']} -{p['removed']})"),
                *((Code(p["diff"]),) if p["diff"] else ()),
            )
        )
        for p in patches
    )
    if not groups:
        return None
    return Section(title="Code Changes", groups=groups, max_group_chars=_MAX_CODE_CHANGES_CHARS)


def _pull_request_states(autofix: Mapping[str, Any]) -> list[dict[str, Any]]:
    return [
        {"repo_name": repo, "pr_url": pr["pr_url"], "pr_number": pr.get("pr_number")}
        for repo, pr in (autofix.get("repo_pr_states") or {}).items()
        if pr.get("pr_url")
    ]


def _pull_requests(prs: list[dict[str, Any]]) -> Section | None:
    lines = tuple(Text(f"- {pr['repo_name']}: {pr['pr_url']}") for pr in prs)
    return Section(title="Pull Requests", groups=(Group(items=lines),)) if lines else None


def _result_sections(autofix: Mapping[str, Any]) -> list[tuple[str, Section, Any]]:
    artifacts = _artifacts(autofix)
    if artifacts.get("root_cause"):
        root_cause = artifacts["root_cause"]
        root_cause_section = _root_cause(root_cause)
    else:
        root_cause = artifacts.get(SINGLE_RUN_ROOT_CAUSE_KEY)
        root_cause_section = _single_run_root_cause(root_cause)
    patches = _file_patches(autofix)
    prs = _pull_request_states(autofix)
    sections = [
        ("root_cause", root_cause_section, root_cause),
        ("solution", _solution(artifacts.get("solution")), artifacts.get("solution")),
        ("code_changes", _code_changes(patches), patches),
        ("pull_requests", _pull_requests(prs), prs),
    ]
    return [(kind, section, data) for kind, section, data in sections if section is not None]


def autofix_results(autofix: Mapping[str, Any]) -> list[dict[str, Any]]:
    """What a run produced, as typed entries any reader can show without knowing the type."""
    markdown = MarkdownFormatter()
    return [
        {
            "type": kind,
            "title": section.title,
            "markdown": markdown.render_body(section),
            "data": data,
        }
        for kind, section, data in _result_sections(autofix)
    ]


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
    rendered = [fmt.render_section(section) for _, section, _ in _result_sections(autofix)]
    return fmt.join([part for part in rendered if part])

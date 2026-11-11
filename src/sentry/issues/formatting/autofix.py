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
    Section,
    Text,
    get_formatter,
)
from sentry.seer.agent.client_models import AgentFilePatch, SeerRunState
from sentry.seer.autofix.single_run import SINGLE_RUN_ROOT_CAUSE_KEY

# p99 of 591 file diffs / 199 runs in Seer Autofix PRs (Nov 2026): 7.9k per file, 20.1k per run.
_MAX_DIFF_CHARS = 8_000
_MAX_DIFFS_CHARS = 20_000


def _root_cause(data: Any) -> Section | None:
    if not data:
        return None
    groups: list[Group] = []
    summary = tuple(
        Text(data[key]) for key in ("headline", "one_line_description", "cause") if data.get(key)
    )
    if summary:
        groups.append(Group(items=summary))
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


def _file_change(repo: str, fp: AgentFilePatch, *, show_diff: bool, link: str | None) -> Group:
    header = Text(f"{repo}: {fp.patch.path} (+{fp.patch.added} -{fp.patch.removed})")
    if not fp.diff:
        return Group(items=(header,))
    if show_diff:
        return Group(items=(header, Code(fp.diff)))
    lines = fp.diff.count("\n") + 1
    note = f"Diff not shown ({lines} lines)."
    if link:
        note += f" See the full change: {link}"
    return Group(items=(header, Text(note)))


def _code_changes(state: SeerRunState) -> Section | None:
    pr_urls = {pr.repo_name: pr.pr_url for pr in state.get_created_pull_request_states()}
    budget = _MAX_DIFFS_CHARS
    groups: list[Group] = []
    for repo, patches in state.get_diffs_by_repo().items():
        for fp in patches:
            show_diff = len(fp.diff) <= min(_MAX_DIFF_CHARS, budget)
            if show_diff:
                budget -= len(fp.diff)
            link = pr_urls.get(repo) or fp.code_url
            groups.append(_file_change(repo, fp, show_diff=show_diff, link=link))
    if not groups:
        return None
    return Section(title="Code Changes", groups=tuple(groups), repeating=True)


def _pull_requests(state: SeerRunState) -> Section | None:
    lines = tuple(
        Text(f"- {pr.repo_name}: {pr.pr_url}")
        for pr in state.get_created_pull_request_states()
        if pr.pr_url
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
    state = SeerRunState.parse_obj(autofix)
    artifacts = {key: artifact.data for key, artifact in state.get_artifacts().items()}
    sections = [
        _root_cause(artifacts.get("root_cause") or artifacts.get(SINGLE_RUN_ROOT_CAUSE_KEY)),
        _solution(artifacts.get("solution")),
        _code_changes(state),
        _pull_requests(state),
    ]
    rendered = [fmt.render_section(section) for section in sections if section is not None]
    return fmt.join([part for part in rendered if part])

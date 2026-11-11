"""Builds the sections for a serialized autofix (Seer Issue Fix) state response, reusing the
shared formatter. Delivered over REST via ``FormattableResponseMixin`` on the autofix endpoint.
Like the event sections, these describe what to render and let the formatter decide how.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Literal, TypedDict

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
    truncate,
)
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.single_run import SINGLE_RUN_ROOT_CAUSE_KEY

_MAX_CODE_CHANGES_CHARS = 20_000

AutofixResultType = Literal["root_cause", "solution", "code_changes", "pull_requests"]


class AutofixResult(TypedDict):
    type: AutofixResultType
    title: str
    markdown: str


def _root_cause(data: Any) -> Section | None:
    if not data:
        return None
    groups: list[Group] = []
    summary = tuple(
        Text(data[key]) for key in ("headline", "one_line_description") if data.get(key)
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


def _code_changes(state: SeerRunState) -> Section | None:
    groups = tuple(
        Group(
            items=(
                Text(f"{repo}: {fp.patch.path} (+{fp.patch.added} -{fp.patch.removed})"),
                *((Code(truncate(fp.diff, _MAX_CODE_CHANGES_CHARS)),) if fp.diff else ()),
            )
        )
        for repo, patches in state.get_diffs_by_repo().items()
        for fp in patches
    )
    if not groups:
        return None
    return Section(title="Code Changes", groups=groups, max_group_chars=_MAX_CODE_CHANGES_CHARS)


def _pull_requests(state: SeerRunState) -> Section | None:
    lines = tuple(
        Text(f"- {pr.repo_name}: {pr.pr_url}")
        for pr in state.get_created_pull_request_states()
        if pr.pr_url
    )
    return Section(title="Pull Requests", groups=(Group(items=lines),)) if lines else None


def _result_sections(state: SeerRunState) -> list[tuple[AutofixResultType, Section]]:
    artifacts = {key: artifact.data for key, artifact in state.get_artifacts().items()}
    sections: list[tuple[AutofixResultType, Section | None]] = [
        (
            "root_cause",
            _root_cause(artifacts.get("root_cause"))
            or _single_run_root_cause(artifacts.get(SINGLE_RUN_ROOT_CAUSE_KEY)),
        ),
        ("solution", _solution(artifacts.get("solution"))),
        ("code_changes", _code_changes(state)),
        ("pull_requests", _pull_requests(state)),
    ]
    return [(kind, section) for kind, section in sections if section is not None]


def autofix_results(state: SeerRunState) -> list[AutofixResult]:
    markdown = MarkdownFormatter()
    return [
        AutofixResult(type=kind, title=section.title, markdown=markdown.render_body(section))
        for kind, section in _result_sections(state)
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
    state = SeerRunState.parse_obj(autofix)
    rendered = [fmt.render_section(section) for _, section in _result_sections(state)]
    return fmt.join([part for part in rendered if part])

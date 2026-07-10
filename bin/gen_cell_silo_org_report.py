#!/usr/bin/env python
# flake8: noqa
"""Generate CELL_SILO_ORG_LINKAGE.md.

Enumerates every `@cell_silo_model`-decorated Django model and reports how it
connects to `sentry.Organization` (direct FK, raw `_id` column, or transitive
chain through hub models). Models with no path to Organization are listed in a
separate section.

Run via:
    .venv/bin/sentry exec bin/gen_cell_silo_org_report.py
"""

from __future__ import annotations

import inspect
import os
from collections import deque
from collections.abc import Iterable
from typing import NamedTuple
from pprint import pprint
from sentry.runner import configure

configure()

from sentry.backup.dependencies import (
    ForeignField,
    ForeignFieldKind,
    NormalizedModelName,
    dependencies,
    get_model_name,
)
from sentry.silo.base import SiloMode

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT_PATH = os.path.join(REPO_ROOT, "CELL_SILO_ORG_LINKAGE.md")
ORG_NAME = NormalizedModelName("sentry.organization")


class Hop(NamedTuple):
    from_model: NormalizedModelName
    field: str
    kind: ForeignFieldKind
    to_model: NormalizedModelName


class Row(NamedTuple):
    model_name: NormalizedModelName
    file_path: str
    link_type: str  # "is-organization" | "direct-fk" | "direct-column" | "indirect" | "none"
    chain: list[Hop]


KIND_LABEL = {
    ForeignFieldKind.FlexibleForeignKey: "FlexibleForeignKey",
    ForeignFieldKind.DefaultForeignKey: "ForeignKey",
    ForeignFieldKind.HybridCloudForeignKey: "HybridCloudForeignKey",
    ForeignFieldKind.OneToOneCascadeDeletes: "OneToOneCascadeDeletes",
    ForeignFieldKind.DefaultOneToOneField: "OneToOneField",
    ForeignFieldKind.ImplicitForeignKey: "raw _id column",
}


def relative_source_path(model: type) -> str:
    try:
        src = inspect.getsourcefile(model) or ""
    except TypeError:
        return ""
    if src.startswith(REPO_ROOT + os.sep):
        return src[len(REPO_ROOT) + 1 :]
    return src


def shortest_chain_to_org(
    start: NormalizedModelName,
    deps: dict[NormalizedModelName, object],
) -> list[Hop] | None:
    """BFS from `start` to `sentry.organization`. Returns the hop list or None."""
    if start == ORG_NAME:
        return []

    visited: set[NormalizedModelName] = {start}
    # queue of (current_model, chain_so_far)
    queue: deque[tuple[NormalizedModelName, list[Hop]]] = deque([(start, [])])

    while queue:
        current, chain = queue.popleft()
        relations = deps.get(current)
        if relations is None:
            continue
        # Deterministic order: sort by field name.
        fks: dict[str, ForeignField] = relations.foreign_keys  # type: ignore[attr-defined]
        for field_name in sorted(fks):
            ff = fks[field_name]
            target = get_model_name(ff.model)
            hop = Hop(from_model=current, field=field_name, kind=ff.kind, to_model=target)
            new_chain = chain + [hop]
            if target == ORG_NAME:
                return new_chain
            if target not in visited:
                visited.add(target)
                queue.append((target, new_chain))
    return None


def classify(chain: list[Hop] | None) -> str:
    if chain is None:
        return "none"
    if len(chain) == 0:
        return "is-organization"
    if len(chain) == 1:
        hop = chain[0]
        if hop.kind == ForeignFieldKind.ImplicitForeignKey:
            return "direct-column"
        return "direct-fk"
    return "indirect"


def render_chain(model_name: NormalizedModelName, chain: list[Hop]) -> str:
    if not chain:
        return f"`{model_name}` (root)"
    parts = [f"`{model_name}`"]
    for hop in chain:
        parts.append(f"--[{hop.field} ({KIND_LABEL[hop.kind]})]--> `{hop.to_model}`")
    return " ".join(parts)


def build_rows() -> list[Row]:
    deps = dependencies()
    rows: list[Row] = []
    for model_name, relations in deps.items():
        if SiloMode.CELL not in relations.silos:  # type: ignore[attr-defined]
            continue
        model = relations.model  # type: ignore[attr-defined]
        chain = shortest_chain_to_org(model_name, deps)
        rows.append(
            Row(
                model_name=model_name,
                file_path=relative_source_path(model),
                link_type=classify(chain),
                chain=chain or [],
            )
        )
    rows.sort(key=lambda r: str(r.model_name))
    return rows


### Render Helpers
def render_direct_table(rows: Iterable[Row]) -> str:
    out = [
        "| Model | File | Field | Kind |",
        "| --- | --- | --- | --- |",
    ]
    for r in rows:
        hop = r.chain[0]
        out.append(
            f"| `{r.model_name}` | `{r.file_path}` | `{hop.field}` | {KIND_LABEL[hop.kind]} |"
        )
    return "\n".join(out)


def render_indirect_table(rows: Iterable[Row]) -> str:
    out = [
        "| Model | File | Hops | Chain |",
        "| --- | --- | --- | --- |",
    ]
    for r in rows:
        out.append(
            f"| `{r.model_name}` | `{r.file_path}` | {len(r.chain)} | {render_chain(r.model_name, r.chain)} |"
        )
    return "\n".join(out)


def render_unlinked_table(rows: Iterable[Row]) -> str:
    out = [
        "| Model | File |",
        "| --- | --- |",
    ]
    for r in rows:
        out.append(f"| `{r.model_name}` | `{r.file_path}` |")
    return "\n".join(out)


def render_report(rows: list[Row]) -> str:
    by_type: dict[str, list[Row]] = {
        "is-organization": [],
        "direct-fk": [],
        "direct-column": [],
        "indirect": [],
        "none": [],
    }
    for r in rows:
        by_type[r.link_type].append(r)

    indirect_by_hops: dict[int, list[Row]] = {}
    for r in by_type["indirect"]:
        indirect_by_hops.setdefault(len(r.chain), []).append(r)

    avg_hop = 0.0
    linked = by_type["direct-fk"] + by_type["direct-column"] + by_type["indirect"]
    if linked:
        avg_hop = sum(len(r.chain) for r in linked) / len(linked)

    out: list[str] = []
    out.append("# `@cell_silo_model` models — Organization linkage report")
    out.append("")
    out.append(
        "Auto-generated by `bin/gen_cell_silo_org_report.py`. For every model decorated "
        "with `@cell_silo_model`, this report shows how it reaches `sentry.Organization` "
        "via foreign keys (direct or transitive). Raw `_id` columns that follow the "
        "Sentry convention (e.g. `organization_id` is a `BoundedBigIntegerField` with no "
        "FK constraint) are detected as **implicit** FKs."
    )
    out.append("")
    out.append("## Summary")
    out.append("")
    out.append(f"- Total `@cell_silo_model` models: **{len(rows)}**")
    out.append(f"- `sentry.Organization` itself: **{len(by_type['is-organization'])}**")
    out.append(f"- Direct FK to Organization: **{len(by_type['direct-fk'])}**")
    out.append(f"- Direct raw column (`organization_id` etc.): **{len(by_type['direct-column'])}**")
    out.append(f"- Indirect (chains through other models): **{len(by_type['indirect'])}**")
    out.append(f"- No path to Organization: **{len(by_type['none'])}**")
    if linked:
        out.append(f"- Avg chain length (linked models only): **{avg_hop:.2f}**")
    out.append("")

    if by_type["is-organization"]:
        out.append("## Organization (root)")
        out.append("")
        for r in by_type["is-organization"]:
            out.append(f"- `{r.model_name}` — `{r.file_path}`")
        out.append("")

    if by_type["direct-fk"]:
        out.append("## Direct FK to Organization")
        out.append("")
        out.append(render_direct_table(by_type["direct-fk"]))
        out.append("")

    if by_type["direct-column"]:
        out.append("## Direct raw `_id` column to Organization")
        out.append("")
        out.append(
            "These models reference Organization through a `BoundedBigIntegerField` "
            "named `organization_id` (no FK constraint at the DB level)."
        )
        out.append("")
        out.append(render_direct_table(by_type["direct-column"]))
        out.append("")

    if by_type["indirect"]:
        out.append("## Indirect links")
        out.append("")
        for hops in sorted(indirect_by_hops):
            out.append(f"### {hops}-hop chains")
            out.append("")
            out.append(render_indirect_table(indirect_by_hops[hops]))
            out.append("")

    if by_type["none"]:
        out.append("## Unlinked / global")
        out.append("")
        out.append(
            "Cell-silo models with no path to Organization. These are either global "
            "tables (region-wide), library-style models referenced by org-scoped models "
            "without an inverse pointer, or workflow/feature artifacts that are not "
            "themselves organization-scoped."
        )
        out.append("")
        out.append(render_unlinked_table(by_type["none"]))
        out.append("")

    return "\n".join(out)


def main() -> None:
    rows = build_rows()
    report = render_report(rows)
    # with open(OUTPUT_PATH, "w") as f:
    #     f.write(report)
    # print(f"Wrote {OUTPUT_PATH} ({len(rows)} models)")
    pprint(rows)


if __name__ == "__main__":
    main()

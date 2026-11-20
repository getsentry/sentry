"""Regenerate Seer's nav snapshot from this checkout's frontend source.

    python -m tools.seer_nav.generate_snapshot [--check | --hook]

Seer links users to the Sentry pages listed in the snapshot, so it must change whenever a
nav page is added, renamed, moved or gated differently. Without `--check` it rewrites the
snapshot when its pages or nav summary changed; with `--check` it writes nothing and exits 1
if stale. `--hook` is the pre-commit hook: it rewrites a stale snapshot and exits 1 so the
author stages it, and only warns if the parser fails, leaving that to the CI check.
"""

from __future__ import annotations

import argparse
import json
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from tools.seer_nav.entries import NavEntry
from tools.seer_nav.parser import check_alias_sources, parse_nav_entries
from tools.seer_nav.summary import NavSummary, summarize_nav

REPO_ROOT = Path(__file__).resolve().parents[2]
SNAPSHOT_PATH = REPO_ROOT / "src/sentry/seer/nav_snapshot.generated.json"
SNAPSHOT_VERSION = 1

UPDATE_COMMANDS = (
    "  python -m tools.seer_nav.generate_snapshot\n"
    "  git add src/sentry/seer/nav_snapshot.generated.json"
)
STALE_MESSAGE = (
    "Seer nav snapshot is out of date: this change touches pages Seer links to.\n"
    f"Update it with:\n{UPDATE_COMMANDS}"
)
REGENERATED_MESSAGE = (
    "Seer nav snapshot was out of date: this change touches pages Seer links to.\n"
    "It has been regenerated. Stage it and commit again:\n"
    "  git add src/sentry/seer/nav_snapshot.generated.json"
)


def _entry_key(entry: NavEntry) -> str:
    return json.dumps(entry.to_dict(), sort_keys=True, ensure_ascii=False)


def _read_snapshot(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text()) if path.exists() else {"entries": []}


def _changes(old: dict[str, Any], entries: Sequence[NavEntry], summary: NavSummary) -> list[str]:
    """`+`/`-` for each added or removed entry, `~` for each changed summary field."""
    old_keys = {json.dumps(e, sort_keys=True, ensure_ascii=False) for e in old["entries"]}
    new_keys = {_entry_key(e) for e in entries}
    old_summary = old.get("summary", {})
    return [
        *(f"+ {key}" for key in sorted(new_keys - old_keys)),
        *(f"- {key}" for key in sorted(old_keys - new_keys)),
        *(f"~ summary.{k}" for k, v in sorted(summary.items()) if old_summary.get(k) != v),
    ]


def _write_snapshot(entries: Sequence[NavEntry], summary: NavSummary, path: Path) -> None:
    payload = {
        "version": SNAPSHOT_VERSION,
        "entries": [e.to_dict() for e in entries],
        "summary": summary,
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")


def refresh_snapshot(
    entries: Sequence[NavEntry], summary: NavSummary, path: Path = SNAPSHOT_PATH
) -> list[str]:
    """Rewrite the snapshot if its entries or summary changed; return what changed."""
    changes = _changes(_read_snapshot(path), entries, summary)
    if changes:
        _write_snapshot(entries, summary, path)
    return changes


def parse_checkout(repo_root: Path = REPO_ROOT) -> tuple[list[NavEntry], NavSummary]:
    app_dir = str(repo_root / "static/app")
    check_alias_sources(app_dir)
    entries = parse_nav_entries(app_dir, str(repo_root / "static/gsApp"))
    if not entries:
        raise SystemExit("Parsed no nav entries; the frontend layout may have changed.")
    return entries, summarize_nav(app_dir)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--check",
        action="store_true",
        help="Write nothing; exit 1 if the snapshot no longer matches the frontend source.",
    )
    mode.add_argument(
        "--hook",
        action="store_true",
        help="Rewrite a stale snapshot and exit 1; only warn if the frontend can't be parsed.",
    )
    args = parser.parse_args(argv)

    if args.hook:
        try:
            entries, summary = parse_checkout()
        except (Exception, SystemExit) as e:
            # A broken parser must not block unrelated commits; the CI check still fails.
            print(f"Could not regenerate the Seer nav snapshot: {e}\n{STALE_MESSAGE}")
            return 0
        changes = refresh_snapshot(entries, summary, SNAPSHOT_PATH)
        if changes:
            print("\n".join(changes))
            print(f"\n{REGENERATED_MESSAGE}")
            return 1
        return 0

    entries, summary = parse_checkout()
    if args.check:
        changes = _changes(_read_snapshot(SNAPSHOT_PATH), entries, summary)
        if changes:
            print("\n".join(changes))
            print(f"\n{STALE_MESSAGE}")
            return 1
        print("Seer nav snapshot is up to date.")
        return 0

    changes = refresh_snapshot(entries, summary, SNAPSHOT_PATH)
    if not changes:
        print("Seer nav snapshot is up to date.")
        return 0
    print("\n".join(changes))
    print(f"\nWrote {len(entries)} entries to {SNAPSHOT_PATH.relative_to(REPO_ROOT)}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

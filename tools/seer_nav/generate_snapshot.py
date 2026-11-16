"""Regenerate Seer's nav snapshot from this checkout's frontend source.

    python -m tools.seer_nav.generate_snapshot [--check]

Seer links users to the Sentry pages listed in the snapshot, so it must change whenever a
nav page is added, renamed, moved or gated differently. Without `--check` it rewrites the
snapshot when its pages changed; with `--check` it writes nothing and exits 1 if stale.
"""

from __future__ import annotations

import argparse
import json
from collections.abc import Sequence
from pathlib import Path

from tools.seer_nav.entries import NavEntry
from tools.seer_nav.parser import check_alias_sources, parse_nav_entries

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


def _entry_key(entry: NavEntry) -> str:
    return json.dumps(entry.to_dict(), sort_keys=True, ensure_ascii=False)


def _snapshot_keys(path: Path) -> set[str]:
    if not path.exists():
        return set()
    return {
        json.dumps(e, sort_keys=True, ensure_ascii=False)
        for e in json.loads(path.read_text())["entries"]
    }


def _entry_changes(old: set[str], new: set[str]) -> list[str]:
    return [f"+ {key}" for key in sorted(new - old)] + [f"- {key}" for key in sorted(old - new)]


def _write_snapshot(entries: Sequence[NavEntry], path: Path) -> None:
    payload = {"version": SNAPSHOT_VERSION, "entries": [e.to_dict() for e in entries]}
    path.write_text(json.dumps(payload, indent=1, ensure_ascii=False) + "\n")


def refresh_snapshot(entries: Sequence[NavEntry], path: Path = SNAPSHOT_PATH) -> list[str]:
    """Rewrite the snapshot if its entries changed; return the `+`/`-` changed entries."""
    changes = _entry_changes(_snapshot_keys(path), {_entry_key(e) for e in entries})
    if changes:
        _write_snapshot(entries, path)
    return changes


def parse_checkout(repo_root: Path = REPO_ROOT) -> list[NavEntry]:
    app_dir = str(repo_root / "static/app")
    check_alias_sources(app_dir)
    entries = parse_nav_entries(app_dir, str(repo_root / "static/gsApp"))
    if not entries:
        raise SystemExit("Parsed no nav entries; the frontend layout may have changed.")
    return entries


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "--check",
        action="store_true",
        help="Write nothing; exit 1 if the snapshot no longer matches the frontend source.",
    )
    args = parser.parse_args(argv)

    entries = parse_checkout()
    if args.check:
        changes = _entry_changes(_snapshot_keys(SNAPSHOT_PATH), {_entry_key(e) for e in entries})
        if changes:
            print("\n".join(changes))
            print(f"\n{STALE_MESSAGE}")
            return 1
        print("Seer nav snapshot is up to date.")
        return 0

    changes = refresh_snapshot(entries)
    if not changes:
        print("Seer nav snapshot is up to date.")
        return 0
    print("\n".join(changes))
    print(f"\nWrote {len(entries)} entries to {SNAPSHOT_PATH.relative_to(REPO_ROOT)}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

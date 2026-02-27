#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

LARGE_SELECTION_THRESHOLD = 300


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: confirm-test-selection.py <selected-tests-file>", file=sys.stderr)
        return 1

    selected_tests_path = Path(sys.argv[1])

    if not selected_tests_path.exists():
        print(f"Selected tests file not found: {selected_tests_path}", file=sys.stderr)
        return 1

    selected_files = [
        line.strip() for line in selected_tests_path.read_text().splitlines() if line.strip()
    ]
    count = len(selected_files)

    if count == 0:
        prompt = (
            "The full test suite will be run, usually due to a change in a file that triggers the full suite (see logs above).\n"
            "Continue? [y/N] "
        )
    elif count >= LARGE_SELECTION_THRESHOLD:
        prompt = f"{count} test files selected, a large amount to run locally. Continue? [y/N] "
    else:
        print(f"{count} test files selected")
        return 0

    try:
        response = input(prompt).strip().lower()
    except (EOFError, KeyboardInterrupt):
        print("\nAborted.")
        return 1

    if response in ("y", "yes"):
        return 0

    print("Aborted.")
    return 2


if __name__ == "__main__":
    sys.exit(main())

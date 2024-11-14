from __future__ import annotations

import collections
import subprocess
import sys


def main() -> int:
    out = subprocess.run(
        (sys.executable, "-m", "tools.mypy_helpers.mypy_without_ignores", *sys.argv[1:]),
        capture_output=True,
    )
    counts: collections.Counter[str] = collections.Counter()
    for line in out.stdout.decode().splitlines():
        filename, _, _ = line.partition(":")
        if filename.endswith(".py"):
            counts[filename] += 1

    vals = [(count, fname) for fname, count in counts.most_common()]
    vals.sort(reverse=True)
    for count, fname in vals:
        print(f"{count}\t{fname}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

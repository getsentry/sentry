from __future__ import annotations

import subprocess
import sys


def main() -> int:
    cmd = (sys.executable, "-m", "tools.mypy_helpers.mypy_without_ignores", *sys.argv[1:])
    out = subprocess.run(cmd, stdout=subprocess.PIPE)
    for line in out.stdout.decode().splitlines():
        if line.endswith('Unused "type: ignore" comment'):
            fname, n, *_ = line.split(":")

            subprocess.check_call(
                (
                    "sed",
                    "-i",
                    "-r",
                    rf"{n}s/# type: ?ignore[^#]*(#|$)/\1/g",
                    fname,
                )
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

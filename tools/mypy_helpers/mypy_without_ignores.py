from __future__ import annotations

import os.path
import subprocess
import sys
import tempfile


def main() -> int:
    with open("pyproject.toml") as f:
        src = f.read()
        msg = "sentry modules with typing issues"
        before, begin, rest = src.partition(f"# begin: {msg}\n")
        _, end, rest = rest.partition(f"# end: {msg}\n")

    with tempfile.TemporaryDirectory() as tmpdir:
        cfg = os.path.join(tmpdir, "mypy.toml")
        with open(cfg, "w") as f:
            f.write(before + begin + end + rest)

        return subprocess.call(("mypy", "--config", cfg, *sys.argv[1:]))


if __name__ == "__main__":
    raise SystemExit(main())

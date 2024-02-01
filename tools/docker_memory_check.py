from __future__ import annotations

import argparse
import json
import os.path
import sys
from typing import Sequence


def should_use_color(setting: str) -> bool:
    # normally I would use `sys.stdout.isatty()` however direnv always pipes this
    return setting == "always" or (setting == "auto" and not os.environ.get("CI"))


def color(s: str, color: str, *, use_color: bool) -> str:
    if use_color:
        return f"{color}{s}\033[m"
    else:
        return s


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--settings-file",
        default=os.path.expanduser("~/Library/Group Containers/group.com.docker/settings.json"),
        help=argparse.SUPPRESS,
    )
    parser.add_argument(
        "--memory-minimum",
        default=8092,
        type=int,
        help="the minimum amount of allocated memory to warn for.  default: %(default)s (MiB)",
    )
    parser.add_argument(
        "--color",
        choices=("always", "never", "auto"),
        default="auto",
        help="whether to use color.  default: %(default)s (auto is determined by CI environment variable)",
    )
    args = parser.parse_args(argv)

    use_color = should_use_color(args.color)

    try:
        with open(args.settings_file) as f:
            contents = json.load(f)
    except (json.JSONDecodeError, OSError):
        return 0  # file didn't exist or was not json

    try:
        configured = contents["memoryMiB"]
    except KeyError:
        return 0  # configuration did not look like what we expected

    if not isinstance(configured, int):
        return 0  # configuration did not look like what we expected

    if configured < args.memory_minimum:
        msg = f"""\
WARNING: docker is configured with less than the recommended minimum memory!
- open Docker.app and adjust the memory in Settings -> Resources
- current memory (MiB): {configured}
- recommended minimum (MiB): {args.memory_minimum}
"""
        print(color(msg, "\033[33m", use_color=use_color), end="", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

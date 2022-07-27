from __future__ import annotations

import argparse
import re
from typing import Sequence

# from tools.lib import gitroot


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("file", nargs="+", type=argparse.FileType("r+"), help="github actions file")
    args = parser.parse_args(argv)
    files = args.file

    ACTION_VERSION_RE = re.compile(r"(?<=uses: )(?P<action>.*)@(?P<version>.+)")
    for file in files:
        # newlines = []
        for line in file:
            if "uses:" in line and "@" in line:
                m = ACTION_VERSION_RE.search(line)
                if not m:
                    continue
                action = m.group(1)
                version = m.group(2)
                print(action, version)
                # line = SENTRY_VERSION_SHA_RE.sub(sha, line)
            # newlines.append(line)
        # f.seek(0)
        # f.truncate()
        # f.writelines(newlines)

    raise SystemExit(1)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

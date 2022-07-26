from __future__ import annotations

import argparse

from tools.lib import gitroot


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("file", nargs="+", type=argparse.FileType('w'), help="github actions file")
    args = parser.parse_args(argv)
    files = args.file

    # file.name

    raise SystemExit(1)

    return 0

if __name__ == "__main__":
    raise SystemExit(main())

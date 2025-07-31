from __future__ import annotations

from collections.abc import Sequence

import tomllib


def main(argv: Sequence[str] | None = None) -> int:
    with open("pyproject.toml", "rb") as f:
        pyproject = tomllib.load(f)
        dev_group = pyproject["dependency-groups"]["dev"]
        pyproject["optional-dependencies"]["dev"] = dev_group

    # oh.. we can't write this back lol

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

import argparse
import subprocess
import tomllib
from collections.abc import Sequence


def _module_ignores_modules(data: dict[str, object]) -> frozenset[str]:
    try:
        overrides = data["tool"]["mypy"]["overrides"]  # type: ignore[index]
    except KeyError:
        return frozenset()
    ignores = [cfg for cfg in overrides if "disable_error_code" in cfg]
    if not ignores:
        return frozenset()
    if len(ignores) > 1:
        raise SystemExit(
            "pyproject.toml has multiple [tool.mypy.overrides] sections with "
            "disable_error_code; expected exactly one module ignores list."
        )
    return frozenset(ignores[0]["module"])


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Prevent new additions to the mypy module ignores list."
    )
    parser.add_argument("filenames", nargs="*")
    args = parser.parse_args(argv)

    retv = 0
    for filename in args.filenames:
        result = subprocess.run(
            ["git", "show", f"HEAD:{filename}"],
            capture_output=True,
        )
        if result.returncode != 0:
            # File is new (not in HEAD); nothing to compare against.
            continue

        head_data = tomllib.loads(result.stdout.decode())
        head_modules = _module_ignores_modules(head_data)

        with open(filename, "rb") as f:
            staged_data = tomllib.load(f)
        staged_modules = _module_ignores_modules(staged_data)

        for mod in sorted(staged_modules - head_modules):
            print(
                f"{filename}: '{mod}' was added to the mypy module ignores list — "
                f"do not add new modules; fix the typing issues instead."
            )
            retv = 1

    return retv


if __name__ == "__main__":
    raise SystemExit(main())

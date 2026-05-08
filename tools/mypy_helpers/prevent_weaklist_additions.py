from __future__ import annotations

import argparse
import subprocess
import tomllib
from collections.abc import Sequence


def _modules_for_override_key(data: dict[str, object], key: str, filename: str) -> frozenset[str]:
    try:
        overrides = data["tool"]["mypy"]["overrides"]  # type: ignore[index]
    except KeyError:
        return frozenset()
    matching = [cfg for cfg in overrides if key in cfg]
    if not matching:
        return frozenset()
    if len(matching) > 1:
        raise SystemExit(
            f"{filename}: multiple [tool.mypy.overrides] sections with "
            f"{key!r}; expected exactly one."
        )
    return frozenset(matching[0]["module"])


# (override key, human-readable list name, advice suffix)
_CHECKS = (
    ("disallow_untyped_defs", "mypy weaklist", "fix the typing issues instead"),
    ("disable_error_code", "mypy module ignores list", "fix the type errors instead"),
)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Prevent new additions to mypy override lists.")
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

        with open(filename, "rb") as f:
            staged_data = tomllib.load(f)

        for key, list_name, advice in _CHECKS:
            head_modules = _modules_for_override_key(head_data, key, filename)
            staged_modules = _modules_for_override_key(staged_data, key, filename)
            for mod in sorted(staged_modules - head_modules):
                print(
                    f"{filename}: '{mod}' was added to the {list_name} — "
                    f"do not add new modules; {advice}."
                )
                retv = 1

    return retv


if __name__ == "__main__":
    raise SystemExit(main())

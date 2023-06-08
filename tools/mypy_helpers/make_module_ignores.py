from __future__ import annotations

import shutil
import subprocess
import sys


def main() -> int:
    shutil.rmtree(".mypy_cache", ignore_errors=True)

    filenames = set()
    out = subprocess.run(
        (sys.executable, "-m", "tools.mypy_helpers.mypy_without_ignores", *sys.argv[1:]),
        capture_output=True,
    )
    for line in out.stdout.decode().splitlines():
        filename, _, _ = line.partition(":")
        if filename.endswith(".py"):
            filenames.add(filename)

    mods = []
    for filename in sorted(filenames):
        # TODO: removeprefix / removesuffix python 3.9+
        if filename.endswith(".py"):
            filename = filename[: -len(".py")]
        if filename.startswith("src/"):
            filename = filename[len("src/") :]
        if filename.endswith("/__init__"):
            filename = filename[: -len("/__init__")]
        mods.append(filename.replace("/", "."))
    mods_s = "".join(f'    "{mod}",\n' for mod in mods)
    generated = (
        f"# - remove the module from the list and fix the issues!\n"
        f"# - python3 -m tools.mypy_helpers.find_easiest_modules\n"
        f"[[tool.mypy.overrides]]\n"
        f"module = [\n{mods_s}]\n"
        f"ignore_errors = true\n"
    )
    with open("pyproject.toml") as f:
        src = f.read()
        msg = "sentry modules with typing issues"
        before, begin, rest = src.partition(f"# begin: {msg}\n")
        _, end, rest = rest.partition(f"# end: {msg}\n")
    with open("pyproject.toml", "w") as f:
        f.write(before + begin + generated + end + rest)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

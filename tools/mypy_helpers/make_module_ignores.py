from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys


def main() -> int:
    shutil.rmtree(".mypy_cache", ignore_errors=True)

    out = subprocess.run(
        (sys.executable, "-m", "tools.mypy_helpers.mypy_without_ignores", "--output=json"),
        capture_output=True,
        text=True,
    )

    codes = set()
    filenames = set()
    os.makedirs(".artfifacts", exist_ok=True)
    with open(".artifacts/mypy-all", "w") as f:
        errors = 0
        for line in out.stdout.splitlines():
            e = json.loads(line)

            if e["file"].endswith(".py"):
                filenames.add(e["file"])
            if e["severity"] == "error":
                errors += 1
                codes.add(e["code"])
                codepart = f' [{e["code"]}]'
            else:
                codepart = ""

            f.write(f'{e["file"]}:{e["line"]}: {e["severity"]}: {e["message"]}{codepart}\n')
        f.write(f"Found {errors} in {len(filenames)} files\n")

    mods = []
    for filename in sorted(filenames):
        filename = filename.removesuffix(".py").removesuffix("/__init__").removeprefix("src/")
        mods.append(filename.replace("/", "."))
    mods_s = "".join(f'    "{mod}",\n' for mod in mods)
    codes_s = "".join(f'    "{code}",\n' for code in sorted(codes))
    generated = (
        f"# - remove the module from the list and fix the issues!\n"
        f"# - python3 -m tools.mypy_helpers.find_easiest_modules\n"
        f"[[tool.mypy.overrides]]\n"
        f"module = [\n{mods_s}]\n"
        f"disable_error_code = [\n{codes_s}]\n"
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

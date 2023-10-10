from __future__ import annotations

import os.path
import re
import shutil
import subprocess
import sys
import tempfile

# Examples:
# Cannot find implementation or library stub for module named "codeowners"
# Skipping analyzing "uwsgidecorators": module is installed, but missing library stubs or py.typed marker
PAT = re.compile('(?:library stub for module named |Skipping analyzing )"([^"]+)"')


def _format_mods(mods: list[str]) -> str:
    return "".join(f'    "{mod}",\n' for mod in mods)


def main() -> int:
    shutil.rmtree(".mypy_cache", ignore_errors=True)

    with open("pyproject.toml") as f:
        contents = f.read()
        msg_stubs = "missing 3rd party stubs"
        before, stubs_begin, rest = contents.partition(f"# begin: {msg_stubs}\n")
        _, stubs_end, rest = rest.partition(f"# end: {msg_stubs}\n")

        msg_ignore = "sentry modules with typing issues"
        between, ignore_begin, rest = rest.partition(f"# begin: {msg_ignore}\n")
        ignore, ignore_end, rest = rest.partition(f"# end: {msg_ignore}\n")

    with tempfile.TemporaryDirectory() as tmpdir:
        cfg = os.path.join(tmpdir, "mypy.toml")
        with open(cfg, "w") as f:
            f.write(before + stubs_begin + stubs_end + between + ignore_begin + ignore_end + rest)

        seen = set()
        out = subprocess.run(("mypy", "--config", cfg, *sys.argv[1:]), capture_output=True)
        for line in out.stdout.decode().splitlines():
            match = PAT.search(line)
            if match is not None and match[1] not in seen:
                seen.add(match[1])

    mods: list[str] = []
    for mod in sorted(seen):
        if not mods or not mod.startswith(f"{mods[-1]}."):
            mods.append(mod)
    mods_s = "".join(f'    "{mod}.*",\n' for mod in mods)
    stubs = (
        f"# - add .pyi files to fixtures/stubs-for-mypy\n"
        f"# - or find a 3rd party stub\n"
        f"[[tool.mypy.overrides]]\n"
        f"module = [\n{mods_s}]\n"
        f"ignore_missing_imports = true\n"
    )
    with open("pyproject.toml", "w") as f:
        f.write(
            before
            + stubs_begin
            + stubs
            + stubs_end
            + between
            + ignore_begin
            + ignore
            + ignore_end
            + rest
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

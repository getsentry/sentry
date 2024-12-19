from __future__ import annotations

import os.path
import re
import subprocess
import sys

ERROR_RE = re.compile(r".*error:.*\[([^]]+)\]$")


def main() -> int:
    with open("pyproject.toml") as f:
        contents = f.read()

    rest = contents
    b1, m1, rest = rest.partition("# begin: stronger typing\n")
    b2, m2, rest = rest.partition("module = [\n")
    b3, m3, rest = rest.partition("]\n")
    b4, m4, rest = rest.partition("# end: stronger typing\n")

    out = subprocess.run(
        (sys.executable, "-m", "mypy", "--disallow-untyped-defs", "--disallow-any-generics"),
        capture_output=True,
    )
    non_strict = set()
    for line in out.stdout.decode().splitlines():
        filename, _, _ = line.partition(":")
        match = ERROR_RE.match(line)
        if match is not None and filename.endswith(".py"):
            non_strict.add(filename)

    strict_mods = []
    for root in (
        *(os.path.join("src", d) for d in os.listdir("src")),
        "fixtures",
        "tests",
        "tools",
    ):
        all_files_out = subprocess.check_output(("git", "ls-files", "--", f"{root}/**.py"))
        all_files = frozenset(all_files_out.decode().splitlines())
        strict = all_files - non_strict

        for fname in sorted(strict, key=lambda s: s.count("/")):
            if fname not in strict:  # already processed!
                continue

            dname = os.path.dirname(fname)
            fnames_in_dname = {fname for fname in all_files if fname.startswith(f"{dname}/")}
            if fnames_in_dname & strict == fnames_in_dname:
                strict -= fnames_in_dname
                strict |= {f"{dname}/*"}

        for s in strict:
            if os.path.exists(s) and os.stat(s).st_size == 0:
                continue

            s = s.removeprefix("src/")
            s = s.removesuffix("/__init__.py")
            s = s.removesuffix(".py")
            s = s.replace("/", ".")
            strict_mods.append(s)

    b3 = "".join(f'    "{mod}",\n' for mod in sorted(strict_mods))
    new_contents = b1 + m1 + b2 + m2 + b3 + m3 + b4 + m4 + rest

    with open("pyproject.toml", "w") as f:
        f.write(new_contents)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

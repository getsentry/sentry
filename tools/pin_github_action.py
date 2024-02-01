from __future__ import annotations

import argparse
import re
import subprocess
from functools import lru_cache
from typing import Sequence

ACTION_VERSION_RE = re.compile(r"(?<=uses: )(?P<action>.*)@(?P<ref>[^#\s]+)")


@lru_cache(maxsize=None)
def get_sha(repo: str, ref: str) -> str:
    if len(ref) == 40:
        try:
            int(ref, 16)
        except ValueError:
            pass
        else:
            return ref

    cmd = ("git", "ls-remote", "--exit-code", f"https://github.com/{repo}", ref)
    out = subprocess.check_output(cmd)
    for line in out.decode().splitlines():
        sha, refname = line.split()
        if refname in (f"refs/tags/{ref}", f"refs/heads/{ref}"):
            return sha
    else:
        raise AssertionError(f"unknown ref: {repo}@{ref}")


def extract_repo(action: str) -> str:
    # Some actions can be like `github/codeql-action/init`,
    # where init is just a directory. The ref is for the whole repo.
    # We only want the repo name though.
    parts = action.split("/")
    return f"{parts[0]}/{parts[1]}"


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("files", nargs="+", type=str, help="path to github actions file")
    args = parser.parse_args(argv)

    for fp in args.files:
        with open(fp, "r+") as f:
            newlines = []
            for line in f:
                m = ACTION_VERSION_RE.search(line)
                if not m:
                    newlines.append(line)
                    continue
                d = m.groupdict()
                sha = get_sha(extract_repo(d["action"]), ref=d["ref"])
                if sha != d["ref"]:
                    line = ACTION_VERSION_RE.sub(rf"\1@{sha} # \2", line)
                newlines.append(line)
            f.seek(0)
            f.truncate()
            f.writelines(newlines)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

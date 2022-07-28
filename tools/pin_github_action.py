from __future__ import annotations

import argparse
import json
import os
import re
import urllib.request
from functools import lru_cache
from typing import Sequence
from urllib.error import HTTPError


@lru_cache(maxsize=None)
def get_sha(repo: str, ref: str, github_token: str) -> str:
    if len(ref) == 40:
        try:
            int(ref, 16)
            return ref
        except ValueError:
            pass

    try:
        resp = urllib.request.urlopen(
            urllib.request.Request(
                f"https://api.github.com/repos/{repo}/commits/{ref}",
                method="GET",
                headers={
                    "Accept": "application/vnd.github+json",
                    "Authorization": f"token {github_token}",
                    # A user agent is required. Lol.
                    "User-Agent": "python-requests/2.26.0",
                },
            )
        )
    except HTTPError as e:
        print(f"Status {e.code} while resolving {ref} for {repo}.")
        if e.code == 403:
            print("You most likely didn't authorize your token for SAML to the getsentry org.")
        return ref

    data: dict[str, str] = json.load(resp)
    return data["sha"]


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

    GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
    if not GITHUB_TOKEN:
        raise SystemExit("GITHUB_TOKEN not set.")

    ACTION_VERSION_RE = re.compile(r"(?<=uses: )(?P<action>.*)@(?P<ref>.+?)\b")
    for fp in args.files:
        with open(fp, "r+") as f:
            newlines = []
            for line in f:
                m = ACTION_VERSION_RE.search(line)
                if not m:
                    newlines.append(line)
                    continue
                d = m.groupdict()
                sha = get_sha(extract_repo(d["action"]), ref=d["ref"], github_token=GITHUB_TOKEN)
                if sha != d["ref"]:
                    line = ACTION_VERSION_RE.sub(rf"\1@{sha}  # \2", line)
                newlines.append(line)
            f.seek(0)
            f.truncate()
            f.writelines(newlines)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

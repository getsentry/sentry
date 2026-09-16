#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# ///
"""Classify files in a large Scraps migration PR.

Usage:
    uv run classify_pr_files.py [PR] [--mark-viewed]

PR may be a getsentry/sentry PR number or URL. When omitted, the script uses
the pull request for the current branch. Successful runs emit JSON to stdout.
"""

from __future__ import annotations

import argparse
import hashlib
import json  # noqa: S003
import re
import secrets
import subprocess
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor  # noqa: S016
from typing import Any

REPOSITORY = "getsentry/sentry"
PR_URL_PREFIX = f"https://github.com/{REPOSITORY}/pull/"
FROM_MODULE_RE = re.compile(
    r"^\s*(?:"
    r"import\s+(?!\()[^;]*?\bfrom|"
    r"export\s+(?:type\s+)?(?:\{.*\}|\*(?:\s+as\s+\w+)?)\s+from|"
    r"}\s+from"
    r")\s+"
    r"(?P<quote>['\"])(?P<module>[^'\"]+)(?P=quote)"
)
SIDE_EFFECT_IMPORT_RE = re.compile(r"^\s*import\s+(?P<quote>['\"])(?P<module>[^'\"]+)(?P=quote)")

KNOWN_NOISE_FILES = {".github/codeowners-coverage-baseline.txt"}
KNOWN_NOISE_PREFIXES = ("tests/js/sentry-test/snapshots/mocks/",)


class GhError(RuntimeError):
    """Raised when an authenticated GitHub CLI request fails."""


def run_gh_json(args: list[str]) -> Any:
    result = subprocess.run(
        ["gh", *args],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise GhError(f"gh command failed with exit status {result.returncode}")

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise GhError("gh command returned invalid JSON") from error


def resolve_pr(pr: str | None) -> int:
    if pr is None:
        data = run_gh_json(["pr", "view", "--repo", REPOSITORY, "--json", "number"])
        number = data.get("number") if isinstance(data, dict) else None
        if not isinstance(number, int):
            raise GhError("could not resolve a pull request for the current branch")
        return number

    if pr.isdigit():
        return int(pr)

    if pr.startswith(PR_URL_PREFIX):
        number = pr[len(PR_URL_PREFIX) :].split("/", 1)[0]
        if number.isdigit():
            return int(number)

    raise ValueError(f"PR must be a {REPOSITORY} pull request number or URL")


def get_pr_files(pr: int) -> list[dict[str, Any]]:
    pages = run_gh_json(
        [
            "api",
            "--paginate",
            "--slurp",
            f"repos/{REPOSITORY}/pulls/{pr}/files?per_page=100",
        ]
    )
    if not isinstance(pages, list) or any(not isinstance(page, list) for page in pages):
        raise GhError("GitHub returned an unexpected pull request files response")

    files = [file for page in pages for file in page]
    if any(not isinstance(file, dict) for file in files):
        raise GhError("GitHub returned invalid pull request file metadata")
    return files


def get_pr_metadata(pr: int) -> dict[str, Any]:
    data = run_gh_json(
        [
            "pr",
            "view",
            str(pr),
            "--repo",
            REPOSITORY,
            "--json",
            "changedFiles,headRefOid,id",
        ]
    )
    if (
        not isinstance(data, dict)
        or not isinstance(data.get("id"), str)
        or not isinstance(data.get("headRefOid"), str)
        or not isinstance(data.get("changedFiles"), int)
    ):
        raise GhError("GitHub returned incomplete pull request metadata")
    return data


def find_destination_dirs(files: list[dict[str, Any]]) -> set[str]:
    destination_dirs: set[str] = set()
    prefix = "static/app/components/core/"

    for file in files:
        path = file.get("filename")
        previous_path = file.get("previous_filename")
        if (
            file.get("status") != "renamed"
            or not isinstance(path, str)
            or not path.startswith(prefix)
            or not isinstance(previous_path, str)
            or previous_path.startswith(prefix)
        ):
            continue

        component = path[len(prefix) :].split("/", 1)[0]
        if component:
            destination_dirs.add(f"{prefix}{component}/")

    return destination_dirs


def normalize_module_line(line: str) -> tuple[str, str] | None:
    for pattern in (FROM_MODULE_RE, SIDE_EFFECT_IMPORT_RE):
        match = pattern.search(line)
        if match:
            start, end = match.span("module")
            return f"{line[:start]}<module>{line[end:]}", match.group("module")
    return None


def is_import_path_only(patch: str) -> bool:
    removed = [
        line[1:]
        for line in patch.splitlines()
        if line.startswith("-") and not line.startswith("---") and line[1:].strip()
    ]
    added = [
        line[1:]
        for line in patch.splitlines()
        if line.startswith("+") and not line.startswith("+++") and line[1:].strip()
    ]
    if not removed or not added:
        return False

    normalized_removed = [normalize_module_line(line) for line in removed]
    normalized_added = [normalize_module_line(line) for line in added]
    if any(line is None for line in normalized_removed + normalized_added):
        return False

    removed_lines = Counter(line[0] for line in normalized_removed if line is not None)
    added_lines = Counter(line[0] for line in normalized_added if line is not None)
    removed_modules = Counter(line[1] for line in normalized_removed if line is not None)
    added_modules = Counter(line[1] for line in normalized_added if line is not None)
    return removed_lines == added_lines and removed_modules != added_modules


def classify_file(file: dict[str, Any], destination_dirs: set[str]) -> dict[str, str]:
    path = file.get("filename")
    if not isinstance(path, str) or not path:
        raise GhError("GitHub returned a pull request file without a valid filename")

    if any(path.startswith(directory) for directory in destination_dirs):
        return {"path": path, "classification": "substantive", "reason": "destination-dir"}

    if path in KNOWN_NOISE_FILES or path.startswith(KNOWN_NOISE_PREFIXES):
        return {"path": path, "classification": "noise", "reason": "known-noise-file"}

    changes = file.get("changes")
    if file.get("status") == "renamed" and changes == 0:
        return {"path": path, "classification": "noise", "reason": "pure-rename"}

    patch = file.get("patch")
    if not isinstance(patch, str):
        return {"path": path, "classification": "substantive", "reason": "patch-unavailable"}

    if is_import_path_only(patch):
        return {"path": path, "classification": "noise", "reason": "import-path-only"}

    return {
        "path": path,
        "classification": "substantive",
        "reason": "has-substantive-changes",
    }


def mark_files_viewed(pr_node_id: str, paths: list[str]) -> list[str]:
    query = """
        mutation MarkFileViewed($pullRequestId: ID!, $path: String!) {
          markFileAsViewed(input: {pullRequestId: $pullRequestId, path: $path}) {
            pullRequest { id }
          }
        }
    """

    def mark_one(path: str) -> str | None:
        result = subprocess.run(
            [
                "gh",
                "api",
                "graphql",
                "-f",
                f"query={query}",
                "-f",
                f"pullRequestId={pr_node_id}",
                "-f",
                f"path={path}",
            ],
            capture_output=True,
            text=True,
        )
        return None if result.returncode == 0 else path

    with ThreadPoolExecutor(max_workers=10) as pool:
        return [path for path in pool.map(mark_one, paths) if path is not None]


def make_approval_token(head_sha: str, paths: list[str]) -> str:
    payload = json.dumps(
        {"head_sha": head_sha, "noise_paths": sorted(paths)},
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def run(
    pr_argument: str | None,
    mark_viewed: bool,
    supplied_approval_token: str | None = None,
) -> tuple[dict[str, Any], int]:
    pr = resolve_pr(pr_argument)
    initial_metadata = get_pr_metadata(pr)
    pr_files = get_pr_files(pr)
    current_metadata = get_pr_metadata(pr)
    if initial_metadata["headRefOid"] != current_metadata["headRefOid"]:
        raise GhError("pull request changed while it was being classified; run again")
    if len(pr_files) != current_metadata["changedFiles"]:
        raise GhError(
            "GitHub returned an incomplete pull request file list "
            f"({len(pr_files)} of {current_metadata['changedFiles']})"
        )

    destination_dirs = find_destination_dirs(pr_files)
    files = [classify_file(file, destination_dirs) for file in pr_files]
    noise = [file for file in files if file["classification"] == "noise"]
    substantive = [file for file in files if file["classification"] == "substantive"]
    noise_paths = [file["path"] for file in noise]
    approval_token = make_approval_token(current_metadata["headRefOid"], noise_paths)

    failed_to_mark: list[str] = []
    if mark_viewed:
        if supplied_approval_token is None or not secrets.compare_digest(
            supplied_approval_token, approval_token
        ):
            raise ValueError(
                "approval token does not match the current PR head and noise files; "
                "classify again and request approval"
            )
        if noise:
            failed_to_mark = mark_files_viewed(current_metadata["id"], noise_paths)

    marked_viewed = len(noise) - len(failed_to_mark) if mark_viewed else 0
    output = {
        "status": "partial" if failed_to_mark else "success",
        "repository": REPOSITORY,
        "pr": pr,
        "head_sha": current_metadata["headRefOid"],
        "approval_token": approval_token,
        "summary": {
            "total": len(files),
            "noise": len(noise),
            "substantive": len(substantive),
            "marked_viewed": marked_viewed,
            "failed_to_mark": len(failed_to_mark),
        },
        "substantive": substantive,
        "noise": noise,
        "failed_to_mark": failed_to_mark,
    }
    return output, 1 if failed_to_mark else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Classify files in a Scraps migration PR")
    parser.add_argument("pr", nargs="?", help="getsentry/sentry PR number or URL")
    parser.add_argument(
        "--mark-viewed",
        action="store_true",
        help="Mark files classified as noise as viewed on GitHub",
    )
    parser.add_argument(
        "--approval-token",
        help="Token from the exact classification result approved by the user",
    )
    args = parser.parse_args()

    try:
        output, exit_code = run(args.pr, args.mark_viewed, args.approval_token)
    except (GhError, ValueError) as error:
        output = {"status": "error", "error": str(error)}
        exit_code = 1

    print(json.dumps(output, indent=2))  # noqa: S002, T201
    return exit_code


if __name__ == "__main__":
    sys.exit(main())

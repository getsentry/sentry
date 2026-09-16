# /// script
# requires-python = ">=3.10"
# ///
"""Classify PR files as noise (import-only) or substantive for scraps migration PRs."""

import json  # noqa: S003
import re
import subprocess
import sys


def get_pr_diff(pr: str, repo: str) -> str:
    result = subprocess.run(
        ["gh", "pr", "diff", pr, "--repo", repo],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout


def get_pr_node_id(pr: str, repo: str) -> str:
    result = subprocess.run(
        ["gh", "pr", "view", pr, "--repo", repo, "--json", "id", "--jq", ".id"],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def parse_file_diffs(diff: str) -> dict[str, list[str]]:
    """Split a unified diff into per-file hunks."""
    files: dict[str, list[str]] = {}
    current_file = None
    current_lines: list[str] = []

    for line in diff.splitlines():
        if line.startswith("diff --git"):
            if current_file:
                files[current_file] = current_lines
            match = re.search(r" b/(.+)$", line)
            current_file = match.group(1) if match else None
            current_lines = [line]
        elif current_file is not None:
            current_lines.append(line)

    if current_file:
        files[current_file] = current_lines
    return files


NOISE_PATTERNS = [
    # import path changes: 'sentry/components/foo' -> '@sentry/scraps/foo'
    re.compile(r"^[-+]\s*(import\b|from\s+['\"]|}\s+from\s+['\"])"),
    # blank lines
    re.compile(r"^[-+]\s*$"),
]

KNOWN_NOISE_FILES = [
    ".github/codeowners-coverage-baseline.txt",
    "tests/js/sentry-test/snapshots/",
]


def find_destination_dir(file_diffs: dict[str, list[str]]) -> str | None:
    """Detect the scraps core destination directory from rename pairs."""
    for path, lines in file_diffs.items():
        if "static/app/components/core/" in path:
            for line in lines:
                if line.startswith("rename from"):
                    parts = path.split("/")
                    # e.g. static/app/components/core/dropdownMenu/
                    idx = parts.index("core") + 2
                    return "/".join(parts[:idx]) + "/"
    return None


def is_noise(path: str, lines: list[str], destination_dir: str | None) -> tuple[bool, str]:
    """Determine whether a file's diff is mechanical noise."""
    # Files in the destination directory are always substantive
    if destination_dir and path.startswith(destination_dir):
        return False, "destination-dir"

    for pattern in KNOWN_NOISE_FILES:
        if path.startswith(pattern) or path == pattern:
            return True, "known-noise-file"

    # Pure renames with no content changes
    added = [ln for ln in lines if ln.startswith("+") and not ln.startswith("+++")]
    removed = [ln for ln in lines if ln.startswith("-") and not ln.startswith("---")]
    if not added and not removed:
        return False, "pure-rename"

    # Check if all added/removed lines are import statements or blank
    for line in added + removed:
        content = line[1:]  # strip the +/- prefix
        if not content.strip():
            continue
        if any(p.match(line) for p in NOISE_PATTERNS):
            continue
        return False, "has-substantive-changes"

    return True, "import-only"


def mark_files_viewed(pr_node_id: str, paths: list[str]) -> int:
    from concurrent.futures import ThreadPoolExecutor  # noqa: S016

    def mark_one(path: str) -> bool:
        query = (
            "mutation { markFileAsViewed(input: "
            f'{{pullRequestId: "{pr_node_id}", path: "{path}"}}'
            ") { pullRequest { id } } }"
        )
        result = subprocess.run(
            ["gh", "api", "graphql", "-f", f"query={query}"],
            capture_output=True,
            text=True,
        )
        return result.returncode == 0

    with ThreadPoolExecutor(max_workers=10) as pool:
        results = list(pool.map(mark_one, paths))
    return sum(results)


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Classify PR files for scraps review")
    parser.add_argument("pr", help="PR number or URL")
    parser.add_argument("--repo", default="getsentry/sentry")
    parser.add_argument(
        "--mark-viewed", action="store_true", help="Mark noise files as viewed on GitHub"
    )
    parser.add_argument("--json", dest="as_json", action="store_true")
    args = parser.parse_args()

    pr = args.pr
    # Extract PR number from URL
    url_match = re.search(r"github\.com/([^/]+/[^/]+)/pull/(\d+)", pr)
    if url_match:
        args.repo = url_match.group(1)
        pr = url_match.group(2)

    diff = get_pr_diff(pr, args.repo)
    file_diffs = parse_file_diffs(diff)

    noise_files: list[dict] = []
    substantive_files: list[dict] = []

    destination_dir = find_destination_dir(file_diffs)

    for path, lines in file_diffs.items():
        is_noise_file, reason = is_noise(path, lines, destination_dir)
        entry = {"path": path, "reason": reason}
        if is_noise_file:
            noise_files.append(entry)
        else:
            substantive_files.append(entry)

    marked = 0
    if args.mark_viewed and noise_files:
        pr_node_id = get_pr_node_id(pr, args.repo)
        marked = mark_files_viewed(pr_node_id, [f["path"] for f in noise_files])

    result = {
        "noise": noise_files,
        "substantive": substantive_files,
        "noise_count": len(noise_files),
        "substantive_count": len(substantive_files),
        "marked_viewed": marked,
    }

    out = sys.stdout.write
    if args.as_json:
        out(json.dumps(result, indent=2) + "\n")
    else:
        out(f"Noise files ({len(noise_files)}):\n")
        for f in noise_files:
            out(f"  {f['path']}  ({f['reason']})\n")
        out(f"\nSubstantive files ({len(substantive_files)}):\n")
        for f in substantive_files:
            out(f"  {f['path']}  ({f['reason']})\n")
        if marked:
            out(f"\nMarked {marked} noise files as viewed on GitHub.\n")


if __name__ == "__main__":
    main()

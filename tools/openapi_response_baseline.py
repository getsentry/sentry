"""Records the undocumented responses a test run found in the OpenAPI response baseline.

Run the tests with SENTRY_OPENAPI_RESPONSE_CHECK=report first. Each pytest process writes a
report, and this merges them. Only the entries of endpoint methods the run's tests called are
replaced, so running one test file updates that file's endpoints and leaves the rest alone.
A replaced entry keeps its reviewed status, reason and first_seen.

The entries have the API guidelines exceptions.json shape, so they can move there later.
"""

from __future__ import annotations

import argparse
import json  # noqa: S003 - tools run without the sentry package
import sys
from datetime import date
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
# src/sentry/testutils/pytest/openapi_responses.py writes the reports and reads the baseline
REPORT_DIR = REPO_ROOT / ".artifacts/openapi-response-check"
BASELINE_PATH = REPO_ROOT / "tests/apidocs/openapi-response-baseline.json"

Signature = tuple[str, str, str, str]


def _signature(item: dict[str, object]) -> Signature:
    return (str(item["rule"]), str(item["path"]), str(item["scope"]), str(item["key"]))


def merge(
    reports: list[dict[str, Any]], old_entries: list[dict[str, object]], today: str
) -> list[dict[str, object]]:
    """The baseline entries after a test run
    `reports` the report-*.json files of the run
    `old_entries` the current baseline's entries
    `today` the first_seen of a new entry
    Returns the entries sorted by signature
    """
    exercised = {(path, scope) for report in reports for path, scope in report["exercised"]}
    old = {_signature(entry): entry for entry in old_entries}
    entries = {
        signature: entry
        for signature, entry in old.items()
        if (signature[1], signature[2]) not in exercised
    }
    for report in reports:
        for finding in report["findings"]:
            signature = _signature(finding)
            if signature in entries:
                continue
            entries[signature] = old.get(signature) or {
                "rule": signature[0],
                "path": signature[1],
                "scope": signature[2],
                "key": signature[3],
                # one undocumented response of one endpoint method, however many tests got it
                "count": 1,
                "owner": finding["owner"],
                "status": "debt-breaking",
                "reason": f"legacy: predates {signature[0]}",
                "first_seen": today,
            }
    return [entries[signature] for signature in sorted(entries)]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "reports", nargs="*", type=Path, help=f"report files (default: {REPORT_DIR}/report-*.json)"
    )
    parser.add_argument("--output", type=Path, default=BASELINE_PATH)
    parser.add_argument("--date", default=date.today().isoformat())
    args = parser.parse_args(argv)

    paths: list[Path] = args.reports or sorted(REPORT_DIR.glob("report-*.json"))
    if not paths:
        print(
            "No reports. Run the tests with SENTRY_OPENAPI_RESPONSE_CHECK=report first.",
            file=sys.stderr,
        )
        return 1
    reports = [json.loads(path.read_text()) for path in paths]
    old_entries = json.loads(args.output.read_text())["entries"] if args.output.exists() else []

    entries = merge(reports, old_entries, args.date)
    args.output.write_text(
        json.dumps({"version": 1, "generated": args.date, "entries": entries}, indent=2) + "\n"
    )

    old = {_signature(entry) for entry in old_entries}
    new = {_signature(entry) for entry in entries}
    print(f"{args.output} has {len(entries)} entries: {len(new - old)} new, {len(old - new)} fixed")
    for label, signatures in (("new", new - old), ("fixed", old - new)):
        for rule, path, scope, key in sorted(signatures):
            print(f"    {label:5}  {rule} {path} {scope} {key}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

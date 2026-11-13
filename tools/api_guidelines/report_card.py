from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

from tools.api_guidelines.owners import UNOWNED, owner_for
from tools.api_guidelines.rules import STRUCTURED_RULES, ApiRule
from tools.api_guidelines.scan import collect_findings
from tools.flake8_plugin import ApiInputViolation

OWNER_MAP_PATH = Path(".artifacts/api-endpoint-owners.json")
_REPO_ROOT = Path(__file__).resolve().parents[2]

# (team, path, finding): a finding with the team that owns it, worked out once in main()
OwnedFinding = tuple[str, str, ApiInputViolation]


def rule_columns() -> list[str]:
    """The rules to show as columns: the ones that report structured output, in ApiRule order
    Returns rule codes like ["S025", "S026", "S027", "S028"]
    """
    columns: list[str] = []
    for rule in ApiRule:
        if rule in STRUCTURED_RULES:
            columns.append(str(rule))
    return columns


def rules_without_structured_output() -> list[str]:
    """The API rules the report card can't count yet, since they report straight to flake8
    Returns rule codes like ["S021", "S022", "S023", "S034"]
    """
    rules: list[str] = []
    for rule in ApiRule:
        if rule not in STRUCTURED_RULES:
            rules.append(str(rule))
    return rules


def find_owners(
    findings: list[tuple[str, ApiInputViolation]], owner_map: dict[str, dict[str, str]]
) -> list[OwnedFinding]:
    """Finds the team of every finding, so the rest of the report card uses one answer
    `findings` every (path, finding) pair from the scan
    `owner_map` {path: {class name: owner}}, from `make api-owner-map`
    Returns a (team, path, finding) triple per finding, in the scan's order
    """
    owned: list[OwnedFinding] = []
    for path, finding in findings:
        owned.append((owner_for(path, finding.scope, finding.caller, owner_map), path, finding))
    return owned


def known_teams(owner_map: dict[str, dict[str, str]]) -> set[str]:
    """Every team in the owner map, plus unowned
    `owner_map` {path: {class name: owner}}, from `make api-owner-map`
    Returns the set of team names a --team can be
    """
    teams = {UNOWNED}
    for owners in owner_map.values():
        for team in owners.values():
            teams.add(team)
    return teams


def count_by_team(owned: list[OwnedFinding]) -> tuple[dict[str, Counter[str]], dict[str, set[str]]]:
    """Counts each team's findings per rule, and the files they're in
    `owned` every finding with its team, from find_owners
    Returns ({team: Counter of rule -> findings}, {team: set of file paths})
    """
    rules_per_team: dict[str, Counter[str]] = {}
    files_per_team: dict[str, set[str]] = {}

    for team, path, finding in owned:
        if team not in rules_per_team:
            rules_per_team[team] = Counter()
            files_per_team[team] = set()
        rules_per_team[team][str(finding.rule)] += 1
        files_per_team[team].add(path)

    return rules_per_team, files_per_team


def team_order(rules_per_team: dict[str, Counter[str]]) -> list[str]:
    """Teams by most findings first, with unowned always last (even with 0 findings)
    `rules_per_team` {team: Counter of rule -> findings}
    Returns the team names in the order to print them
    """
    teams = []
    for team in rules_per_team:
        if team != UNOWNED:
            teams.append(team)

    def total(team: str) -> tuple[int, str]:
        # most findings first, then by name so ties are in a stable order
        return (-sum(rules_per_team[team].values()), team)

    teams.sort(key=total)
    teams.append(UNOWNED)
    return teams


def format_table(owned: list[OwnedFinding], markdown: bool) -> list[str]:
    """The report card table, one row per team plus a total row
    `owned` every finding with its team, from find_owners
    `markdown` True for a markdown table (for docs and PR comments), False for plain text
    Returns the table's lines
    """
    columns = rule_columns()
    rules_per_team, files_per_team = count_by_team(owned)

    header = ["team", "total"] + columns + ["files"]
    rows: list[list[str]] = []
    for team in team_order(rules_per_team):
        rules = rules_per_team.get(team, Counter())
        row = [team, str(sum(rules.values()))]
        for rule in columns:
            row.append(str(rules[rule]))
        row.append(str(len(files_per_team.get(team, set()))))
        rows.append(row)

    total_row = ["total", str(len(owned))]
    all_files = set()
    for _team, path, _finding in owned:
        all_files.add(path)
    for rule in columns:
        rule_total = 0
        for rules in rules_per_team.values():
            rule_total += rules[rule]
        total_row.append(str(rule_total))
    total_row.append(str(len(all_files)))
    rows.append(total_row)

    lines: list[str] = []
    if markdown:
        lines.append("| " + " | ".join(header) + " |")
        separator = ["---"]
        for _column in header[1:]:
            separator.append("---:")
        lines.append("| " + " | ".join(separator) + " |")
        for row in rows:
            lines.append("| " + " | ".join(row) + " |")
        return lines

    # plain text: the team column is as wide as the longest name, the number columns are right-aligned
    width = len("team")
    for row in rows:
        width = max(width, len(row[0]))
    lines.append(_text_row(header, width))
    for row in rows:
        lines.append(_text_row(row, width))
    return lines


def _text_row(row: list[str], width: int) -> str:
    """One plain-text table row: the team left-aligned, the numbers right-aligned"""
    text = row[0].ljust(width)
    for cell in row[1:]:
        text += cell.rjust(7)
    return text


def team_findings(owned: list[OwnedFinding], team: str) -> list[str]:
    """One team's findings, one line each, sorted by file and line
    `owned` every finding with its team, from find_owners
    `team` the team to list, i.e "issues-feed" or "unowned"
    Returns lines like "src/sentry/x.py:12  S026  query:id  in ExampleEndpoint.get"
    """
    mine: list[tuple[str, ApiInputViolation]] = []
    for finding_team, path, finding in owned:
        if finding_team == team:
            mine.append((path, finding))

    def position(pair: tuple[str, ApiInputViolation]) -> tuple[str, int]:
        return (pair[0], pair[1].line)

    mine.sort(key=position)

    lines: list[str] = []
    for path, finding in mine:
        lines.append(f"{path}:{finding.line}  {finding.rule}  {finding.key}  in {finding.scope}")
    return lines


def main(argv: list[str] | None = None) -> int:
    """Prints the API report card: every team's API rule findings, per rule
    `argv` the CLI arguments. None means use the real ones (tests pass their own list)
    Returns 0 when the report was printed, and 1 when the owner map is missing or --team is unknown
    """
    parser = argparse.ArgumentParser(description="Print every team's API rule findings.")
    parser.add_argument("--owner-map", type=Path, default=_REPO_ROOT / OWNER_MAP_PATH)
    parser.add_argument("--team", help="list this team's findings instead of the table")
    parser.add_argument("--format", choices=["text", "markdown"], default="text")
    args = parser.parse_args(argv)

    if not args.owner_map.exists():
        print(
            f"{args.owner_map} not found. Run `make api-owner-map` first (needs Redis: `devservices up`).",
            file=sys.stderr,
        )
        return 1

    owner_map: dict[str, dict[str, str]] = json.loads(args.owner_map.read_text())

    # a misspelled team would otherwise print "0 findings", which looks like a clean team
    teams = known_teams(owner_map)
    if args.team and args.team not in teams:
        print(
            f"Unknown team {args.team!r}. Teams in the owner map: {', '.join(sorted(teams))}",
            file=sys.stderr,
        )
        return 1

    owned = find_owners(collect_findings(_REPO_ROOT), owner_map)

    if args.team:
        lines = team_findings(owned, args.team)
        print(f"{len(lines)} findings owned by {args.team}")
        for line in lines:
            print(line)
        return 0

    # the owner map has no date inside it, so its file's modification time is when it was made
    generated = datetime.fromtimestamp(args.owner_map.stat().st_mtime).strftime("%Y-%m-%d %H:%M")
    unowned = 0
    for team, _path, _finding in owned:
        if team == UNOWNED:
            unowned += 1
    print(f"API report card: {len(owned)} findings")
    print(f"owner map generated {generated}, {unowned} findings unowned")
    print(f"Not reporting structured output yet: {', '.join(rules_without_structured_output())}")
    print()

    for line in format_table(owned, markdown=args.format == "markdown"):
        print(line)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

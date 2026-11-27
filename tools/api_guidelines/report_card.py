from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

from tools.api_guidelines.entries import EXCEPTIONS_PATH, describe_entry, diff_entries
from tools.api_guidelines.owners import UNOWNED
from tools.api_guidelines.rules import BASELINED_RULES, RULES, ApiRule, RuleSource
from tools.api_guidelines.scan import collect_findings
from tools.api_guidelines.signature import BaselineSignature

_REPO_ROOT = Path(__file__).resolve().parents[2]

# one entry of exceptions.json, i.e {"rule": "S026", "path": ..., "scope": ..., "key": ..., "count": 2, "owner": ...}
Entry = dict[str, object]


def rule_columns() -> list[str]:
    """The rules to show as columns: the ones kept in exceptions.json, in ApiRule order
    Returns rule codes like ["S025", "S026", "S027", "S028"]
    """
    columns: list[str] = []
    for rule in ApiRule:
        if rule in BASELINED_RULES:
            columns.append(str(rule))
    return columns


def rules_not_in_baseline() -> list[ApiRule]:
    """The flake8 API rules the report card can't count, since exceptions.json has no baseline
    Returns rule codes like ["S021", "S022", "S023", "S034"]. The OpenAPI response rules are left
    out, since their findings have their own baseline and will be merged later on
    """
    rules: list[ApiRule] = []
    for rule in ApiRule:
        if rule not in BASELINED_RULES and RULES[rule].source == RuleSource.FLAKE8:
            rules.append(rule)
    return rules


def read_exceptions(path: Path) -> dict[str, object] | None:
    """Reads an exceptions.json file
    `path` the file to read, i.e api_exceptions/exceptions.json
    Returns the file's {"version", "generated", "entries"} dict, or None when the file doesn't exist
    """
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(data, dict)
    return data


def file_entries(data: dict[str, object]) -> list[Entry]:
    """The entries of a file read by read_exceptions"""
    entries = data["entries"]
    assert isinstance(entries, list)
    return entries


def entry_count(entry: Entry) -> int:
    """How many findings an entry stands for"""
    count = entry["count"]
    assert isinstance(count, int)
    return count


def entry_owner(entry: Entry) -> str:
    """The team that owns an entry"""
    return str(entry["owner"])


def total_findings(entries: list[Entry]) -> int:
    """Adds up the count of every entry"""
    total = 0
    for entry in entries:
        total += entry_count(entry)
    return total


def known_teams(entries: list[Entry]) -> set[str]:
    """Every team that owns an entry, plus unowned
    `entries` every entry in exceptions.json
    Returns the set of team names a --team can be
    """
    teams = {UNOWNED}
    for entry in entries:
        teams.add(entry_owner(entry))
    return teams


def count_by_team(entries: list[Entry]) -> tuple[dict[str, Counter[str]], dict[str, set[str]]]:
    """Counts each team's findings per rule, and the files they're in
    `entries` every entry in exceptions.json
    Returns ({team: Counter of rule -> findings}, {team: set of file paths})
    """
    rules_per_team: dict[str, Counter[str]] = {}
    files_per_team: dict[str, set[str]] = {}

    for entry in entries:
        team = entry_owner(entry)
        if team not in rules_per_team:
            rules_per_team[team] = Counter()
            files_per_team[team] = set()
        rules_per_team[team][str(entry["rule"])] += entry_count(entry)
        files_per_team[team].add(str(entry["path"]))

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


def format_table(entries: list[Entry], markdown: bool) -> list[str]:
    """The report card table, one row per team plus a total row
    `entries` every entry in exceptions.json
    `markdown` True for a markdown table (for docs and PR comments), False for plain text
    Returns the table's lines
    """
    columns = rule_columns()
    rules_per_team, files_per_team = count_by_team(entries)

    header = ["team", "total"] + columns + ["files"]
    rows: list[list[str]] = []
    for team in team_order(rules_per_team):
        rules = rules_per_team.get(team, Counter())
        row = [team, str(sum(rules.values()))]
        for rule in columns:
            row.append(str(rules[rule]))
        row.append(str(len(files_per_team.get(team, set()))))
        rows.append(row)

    total_row = ["total", str(total_findings(entries))]
    all_files = set()
    for entry in entries:
        all_files.add(str(entry["path"]))
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


def format_legend(markdown: bool) -> list[str]:
    """What each rule column in the table means -> one line per column
    `markdown` True for a markdown list, False for plain text
    Returns lines like "S026  query or body param read without a declared serializer"
    """
    lines: list[str] = []
    for rule in rule_columns():
        summary = RULES[ApiRule(rule)].summary
        if markdown:
            lines.append(f"- `{rule}` {summary}")
        else:
            lines.append(f"{rule}  {summary}")
    return lines


def _signature(entry: Entry) -> BaselineSignature:
    """An entry's signature, to match it with the findings of a rescan"""
    raw_key = entry["key"]
    if raw_key is None:
        key = None
    else:
        key = str(raw_key)
    return BaselineSignature(
        rule=ApiRule(str(entry["rule"])),
        path=str(entry["path"]),
        scope=str(entry["scope"]),
        key=key,
    )


def find_lines(entries: list[Entry], root: Path) -> dict[BaselineSignature, list[int]]:
    """Rescans only the files of `entries` to find the line of each finding in the current code.
    exceptions.json has no lines on purpose, so code moving up or down doesn't change it
    `entries` the entries that will be printed
    `root` the checkout to scan
    Returns {signature: sorted line numbers}. An entry that isn't in the current code has no key
    """
    paths: set[str] = set()
    for entry in entries:
        paths.add(str(entry["path"]))

    lines: dict[BaselineSignature, list[int]] = {}
    for path, finding in collect_findings(root, sorted(paths)):
        signature = BaselineSignature(
            rule=finding.rule, path=path, scope=finding.scope, key=finding.key
        )
        lines.setdefault(signature, []).append(finding.line)
    for found in lines.values():
        found.sort()
    return lines


def _describe_with_lines(entry: Entry, lines: dict[BaselineSignature, list[int]]) -> str:
    """describe_entry with a path:line for each finding, so cmd-click in a terminal opens the line
    `entry` the entry to describe
    `lines` {signature: line numbers} from find_lines
    Returns its description, with the plain path marked when the rescan didn't find it
    """
    found = lines.get(_signature(entry))
    if found is None:
        where = f"{entry['path']} (not in current code)"
    else:
        located: list[str] = []
        for line in found:
            located.append(f"{entry['path']}:{line}")
        where = ", ".join(located)

    # describe_entry is shared with generate_baseline's summary, so only this copy gets the lines
    with_lines = dict(entry)
    with_lines["path"] = where
    return describe_entry(with_lines, with_owner=False)


def team_findings(
    entries: list[Entry], team: str, lines: dict[BaselineSignature, list[int]]
) -> list[str]:
    """One team's entries, one line each, in the file's order (path, scope, rule, key)
    `entries` every entry in exceptions.json
    `team` the team to list, i.e "issues-feed" or "unowned"
    `lines` {signature: line numbers} from find_lines
    Returns lines like "S026 src/sentry/x.py:12, src/sentry/x.py:40 ExampleEndpoint.get query:id (x2)"
    """
    printed: list[str] = []
    for entry in entries:
        if entry_owner(entry) == team:
            printed.append(f"{_describe_with_lines(entry, lines)} (x{entry_count(entry)})")
    return printed


def _owned_by(entries: list[Entry], team: str) -> list[Entry]:
    """The entries `team` owns"""
    owned = []
    for entry in entries:
        if entry_owner(entry) == team:
            owned.append(entry)
    return owned


def format_changes(
    old_entries: list[Entry],
    new_entries: list[Entry],
    team: str | None,
    lines: dict[BaselineSignature, list[int]],
) -> list[str]:
    """The new, fixed and changed-count entries between an older exceptions.json and this one, per team
    `old_entries` every entry in the older file
    `new_entries` every entry in this file
    `team` only show this team's changes, or None for every team
    `lines` {signature: line numbers} from find_lines, for the new and changed entries
    Returns the section's lines, starting with a summary line. Fixed entries are no longer in the
    code so they print their plain path
    """
    added, removed, changed = diff_entries(old_entries, new_entries)

    # a fixed entry belongs to the team that owned it in the older file
    if team is not None:
        added = _owned_by(added, team)
        removed = _owned_by(removed, team)
        kept_changed = []
        for old, new in changed:
            if entry_owner(new) == team:
                kept_changed.append((old, new))
        changed = kept_changed

    # {team: lines}
    per_team: dict[str, list[str]] = {}
    for entry in added:
        line = f"  new      {_describe_with_lines(entry, lines)} (x{entry_count(entry)})"
        per_team.setdefault(entry_owner(entry), []).append(line)
    for entry in removed:
        line = f"  fixed    {describe_entry(entry, with_owner=False)} (x{entry_count(entry)})"
        per_team.setdefault(entry_owner(entry), []).append(line)
    for old, new in changed:
        line = f"  changed  {_describe_with_lines(new, lines)} (x{entry_count(old)} -> x{entry_count(new)})"
        per_team.setdefault(entry_owner(new), []).append(line)

    section = [f"Changes: {len(added)} new, {len(removed)} fixed, {len(changed)} changed count"]
    for owner in sorted(per_team):
        section.append(owner)
        for line in per_team[owner]:
            section.append(line)
    return section


def _display_path(path: Path) -> str:
    """The path relative to the repo root when it's inside it, else as given"""
    try:
        return str(path.resolve().relative_to(_REPO_ROOT))
    except ValueError:
        return str(path)


def main(argv: list[str] | None = None, root: Path = _REPO_ROOT) -> int:
    """Prints the API report card from exceptions.json: every team's findings, per rule
    `argv` the CLI arguments. None means use the real ones (tests pass their own list)
    `root` the checkout rescanned for line numbers. Tests pass a fake repo
    Returns 0 when the report was printed, and 1 when a file is missing or --team is unknown
    """
    parser = argparse.ArgumentParser(
        description="Print every team's API rule findings, read from exceptions.json."
    )
    parser.add_argument(
        "--exceptions",
        type=Path,
        default=_REPO_ROOT / EXCEPTIONS_PATH,
        help=f"the exceptions.json to read (default: {EXCEPTIONS_PATH})",
    )
    parser.add_argument("--team", help="list this team's entries instead of the table")
    parser.add_argument(
        "--format",
        choices=["text", "markdown"],
        default="text",
        help="the table's format (table only, --team and --compare output are always text)",
    )
    parser.add_argument(
        "--compare",
        type=Path,
        metavar="OLDER_JSON",
        help="an older exceptions.json, to also show the new, fixed and changed-count entries since it",
    )
    args = parser.parse_args(argv)

    data = read_exceptions(args.exceptions)
    if data is None:
        print(f"{args.exceptions} not found. Run `make api-baseline` first.", file=sys.stderr)
        return 1
    entries = file_entries(data)

    older = None
    if args.compare is not None:
        older = read_exceptions(args.compare)
        if older is None:
            # make api-baseline only writes the current file, so an older copy comes from git
            print(
                f"{args.compare} not found. Save an older copy first, i.e `git show <ref>:{EXCEPTIONS_PATH} > older.json`.",
                file=sys.stderr,
            )
            return 1

    # a misspelled team would otherwise print "0 findings", which looks like a clean team
    # with --compare a team whose entries were all fixed is only in the older file
    teams = known_teams(entries)
    if older is not None:
        teams |= known_teams(file_entries(older))
    if args.team and args.team not in teams:
        print(
            f"Unknown team {args.team!r}. Teams in {_display_path(args.exceptions)}: {', '.join(sorted(teams))}",
            file=sys.stderr,
        )
        return 1

    header = (
        f"API report card: {_display_path(args.exceptions)}, generated {data['generated']}, "
        f"{len(entries)} entries, {total_findings(entries)} findings"
    )
    if older is not None:
        header += f", since {older['generated']}"
    print(header)
    print(f"Not in exceptions.json (no baseline): {', '.join(rules_not_in_baseline())}")
    print()

    # only the entries that get printed one per line need a line number, so the table alone
    # rescans nothing. The lines come from the current code, not from an older --compare file
    to_locate: list[Entry] = []
    if args.team:
        to_locate += entries
    if older is not None:
        added, _removed, changed = diff_entries(file_entries(older), entries)
        to_locate += added
        for _old, new in changed:
            to_locate.append(new)
    # format_changes only prints the team's entries, so other teams' files don't need a rescan
    if args.team:
        to_locate = _owned_by(to_locate, args.team)
    lines = find_lines(to_locate, root)

    if args.team:
        findings = team_findings(entries, args.team, lines)
        print(f"{len(findings)} entries owned by {args.team}")
        for line in findings:
            print(line)
    else:
        markdown = args.format == "markdown"
        for line in format_table(entries, markdown=markdown):
            print(line)
        # the columns stay as codes so the table is narrow, the legend says what they mean
        print()
        for line in format_legend(markdown=markdown):
            print(line)

    if older is not None:
        print()
        for line in format_changes(file_entries(older), entries, args.team, lines):
            print(line)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

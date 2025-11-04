"""
Compares PostgreSQL database dumps for Sentry schema between two sources, normalizing
irrelevant differences (like constraint names and Django migration tables), and
highlighting only meaningful schema changes. Useful for testing and validating
Django or raw SQL migrations.

This script is typically used in CI to assert that migrations yield the intended
database structure.
"""

import argparse
import collections
import difflib
import hashlib
import re
import sys

CONSTRAINT_RE = re.compile(r"CONSTRAINT ([^ ]+) (.*)")
# Matches ANSI escape sequences (used for terminal color codes), e.g. '\033[31m'
ANSI_ESCAPE_RE = re.compile(r"\033\[[0-9;]*m")


def _constraint_replacement(m: re.Match[str]) -> str:
    meat = m[2]
    h = hashlib.sha256(meat.rstrip(",;").encode()).hexdigest()[:8]
    return rf"CONSTRAINT __c_fake__{h} {meat}"


DJANGO_TABLES = re.compile(
    r"^(?:CREATE|ALTER) TABLE (?:ONLY )?public.django_migrations[^;]*;",
    re.M | re.DOTALL,
)


def _remove_migrations_tables(s: str) -> str:
    return DJANGO_TABLES.sub("", s)


def norm(s: str) -> dict[str, str]:
    dbs: dict[str, list[str]]
    dbs = collections.defaultdict(list)

    db = "ROOT"
    last = ""
    create_table_parts: list[str] = []

    s = _remove_migrations_tables(s)

    for line in s.splitlines(True):
        if line.startswith(r"\connect "):
            _, db = line.split()
        if line.startswith("--"):
            continue
        if last == "\n" and line == "\n":
            continue
        else:
            last = line
        line = CONSTRAINT_RE.sub(_constraint_replacement, line)
        if create_table_parts:
            if line == ");\n":
                dbs[db].append(create_table_parts[0])
                create_table_parts[-1] = create_table_parts[-1].replace("\n", ",\n")
                for part in sorted(create_table_parts[1:]):
                    dbs[db].append(part)
                create_table_parts = []
                dbs[db].append(line)
            else:
                create_table_parts.append(line)
        elif line.startswith("CREATE TABLE "):
            create_table_parts.append(line)
        else:
            dbs[db].append(line)

    return {k: "\n\n".join(sorted("".join(v).split("\n\n"))).strip() for k, v in dbs.items()}


def _is_only_pending_deletion_drift(differences: list[str]) -> bool:
    """
    Detect if drift is only from pending model deletions (step 1 of safe deletion).
    Pending deletion drift has this pattern:
    - Only removals (lines starting with '-'), no additions ('+')
    - Removals are table definitions, indexes, constraints, sequences

    In unified diff format:
    - Lines starting with '-' (but not '---') are removals
    - Lines starting with '+' (but not '+++') are additions
    - Lines starting with ' ' are context lines
    """
    has_removals = False
    has_additions = False

    for line in differences:
        # Skip header lines
        if line.startswith("---") or line.startswith("+++") or line.startswith("@@"):
            continue

        # Remove ANSI color codes for checking
        stripped = ANSI_ESCAPE_RE.sub("", line)

        if stripped.startswith("-") and not stripped.startswith("---"):
            has_removals = True
        elif stripped.startswith("+") and not stripped.startswith("+++"):
            has_additions = True

    # Pending deletion drift = only removals, no additions
    return has_removals and not has_additions


COLOR_GREEN = "\033[32m"
COLOR_RED = "\033[31m"
COLOR_BOLD = "\033[1m"
COLOR_SUBTLE = "\033[2m"
COLOR_YELLOW = "\033[33m"
COLOR_RESET = "\033[m"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("before")
    parser.add_argument("after")
    parser.add_argument("--color", action="store_true", default=sys.stdout.isatty())
    args = parser.parse_args()

    if not args.color:
        global COLOR_GREEN, COLOR_RED, COLOR_BOLD, COLOR_SUBTLE, COLOR_YELLOW, COLOR_RESET
        COLOR_GREEN = COLOR_RED = COLOR_BOLD = COLOR_SUBTLE = COLOR_YELLOW = COLOR_RESET = ""

    with open(args.before) as f:
        before = norm(f.read())

    with open(args.after) as f:
        after = norm(f.read())

    assert frozenset(before) == frozenset(after), (sorted(before), sorted(after))

    differences: list[str] = []

    for k, v in before.items():
        v_after = after[k]
        if v != v_after:
            differences.extend(
                difflib.unified_diff(
                    v.splitlines(True),
                    v_after.splitlines(True),
                    fromfile=f"REAL(dbname={k})",
                    tofile=f"STATE(dbname={k})",
                )
            )

    for i, line in enumerate(differences):
        if line.startswith("---"):
            differences[i] = f"{COLOR_BOLD}{COLOR_RED}{line}{COLOR_RESET}"
        elif line.startswith("+++"):
            differences[i] = f"{COLOR_BOLD}{COLOR_GREEN}{line}{COLOR_RESET}"
        elif line.startswith("-"):
            differences[i] = f"{COLOR_RED}{line}{COLOR_RESET}"
        elif line.startswith("+"):
            differences[i] = f"{COLOR_GREEN}{line}{COLOR_RESET}"

    if differences:
        analyze_differences(differences)
    else:
        return 0


def analyze_differences(differences: list[str]) -> int:
    # Check if this is only pending deletion drift
    if _is_only_pending_deletion_drift(differences):
        print(
            f'{"".join(differences)}\n'
            f"---\n\n"
            f"{COLOR_BOLD}{COLOR_YELLOW}⚠️  Expected schema drift detected{COLOR_RESET}\n\n"
            f"This drift is due to {COLOR_BOLD}step 1 of safe model deletion{COLOR_RESET} (MOVE_TO_PENDING).\n"
            f"Tables are removed from Django's model state but remain in the database.\n\n"
            f"{COLOR_SUBTLE}This is expected and safe. The actual table deletion (step 2) will happen later.{COLOR_RESET}\n\n"
            f"✅ Check passes - no action needed for your PR.\n"
        )
        return 0
    else:
        raise SystemExit(
            f'{"".join(differences)}\n'
            f"---\n\n"
            f"{COLOR_BOLD}{COLOR_RED}❌ migrations drift detected!{COLOR_RESET}\n\n"
            f"{COLOR_SUBTLE}(If this is due to step 1 of the two-step deletion process, it is expected and would pass){COLOR_RESET}\n\n"
            f"^^^ diff printed above ^^^"
        )


if __name__ == "__main__":
    raise SystemExit(main())

import argparse
import collections
import difflib
import hashlib
import re
import sys

CONSTRAINT_RE = re.compile(r"CONSTRAINT ([^ ]+) (.*)")


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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("before")
    parser.add_argument("after")
    parser.add_argument("--color", action="store_true", default=sys.stdout.isatty())
    args = parser.parse_args()

    if args.color:
        green = "\033[32m"
        red = "\033[31m"
        bold = "\033[1m"
        subtle = "\033[2m"
        reset = "\033[m"
    else:
        green = red = bold = subtle = reset = ""

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
            differences[i] = f"{bold}{red}{line}{reset}"
        elif line.startswith("+++"):
            differences[i] = f"{bold}{green}{line}{reset}"
        elif line.startswith("-"):
            differences[i] = f"{red}{line}{reset}"
        elif line.startswith("+"):
            differences[i] = f"{green}{line}{reset}"

    if differences:
        raise SystemExit(
            f'{"".join(differences)}\n'
            f"---\n\n"
            f"{bold}migrations drift detected!{reset}\n\n"
            f"{subtle}(drift due to step 1 of deletion is normal){reset}\n\n"
            f"^^^ diff printed above ^^^"
        )
    else:
        return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Lint: keep fields out of the public schema only on purpose.

drf-spectacular's ``@extend_schema_serializer(exclude_fields=[...])`` drops a
field from the generated OpenAPI document, and that document scaffolds our SDKs
-- so an excluded field is missing from every generated client even though the
API still accepts it. Historically the docs build offered exclusion as one of
three peer fixes for a missing description, so it became the cheap way to quiet
the build rather than a deliberate product decision.

This linter makes the deliberate path the only easy one. It reports:

  1. ``exclude_fields`` on any serializer, unless the entry is in SAFELIST.
     The supported spelling is ``@sentry_schema_serializer(
     omit_from_public_schema={"field": "why"})``, which records a reason.
  2. ``omit_from_public_schema`` entries with a blank reason.
  3. Entries -- either spelling -- naming a field that does not exist on the
     decorated class or its in-file bases. Those exclude nothing.
  4. SAFELIST entries that no longer match anything, so the list cannot rot.

Invoke as:
    python -m sentry.apidocs._check_schema_omissions [paths...]

Exits non-zero on any diagnostic.
"""

from __future__ import annotations

import ast
import sys
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from pathlib import Path

DEFAULT_PATHS = ("src/sentry",)

# Bare ``exclude_fields`` entries that predate omit_from_public_schema and have
# not been converted yet, as "path::Class::field".
#
# This list only ever shrinks. Do NOT add to it: a new field either gets a
# help_text (almost always the right answer) or an omit_from_public_schema entry
# with a reason. Entries are removed as sites convert, and the linter fails on
# any entry here that no longer matches, so it cannot silently rot.
SAFELIST: frozenset[str] = frozenset()


@dataclass(frozen=True)
class Diagnostic:
    path: Path
    line: int
    cls: str
    message: str

    def __str__(self) -> str:
        return f"{self.path}:{self.line} {self.cls}: {self.message}"


def _decorator_name(dec: ast.expr) -> str | None:
    fn = dec.func if isinstance(dec, ast.Call) else dec
    return getattr(fn, "id", getattr(fn, "attr", None))


# Bases that declare no fields of their own, so a class inheriting only from
# these has a fully enumerable field set. Anything else (ModelSerializer,
# CamelSnakeSerializer, project base classes) may contribute fields we cannot
# see from this file.
_EMPTY_ROOTS = frozenset({"Serializer", "TypedDict", "object"})


def _base_name(node: ast.expr) -> str | None:
    """Name of a base class, unwrapping generic subscripts like Serializer[T]."""
    if isinstance(node, ast.Subscript):
        node = node.value
    return node.id if isinstance(node, ast.Name) else getattr(node, "attr", None)


def _class_field_names(cls: ast.ClassDef, classes: dict[str, ast.ClassDef]) -> set[str]:
    """Field names on cls, following bases defined in the same file."""
    names: set[str] = set()
    seen: set[str] = set()
    stack = [cls]
    while stack:
        node = stack.pop()
        if node.name in seen:
            continue
        seen.add(node.name)
        for stmt in node.body:
            if isinstance(stmt, ast.Assign):
                for t in stmt.targets:
                    if isinstance(t, ast.Name):
                        names.add(t.id)
            elif isinstance(stmt, ast.AnnAssign) and isinstance(stmt.target, ast.Name):
                names.add(stmt.target.id)
            elif isinstance(stmt, ast.ClassDef) and stmt.name == "Meta":
                for m in stmt.body:
                    if (
                        isinstance(m, ast.Assign)
                        and isinstance(m.targets[0], ast.Name)
                        and m.targets[0].id == "fields"
                        and isinstance(m.value, (ast.List, ast.Tuple))
                    ):
                        names.update(
                            e.value
                            for e in m.value.elts
                            if isinstance(e, ast.Constant) and isinstance(e.value, str)
                        )
                    elif (
                        isinstance(m, ast.Assign)
                        and isinstance(m.targets[0], ast.Name)
                        and m.targets[0].id == "fields"
                    ):
                        # Meta.fields = "__all__" (or any non-literal): the field set
                        # comes from the model, so we cannot enumerate it
                        names.add("*")
        for base in node.bases:
            bn = _base_name(base)
            if bn in classes:
                stack.append(classes[bn])
            elif bn in _EMPTY_ROOTS or bn is None:
                continue
            else:
                # base defined elsewhere: we cannot enumerate it, so treat the
                # class as open and skip the "field does not exist" check
                names.add("*")
    return names


def check_file(path: Path) -> tuple[list[Diagnostic], set[str]]:
    """Return diagnostics plus the safelist keys this file matched."""
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"))
    except (SyntaxError, UnicodeDecodeError):
        return [], set()

    # module-level only: ast.walk would let a nested class shadow a top-level one
    classes = {n.name: n for n in tree.body if isinstance(n, ast.ClassDef)}
    out: list[Diagnostic] = []
    used: set[str] = set()

    for cls in classes.values():
        for dec in cls.decorator_list:
            if not isinstance(dec, ast.Call):
                continue
            name = _decorator_name(dec)
            if name not in ("extend_schema_serializer", "sentry_schema_serializer"):
                continue
            fields = _class_field_names(cls, classes)
            open_class = "*" in fields

            for kw in dec.keywords:
                if kw.arg == "exclude_fields":
                    entries = _string_entries(kw.value)
                    for field in entries:
                        key = f"{path}::{cls.name}::{field}"
                        if key in SAFELIST:
                            used.add(key)
                        else:
                            out.append(
                                Diagnostic(
                                    path,
                                    dec.lineno,
                                    cls.name,
                                    f"exclude_fields={field!r} has no recorded reason. Add a "
                                    f"help_text to the field, or withhold it deliberately with "
                                    f"@sentry_schema_serializer(omit_from_public_schema="
                                    f'{{{field!r}: "<why>"}}).',
                                )
                            )
                        if not open_class and field not in fields:
                            out.append(
                                Diagnostic(
                                    path,
                                    dec.lineno,
                                    cls.name,
                                    f"exclude_fields={field!r} names no field on this class; "
                                    f"it excludes nothing and should be deleted.",
                                )
                            )

                elif kw.arg == "omit_from_public_schema":
                    if not isinstance(kw.value, ast.Dict):
                        out.append(
                            Diagnostic(
                                path,
                                dec.lineno,
                                cls.name,
                                "omit_from_public_schema must be a {field: reason} mapping.",
                            )
                        )
                        continue
                    for k, v in zip(kw.value.keys, kw.value.values):
                        if not isinstance(k, ast.Constant) or not isinstance(k.value, str):
                            continue
                        field = k.value
                        reason = _joined_str(v)
                        if reason is not None and not reason.strip():
                            out.append(
                                Diagnostic(
                                    path,
                                    dec.lineno,
                                    cls.name,
                                    f"omit_from_public_schema[{field!r}] needs a reason "
                                    f"explaining why the field is not public surface.",
                                )
                            )
                        if not open_class and field not in fields:
                            out.append(
                                Diagnostic(
                                    path,
                                    dec.lineno,
                                    cls.name,
                                    f"omit_from_public_schema[{field!r}] names no field on this "
                                    f"class; it omits nothing and should be deleted.",
                                )
                            )
    return out, used


def _string_entries(node: ast.expr) -> list[str]:
    if isinstance(node, (ast.List, ast.Tuple)):
        return [
            e.value for e in node.elts if isinstance(e, ast.Constant) and isinstance(e.value, str)
        ]
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        # a bare string "works" only by substring match; report it as one entry
        return [node.value]
    return []


def _joined_str(node: ast.expr) -> str | None:
    """Concatenated string literal, or None when not statically a string."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        left, right = _joined_str(node.left), _joined_str(node.right)
        return None if left is None or right is None else left + right
    return None


def iter_files(roots: Iterable[str]) -> Iterator[Path]:
    for root in roots:
        p = Path(root)
        if p.is_file() and p.suffix == ".py":
            yield p
        else:
            yield from sorted(p.rglob("*.py"))


def main(argv: list[str]) -> int:
    roots = argv[1:] if len(argv) > 1 else list(DEFAULT_PATHS)
    diagnostics: list[Diagnostic] = []
    used: set[str] = set()
    for path in iter_files(roots):
        found, matched = check_file(path)
        diagnostics.extend(found)
        used |= matched

    for diagnostic in diagnostics:
        sys.stdout.write(f"{diagnostic}\n")

    stale = SAFELIST - used
    checked_everything = roots == list(DEFAULT_PATHS)
    if stale and checked_everything:
        for key in sorted(stale):
            sys.stdout.write(f"stale SAFELIST entry, delete it: {key}\n")

    if diagnostics or (stale and checked_everything):
        sys.stderr.write(
            "\nFields are withheld from the public schema -- and therefore from every "
            "generated SDK -- only on purpose. Add a help_text, or use "
            "@sentry_schema_serializer(omit_from_public_schema={'field': '<why>'}).\n"
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
